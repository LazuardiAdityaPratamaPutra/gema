import { DEMO_ACCOUNTS, DEMO_INSTITUTION_ID, DEMO_MEMBERS, DEMO_PASSWORD } from '@/lib/demo';
import { persist, resetDb } from '../db';
import { audit, ipHash, limiters, nowFor, sealAnchors, tick } from '../logic';
import { demoEnabled } from '../demo-flag';
import { DAY, HttpError } from '../util';
import { body, clientIp, json, type Handler } from './context';

/** Rute `/api/demo/*`: hanya aktif saat Mode Demo menyala. */
export const demo: Handler = async ({ method, seg: [a, b], req, db }) => {
  if (a !== 'demo') return;
  if (!demoEnabled()) throw new HttpError(404, 'Mode Demo dinonaktifkan');
  if (!limiters.misc.check('demo:' + ipHash(clientIp(req)), 60, 60_000))
    throw new HttpError(429, 'Terlalu cepat.');

  if (b === 'info' && method === 'GET')
    return json({
      institutionId: DEMO_INSTITUTION_ID,
      accounts: DEMO_ACCOUNTS,
      members: DEMO_MEMBERS,
      password: DEMO_PASSWORD,
      offsetDays: Math.round(db.clock.demoOffsetMs / DAY),
      now: nowFor(db, DEMO_INSTITUTION_ID),
      pendingAnchors: Object.values(db.evidence).filter((e) => !e.anchor_id && e.blob_ready).length,
    });

  if (b === 'advance' && method === 'POST') {
    const x = await body<{ days?: number }>(req);
    const days = Math.min(30, Math.max(1, Math.round(Number(x.days) || 1)));
    db.clock.demoOffsetMs += days * DAY;
    audit(db, 'demo', 'jam-demo-maju', `+${days} hari`);
    await tick(db);
    persist(db);
    return json({ offsetDays: Math.round(db.clock.demoOffsetMs / DAY) });
  }

  if (b === 'anchor-now' && method === 'POST') {
    const sealed = sealAnchors(db, true);
    return json({
      sealed: !!sealed,
      root: sealed?.merkle_root ?? null,
      size: sealed?.jumlah_hash ?? 0,
    });
  }

  if (b === 'reset' && method === 'POST') {
    // pengaman: hanya boleh bila seluruh institusi di basis data ini fiktif
    if (!Object.values(db.institutions).every((i) => i.demo))
      throw new HttpError(403, 'Reset ditolak: basis data memuat institusi non-demo.');
    await resetDb();
    return json({ ok: true });
  }
};
