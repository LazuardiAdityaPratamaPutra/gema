import crypto from 'node:crypto';
import {
  authHash,
  b64u,
  constantTimeEqual,
  fromB64u,
  fromHex,
  normalizeCaseCode,
  randomBytes,
  sha256,
  toHex,
  utf8,
  concat,
} from '@gema/crypto';
import { isValidPublicKey } from '@gema/zk';
import { evidenceLeaf, merkleRoot, auditPath } from '@gema/merkle';
import { confidenceFor, type Confidence } from '@gema/matching';
import { complianceSnapshot, bucketize, noisyCount } from '@gema/dp';
import { deriveInstitutionKey, evaluateBatch, MAX_EVALUATIONS_PER_REPORT } from '@gema/oprf';
import { blobDelete, fpIndex, getDb, loadedDb, persist, rebuildIndex, secretSeed } from './db';
import type {
  Session,
  AuditEntry,
  CaseStatus,
  DB,
  Escalation,
  Institution,
  Report,
  SatgasRole,
} from './types';
import { CASE_STATUSES } from './types';
import {
  DAY,
  HttpError,
  RateLimiter,
  addBusinessDays,
  businessDaysBetween,
  chainHash,
  quarterEnd,
  quarterOf,
  sha256hex,
  uid,
  wibDate,
} from './util';

/* ---------- waktu ---------- */
export function nowFor(db: DB, institutionId?: string): number {
  const inst = institutionId ? db.institutions[institutionId] : undefined;
  return inst?.demo ? Date.now() + db.clock.demoOffsetMs : Date.now();
}

/* ---------- sesi dan pembatas laju ---------- */
export type { Session } from './types';

type G = typeof globalThis & { __gemaSalt?: { day: string; salt: string } };
const g = globalThis as G;

/** Satu pembatas per nama; hitungannya disimpan di basis data (db.runtime.hits). */
const limiter = (name: string) =>
  new RateLimiter(
    () => (loadedDb().runtime.hits[name] ??= {}),
    () => persist(loadedDb()),
  );
const RL = {
  login: limiter('login'),
  create: limiter('create'),
  oprf: limiter('oprf'),
  misc: limiter('misc'),
};

export const SESSION_TTL = 7 * DAY;

type DistOmit<T> = T extends unknown ? Omit<T, 'exp'> : never;
export function issueSession(s: DistOmit<Session>): string {
  const db = loadedDb();
  const token = b64u(randomBytes(32));
  const now = Date.now();
  for (const [k, v] of Object.entries(db.runtime.sessions))
    if (v.exp < now) delete db.runtime.sessions[k];
  db.runtime.sessions[sha256hex(token)] = { ...s, exp: now + SESSION_TTL } as Session;
  persist(db);
  return token;
}

export function readSession(authorization: string | null): Session | null {
  if (!authorization?.startsWith('Bearer ')) return null;
  const s = loadedDb().runtime.sessions[sha256hex(authorization.slice(7))];
  if (!s || s.exp < Date.now()) return null;
  return s;
}

export function endSession(authorization: string | null) {
  if (!authorization?.startsWith('Bearer ')) return;
  const db = loadedDb();
  delete db.runtime.sessions[sha256hex(authorization.slice(7))];
  persist(db);
}

/** IP di-hash dengan garam harian; hanya untuk kuota, tidak disimpan di basis data. */
export function ipHash(ip: string): string {
  const today = wibDate(Date.now());
  if (!g.__gemaSalt || g.__gemaSalt.day !== today)
    g.__gemaSalt = { day: today, salt: b64u(randomBytes(16)) };
  return sha256hex(g.__gemaSalt.salt + ip);
}

export const limiters = RL;

