import { DEMO_ACCOUNTS, DEMO_INSTITUTION_ID, DEMO_MEMBERS, DEMO_PASSWORD } from '@/lib/demo/demo';
import { persist, resetDb } from '../db';
import { audit, ipHash, limiters, nowFor, sealAnchors, tick } from '../logic';
import { demoEnabled } from '../demo-flag';
import { DAY, HttpError } from '../util';
import { bodyOf, clientIp, json, type Ctx, type Handler } from './context';
import { advanceBody } from './schemas';

type Route = (ctx: Ctx) => Promise<Response> | Response;

/** Rute bernama `"METODE segmen"`. */
const ROUTES: Record<string, Route> = {
  'GET info': ({ db }) =>
    json({
      institutionId: DEMO_INSTITUTION_ID,
      accounts: db.meta.contoh ? DEMO_ACCOUNTS : [],
      members: DEMO_MEMBERS,
      password: DEMO_PASSWORD,
      offsetDays: Math.round(db.clock.demoOffsetMs / DAY),
      now: nowFor(db, DEMO_INSTITUTION_ID),
      pendingAnchors: Object.values(db.evidence).filter((e) => !e.anchor_id && e.blob_ready).length,
    }),
  'POST advance': async ({ req, db }) => {
    const x = await bodyOf(advanceBody, req);
    const days = Math.min(30, Math.max(1, Math.round(Number(x.days) || 1)));
    db.clock.demoOffsetMs += days * DAY;
    audit(db, 'demo', 'jam-demo-maju', `+${days} hari`);
    await tick(db);
    persist(db);
    return json({ offsetDays: Math.round(db.clock.demoOffsetMs / DAY) });
  },
  'POST anchor-now': ({ db }) => {
    const sealed = sealAnchors(db, true);
    return json({
      sealed: !!sealed,
      root: sealed?.merkle_root ?? null,
      size: sealed?.jumlah_hash ?? 0,
    });
  },
  'POST reset': async ({ db }) => {
    // pengaman: hanya boleh bila seluruh institusi di basis data ini fiktif
    if (!Object.values(db.institutions).every((i) => i.demo))
      throw new HttpError(403, 'Reset ditolak: basis data memuat institusi non-demo.');
    await resetDb();
    return json({ ok: true });
  },
};

/** Rute `/api/demo/*`: hanya aktif saat Mode Demo menyala. */
export const demo: Handler = (ctx) => {
  const [a, b] = ctx.seg;
  if (a !== 'demo') return;
  if (!demoEnabled()) throw new HttpError(404, 'Mode Demo dinonaktifkan');
  if (!limiters.misc.check('demo:' + ipHash(clientIp(ctx.req)), 60, 60_000))
    throw new HttpError(429, 'Terlalu cepat.');
  return ROUTES[`${ctx.method} ${b}`]?.(ctx);
};
