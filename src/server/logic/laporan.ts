import { fromHex, toHex } from '@gema/crypto';
import { evidenceLeaf } from '@gema/merkle';
import { isValidPublicKey } from '@gema/zk';
import { blobDelete, fpIndex, persist, rebuildIndex } from '../db';
import type { DB, Report, Session } from '../types';
import { HttpError, uid } from '../util';
import { runConditionals } from './eskalasi';
import { institutionOf } from './institusi';

function activeReportsOf(db: DB, reporterId: string): Report[] {
  return Object.values(db.reports).filter((r) => r.reporter_id === reporterId);
}

export function createReport(
  db: DB,
  s: Extract<Session, { kind: 'reporter' }>,
  body: {
    institutionId: string;
    unitId: string;
    k: number;
    secrets: Report['secrets'];
    ownerPub?: string;
    fingerprints: { varian: string; tingkat: string; fp: string }[];
    evidence: {
      clientId: string;
      sha256: string;
      messageRoot: string | null;
      messageCount: number | null;
      tipe: string;
    }[];
  },
) {
  const inst = institutionOf(db, body.institutionId);
  const unit = db.units.find((u) => u.id === body.unitId && u.institution_id === inst.id);
  if (!unit) throw new HttpError(400, 'Unit tidak ada dalam daftar institusi');
  if (activeReportsOf(db, s.reporter_id).length >= 3)
    throw new HttpError(409, 'Maksimal 3 laporan aktif per pelapor.');
  if (!body.secrets?.narasi_ciphertext || !body.secrets?.dek_wrapped_klien)
    throw new HttpError(400, 'Isi laporan tidak lengkap');
  if (!Array.isArray(body.evidence) || body.evidence.length > 10)
    throw new HttpError(400, 'Maksimal 10 berkas bukti');
  const k = Math.min(4, Math.max(2, Math.round(body.k || 2)));

  // Anti self-match: satu pasangan (pelapor, fingerprint) hanya sekali
  const idx = fpIndex();
  const myIds = new Set(activeReportsOf(db, s.reporter_id).map((r) => r.id));
  const fps = (body.fingerprints ?? []).filter(
    (f) =>
      /^[0-9a-f]{64}$/.test(f.fp) &&
      ['V1', 'V2', 'V3', 'V4', 'W1', 'W2', 'S1', 'S2', 'S3'].includes(f.varian),
  );
  for (const f of fps) {
    const hit = idx.get(`${f.tingkat}|${f.fp}`);
    if (hit && [...hit].some((rid) => myIds.has(rid)))
      throw new HttpError(
        409,
        'Kamu sudah memiliki laporan tentang terlapor ini. Satu laporan per terlapor.',
      );
  }

  const id = uid(10);
  const now = Date.now();
  db.reports[id] = {
    id,
    reporter_id: s.reporter_id,
    scope_id: s.scope_id,
    institution_id: inst.id,
    unit_id: unit.id,
    status: 'tersimpan',
    k_threshold: k,
    include_weak: false,
    opt_in: false,
    created_at: now,
    secrets: body.secrets,
    owner_pub: body.ownerPub && isValidPublicKey(body.ownerPub) ? body.ownerPub : undefined,
  };
  for (const f of fps) {
    db.fingerprints.push({
      report_id: id,
      varian: f.varian as never,
      tingkat: f.tingkat as never,
      fp_hash: f.fp,
      unit_id: unit.id,
    });
    const key = `${f.tingkat}|${f.fp}`;
    let set = idx.get(key);
    if (!set) idx.set(key, (set = new Set()));
    set.add(id);
  }
  const evOut: { clientId: string; id: string }[] = [];
  for (const e of body.evidence) {
    if (
      !/^[0-9a-f]{64}$/.test(e.sha256) ||
      (e.messageRoot && !/^[0-9a-f]{64}$/.test(e.messageRoot))
    )
      throw new HttpError(400, 'Hash bukti tidak valid');
    const eid = uid(10);
    db.evidence[eid] = {
      id: eid,
      report_id: id,
      sha256_asli: e.sha256,
      message_root: e.messageRoot ?? null,
      jumlah_pesan: e.messageCount ?? null,
      ukuran: 0,
      tipe: String(e.tipe || 'berkas').slice(0, 60),
      uploaded_at: now,
      leaf: toHex(evidenceLeaf(fromHex(e.sha256), e.messageRoot ? fromHex(e.messageRoot) : null)),
      blob_ready: false,
      anchor_id: null,
    };
    evOut.push({ clientId: e.clientId, id: eid });
  }
  persist(db);
  runConditionals(db, id); // laporan baru bisa memenuhi syarat laporan lain di klaster
  return { reportId: id, evidence: evOut };
}

export async function deleteReport(db: DB, reportId: string) {
  const r = db.reports[reportId];
  if (!r) return;
  for (const e of Object.values(db.evidence).filter((x) => x.report_id === reportId)) {
    await blobDelete(e.id);
    delete db.evidence[e.id];
  }
  for (const esc of Object.values(db.escalations).filter((x) => x.report_id === reportId)) {
    db.events = db.events.filter((ev) => ev.escalation_id !== esc.id);
    delete db.escalations[esc.id];
  }
  db.fingerprints = db.fingerprints.filter((f) => f.report_id !== reportId);
  delete db.reports[reportId];
  rebuildIndex(db);
  persist(db);
}
