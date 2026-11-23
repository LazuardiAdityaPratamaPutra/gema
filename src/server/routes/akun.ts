import { endSession, ipHash, limiters, loginReporter, registerReporter, setDecoy } from '../logic';
import {
  clearPasskey,
  clearRecovery,
  finishRecovery,
  loginWithPasskey,
  passkeyChallenge,
  passkeyStatus,
  recoveryStatus,
  setPasskey,
  setRecovery,
  startRecovery,
} from '../logic-akun';
import { HttpError } from '../util';
import { body, clientIp, json, reporterSession, type Handler } from './context';

/** Rute `/api/auth/*`: akun anonim, kunci sandi (passkey), dan pemulihan. */
export const akun: Handler = async ({ method, seg: [a, b, c], req, db }) => {
  if (a !== 'auth') return;

  if (b === 'register' && method === 'POST')
    return json(registerReporter(db, (await body(req)) as never, clientIp(req)), 201);

  if (b === 'login' && method === 'POST') {
    if (!limiters.misc.check('rl:' + ipHash(clientIp(req)), 120, 15 * 60_000))
      throw new HttpError(429, 'Terlalu banyak percobaan dari jaringan ini. Coba lagi nanti.');
    return json(loginReporter(db, (await body(req)) as never));
  }

  if (b === 'logout' && method === 'POST') {
    endSession(req.headers.get('authorization'));
    return json({ ok: true });
  }

  if (b === 'decoy' && method === 'POST')
    return json(setDecoy(db, reporterSession(req), (await body(req)) as never));

  if (b === 'passkey') {
    if (!c && method === 'GET') return json(passkeyStatus(db, reporterSession(req)));
    if (!c && method === 'POST')
      return json(setPasskey(db, reporterSession(req), (await body(req)) as never), 201);
    if (!c && method === 'DELETE') {
      clearPasskey(db, reporterSession(req));
      return json({ ok: true });
    }
    if (c === 'challenge' && method === 'POST')
      return json(passkeyChallenge(db, (await body(req)) as never));
    if (c === 'login' && method === 'POST')
      return json(loginWithPasskey(db, (await body(req)) as never));
  }

  if (b === 'recovery') {
    if (method === 'GET') return json(recoveryStatus(db, reporterSession(req)));
    if (method === 'POST')
      return json(setRecovery(db, reporterSession(req), (await body(req)) as never), 201);
    if (method === 'DELETE') {
      clearRecovery(db, reporterSession(req));
      return json({ ok: true });
    }
  }

  if (b === 'recover' && method === 'POST') {
    if (!c) return json(startRecovery(db, (await body(req)) as never));
    if (c === 'finish')
      return json(finishRecovery(db, reporterSession(req), (await body(req)) as never));
  }
};
