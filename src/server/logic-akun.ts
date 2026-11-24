/** Akun pelapor: pemulihan lewat orang tepercaya dan masuk dengan passkey (WebAuthn PRF). */
import crypto from 'node:crypto';
import { authHash, b64u, constantTimeEqual, fromB64u, normalizeCaseCode, utf8 } from '@gema/crypto';
import { VAULT_SIZE } from '@/lib/laporan/report-format';
import { secretSeed, persist } from './db';
import { audit, issueSession, limiters as RL, type Session } from './logic';
import type { DB } from './types';
import { HttpError, sha256hex } from './util';

/* ---------- pemulihan lewat orang tepercaya ---------- */
function decode(x: unknown): Uint8Array {
  try {
    return fromB64u(String(x ?? ''));
  } catch {
    throw new HttpError(400, 'Data pemulihan tidak valid');
  }
}

export function setRecovery(
  db: DB,
  s: Extract<Session, { kind: 'reporter' }>,
  body: { authKey: string; wrappedKek: string },
) {
  const ak = decode(body.authKey);
  const wk = decode(body.wrappedKek);
  if (ak.length !== 32 || wk.length < 32 || wk.length > 256)
    throw new HttpError(400, 'Data pemulihan tidak valid');
  const rep = db.reporters[s.reporter_id];
  rep.recovery = {
    auth_hash: authHash(ak),
    wrapped_kek: body.wrappedKek,
    scope_id: s.scope_id,
    set_at: Date.now(),
  };
  audit(db, 'pelapor-anonim', 'pasang-pemulihan', rep.id.slice(0, 4) + '…');
  persist(db);
  return { ok: true, setAt: rep.recovery.set_at };
}

export function clearRecovery(db: DB, s: Extract<Session, { kind: 'reporter' }>) {
  const rep = db.reporters[s.reporter_id];
  if (!rep.recovery) return;
  rep.recovery = undefined;
  audit(db, 'pelapor-anonim', 'cabut-pemulihan', rep.id.slice(0, 4) + '…');
  persist(db);
}

export function recoveryStatus(db: DB, s: Extract<Session, { kind: 'reporter' }>) {
  const r = db.reporters[s.reporter_id].recovery;
  return { set: !!r && r.scope_id === s.scope_id, setAt: r?.set_at ?? null };
}

const DUMMY_RECOVERY = authHash(new Uint8Array(32).fill(7));

/** Mulai pemulihan: dua bagian rahasia yang benar menghasilkan kunci pembuka dan sesi untuk brankas asli. */
export function startRecovery(db: DB, body: { caseCode: string; authKey: string }) {
  const code = normalizeCaseCode(body.caseCode ?? '');
  const rlKey = sha256hex('recover:' + code);
  if (RL.login.count(rlKey, 15 * 60_000) >= 5)
    throw new HttpError(429, 'Terlalu banyak percobaan. Coba lagi dalam 15 menit.');
  let key: Uint8Array;
  try {
    key = fromB64u(body.authKey ?? '');
  } catch {
    key = new Uint8Array(32);
  }
  const reporter = Object.values(db.reporters).find((r) => r.case_code === code);
  const rec = reporter?.recovery;
  const eq = constantTimeEqual(
    utf8(authHash(key.length === 32 ? key : new Uint8Array(32))),
    utf8(rec?.auth_hash ?? DUMMY_RECOVERY),
  );
  if (!reporter || !rec || !eq) {
    RL.login.check(rlKey, 1_000_000, 15 * 60_000);
    throw new HttpError(401, 'Kode atau bagian pemulihan tidak cocok.');
  }
  const token = issueSession({
    kind: 'reporter',
    reporter_id: reporter.id,
    scope_id: rec.scope_id,
  });
  return { token, scopeId: rec.scope_id, wrappedKek: rec.wrapped_kek };
}

/** Selesaikan pemulihan: ganti kata sandi brankas asli dan bungkus ulang kunci laporan, sekali jalan. Pemulihan lama dicabut. */
/** Pemulihan dipakai saat perangkat hilang: semua sesi lama pelapor ini harus mati. */
function revokeOtherSessions(db: DB, keep: Extract<Session, { kind: 'reporter' }>) {
  const sessions = db.runtime.sessions;
  for (const [key, v] of Object.entries(sessions))
    if (v !== keep && v.kind === 'reporter' && v.reporter_id === keep.reporter_id)
      delete sessions[key];
}

