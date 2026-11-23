import { fromB64u } from '@gema/crypto';
import { DEMO_INSTITUTION_ID } from '@/lib/demo';
import { persist } from '../db';
import { advanceStatus, audit, issueSession, ipHash, limiters, nowFor, tick } from '../logic';
import {
  approvalsFor,
  approve,
  hasApproval,
  newChallenge,
  requestApproval,
  setPanelMode,
  verifyOwner,
} from '../logic-satgas';
import { checkPassword } from '../seed';
import { CASE_STATUSES, type CaseStatus, type Escalation } from '../types';
import { demoEnabled } from '../demo-flag';
import { HttpError, uid } from '../util';
import {
  body,
  clientIp,
  json,
  memberOf,
  satgasSession,
  type Ctx,
  type Handler,
  type SatgasSession,
} from './context';
import { memberName } from './helpers';
import { caseListItem, dossierView } from './views';

const STAFF = ['Ketua', 'Anggota'];

/** Rute `/api/satgas/*`: masuk, daftar kasus, dosir, persetujuan, kunci, audit, radar, tangga. */
export const satgas: Handler = async (ctx) => {
  const {
    method,
    seg: [a, b, c],
    req,
    db,
  } = ctx;
  if (a !== 'satgas') return;

  if (b === 'login' && method === 'POST') return login(ctx);

  const s = satgasSession(req);
  const me = memberOf(db, s);
  const inst = db.institutions[s.institution_id];

  if (b === 'me')
    return json({
      member: { nama: me.nama, role: me.role, email: me.email },
      institution: {
        id: inst.id,
        nama: inst.nama,
        demo: inst.demo,
        slaHari: inst.sla_hari,
        publicKey: inst.public_key_satgas,
        panelMode: inst.panel_mode,
      },
      now: nowFor(db, inst.id),
    });

  if (b === 'team' && method === 'GET') {
    satgasSession(req, ['Ketua']);
    return json({
      members: Object.values(db.members)
        .filter((m) => m.institution_id === inst.id && STAFF.includes(m.role))
        .map((m) => ({ id: m.id, nama: m.nama, role: m.role })),
    });
  }

  if (b === 'cases' && !c && method === 'GET') return caseList(ctx, s);
  if (b === 'cases' && c) {
    const res = await caseActions(ctx, s, c);
    if (res) return res;
  }

  if (b === 'panel' && method === 'POST') {
    const x = await body<{ mode?: string }>(req);
    setPanelMode(db, s, x.mode as never);
    return json({ ok: true, panelMode: inst.panel_mode });
  }
  if (b === 'approvals' && !c && method === 'GET') {
    satgasSession(req, ['Ketua', 'Anggota', 'Pimpinan']);
    return json(approvalsFor(db, s));
  }
  if (b === 'approvals' && c && seg3(ctx) === 'approve' && method === 'POST') {
    approve(db, s, c);
    return json({ ok: true });
  }
  if (b === 'key' && method === 'POST') return replaceKey(ctx);
  if (b === 'audit' && method === 'GET') {
    satgasSession(req, ['Auditor', 'Ketua']);
    return json({ entries: db.audit.slice(-200).reverse(), total: db.audit.length });
  }
  if (b === 'radar' && method === 'GET') return radar(ctx);
  if (b === 'ladder' && method === 'GET') return ladder(ctx, s);
};

const seg3 = ({ seg }: Ctx) => seg[3];

async function login({ req, db }: Ctx) {
  if (!limiters.misc.check('sl:' + ipHash(clientIp(req)), 20, 15 * 60_000))
    throw new HttpError(429, 'Terlalu banyak percobaan.');
  const x = await body<{ email?: string; password?: string; demoRole?: string }>(req);
  const members = Object.values(db.members);
  let m =
    x.demoRole && demoEnabled()
      ? members.find((mm) => mm.institution_id === DEMO_INSTITUTION_ID && mm.role === x.demoRole)
      : undefined;
  if (!m) m = members.find((mm) => mm.email === String(x.email ?? '').toLowerCase());
  if (!m || (!x.demoRole && !checkPassword(String(x.password ?? ''), m.pass_hash)))
    throw new HttpError(401, 'Email atau kata sandi tidak cocok.');
  const token = issueSession({
    kind: 'satgas',
    member_id: m.id,
    institution_id: m.institution_id,
    role: m.role,
  });
  audit(db, `${m.role}:${m.nama}`, 'masuk', 'dashboard');
  persist(db);
  return json({
    token,
    member: { nama: m.nama, role: m.role, email: m.email },
    institution: {
      id: m.institution_id,
      nama: db.institutions[m.institution_id].nama,
      demo: db.institutions[m.institution_id].demo,
    },
  });
}

