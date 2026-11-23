/**
 * Mode Demo (FR-L1 s.d. FR-L6): institusi fiktif "Universitas Contoh", akun Satgas/Pimpinan/Auditor/Pengawas,
 * tiga pelapor fiktif dan data seed yang memperagakan alur simpan → cocokkan → eskalasi → tangani → verifikasi.
 * Semua isi fiktif. Laporan dibangun dengan kode yang sama dengan wizard klien.
 */
import crypto from 'node:crypto';
import {
  authHash,
  b64u,
  deriveAccountKeys,
  encryptJson,
  fromHex,
  normalizeCaseCode,
  padTo,
  randomBytes,
  aesGcmEncrypt,
  utf8,
} from '@gema/crypto';
import { wrapForSatgas } from '@gema/pq-kem';
import { runLocal, deriveInstitutionKey } from '@gema/oprf';
import { parseWhatsApp } from '@gema/chat-parser';
import { complianceSnapshot, bucketize, noisyCount } from '@gema/dp';
import {
  DEMO_ACCOUNTS,
  DEMO_CHAT,
  DEMO_INSTITUTION_ID,
  DEMO_MEMBERS,
  DEMO_NOTE_SAKSI,
  DEMO_PASSWORD,
  DEMO_UNITS,
} from '@/lib/demo';
import { DEMO_SATGAS_PUBLIC } from '@/lib/demo-keys';
import { AAD, AAD_CATATAN, VAULT_SIZE } from '@/lib/report-format';
import { buildReport } from '@/lib/report-build';
import { blobWrite, secretSeed } from './db';
import { audit, sealAnchors, tick } from './logic';
import { demoEnabled } from './demo-flag';
import type { DB, Report, Escalation } from './types';
import { DAY, addBusinessDays, uid } from './util';
import type { Relasi } from '@gema/pendamping';

export function hashPassword(pw: string, salt = crypto.randomBytes(12).toString('hex')): string {
  return `scrypt$${salt}$${crypto.scryptSync(pw, salt, 32).toString('hex')}`;
}
export function checkPassword(pw: string, stored: string): boolean {
  const [, salt, h] = stored.split('$');
  const c = crypto.scryptSync(pw, salt, 32).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(c), Buffer.from(h));
}

type Spec = {
  nama: string;
  unitId: string;
  unitNama: string;
  peran?: 'dosen' | 'tendik' | 'mahasiswa' | 'lainnya';
  attrs: {
    role?: 'dosen' | 'tendik' | 'mahasiswa' | 'lainnya';
    periods?: string[];
    location?: 'kampus' | 'daring' | 'luar-kampus';
  };
  teks: {
    kapan: string;
    dimana: string;
    apa: string;
    saksi: string;
    bukti: string;
    dampak: string;
  };
  files: { nama: string; tipe: string; text: string; chat?: boolean }[];
  ageDays: number;
  escalate?: {
    daysAgo: number;
    status: Escalation['status'];
    mode: 'tunggal' | 'bersama';
    prioritas?: boolean;
  };
  relasi?: Relasi;
};

