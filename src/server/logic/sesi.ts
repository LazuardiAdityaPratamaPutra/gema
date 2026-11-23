import { b64u, randomBytes } from '@gema/crypto';
import { loadedDb, persist } from '../db';
import type { DB, Session } from '../types';
import { DAY, RateLimiter, sha256hex, wibDate } from '../util';

/* ---------- waktu ---------- */
export function nowFor(db: DB, institutionId?: string): number {
  const inst = institutionId ? db.institutions[institutionId] : undefined;
  return inst?.demo ? Date.now() + db.clock.demoOffsetMs : Date.now();
}

/* ---------- sesi dan pembatas laju ---------- */
export type { Session } from '../types';

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

const SESSION_TTL = 7 * DAY;

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
