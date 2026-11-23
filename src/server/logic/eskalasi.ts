import { randomBytes } from '@gema/crypto';
import { persist } from '../db';
import type { DB, Escalation, Report, Session } from '../types';
import { HttpError, addBusinessDays, uid } from '../util';
import { audit } from './audit';
import { institutionOf } from './institusi';
import { clusterMembers, matchInfo } from './klaster';
import { nowFor } from './sesi';

const ALIAS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function newAlias(): string {
  let s = 'KS-';
  for (const b of randomBytes(6)) s += ALIAS[b % ALIAS.length];
  return s;
}

export function escalate(
  db: DB,
  s: Extract<Session, { kind: 'reporter' }>,
  reportId: string,
  body: {
    escalationId: string;
    mode: 'bersama' | 'tunggal';
    wrapped: Escalation['dek_wrapped_satgas'];
    prioritas?: boolean;
  },
) {
  const r = db.reports[reportId];
  if (!r || r.reporter_id !== s.reporter_id || r.scope_id !== s.scope_id)
    throw new HttpError(404, 'Laporan tidak ditemukan');
  if (r.status === 'tereskalasi') throw new HttpError(409, 'Laporan ini sudah dieskalasi.');
  if (!body.escalationId || db.escalations[body.escalationId])
    throw new HttpError(409, 'ID eskalasi tidak valid');
  if (!body.wrapped?.blob || !body.wrapped?.ctMlkem)
    throw new HttpError(400, 'Pembungkus kunci tidak lengkap');
  if (body.mode === 'bersama') {
    const mi = matchInfo(db, reportId);
    if (!mi.notify || !r.opt_in || mi.optedIn < 2)
      throw new HttpError(409, 'Eskalasi bersama butuh persetujuan minimal dua pelapor.');
  }
  return createEscalation(db, r, {
    escalationId: body.escalationId,
    sumber: body.mode === 'bersama' ? 'bersama' : 'tunggal',
    wrapped: body.wrapped,
    prioritas: body.prioritas === true,
    label: `Laporan dieskalasi atas persetujuan pelapor (${body.mode === 'bersama' ? 'bersama' : 'tunggal'}).`,
    aktor: 'pelapor-anonim',
  });
}

function createEscalation(
  db: DB,
  r: Report,
  o: {
    escalationId: string;
    sumber: Escalation['sumber'];
    wrapped: Escalation['dek_wrapped_satgas'];
    prioritas: boolean;
    label: string;
    aktor: string;
  },
): Escalation {
  const inst = institutionOf(db, r.institution_id);
  const now = nowFor(db, inst.id);
  const esc: Escalation = {
    id: o.escalationId,
    report_id: r.id,
    institution_id: inst.id,
    alias: newAlias(),
    sumber: o.sumber,
    dek_wrapped_satgas: o.wrapped,
    escalated_at: now,
    sla_due_at: addBusinessDays(now, inst.sla_hari),
    status: 'Diterima',
    prioritas: o.prioritas,
    tingkat_tangga: 0,
    opened_at: null,
    selesai_at: null,
  };
  db.escalations[esc.id] = esc;
  r.status = 'tereskalasi';
  r.conditional = undefined;
  db.events.push({
    id: uid(8),
    escalation_id: esc.id,
    actor_role: 'pelapor',
    tipe: 'eskalasi',
    label: o.label,
    catatan_ciphertext: null,
    at: now,
  });
  audit(db, o.aktor, 'eskalasi', esc.alias, now);
  persist(db);
  return esc;
}

/* ---------- eskalasi bersyarat ---------- */
const MIN_COND = 2;
const MAX_COND = 5;

export function ownedReport(
  db: DB,
  s: Extract<Session, { kind: 'reporter' }>,
  reportId: string,
): Report {
  const r = db.reports[reportId];
  if (!r || r.reporter_id !== s.reporter_id || r.scope_id !== s.scope_id)
    throw new HttpError(404, 'Laporan tidak ditemukan');
  return r;
}