/* ---------- audit ---------- */
export function audit(
  db: DB,
  aktor: string,
  aksi: string,
  objek: string,
  at = Date.now(),
): AuditEntry {
  const prev = db.audit.length ? db.audit[db.audit.length - 1].hash : 'genesis';
  const entry = { id: uid(8), aktor, aksi, objek, at };
  const e: AuditEntry = { ...entry, prev_hash: prev, hash: chainHash(prev, entry) };
  db.audit.push(e);
  return e;
}

/* ---------- akun anonim ---------- */
const VAULT_SIZE = 4096;
const CODE_RE = /^[A-HJKMNP-Z2-9]{12}$/;

export function registerReporter(
  db: DB,
  body: { caseCode: string; slots: { authKey: string; vaultBlob: string }[] },
  ip: string,
) {
  const code = normalizeCaseCode(body.caseCode ?? '');
  if (!CODE_RE.test(code)) throw new HttpError(400, 'Kode Kasus tidak valid');
  if (!Array.isArray(body.slots) || body.slots.length !== 2)
    throw new HttpError(400, 'Data akun tidak lengkap');
  if (!RL.create.check(ipHash(ip), 20, DAY))
    throw new HttpError(429, 'Terlalu banyak akun dibuat dari jaringan ini. Coba lagi besok.');
  if (Object.values(db.reporters).some((r) => r.case_code === code))
    throw new HttpError(409, 'Kode Kasus sudah dipakai, buat ulang.');
  const id = uid(10);
  db.reporters[id] = { id, case_code: code, created_at: Date.now() };
  for (const s of body.slots) {
    const ak = fromB64u(s.authKey);
    const vb = fromB64u(s.vaultBlob);
    if (ak.length !== 32 || vb.length !== VAULT_SIZE)
      throw new HttpError(400, 'Bentuk data akun tidak valid');
    db.slots.push({
      slot_id: uid(8),
      reporter_id: id,
      scope_id: uid(10),
      auth_hash: authHash(ak),
      vault_blob: s.vaultBlob,
    });
  }
  persist(db);
  return { ok: true };
}

const DUMMY = authHash(new Uint8Array(32));

/** Respons dan waktu seragam untuk kode yang tidak ada, slot nyata, maupun slot umpan. */
export function loginReporter(db: DB, body: { caseCode: string; authKey: string }) {
  const code = normalizeCaseCode(body.caseCode ?? '');
  const rlKey = sha256hex('login:' + code);
  if (RL.login.count(rlKey, 15 * 60_000) >= 5)
    throw new HttpError(429, 'Terlalu banyak percobaan. Coba lagi dalam 15 menit.');
  let key: Uint8Array;
  try {
    key = fromB64u(body.authKey ?? '');
  } catch {
    key = new Uint8Array(32);
  }
  const reporter = Object.values(db.reporters).find((r) => r.case_code === code);
  const slots = reporter ? db.slots.filter((s) => s.reporter_id === reporter.id) : [];
  const h = authHash(key.length === 32 ? key : new Uint8Array(32));
  const hb = utf8(h);
  let matched = -1;
  for (let i = 0; i < 2; i++) {
    const cand = slots[i]?.auth_hash ?? DUMMY;
    const eq = constantTimeEqual(hb, utf8(cand));
    if (eq && slots[i]) matched = i; // tanpa short-circuit: kedua slot selalu diperiksa
  }
  if (matched < 0 || !reporter) {
    RL.login.check(rlKey, 1_000_000, 15 * 60_000); // catat kegagalan
    throw new HttpError(401, 'Kode atau passphrase tidak cocok.');
  }
  const slot = slots[matched];
  const token = issueSession({
    kind: 'reporter',
    reporter_id: reporter.id,
    scope_id: slot.scope_id,
  });
  return { token, scopeId: slot.scope_id, vaultBlob: slot.vault_blob };
}

