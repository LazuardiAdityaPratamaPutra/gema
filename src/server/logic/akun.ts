import {
  authHash,
  constantTimeEqual,
  fromB64u,
  normalizeCaseCode,
  randomBytes,
  utf8,
} from '@gema/crypto';
import { persist } from '../db';
import type { DB, Session } from '../types';
import { DAY, HttpError, sha256hex, uid } from '../util';
import { ipHash, issueSession, limiters as RL } from './sesi';

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

/** Kunci otentikasi dari klien; yang rusak diperlakukan sebagai kunci nol agar waktu jawab tetap sama. */
function decodeAuthKey(authKey: string | undefined): Uint8Array {
  try {
    const key = fromB64u(authKey ?? '');
    return key.length === 32 ? key : new Uint8Array(32);
  } catch {
    return new Uint8Array(32);
  }
}

/** Indeks slot yang cocok, atau -1. Kedua slot (dan umpan) selalu dibandingkan, tanpa short-circuit. */
function matchSlot(slots: { auth_hash: string }[], key: Uint8Array): number {
  const hb = utf8(authHash(key));
  let matched = -1;
  for (let i = 0; i < 2; i++) {
    const eq = constantTimeEqual(hb, utf8(slots[i]?.auth_hash ?? DUMMY));
    if (eq && slots[i]) matched = i;
  }
  return matched;
}

/** Respons dan waktu seragam untuk kode yang tidak ada, slot nyata, maupun slot umpan. */
export function loginReporter(db: DB, body: { caseCode: string; authKey: string }) {
  const code = normalizeCaseCode(body.caseCode ?? '');
  const rlKey = sha256hex('login:' + code);
  if (RL.login.count(rlKey, 15 * 60_000) >= 5)
    throw new HttpError(429, 'Terlalu banyak percobaan. Coba lagi dalam 15 menit.');
  const key = decodeAuthKey(body.authKey);
  const reporter = Object.values(db.reporters).find((r) => r.case_code === code);
  const slots = reporter ? db.slots.filter((s) => s.reporter_id === reporter.id) : [];
  const matched = matchSlot(slots, key);
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
