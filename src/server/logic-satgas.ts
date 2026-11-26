/** Pekerjaan Satgas: mode Empat Mata (persetujuan dua orang) dan Bukti Pemilik (nol-pengetahuan). */
import { b64u, randomBytes } from '@gema/crypto';
import { isValidPublicKey, verifyOwnership } from '@gema/zk';
import { loadedDb, persist } from './db';
import { audit, institutionOf, nowFor, ownedReport, type Session } from './logic';
import type { DB, Institution, SatgasRole } from './types';
import { HttpError, uid } from './util';

/* ---------- mode Empat Mata (panel 2-dari-3) ---------- */
const APPROVAL_TTL = 30 * 60_000;
const PANEL_ROLES: SatgasRole[] = ['Ketua', 'Anggota', 'Pimpinan'];
/** Penanda permintaan mematikan Empat Mata; memakai mekanisme persetujuan yang sama dengan pembukaan dosir. */
const CABUT_PANEL = 'panel-cabut';

export function setPanelMode(
  db: DB,
  s: Extract<Session, { kind: 'satgas' }>,
  mode: Institution['panel_mode'],
) {
  if (s.role !== 'Ketua') throw new HttpError(403, 'Hanya Ketua yang dapat mengubah mode panel.');
  if (mode !== 'tunggal' && mode !== '2dari3') throw new HttpError(400, 'Mode tidak dikenal');
  const inst = institutionOf(db, s.institution_id);
  if (inst.panel_mode === mode) return;
  if (mode === '2dari3') {
    const anggotaPanel = Object.values(db.members).filter(
      (m) => m.institution_id === s.institution_id && PANEL_ROLES.includes(m.role),
    ).length;
    if (anggotaPanel < 2)
      throw new HttpError(
        409,
        'Empat Mata butuh minimal dua akun panel (Ketua, Anggota, atau Pimpinan). Tambahkan akun kedua dulu, kalau tidak dosir akan terkunci.',
      );
  }
  const now = nowFor(db, s.institution_id);
  if (mode === 'tunggal') {
    // Mematikan Empat Mata tidak boleh dilakukan Ketua sendirian: anggota panel lain harus menyetujui.
    const izin = db.approvals.find(
      (a) =>
        a.escalation_id === CABUT_PANEL &&
        a.requester_id === s.member_id &&
        !!a.approved_at &&
        now - a.approved_at < APPROVAL_TTL,
    );
    if (!izin) {
      const nama = db.members[s.member_id].nama;
      const terbuka = db.approvals.some(
        (a) =>
          a.escalation_id === CABUT_PANEL &&
          a.requester_id === s.member_id &&
          !a.approved_at &&
          now - a.requested_at < APPROVAL_TTL,
      );
      if (!terbuka) {
        db.approvals.push({
          id: uid(8),
          escalation_id: CABUT_PANEL,
          institution_id: s.institution_id,
          requester_id: s.member_id,
          approver_id: null,
          requested_at: now,
          approved_at: null,
        });
        audit(db, `Ketua:${nama}`, 'minta-cabut-empat-mata', mode);
        persist(db);
      }
      throw new HttpError(
        409,
        'Mematikan Empat Mata butuh persetujuan anggota panel lain (Anggota atau Pimpinan). Permintaan sudah dikirim. Setelah disetujui, tekan tombol ini lagi dalam 30 menit.',
      );
    }
    db.approvals = db.approvals.filter((a) => a !== izin);
  }
  inst.panel_mode = mode;
  audit(db, `Ketua:${db.members[s.member_id].nama}`, 'ubah-mode-panel', mode);
  persist(db);
}

/* ---------- mundur karena konflik kepentingan ---------- */
export const sudahMundur = (e: { mundur?: string[] }, memberId: string) =>
  !!e.mundur?.includes(memberId);

/**
 * Anggota panel menyatakan konflik kepentingan atas satu kasus. Alasannya tidak disimpan: yang tercatat
 * hanya bahwa dia mundur, dan pelapor ikut melihat kejadiannya.
 */
export function mundurDariKasus(
  db: DB,
  s: Extract<Session, { kind: 'satgas' }>,
  e: { id: string; alias: string; assignee_id?: string | null; assigned_at?: number | null },
) {
  if (!PANEL_ROLES.includes(s.role))
    throw new HttpError(403, 'Hanya Ketua, Anggota, atau Pimpinan yang dapat mundur dari kasus.');
  const esc = db.escalations[e.id];
  if (esc.status === 'Selesai') throw new HttpError(409, 'Kasus yang selesai tidak perlu mundur.');
  const nama = db.members[s.member_id].nama;
  const now = nowFor(db, s.institution_id);
  if (!sudahMundur(esc, s.member_id)) {
    esc.mundur = [...(esc.mundur ?? []), s.member_id];
    if (esc.assignee_id === s.member_id) {
      esc.assignee_id = null;
      esc.assigned_at = null;
    }
    db.events.push({
      id: uid(8),
      escalation_id: esc.id,
      actor_role: s.role,
      tipe: 'mundur',
      label: 'Seorang anggota Satgas mundur dari kasus ini karena konflik kepentingan.',
      catatan_ciphertext: null,
      at: now,
    });
    audit(db, `${s.role}:${nama}`, 'mundur-konflik', esc.alias, now);
    persist(db);
  }
  const sisa = Object.values(db.members).filter(
    (m) =>
      m.institution_id === s.institution_id &&
      PANEL_ROLES.includes(m.role) &&
      !sudahMundur(esc, m.id),
  ).length;
  const inst = institutionOf(db, s.institution_id);
  return {
    peringatan:
      inst.panel_mode === '2dari3' && sisa < 2
        ? 'Tersisa kurang dari dua anggota panel tanpa konflik, sehingga kasus ini tidak bisa dibuka dalam mode Empat Mata. Ketua perlu menambah akun panel.'
        : null,
  };
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
  if (db.escalations[a.escalation_id] && sudahMundur(db.escalations[a.escalation_id], s.member_id))
    throw new HttpError(
      403,
      'Kamu sudah mundur dari kasus ini, jadi tidak bisa menyetujui aksesnya.',
    );
  const now = nowFor(db, s.institution_id);
  if (now - a.requested_at >= APPROVAL_TTL)
    throw new HttpError(410, 'Permintaan sudah kedaluwarsa. Minta ulang.');
  if (a.approved_at) return a;
  a.approver_id = s.member_id;
  a.approved_at = now;
  const e = db.escalations[a.escalation_id];
  audit(
    db,
    `${s.role}:${db.members[s.member_id].nama}`,
    a.escalation_id === CABUT_PANEL ? 'setujui-cabut-empat-mata' : 'setujui-akses-dosir',
    e?.alias ?? '-',
  );
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
    cabut: a.escalation_id === CABUT_PANEL,
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
const CHALLENGE_TTL = 15 * 60_000;

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