/** Pasang atau cabut Kode Paksa: mengganti slot LAIN (bukan slot sesi ini). Server tidak menyimpan label slot. */
export function setDecoy(
  db: DB,
  s: Extract<Session, { kind: 'reporter' }>,
  body: { authKey: string | null; vaultBlob: string },
) {
  const mine = db.slots.filter((x) => x.reporter_id === s.reporter_id);
  const other = mine.find((x) => x.scope_id !== s.scope_id);
  if (!other) throw new HttpError(500, 'Slot tidak ditemukan');
  const vb = fromB64u(body.vaultBlob);
  if (vb.length !== VAULT_SIZE) throw new HttpError(400, 'Bentuk data tidak valid');
  const ak = body.authKey ? fromB64u(body.authKey) : randomBytes(32);
  const newHash = authHash(ak);
  const self = mine.find((x) => x.scope_id === s.scope_id)!;
  if (newHash === self.auth_hash)
    throw new HttpError(400, 'Kode Paksa tidak boleh sama dengan passphrase asli.');
  other.auth_hash = newHash;
  other.vault_blob = body.vaultBlob;
  persist(db);
  return { ok: true };
}

/* ---------- OPRF / HMAC ---------- */
export function institutionOf(db: DB, id: string): Institution {
  const inst = db.institutions[id];
  if (!inst) throw new HttpError(404, 'Institusi tidak ditemukan');
  return inst;
}

function quota(s: Extract<Session, { kind: 'reporter' }>, draftId: string, n: number, ip: string) {
  if (typeof draftId !== 'string' || draftId.length < 6 || draftId.length > 64)
    throw new HttpError(400, 'draftId tidak valid');
  const perDraft = RL.oprf.count('d:' + draftId, DAY);
  if (perDraft + n > MAX_EVALUATIONS_PER_REPORT)
    throw new HttpError(429, 'Kuota evaluasi untuk laporan ini habis (maksimal 8).');
  if (RL.oprf.count('r:' + s.reporter_id, DAY) + n > 24)
    throw new HttpError(429, 'Kuota evaluasi harian habis (24 per pelapor).');
  const iph = ipHash(ip);
  if (RL.oprf.count('i:' + iph, DAY) + n > 60)
    throw new HttpError(429, 'Kuota evaluasi harian untuk jaringan ini habis.');
  for (let i = 0; i < n; i++) {
    RL.oprf.check('d:' + draftId, 1_000_000, DAY);
    RL.oprf.check('r:' + s.reporter_id, 1_000_000, DAY);
    RL.oprf.check('i:' + iph, 1_000_000, DAY);
  }
}

export function oprfEvaluate(
  db: DB,
  s: Extract<Session, { kind: 'reporter' }>,
  body: { institutionId: string; draftId: string; blinded: string[] },
  ip: string,
) {
  const inst = institutionOf(db, body.institutionId);
  if (inst.fp_mode !== 'oprf') throw new HttpError(409, 'Institusi ini memakai mode HMAC.');
  if (
    !Array.isArray(body.blinded) ||
    body.blinded.length === 0 ||
    body.blinded.length > MAX_EVALUATIONS_PER_REPORT
  )
    throw new HttpError(400, 'Jumlah titik tidak valid');
  let evaluated: string[];
  const kp = deriveInstitutionKey(secretSeed(), inst.id);
  try {
    // validasi seluruh titik dahulu agar kuota tidak terpakai untuk masukan rusak
    evaluated = evaluateBatch(kp.secretKey, body.blinded);
  } catch {
    throw new HttpError(400, 'Titik tersamar tidak valid');
  }
  quota(s, body.draftId, body.blinded.length, ip);
  return { evaluated };
}

