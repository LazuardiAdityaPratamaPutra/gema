import { persist } from '../db';
import { tick } from '../logic';
import { HttpError } from '../util';
import { bodyOf, json, requireCronSecret, type Handler } from './context';
import { commitRefBody } from './schemas';

/** Rute `/api/cron/*`: dipanggil penjadwal, dilindungi `GEMA_CRON_SECRET`. */
export const cron: Handler = async ({ method, seg: [a, b], req, db }) => {
  if (a !== 'cron') return;

  if (b === 'tick') {
    requireCronSecret(req, false);
    return json(await tick(db));
  }

  if (b === 'commit-ref' && method === 'POST') {
    requireCronSecret(req, true);
    const x = await bodyOf(commitRefBody, req);
    const anchor = db.anchors.find((q) => q.tanggal === x.date);
    if (!anchor || !/^[0-9a-f]{7,64}$/.test(String(x.commitRef)))
      throw new HttpError(400, 'Data tidak valid');
    if (anchor.commit_ref) throw new HttpError(409, 'Komit sudah tercatat');
    anchor.commit_ref = String(x.commitRef);
    persist(db);
    return json({ ok: true });
  }
};
