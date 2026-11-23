import { HttpError, clientIpFrom } from '../util';
import { readSession, type Session } from '../logic';
import type { DB, SatgasRole } from '../types';

/** Permintaan yang sudah dipecah per segmen jalur, beserta basis data yang termuat. */
export type Ctx = { method: string; seg: string[]; req: Request; db: DB };

/** Penangan satu kelompok rute. Mengembalikan `undefined` bila tidak ada rute yang cocok. */
export type Handler = (ctx: Ctx) => Promise<Response | undefined> | Response | undefined;

export type ReporterSession = Extract<Session, { kind: 'reporter' }>;
export type SatgasSession = Extract<Session, { kind: 'satgas' }>;

export const json = (data: unknown, status = 200) =>
  Response.json(data, {
    status,
    headers: { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' },
  });

export async function body<T = Record<string, unknown>>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new HttpError(400, 'Isi permintaan bukan JSON yang valid');
  }
}

export function reporterSession(req: Request): ReporterSession {
  const s = readSession(req.headers.get('authorization'));
  if (!s || s.kind !== 'reporter')
    throw new HttpError(401, 'Masuk dahulu dengan Kode Kasus dan passphrase.');
  return s;
}

export function satgasSession(req: Request, roles?: SatgasRole[]): SatgasSession {
  const s = readSession(req.headers.get('authorization'));
  if (!s || s.kind !== 'satgas') throw new HttpError(401, 'Masuk sebagai anggota Satgas dahulu.');
  if (roles && !roles.includes(s.role))
    throw new HttpError(403, 'Peranmu tidak memiliki akses ke bagian ini.');
  return s;
}

export function memberOf(db: DB, s: SatgasSession) {
  const m = db.members[s.member_id];
  if (!m) throw new HttpError(401, 'Sesi tidak valid');
  return m;
}

export const clientIp = (req: Request) =>
  clientIpFrom(
    req.headers.get('x-forwarded-for'),
    Number(process.env.GEMA_TRUSTED_PROXIES ?? 1) || 1,
  );

/**
 * Pengaman cron. Bila `mandatory`, rahasia wajib dikonfigurasi dan cocok.
 * Bila tidak, rahasia hanya diperiksa saat sudah dikonfigurasi.
 */
export function requireCronSecret(req: Request, mandatory: boolean) {
  const secret = process.env.GEMA_CRON_SECRET;
  const matches = req.headers.get('authorization') === `Bearer ${secret}`;
  if (mandatory ? !secret || !matches : secret && !matches)
    throw new HttpError(401, 'Tidak diizinkan');
}