export async function seedDemo(db: DB) {
  const now = Date.now();
  const inst = DEMO_INSTITUTION_ID;
  db.institutions[inst] = {
    id: inst,
    nama: 'Universitas Contoh',
    kota: 'Kota Fiktif',
    demo: true,
    public_key_satgas: DEMO_SATGAS_PUBLIC,
    sla_hari: 3, // Permendikbudristek 55/2024 Pasal 53: laporan ditindaklanjuti paling lambat 3 hari kerja
    fp_mode: 'oprf',
    papan_publik: true,
    ambang_tangga: { t1: 0, t2: 3, t3: 10 },
    dp_epsilon: 1,
    panel_mode: 'tunggal',
    rujukan: [
      {
        nama: 'Unit Layanan Psikologi Universitas Contoh',
        jenis: 'psikolog',
        kontak: 'Gedung Rektorat lt. 2 · ext. 2210 (fiktif)',
        catatan: 'Gratis untuk mahasiswa dan pegawai',
      },
      {
        nama: 'Lembaga Konsultasi Bantuan Hukum Fakultas Hukum',
        jenis: 'hukum',
        kontak: 'lkbh@contoh.ac.id (fiktif)',
        catatan: 'Pendampingan hukum tanpa biaya',
      },
      { nama: 'Klinik Pratama Kampus', jenis: 'medis', kontak: 'Gedung Klinik · 24 jam (fiktif)' },
    ],
  };
  // Institusi fiktif lain hanya untuk memperagakan Papan Kepatuhan (tanpa unit → tidak bisa dipilih pelapor)
  for (const [id, nama, kota] of [
    ['inst-poli', 'Politeknik Contoh Nusantara', 'Kota Fiktif B'],
    ['inst-itc', 'Institut Teknologi Contoh', 'Kota Fiktif C'],
  ] as const) {
    db.institutions[id] = { ...db.institutions[inst], id, nama, kota, fp_mode: 'hmac' };
  }
  for (const u of DEMO_UNITS) db.units.push({ ...u, institution_id: inst });

  for (const m of DEMO_MEMBERS) {
    const id = uid(6);
    db.members[id] = {
      id,
      institution_id: inst,
      email: m.email,
      nama: m.nama,
      role: m.role,
      // kata sandi publik hanya bila demo aktif; selain itu acak sehingga tidak ada kredensial yang diketahui umum
      pass_hash: hashPassword(
        demoEnabled() ? DEMO_PASSWORD : crypto.randomBytes(18).toString('hex'),
      ),
    };
  }

  const kp = deriveInstitutionKey(secretSeed(), inst);
  const fp = async (inputs: string[]) => runLocal(kp.secretKey, inputs);

  const reporters: Record<string, { id: string; kek: Uint8Array; scope: string }> = {};
  for (const a of DEMO_ACCOUNTS) {
    const keys = await deriveAccountKeys(a.caseCode, a.passphrase);
    const id = uid(10);
    db.reporters[id] = { id, case_code: normalizeCaseCode(a.caseCode), created_at: now - 12 * DAY };
    const real = {
      slot_id: uid(8),
      reporter_id: id,
      scope_id: uid(10),
      auth_hash: authHash(keys.authKey),
      vault_blob: b64u(padTo(await encryptJson(keys.kek, { t: 'real' }, AAD.vault), VAULT_SIZE)),
    };
    const empty = {
      slot_id: uid(8),
      reporter_id: id,
      scope_id: uid(10),
      auth_hash: authHash(randomBytes(32)),
      vault_blob: b64u(randomBytes(VAULT_SIZE)),
    };
    // urutan acak: tidak ada petunjuk slot mana yang nyata
    const order = randomBytes(1)[0] & 1 ? [real, empty] : [empty, real];
    db.slots.push(...order);
    reporters[a.key] = { id, kek: keys.kek, scope: real.scope_id };
  }

  const specs: Record<string, Spec[]> = {
    maya: [
      {
        nama: 'Dr. Hendra Wijaya, M.T.',
        unitId: 'u-ft',
        unitNama: 'Fakultas Teknik',
        attrs: { role: 'dosen', periods: ['2026/2027-ganjil'], location: 'kampus' },
        teks: {
          kapan: 'Akhir Oktober sampai awal November 2026.',
          dimana: 'Pesan WhatsApp dan ruang dosen di gedung Fakultas Teknik.',
          apa: 'Dosen pembimbing berulang kali meminta saya datang sendirian malam hari ke ruangannya dan menahan nilai bila saya menolak. Saya diminta merahasiakannya.',
          saksi: 'Seorang teman melihat saya keluar dari ruang dosen malam itu.',
          bukti: 'Ekspor chat WhatsApp 31 Oktober sampai 1 November.',
          dampak: 'Saya jadi takut bimbingan dan menunda skripsi.',
        },
        files: [{ nama: 'chat-bimbingan.txt', tipe: 'text/plain', text: DEMO_CHAT, chat: true }],
        ageDays: 9,
      },
    ],
    rafi: [
      {
        nama: 'Hendra Wijaya',
        unitId: 'u-ft',
        unitNama: 'Fakultas Teknik',
        attrs: { role: 'dosen', location: 'kampus' },
        teks: {
          kapan: 'Sekitar 2 November 2026, malam hari.',
          dimana: 'Lorong lantai 3 gedung Fakultas Teknik.',
          apa: 'Saya melihat seorang mahasiswi keluar dari ruang dosen dalam keadaan menangis. Dosen tersebut berdiri di pintu dan menutupnya.',
          saksi: 'Tidak ada saksi lain yang saya ketahui.',
          bukti: 'Catatan pribadi saya.',
          dampak: 'Saya khawatir tetapi tidak ingin dihubungi balik.',
        },
        files: [{ nama: 'catatan-saksi.txt', tipe: 'text/plain', text: DEMO_NOTE_SAKSI }],
        ageDays: 5,
      },
    ],
    dewa: [
      {
        nama: 'Bambang Haryono',
        unitId: 'u-fisip',
        unitNama: 'Fakultas Ilmu Sosial dan Politik',
        attrs: { role: 'tendik' },
        teks: {
          kapan: 'Sekitar sebulan lalu.',
          dimana: 'Ruang administrasi fakultas.',
          apa: 'Petugas administrasi mengancam tidak memproses berkas saya bila saya tidak menuruti permintaannya yang membuat saya tidak nyaman. (Data fiktif untuk demo.)',
          saksi: 'Tidak ada.',
          bukti: 'Tidak ada berkas.',
          dampak: 'Saya menunda pengurusan administrasi.',
        },
        files: [
          {
            nama: 'catatan-pribadi.txt',
            tipe: 'text/plain',
            text: 'Catatan pribadi fiktif untuk demo. Tidak berisi data sungguhan.',
          },
        ],
        ageDays: 20,
        escalate: { daysAgo: 16, status: 'Verifikasi', mode: 'tunggal' },
      },
      {
        nama: 'Rina Kusuma',
        unitId: 'u-feb',
        unitNama: 'Fakultas Ekonomi dan Bisnis',
        attrs: { role: 'dosen' },
        teks: {
          kapan: 'Dua pekan lalu.',
          dimana: 'Ruang rapat jurusan.',
          apa: 'Dosen pengampu saya berulang kali berkomentar soal badan saya di depan peserta rapat. Setelah itu dia mengirim pesan jangan bilang siapa-siapa, nilaimu saya urus. (Data fiktif untuk demo.)',
          saksi: 'Beberapa peserta rapat.',
          bukti: 'Tidak ada.',
          dampak: 'Saya merasa tidak aman hadir pada rapat berikutnya.',
        },
        files: [
          {
            nama: 'chat-dosen.txt',
            tipe: 'text/plain',
            chat: true,
            text: '05/11/2026 22.41 - Dosen R: Tadi di rapat kamu cantik banget, bajumu pas di badan kamu\n05/11/2026 22.43 - Saya: Maaf Bu, saya kurang nyaman\n05/11/2026 23.02 - Dosen R: Jangan bilang siapa-siapa ya, nilaimu saya urus\n06/11/2026 08.10 - Dosen R: Besok datang sendiri ke ruangan saya jam 7 malam\n',
          },
        ],
        ageDays: 4,
        escalate: { daysAgo: 2, status: 'Diterima', mode: 'tunggal', prioritas: true },
        relasi: 'pengajar',
      },
    ],
  };

  for (const [key, list] of Object.entries(specs)) {
    const rep = reporters[key];
    for (const s of list) {
      const files = s.files.map((f) => ({
        nama: f.nama,
        tipe: f.tipe,
        bytes: utf8(f.text),
        messages: f.chat
          ? parseWhatsApp(f.text).messages.map(({ ts, sender, text, attachment }) => ({
              ts,
              sender,
              text,
              attachment,
            }))
          : undefined,
      }));
      const built = await buildReport({
        kek: rep.kek,
        narasi: {
          ...s.teks,
          terlapor: {
            nama: s.nama,
            unitId: s.unitId,
            unitNama: s.unitNama,
            peran: s.attrs.role,
            relasi: s.relasi,
          },
          atribut: s.attrs,
        },
        attrs: s.attrs,
        files,
        fp,
      });
      const id = uid(10);
      const created = now - s.ageDays * DAY;
      const report: Report = {
        id,
        reporter_id: rep.id,
        scope_id: rep.scope,
        institution_id: inst,
        unit_id: s.unitId,
        status: s.escalate ? 'tereskalasi' : 'tersimpan',
        k_threshold: 2,
        include_weak: false,
        opt_in: false,
        created_at: created,
        secrets: built.secrets,
      };
      db.reports[id] = report;
      for (const f of built.fingerprints)
        db.fingerprints.push({
          report_id: id,
          varian: f.varian as never,
          tingkat: f.tingkat as never,
          fp_hash: f.fp,
          unit_id: s.unitId,
        });
      const { evidenceLeaf } = await import('@gema/merkle');
      const { toHex } = await import('@gema/crypto');
      for (const e of built.evidence) {
        const eid = uid(10);
        await blobWrite(eid, e.blob);
        db.evidence[eid] = {
          id: eid,
          report_id: id,
          sha256_asli: e.sha256,
          message_root: e.messageRoot,
          jumlah_pesan: e.messageCount,
          ukuran: e.blob.length,
          tipe: e.tipe,
          uploaded_at: created,
          leaf: toHex(
            evidenceLeaf(fromHex(e.sha256), e.messageRoot ? fromHex(e.messageRoot) : null),
          ),
          blob_ready: true,
          anchor_id: null,
        };
      }
      if (s.escalate) {
        const escId = uid(10);
        const escalatedAt = now - s.escalate.daysAgo * DAY;
        const wrapped = await wrapForSatgas(built.dek, DEMO_SATGAS_PUBLIC, {
          institutionId: inst,
          escalationId: escId,
        });
        const esc: Escalation = {
          id: escId,
          report_id: id,
          institution_id: inst,
          alias:
            'KS-' +
            b64u(randomBytes(5))
              .replace(/[^A-Za-z0-9]/g, '')
              .slice(0, 6)
              .toUpperCase()
              .replace(/[IO01L]/g, 'X'),
          sumber: s.escalate.mode,
          dek_wrapped_satgas: wrapped,
          escalated_at: escalatedAt,
          sla_due_at: addBusinessDays(escalatedAt, db.institutions[inst].sla_hari),
          prioritas: !!s.escalate.prioritas,
          status: s.escalate.status,
          tingkat_tangga: 0,
          opened_at: s.escalate.status === 'Diterima' ? null : escalatedAt + DAY,
          selesai_at: null,
        };
        db.escalations[escId] = esc;
        db.events.push({
          id: uid(8),
          escalation_id: escId,
          actor_role: 'pelapor',
          tipe: 'eskalasi',
          label: `Laporan dieskalasi atas persetujuan pelapor (${esc.sumber}).`,
          catatan_ciphertext: null,
          at: escalatedAt,
        });
        if (s.escalate.status !== 'Diterima') {
          db.events.push({
            id: uid(8),
            escalation_id: escId,
            actor_role: 'Ketua',
            tipe: 'status',
            label: 'Status menjadi "Verifikasi".',
            catatan_ciphertext: null,
            at: escalatedAt + DAY,
          });
          const note = await encryptJson(
            built.dek,
            {
              teks: 'Pelapor dan terlapor belum dihubungi. Menunggu jadwal klarifikasi dengan unit.',
              penulis: 'Dr. Sari Wulandari',
            },
            AAD_CATATAN,
          );
          db.events.push({
            id: uid(8),
            escalation_id: escId,
            actor_role: 'Ketua',
            tipe: 'catatan',
            label: 'Catatan internal ditambahkan.',
            catatan_ciphertext: b64u(note),
            at: escalatedAt + 2 * DAY,
          });
        }
        audit(db, 'pelapor-anonim', 'eskalasi', esc.alias, escalatedAt);
      }
    }
  }

  // anchor pertama: seluruh bukti seed
  sealAnchors(db, true, now - 2 * DAY);

  // snapshot Papan Kepatuhan dan Radar (fiktif, berderau; derau ditambahkan sekali saat dibuat)
  const synthetic: Record<string, [number, number, number][]> = {
    // [due, onTime, medianHari] untuk 2026-Q1..Q3
    [inst]: [
      [16, 9, 7],
      [18, 12, 6],
      [24, 19, 4],
    ],
    'inst-poli': [
      [9, 8, 4],
      [11, 7, 6],
      [14, 12, 4],
    ],
    'inst-itc': [
      [30, 17, 8],
      [34, 21, 7],
      [38, 25, 6],
    ],
  };
  for (const [iid, rows] of Object.entries(synthetic)) {
    rows.forEach(([due, ok, med], i) => {
      const s = complianceSnapshot(due, ok, med, db.institutions[iid].dp_epsilon);
      db.compliance.push({
        institution_id: iid,
        kuartal: `2026-Q${i + 1}`,
        enough: s.enough,
        persen: s.percent,
        median_bucket: s.medianBucket,
        jumlah_bucket: bucketize(s.dueNoisy, 5),
        epsilon: db.institutions[iid].dp_epsilon,
        created_at: now - (3 - i) * 30 * DAY,
      });
    });
  }
  const radarTrue: [string, string, number, boolean][] = [
    ['u-ft', 'Fakultas Teknik', 7, true],
    ['u-feb', 'Fakultas Ekonomi dan Bisnis', 3, false],
    ['u-fisip', 'Fakultas Ilmu Sosial dan Politik', 5, true],
    ['u-fk', 'Fakultas Kedokteran', 1, false],
    ['u-bem', 'Unit Kegiatan Mahasiswa', 9, true],
  ];
  for (const [uidU, nama, n, rep] of radarTrue) {
    const noisy = noisyCount(n, 1);
    const b = bucketize(noisy, 3);
    db.radar.push({
      unit_id: uidU,
      unit_nama: nama,
      institution_id: inst,
      periode: '2026-Q3',
      bucket: b,
      pola_berulang: b !== null && rep,
      epsilon: 1,
    });
  }

  db.meta.seededAt = now;
  await tick(db);
}

void aesGcmEncrypt;