export function finishRecovery(
  db: DB,
  s: Extract<Session, { kind: 'reporter' }>,
  body: {
    authKey: string;
    vaultBlob: string;
    deks: { reportId: string; wrapped: string }[];
  },
) {
  const rep = db.reporters[s.reporter_id];
  if (!rep.recovery || rep.recovery.scope_id !== s.scope_id)
    throw new HttpError(403, 'Sesi ini bukan sesi pemulihan.');
  const ak = decode(body.authKey);
  const vb = decode(body.vaultBlob);
  if (ak.length !== 32 || vb.length !== VAULT_SIZE)
    throw new HttpError(400, 'Bentuk data akun tidak valid');
  const mine = Object.values(db.reports).filter(
    (r) => r.reporter_id === s.reporter_id && r.scope_id === s.scope_id,
  );
  const byId = new Map((body.deks ?? []).map((d) => [d.reportId, d.wrapped]));
  if (byId.size !== mine.length || mine.some((r) => !byId.has(r.id)))
    throw new HttpError(400, 'Kunci laporan tidak lengkap.');
  for (const d of byId.values()) decode(d);
  const slots = db.slots.filter((x) => x.reporter_id === s.reporter_id);
  const self = slots.find((x) => x.scope_id === s.scope_id);
  if (!self) throw new HttpError(500, 'Slot tidak ditemukan');
  const newHash = authHash(ak);
  if (slots.some((x) => x !== self && x.auth_hash === newHash))
    throw new HttpError(400, 'Kata sandi baru tidak boleh sama dengan Kode Paksa.');
  self.auth_hash = newHash;
  self.vault_blob = body.vaultBlob;
  for (const r of mine) r.secrets.dek_wrapped_klien = byId.get(r.id)!;
  rep.recovery = undefined;
  rep.passkey = undefined; // membungkus KEK lama, jadi tak berlaku lagi
  revokeOtherSessions(db, s);
  audit(db, 'pelapor-anonim', 'selesai-pemulihan', rep.id.slice(0, 4) + '…');
  persist(db);
  return { ok: true };
}

/* ---------- passkey (WebAuthn PRF) ---------- */
export function setPasskey(
  db: DB,
  s: Extract<Session, { kind: 'reporter' }>,
  body: { credId: string; salt: string; authKey: string; wrappedKek: string },
) {
  const cred = decode(body.credId);
  const salt = decode(body.salt);
  const ak = decode(body.authKey);
  const wk = decode(body.wrappedKek);
  if (cred.length < 8 || cred.length > 1024 || salt.length !== 32 || ak.length !== 32)
    throw new HttpError(400, 'Data passkey tidak valid');
  if (wk.length < 32 || wk.length > 256) throw new HttpError(400, 'Data passkey tidak valid');
  const rep = db.reporters[s.reporter_id];
  rep.passkey = {
    cred_id: body.credId,
    salt: body.salt,
    auth_hash: authHash(ak),
    wrapped_kek: body.wrappedKek,
    scope_id: s.scope_id,
    set_at: Date.now(),
  };
  audit(db, 'pelapor-anonim', 'pasang-passkey', rep.id.slice(0, 4) + '…');
  persist(db);
  return { ok: true, setAt: rep.passkey.set_at };
}

export function clearPasskey(db: DB, s: Extract<Session, { kind: 'reporter' }>) {
  const rep = db.reporters[s.reporter_id];
  if (!rep.passkey) return;
  rep.passkey = undefined;
  audit(db, 'pelapor-anonim', 'cabut-passkey', rep.id.slice(0, 4) + '…');
  persist(db);
}

export function passkeyStatus(db: DB, s: Extract<Session, { kind: 'reporter' }>) {
  const p = db.reporters[s.reporter_id].passkey;
  return { set: !!p && p.scope_id === s.scope_id, setAt: p?.set_at ?? null };
}

/** Kode yang tidak punya passkey mendapat tantangan palsu yang stabil, supaya keberadaan akun tidak langsung terbaca. */
export function passkeyChallenge(db: DB, body: { caseCode: string }) {
  const code = normalizeCaseCode(body.caseCode ?? '');
  const p = Object.values(db.reporters).find((r) => r.case_code === code)?.passkey;
  if (p) return { credId: p.cred_id, salt: p.salt };
  const fake = (label: string) =>
    b64u(
      new Uint8Array(
        crypto
          .createHmac('sha256', Buffer.from(secretSeed()))
          .update(`pk:${label}:${code}`)
          .digest(),
      ),
    );
  return { credId: fake('cred'), salt: fake('salt') };
}

const DUMMY_PASSKEY = authHash(new Uint8Array(32).fill(9));

export function loginWithPasskey(db: DB, body: { caseCode: string; authKey: string }) {
  const code = normalizeCaseCode(body.caseCode ?? '');
  const rlKey = sha256hex('passkey:' + code);
  if (RL.login.count(rlKey, 15 * 60_000) >= 5)
    throw new HttpError(429, 'Terlalu banyak percobaan. Coba lagi dalam 15 menit.');
  let key: Uint8Array;
  try {
    key = fromB64u(body.authKey ?? '');
  } catch {
    key = new Uint8Array(32);
  }
  const reporter = Object.values(db.reporters).find((r) => r.case_code === code);
  const pk = reporter?.passkey;
  const eq = constantTimeEqual(
    utf8(authHash(key.length === 32 ? key : new Uint8Array(32))),
    utf8(pk?.auth_hash ?? DUMMY_PASSKEY),
  );
  if (!reporter || !pk || !eq) {
    RL.login.check(rlKey, 1_000_000, 15 * 60_000);
    throw new HttpError(401, 'Passkey tidak cocok untuk kode ini.');
  }
  const token = issueSession({ kind: 'reporter', reporter_id: reporter.id, scope_id: pk.scope_id });
  return { token, scopeId: pk.scope_id, wrappedKek: pk.wrapped_kek };
}