/** Pelapor menyiapkan eskalasi sekarang (kunci sudah dibungkus untuk Satgas) yang baru berjalan bila syarat terpenuhi. */
export function setConditional(
  db: DB,
  s: Extract<Session, { kind: 'reporter' }>,
  reportId: string,
  body: {
    escalationId: string;
    wrapped: Escalation['dek_wrapped_satgas'];
    minSize: number;
    prioritas?: boolean;
  },
) {
  const r = ownedReport(db, s, reportId);
  if (r.status === 'tereskalasi') throw new HttpError(409, 'Laporan ini sudah dieskalasi.');
  if (!body.escalationId || db.escalations[body.escalationId])
    throw new HttpError(409, 'ID eskalasi tidak valid');
  if (!body.wrapped?.blob || !body.wrapped?.ctMlkem)
    throw new HttpError(400, 'Pembungkus kunci tidak lengkap');
  const min = Math.round(Number(body.minSize));
  if (!Number.isFinite(min) || min < MIN_COND || min > MAX_COND)
    throw new HttpError(400, `Syarat harus antara ${MIN_COND} dan ${MAX_COND} pelapor.`);
  r.conditional = {
    escalation_id: body.escalationId,
    wrapped: body.wrapped,
    prioritas: body.prioritas === true,
    min_size: min,
    set_at: Date.now(),
  };
  audit(db, 'pelapor-anonim', 'pasang-eskalasi-bersyarat', r.id.slice(0, 4) + '…');
  const fired = runConditionals(db, r.id);
  persist(db);
  return { fired: fired.includes(r.id) };
}

export function clearConditional(
  db: DB,
  s: Extract<Session, { kind: 'reporter' }>,
  reportId: string,
) {
  const r = ownedReport(db, s, reportId);
  if (!r.conditional) return;
  r.conditional = undefined;
  audit(db, 'pelapor-anonim', 'cabut-eskalasi-bersyarat', r.id.slice(0, 4) + '…');
  persist(db);
}

/**
 * Memeriksa klaster di sekitar laporan: setiap anggota yang punya syarat dan syaratnya terpenuhi
 * dieskalasi atas persetujuan awalnya. Mengembalikan id laporan yang dieskalasi.
 */
export function runConditionals(db: DB, reportId: string): string[] {
  const members = clusterMembers(db, reportId);
  const size = new Set(members.map((m) => m.reporter_id)).size;
  const fired: string[] = [];
  for (const m of members) {
    const c = m.conditional;
    if (!c || m.status !== 'tersimpan' || size < c.min_size) continue;
    createEscalation(db, m, {
      escalationId: c.escalation_id,
      sumber: 'bersama',
      wrapped: c.wrapped,
      prioritas: c.prioritas,
      label: `Dieskalasi otomatis: ${size} pelapor cocok, sesuai syarat yang dipasang pelapor.`,
      aktor: 'sistem-bersyarat',
    });
    fired.push(m.id);
  }
  return fired;
}

export function withdrawEscalation(
  db: DB,
  s: Extract<Session, { kind: 'reporter' }>,
  reportId: string,
) {
  const r = db.reports[reportId];
  if (!r || r.reporter_id !== s.reporter_id || r.scope_id !== s.scope_id)
    throw new HttpError(404, 'Laporan tidak ditemukan');
  const esc = Object.values(db.escalations).find((e) => e.report_id === reportId);
  if (!esc) throw new HttpError(409, 'Laporan ini belum dieskalasi.');
  if (esc.opened_at)
    throw new HttpError(409, 'Satgas sudah membuka kasus ini, persetujuan tidak dapat ditarik.');
  db.events = db.events.filter((e) => e.escalation_id !== esc.id);
  db.ladder = db.ladder.filter((e) => e.escalation_id !== esc.id);
  delete db.escalations[esc.id];
  r.status = 'tersimpan';
  r.conditional = undefined; // menarik berarti tidak ingin langsung dieskalasi ulang
  audit(db, 'pelapor-anonim', 'tarik-persetujuan', esc.alias);
  persist(db);
}
