/** Pekerjaan Satgas: mode Empat Mata (persetujuan dua orang) dan Bukti Pemilik (nol-pengetahuan). */
import { b64u, randomBytes } from '@gema/crypto';
import { isValidPublicKey, verifyOwnership } from '@gema/zk';
import { loadedDb, persist } from './db';
import { audit, institutionOf, nowFor, ownedReport, type Session } from './logic';
import type { DB, Institution, SatgasRole } from './types';
import { HttpError, uid } from './util';

/* ---------- mode Empat Mata (panel 2-dari-3) ---------- */
export const APPROVAL_TTL = 30 * 60_000;
const PANEL_ROLES: SatgasRole[] = ['Ketua', 'Anggota', 'Pimpinan'];

export function setPanelMode(
  db: DB,
  s: Extract<Session, { kind: 'satgas' }>,
  mode: Institution['panel_mode'],
) {
  if (s.role !== 'Ketua') throw new HttpError(403, 'Hanya Ketua yang dapat mengubah mode panel.');
  if (mode !== 'tunggal' && mode !== '2dari3') throw new HttpError(400, 'Mode tidak dikenal');
  const inst = institutionOf(db, s.institution_id);
  if (inst.panel_mode === mode) return;
  inst.panel_mode = mode;
  audit(db, `Ketua:${db.members[s.member_id].nama}`, 'ubah-mode-panel', mode);
  persist(db);
}

export function requestApproval(
  db: DB,
  s: Extract<Session, { kind: 'satgas' }>,
  escalationId: string,
) {
  const e = db.escalations[escalationId];
  if (!e || e.institution_id !== s.institution_id)
    throw new HttpError(404, 'Kasus tidak ditemukan');
  const now = nowFor(db, s.institution_id);
  const open = db.approvals.find(
    (a) =>
      a.escalation_id === e.id &&
      a.requester_id === s.member_id &&
      !a.approved_at &&
      now - a.requested_at < APPROVAL_TTL,
  );
  if (open) return open;
  const a = {
    id: uid(8),
    escalation_id: e.id,
    institution_id: e.institution_id,
    requester_id: s.member_id,
    approver_id: null,
    requested_at: now,
    approved_at: null,
  };
  db.approvals.push(a);
  audit(db, `${s.role}:${db.members[s.member_id].nama}`, 'minta-persetujuan-dosir', e.alias);
  persist(db);
  return a;
}

export function approve(db: DB, s: Extract<Session, { kind: 'satgas' }>, approvalId: string) {
  const a = db.approvals.find((x) => x.id === approvalId && x.institution_id === s.institution_id);
  if (!a) throw new HttpError(404, 'Permintaan tidak ditemukan');
  if (!PANEL_ROLES.includes(s.role))
    throw new HttpError(403, 'Peranmu tidak dapat menyetujui akses dosir.');
  if (a.requester_id === s.member_id)
    throw new HttpError(403, 'Persetujuan harus dari anggota lain, bukan pemohon sendiri.');
  const now = nowFor(db, s.institution_id);
  if (now - a.requested_at >= APPROVAL_TTL)
    throw new HttpError(410, 'Permintaan sudah kedaluwarsa. Minta ulang.');
  if (a.approved_at) return a;
  a.approver_id = s.member_id;
  a.approved_at = now;
  const e = db.escalations[a.escalation_id];
  audit(db, `${s.role}:${db.members[s.member_id].nama}`, 'setujui-akses-dosir', e?.alias ?? '-');
  persist(db);
  return a;
}

/** Pada mode 2dari3, dosir dan bukti hanya terbuka bila anggota lain sudah menyetujui dalam 30 menit terakhir. */
export function hasApproval(
  db: DB,
  s: Extract<Session, { kind: 'satgas' }>,
  escalationId: string,
): boolean {
  const inst = institutionOf(db, s.institution_id);
  if (inst.panel_mode !== '2dari3') return true;
  const now = nowFor(db, s.institution_id);
  return db.approvals.some(
    (a) =>
      a.escalation_id === escalationId &&
      a.requester_id === s.member_id &&
      !!a.approved_at &&
      now - a.approved_at < APPROVAL_TTL,
  );
}