async function caseList({ db }: Ctx, s: SatgasSession) {
  if (!['Ketua', 'Anggota', 'Pimpinan'].includes(s.role))
    throw new HttpError(403, 'Peranmu tidak memiliki akses ke daftar kasus.');
  await tick(db);
  const priority = (e: Escalation) => Number(!!e.prioritas && e.status !== 'Selesai');
  const cases = Object.values(db.escalations)
    .filter((e) => e.institution_id === s.institution_id)
    .sort((x, y) => priority(y) - priority(x) || x.sla_due_at - y.sla_due_at)
    .map((e) => caseListItem(db, e, s.role));
  return json({ cases, now: nowFor(db, s.institution_id) });
}

/** Aksi atas satu kasus: `/api/satgas/cases/:id[/aksi]`. */
async function caseActions(ctx: Ctx, s: SatgasSession, caseId: string) {
  const {
    method,
    seg: [, , , d],
    req,
    db,
  } = ctx;
  const e = db.escalations[caseId];
  if (!e || e.institution_id !== s.institution_id)
    throw new HttpError(404, 'Kasus tidak ditemukan');

  if (d === 'assign' && method === 'POST') return assign(ctx, s, e);
  if (d === 'status' && method === 'POST') return changeStatus(ctx, s, e);

  satgasSession(req, ['Ketua', 'Anggota']);
  if (d === 'challenge' && method === 'POST') return json(newChallenge(db, s, e.id), 201);
  if (d === 'verify-owner' && method === 'POST')
    return json(verifyOwner(db, s, e.id, (await body(req)) as never));
  if (d === 'approval' && method === 'POST')
    return json({ ok: true, approval: requestApproval(db, s, e.id) }, 201);
  if (d === 'notes' && method === 'POST') return addNote(ctx, s, e);
  if (!d && method === 'GET') return openDossier(ctx, s, e);
}

async function assign({ req, db }: Ctx, s: SatgasSession, e: Escalation) {
  satgasSession(req, ['Ketua']);
  const me = memberOf(db, s);
  const x = await body<{ memberId?: string | null }>(req);
  if (e.status === 'Selesai')
    throw new HttpError(409, 'Kasus yang selesai tidak dapat ditugaskan.');
  const target = x.memberId ? db.members[x.memberId] : undefined;
  if (
    x.memberId &&
    (!target || target.institution_id !== s.institution_id || !STAFF.includes(target.role))
  )
    throw new HttpError(400, 'Penanggung jawab harus Ketua atau Anggota Satgas institusi ini.');
  const now = nowFor(db, s.institution_id);
  e.assignee_id = target?.id ?? null;
  e.assigned_at = target ? now : null;
  db.events.push({
    id: uid(8),
    escalation_id: e.id,
    actor_role: s.role,
    tipe: 'penugasan',
    label: target ? 'Kasus ditugaskan kepada seorang anggota Satgas.' : 'Penugasan kasus dicabut.',
    catatan_ciphertext: null,
    at: now,
  });
  audit(
    db,
    `${s.role}:${me.nama}`,
    target ? 'tugaskan-kasus' : 'cabut-penugasan',
    `${e.alias}${target ? '>' + target.nama : ''}`,
    now,
  );
  persist(db);
  return json({ ok: true, penanggungJawab: memberName(db, target?.id) });
}

