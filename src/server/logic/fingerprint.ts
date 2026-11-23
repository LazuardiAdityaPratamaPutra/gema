import crypto from 'node:crypto';
import { deriveInstitutionKey, evaluateBatch, MAX_EVALUATIONS_PER_REPORT } from '@gema/oprf';
import { secretSeed } from '../db';
import type { DB, Session } from '../types';
import { DAY, HttpError } from '../util';
import { institutionOf } from './institusi';
import { ipHash, limiters as RL } from './sesi';

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