export function approvalsFor(db: DB, s: Extract<Session, { kind: 'satgas' }>) {
  const now = nowFor(db, s.institution_id);
  const name = (id: string | null) => (id ? db.members[id]?.nama : null) ?? null;
  const live = db.approvals.filter(
    (a) => a.institution_id === s.institution_id && now - a.requested_at < APPROVAL_TTL,
  );
  const view = (a: (typeof live)[number]) => ({
    id: a.id,
    alias: db.escalations[a.escalation_id]?.alias ?? '-',
    escalationId: a.escalation_id,
    requester: name(a.requester_id),
    approver: name(a.approver_id),
    requestedAt: a.requested_at,
    approvedAt: a.approved_at,
  });
  return {
    menungguKamu: live.filter((a) => !a.approved_at && a.requester_id !== s.member_id).map(view),
    milikku: live.filter((a) => a.requester_id === s.member_id).map(view),
  };
}

/* ---------- bukti pemilik (nol-pengetahuan) ---------- */
export const CHALLENGE_TTL = 15 * 60_000;

/** Laporan lama (sebelum Bukti Pemilik) mendaftarkan kunci sekali saja; setelah itu tidak bisa diganti. */
export function registerOwnerKey(
  db: DB,
  s: Extract<Session, { kind: 'reporter' }>,
  reportId: string,
  ownerPub: string,
) {
  const r = ownedReport(db, s, reportId);
  if (r.owner_pub) throw new HttpError(409, 'Laporan ini sudah punya kunci pemilik.');
  if (!isValidPublicKey(ownerPub ?? '')) throw new HttpError(400, 'Kunci pemilik tidak valid');
  r.owner_pub = ownerPub;
  persist(db);
}

export function newChallenge(
  db: DB,
  s: Extract<Session, { kind: 'satgas' }>,
  escalationId: string,
) {
  const e = db.escalations[escalationId];
  if (!e || e.institution_id !== s.institution_id)
    throw new HttpError(404, 'Kasus tidak ditemukan');
  const challenge = b64u(randomBytes(12));
  const exp = Date.now() + CHALLENGE_TTL;
  const challenges = loadedDb().runtime.challenges;
  challenges[`${e.id}|${challenge}`] = exp;
  for (const [k, v] of Object.entries(challenges)) if (v < Date.now()) delete challenges[k];
  persist(db);
  return { challenge, expiresAt: exp, context: `${e.alias}|${challenge}` };
}

export function verifyOwner(
  db: DB,
  s: Extract<Session, { kind: 'satgas' }>,
  escalationId: string,
  body: { challenge: string; proof: string },
) {
  const e = db.escalations[escalationId];
  if (!e || e.institution_id !== s.institution_id)
    throw new HttpError(404, 'Kasus tidak ditemukan');
  const key = `${e.id}|${body.challenge}`;
  const challenges = loadedDb().runtime.challenges;
  const exp = challenges[key];
  if (!exp || exp < Date.now())
    throw new HttpError(
      410,
      'Tantangan tidak dikenal atau sudah kedaluwarsa. Buat tantangan baru.',
    );
  const pub = db.reports[e.report_id]?.owner_pub;
  if (!pub)
    return {
      valid: false,
      reason: 'Laporan ini dibuat sebelum Bukti Pemilik ada dan belum mendaftarkan kunci.',
    };
  const valid = verifyOwnership(pub, String(body.proof ?? ''), `${e.alias}|${body.challenge}`);
  if (valid) delete challenges[key]; // sekali pakai
  audit(
    db,
    `${s.role}:${db.members[s.member_id].nama}`,
    valid ? 'bukti-pemilik-sah' : 'bukti-pemilik-gagal',
    e.alias,
  );
  persist(db);
  return { valid, reason: valid ? null : 'Bukti tidak cocok dengan pemilik laporan ini.' };
}