async function changeStatus({ req, db }: Ctx, s: SatgasSession, e: Escalation) {
  satgasSession(req, ['Ketua', 'Anggota', 'Pimpinan']);
  const me = memberOf(db, s);
  const x = await body<{ to: CaseStatus }>(req);
  if (!CASE_STATUSES.includes(x.to)) throw new HttpError(400, 'Status tidak dikenal');
  if (x.to === 'Selesai' && !['Ketua', 'Pimpinan'].includes(s.role))
    throw new HttpError(403, 'Hanya Ketua atau Pimpinan yang dapat menyelesaikan kasus.');
  if (s.role === 'Pimpinan' && x.to !== 'Selesai')
    throw new HttpError(403, 'Pimpinan hanya dapat menyelesaikan kasus.');
  advanceStatus(db, e, x.to, { role: s.role, name: me.nama });
  return json({ ok: true });
}

async function addNote({ req, db }: Ctx, s: SatgasSession, e: Escalation) {
  const x = await body<{ catatan_ciphertext: string }>(req);
  fromB64u(x.catatan_ciphertext);
  db.events.push({
    id: uid(8),
    escalation_id: e.id,
    actor_role: s.role,
    tipe: 'catatan',
    label: 'Catatan internal ditambahkan.',
    catatan_ciphertext: x.catatan_ciphertext,
    at: nowFor(db, s.institution_id),
  });
  audit(db, `${s.role}:${memberOf(db, s).nama}`, 'tambah-catatan', e.alias);
  persist(db);
  return json({ ok: true });
}

function openDossier({ db }: Ctx, s: SatgasSession, e: Escalation) {
  if (!hasApproval(db, s, e.id))
    return json(
      { error: 'Mode Empat Mata: butuh persetujuan anggota lain.', needApproval: true },
      403,
    );
  if (!e.opened_at) {
    e.opened_at = nowFor(db, s.institution_id);
    audit(db, `${s.role}:${memberOf(db, s).nama}`, 'buka-dosir', e.alias);
    persist(db);
  }
  return json(dossierView(db, e, s.institution_id));
}

async function replaceKey({ req, db }: Ctx) {
  const s = satgasSession(req, ['Ketua']);
  const inst = db.institutions[s.institution_id];
  const x = await body<{ publicKey?: { suite?: string; ecdh?: string; mlkem?: string } }>(req);
  const k = x.publicKey;
  if (
    !k ||
    k.suite !== 'ecdh-p256+mlkem768-v1' ||
    !k.ecdh ||
    !k.mlkem ||
    fromB64u(k.ecdh).length !== 33 ||
    fromB64u(k.mlkem).length !== 1184
  )
    throw new HttpError(400, 'Kunci publik tidak valid');
  inst.public_key_satgas = { suite: k.suite, ecdh: k.ecdh, mlkem: k.mlkem };
  audit(db, `${s.role}:${memberOf(db, s).nama}`, 'ganti-kunci-satgas', 'kunci publik institusi');
  persist(db);
  return json({ ok: true });
}

function radar({ req, db }: Ctx) {
  const s = satgasSession(req, ['Pimpinan']);
  return json({
    snapshots: db.radar
      .filter((x) => x.institution_id === s.institution_id)
      .map((x) => ({
        unit: x.unit_nama,
        periode: x.periode,
        bucket: x.bucket,
        polaBerulang: x.pola_berulang,
        epsilon: x.epsilon,
      })),
  });
}

/** Notifikasi tangga eskalasi: isinya bergantung pada peran. */
async function ladder({ db }: Ctx, s: SatgasSession) {
  await tick(db);
  const mine = db.ladder.filter(
    (l) => db.escalations[l.escalation_id]?.institution_id === s.institution_id,
  );
  const eventsFrom = (minLevel: number) =>
    json({
      events: mine
        .filter((l) => l.tingkat >= minLevel)
        .map((l) => ({
          alias: l.alias,
          tingkat: l.tingkat,
          hariTerlambat: l.hari_terlambat,
          at: l.at,
          ke: l.notified_role,
        })),
    });
  if (s.role === 'Ketua') return eventsFrom(1);
  if (s.role === 'Pimpinan') return eventsFrom(2);
  if (s.role === 'Pengawas')
    return json({
      agregat: {
        kasusTerlambatT3: Object.values(db.escalations).filter(
          (e) =>
            e.institution_id === s.institution_id &&
            e.tingkat_tangga === 3 &&
            e.status !== 'Selesai',
        ).length,
      },
    });
  throw new HttpError(403, 'Peranmu tidak menerima notifikasi tangga.');
}
