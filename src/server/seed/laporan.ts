import { b64u, encryptJson, fromHex, randomBytes, toHex, utf8 } from '@gema/crypto';
import { parseWhatsApp, type ParseResult } from '@gema/chat-parser';
import { evidenceLeaf } from '@gema/merkle';
import { wrapForSatgas } from '@gema/pq-kem';
import { DEMO_INSTITUTION_ID } from '@/lib/demo/demo';
import { DEMO_SATGAS_PUBLIC } from '@/lib/demo/demo-keys';
import {
  buildReport,
  type BuiltReport,
  type FileInput,
  type FpFn,
} from '@/lib/laporan/report-build';
import { AAD_CATATAN } from '@/lib/laporan/report-format';
import { blobWrite } from '../db';
import { audit } from '../logic';
import type { DB, Escalation, Report } from '../types';
import { DAY, addBusinessDays, uid } from '../util';
import type { SeedReporter } from './pelapor';
import { SPECS, type Spec } from './specs';

const inst = DEMO_INSTITUTION_ID;

const SENDER_FIELDS = ({ ts, sender, text, attachment }: ParseResult['messages'][number]) => ({
  ts,
  sender,
  text,
  attachment,
});

function filesOf(s: Spec): FileInput[] {
  return s.files.map((f) => ({
    nama: f.nama,
    tipe: f.tipe,
    bytes: utf8(f.text),
    messages: f.chat ? parseWhatsApp(f.text).messages.map(SENDER_FIELDS) : undefined,
  }));
}

function narasiOf(s: Spec) {
  return {
    ...s.teks,
    terlapor: {
      nama: s.nama,
      unitId: s.unitId,
      unitNama: s.unitNama,
      peran: s.attrs.role,
      relasi: s.relasi,
    },
    atribut: s.attrs,
  };
}

/** Laporan dan sidik pencocokan; mengembalikan id laporan. */
function insertReport(db: DB, s: Spec, rep: SeedReporter, built: BuiltReport, created: number) {
  const id = uid(10);
  db.reports[id] = {
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
  } satisfies Report;
  for (const f of built.fingerprints)
    db.fingerprints.push({
      report_id: id,
      varian: f.varian as never,
      tingkat: f.tingkat as never,
      fp_hash: f.fp,
      unit_id: s.unitId,
    });
  return id;
}

async function insertEvidence(db: DB, reportId: string, built: BuiltReport, created: number) {
  for (const e of built.evidence) {
    const eid = uid(10);
    await blobWrite(eid, e.blob);
    db.evidence[eid] = {
      id: eid,
      report_id: reportId,
      sha256_asli: e.sha256,
      message_root: e.messageRoot,
      jumlah_pesan: e.messageCount,
      ukuran: e.blob.length,
      tipe: e.tipe,
      uploaded_at: created,
      leaf: toHex(evidenceLeaf(fromHex(e.sha256), e.messageRoot ? fromHex(e.messageRoot) : null)),
      blob_ready: true,
      anchor_id: null,
    };
  }
}

function newAlias() {
  return (
    'KS-' +
    b64u(randomBytes(5))
      .replace(/[^A-Za-z0-9]/g, '')
      .slice(0, 6)
      .toUpperCase()
      .replace(/[IO01L]/g, 'X')
  );
}

/** Kejadian awal sebuah eskalasi: dibuat, lalu (bila sudah dibuka) status Verifikasi dan satu catatan internal. */
async function pushEscalationEvents(
  db: DB,
  esc: Escalation,
  dek: BuiltReport['dek'],
  escalatedAt: number,
) {
  const base = { escalation_id: esc.id, catatan_ciphertext: null };
  db.events.push({
    ...base,
    id: uid(8),
    actor_role: 'pelapor',
    tipe: 'eskalasi',
    label: `Laporan dieskalasi atas persetujuan pelapor (${esc.sumber}).`,
    at: escalatedAt,
  });
  if (esc.status === 'Diterima') return;
  db.events.push({
    ...base,
    id: uid(8),
    actor_role: 'Ketua',
    tipe: 'status',
    label: 'Status menjadi "Verifikasi".',
    at: escalatedAt + DAY,
  });
  const note = await encryptJson(
    dek,
    {
      teks: 'Pelapor dan terlapor belum dihubungi. Menunggu jadwal klarifikasi dengan unit.',
      penulis: 'Akun demo: Ketua Satgas',
    },
    AAD_CATATAN,
  );
  db.events.push({
    ...base,
    id: uid(8),
    actor_role: 'Ketua',
    tipe: 'catatan',
    label: 'Catatan internal ditambahkan.',
    catatan_ciphertext: b64u(note),
    at: escalatedAt + 2 * DAY,
  });
}

async function insertEscalation(
  db: DB,
  now: number,
  reportId: string,
  built: BuiltReport,
  plan: NonNullable<Spec['escalate']>,
) {
  const escId = uid(10);
  const escalatedAt = now - plan.daysAgo * DAY;
  const wrapped = await wrapForSatgas(built.dek, DEMO_SATGAS_PUBLIC, {
    institutionId: inst,
    escalationId: escId,
  });
  const esc: Escalation = {
    id: escId,
    report_id: reportId,
    institution_id: inst,
    alias: newAlias(),
    sumber: plan.mode,
    dek_wrapped_satgas: wrapped,
    escalated_at: escalatedAt,
    sla_due_at: addBusinessDays(escalatedAt, db.institutions[inst].sla_hari),
    prioritas: !!plan.prioritas,
    status: plan.status,
    tingkat_tangga: 0,
    opened_at: plan.status === 'Diterima' ? null : escalatedAt + DAY,
    selesai_at: null,
  };
  db.escalations[escId] = esc;
  await pushEscalationEvents(db, esc, built.dek, escalatedAt);
  audit(db, 'pelapor-anonim', 'eskalasi', esc.alias, escalatedAt);
}

/** Laporan, bukti terenkripsi, dan eskalasi fiktif; dibangun dengan kode yang sama dengan wizard klien. */
export async function seedReports(
  db: DB,
  now: number,
  reporters: Record<string, SeedReporter>,
  fp: FpFn,
) {
  for (const [key, list] of Object.entries(SPECS)) {
    const rep = reporters[key];
    for (const s of list) {
      const built = await buildReport({
        kek: rep.kek,
        narasi: narasiOf(s),
        attrs: s.attrs,
        files: filesOf(s),
        fp,
      });
      const created = now - s.ageDays * DAY;
      const id = insertReport(db, s, rep, built, created);
      await insertEvidence(db, id, built, created);
      if (s.escalate) await insertEscalation(db, now, id, built, s.escalate);
    }
  }
}
