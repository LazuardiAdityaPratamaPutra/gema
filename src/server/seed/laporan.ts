import { b64u, encryptJson, fromHex, randomBytes, toHex, utf8 } from '@gema/crypto';
import { parseWhatsApp } from '@gema/chat-parser';
import { evidenceLeaf } from '@gema/merkle';
import { wrapForSatgas } from '@gema/pq-kem';
import { DEMO_INSTITUTION_ID } from '@/lib/demo';
import { DEMO_SATGAS_PUBLIC } from '@/lib/demo-keys';
import { buildReport } from '@/lib/report-build';
import { AAD_CATATAN } from '@/lib/report-format';
import { blobWrite } from '../db';
import { audit } from '../logic';
import type { DB, Escalation, Report } from '../types';
import { DAY, addBusinessDays, uid } from '../util';
import type { SeedReporter } from './pelapor';
import { SPECS } from './specs';

const inst = DEMO_INSTITUTION_ID;

/** Laporan, bukti terenkripsi, dan eskalasi fiktif; dibangun dengan kode yang sama dengan wizard klien. */
export async function seedReports(
  db: DB,
  now: number,
  reporters: Record<string, SeedReporter>,
  fp: (inputs: string[]) => Promise<string[]>,
) {
  for (const [key, list] of Object.entries(SPECS)) {
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
}