/** Cadangan (P0): server melihat nama sesaat lewat TLS, menghitung HMAC, lalu membuangnya. */
export function hmacFingerprints(
  db: DB,
  s: Extract<Session, { kind: 'reporter' }>,
  body: { institutionId: string; draftId: string; inputs: string[] },
  ip: string,
) {
  const inst = institutionOf(db, body.institutionId);
  if (inst.fp_mode !== 'hmac') throw new HttpError(409, 'Institusi ini memakai mode OPRF.');
  if (
    !Array.isArray(body.inputs) ||
    body.inputs.length === 0 ||
    body.inputs.length > MAX_EVALUATIONS_PER_REPORT
  )
    throw new HttpError(400, 'Jumlah masukan tidak valid');
  quota(s, body.draftId, body.inputs.length, ip);
  const key = crypto
    .createHmac('sha256', Buffer.from(secretSeed()))
    .update('hmac:' + inst.id)
    .digest();
  return {
    fps: body.inputs.map((x) => crypto.createHmac('sha256', key).update(String(x)).digest('hex')),
  };
}

/* ---------- laporan ---------- */
export function activeReportsOf(db: DB, reporterId: string): Report[] {
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
  const mine = activeReportsOf(db, s.reporter_id).filter((r) => r.scope_id === s.scope_id);
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
  void mine;
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

/* ---------- klaster dan keyakinan ---------- */
export type MatchInfo = {
  notify: boolean;
  size: number | null;
  confidence: Confidence | null;
  weak: number | null;
  optedIn: number;
  flagFast: boolean;
};

function fpsOf(db: DB, reportId: string) {
  return db.fingerprints.filter((f) => f.report_id === reportId);
}

export function clusterMembers(db: DB, reportId: string): Report[] {
  const idx = fpIndex();
  const start = db.reports[reportId];
  if (!start) return [];
  const seen = new Set<string>([reportId]);
  const queue = [start];
  while (queue.length) {
    const r = queue.shift()!;
    for (const f of fpsOf(db, r.id).filter((x) => x.tingkat === 'kuat')) {
      for (const rid of idx.get(`kuat|${f.fp_hash}`) ?? []) {
        const o = db.reports[rid];
        if (!o || seen.has(rid) || o.reporter_id === r.reporter_id) continue;
        seen.add(rid);
        queue.push(o);
      }
    }
  }
  return [...seen].map((id) => db.reports[id]);
}

export function matchInfo(db: DB, reportId: string): MatchInfo {
  const r = db.reports[reportId];
  const members = clusterMembers(db, reportId);
  const reporters = new Set(members.map((m) => m.reporter_id));
  const size = reporters.size;
  if (size < r.k_threshold)
    return { notify: false, size: null, confidence: null, weak: null, optedIn: 0, flagFast: false };
  const own = fpsOf(db, reportId)
    .filter((f) => f.tingkat === 'penguat')
    .map((f) => f.fp_hash);
  const others = members
    .filter((m) => m.id !== reportId)
    .map((m) =>
      fpsOf(db, m.id)
        .filter((f) => f.tingkat === 'penguat')
        .map((f) => f.fp_hash),
    );
  const confidence = confidenceFor(own, others);
  let weak: number | null = null;
  if (r.include_weak) {
    const idx = fpIndex();
    const w = new Set<string>();
    for (const f of fpsOf(db, reportId).filter((x) => x.tingkat === 'lemah')) {
      for (const rid of idx.get(`lemah|${f.fp_hash}`) ?? []) {
        const o = db.reports[rid];
        if (o && o.reporter_id !== r.reporter_id && !reporters.has(o.reporter_id))
          w.add(o.reporter_id);
      }
    }
    weak = w.size;
  }
  const optedIn = new Set(members.filter((m) => m.opt_in).map((m) => m.reporter_id)).size;
  const times = members.map((m) => m.created_at);
  const flagFast = Math.max(...times) - Math.min(...times) < DAY;
  return { notify: true, size, confidence, weak, optedIn, flagFast };
}

/** Untuk Satgas: hanya angka — berapa laporan di klaster, berapa yang tereskalasi, berapa yang tersegel. */
export function clusterCounts(db: DB, reportId: string) {
  const members = clusterMembers(db, reportId);
  const escalated = members.filter((m) => m.status === 'tereskalasi').length;
  return { total: members.length, tereskalasi: escalated, tersegel: members.length - escalated };
}

/* ---------- eskalasi dan SLA ---------- */
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

export type SlaView = {
  status: CaseStatus;
  due: number;
  escalated: number;
  hariSisa: number | null;
  hariTerlambat: number;
  tingkat: number;
  terlambat: boolean;
  h2: boolean;
};

export function slaView(db: DB, e: Escalation): SlaView {
  const now = nowFor(db, e.institution_id);
  const late = e.status !== 'Selesai' && now > e.sla_due_at;
  const lateBD = late ? businessDaysBetween(e.sla_due_at, now) : 0;
  const remainingBD =
    !late && e.status !== 'Selesai' ? businessDaysBetween(now, e.sla_due_at) : null;
  return {
    status: e.status,
    due: e.sla_due_at,
    escalated: e.escalated_at,
    hariSisa: remainingBD,
    hariTerlambat: lateBD,
    tingkat: e.tingkat_tangga,
    terlambat: late,
    h2: !late && e.status !== 'Selesai' && remainingBD !== null && remainingBD <= 2,
  };
}

export function advanceStatus(
  db: DB,
  e: Escalation,
  to: CaseStatus,
  actor: { role: SatgasRole; name: string },
) {
  const from = CASE_STATUSES.indexOf(e.status);
  const target = CASE_STATUSES.indexOf(to);
  if (target !== from + 1) throw new HttpError(409, 'Status hanya dapat maju satu langkah.');
  const now = nowFor(db, e.institution_id);
  e.status = to;
  if (to === 'Selesai') e.selesai_at = now;
  db.events.push({
    id: uid(8),
    escalation_id: e.id,
    actor_role: actor.role,
    tipe: 'status',
    label: `Status menjadi "${to}".`,
    catatan_ciphertext: null,
    at: now,
  });
  audit(db, `${actor.role}:${actor.name}`, 'ubah-status:' + to, e.alias, now);
  persist(db);
}

/** Dijalankan berkala dan idempoten: menaikkan Tangga Eskalasi, merilis snapshot kuartal tertutup, menerbitkan anchor harian. */
export async function tick(db: DB) {
  let changed = false;
  for (const e of Object.values(db.escalations)) {
    if (e.status === 'Selesai') continue;
    const inst = db.institutions[e.institution_id];
    const now = nowFor(db, e.institution_id);
    if (now <= e.sla_due_at) continue;
    const lateBD = businessDaysBetween(e.sla_due_at, now);
    const th = inst.ambang_tangga;
    const level = (lateBD >= th.t3 ? 3 : lateBD >= th.t2 ? 2 : 1) as 1 | 2 | 3;
    for (let l = e.tingkat_tangga + 1; l <= level; l++) {
      const L = l as 1 | 2 | 3;
      const role = L === 1 ? 'Ketua Satgas' : L === 2 ? 'Pimpinan' : 'LLDIKTI (agregat)';
      db.ladder.push({
        id: uid(8),
        escalation_id: e.id,
        alias: e.alias,
        tingkat: L,
        notified_role: role,
        hari_terlambat: lateBD,
        at: now,
      });
      db.events.push({
        id: uid(8),
        escalation_id: e.id,
        actor_role: 'sistem',
        tipe: 'tangga',
        label: `Peringatan naik ke T${L}: ${role}.`,
        catatan_ciphertext: null,
        at: now,
      });
      audit(db, 'sistem', `tangga-T${L}`, e.alias, now);
      e.tingkat_tangga = L;
      changed = true;
    }
  }
  if (sealAnchors(db, false)) changed = true;
  if (closeQuarters(db)) changed = true;
  if (changed) persist(db);
  return { changed };
}

/* ---------- anchor Merkle harian ---------- */
export function sealAnchors(db: DB, force: boolean, now = Date.now()) {
  const today = wibDate(now);
  const pending = Object.values(db.evidence)
    .filter((e) => !e.anchor_id && e.blob_ready && (force || wibDate(e.uploaded_at) < today))
    .sort((a, b) => a.uploaded_at - b.uploaded_at);
  if (!pending.length) return null;
  const leaves = pending.map((e) => e.leaf);
  const root = toHex(merkleRoot(leaves.map(fromHex)));
  const prev = db.anchors.length ? db.anchors[db.anchors.length - 1].chain_hash : 'genesis';
  const id = uid(8);
  const anchor = {
    id,
    tanggal: today,
    merkle_root: root,
    jumlah_hash: leaves.length,
    leaves,
    chain_hash: chainHash(prev, { root, tanggal: today, n: leaves.length }),
    commit_ref: null,
    created_at: now,
  };
  db.anchors.push(anchor);
  for (const e of pending) e.anchor_id = id;
  audit(db, 'sistem', 'anchor-merkle', `${today}:${root.slice(0, 12)}`, now);
  persist(db);
  return anchor;
}

export function anchorProof(db: DB, evidenceId: string) {
  const e = db.evidence[evidenceId];
  if (!e) return null;
  const a = e.anchor_id ? db.anchors.find((x) => x.id === e.anchor_id) : null;
  let anchor = null;
  if (a) {
    const leaves = a.leaves.map(fromHex);
    const index = a.leaves.indexOf(e.leaf);
    anchor = {
      date: a.tanggal,
      root: a.merkle_root,
      size: a.jumlah_hash,
      index,
      path: auditPath(index, leaves).map(toHex),
      chainHash: a.chain_hash,
      commitRef: a.commit_ref,
    };
  }
  return {
    v: 1 as const,
    evidenceId: e.id,
    sha256: e.sha256_asli,
    messageRoot: e.message_root,
    messageCount: e.jumlah_pesan,
    uploadedAt: new Date(e.uploaded_at).toISOString(),
    leaf: e.leaf,
    anchor,
  };
}

/* ---------- snapshot berderau (Papan Kepatuhan dan Radar) ---------- */
function median(a: number[]): number {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Kuartal yang sudah ditutup + tunda 14 hari. Derau ditambahkan SEKALI lalu disimpan. */
export function closeQuarters(db: DB, now = Date.now()): boolean {
  let changed = false;
  for (const inst of Object.values(db.institutions)) {
    const t = nowFor(db, inst.id);
    const cur = quarterOf(t);
    const quarters = new Set<string>();
    for (const e of Object.values(db.escalations).filter((x) => x.institution_id === inst.id))
      quarters.add(quarterOf(e.sla_due_at));
    for (const q of quarters) {
      if (q === cur) continue;
      if (quarterEnd(q) + 14 * DAY > t) continue;
      if (db.compliance.some((c) => c.institution_id === inst.id && c.kuartal === q)) continue;
      const esc = Object.values(db.escalations).filter(
        (x) => x.institution_id === inst.id && quarterOf(x.sla_due_at) === q,
      );
      const onTime = esc.filter((x) => x.selesai_at && x.selesai_at <= x.sla_due_at).length;
      const days = esc
        .filter((x) => x.selesai_at)
        .map((x) => businessDaysBetween(x.escalated_at, x.selesai_at!));
      const snap = complianceSnapshot(esc.length, onTime, median(days), inst.dp_epsilon);
      const jb = bucketize(snap.dueNoisy, 5);
      db.compliance.push({
        institution_id: inst.id,
        kuartal: q,
        enough: snap.enough,
        persen: snap.percent,
        median_bucket: snap.medianBucket,
        jumlah_bucket: jb,
        epsilon: inst.dp_epsilon,
        created_at: now,
      });
      audit(db, 'sistem', 'snapshot-kepatuhan', `${inst.id}:${q}:eps=${inst.dp_epsilon}`, now);
      changed = true;
    }
  }
  void noisyCount;
  return changed;
}

export async function ready(): Promise<DB> {
  return getDb();
}

export { sha256, concat };
