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
import { bodyOf, clientIp, json, reporterSession, type Ctx, type Handler } from './context';
import {
  caseCodeBody,
  decoyBody,
  loginBody,
  passkeySetBody,
  recoverFinishBody,
  recoverySetBody,
  registerBody,
} from './schemas';

type Route = (ctx: Ctx) => Promise<Response> | Response;

const rl = ({ req }: Ctx) => {
  if (!limiters.misc.check('rl:' + ipHash(clientIp(req)), 120, 15 * 60_000))
    throw new HttpError(429, 'Terlalu banyak percobaan dari jaringan ini. Coba lagi nanti.');
};

/** Rute bernama `"METODE segmen[/segmen]"`. Pemeriksaan sesi selalu mendahului pembacaan isi. */
const ROUTES: Record<string, Route> = {
  'POST register': async ({ req, db }) =>
    json(registerReporter(db, await bodyOf(registerBody, req), clientIp(req)), 201),
  'POST login': async (ctx) => {
    rl(ctx);
    return json(loginReporter(ctx.db, await bodyOf(loginBody, ctx.req)));
  },
  'POST logout': ({ req }) => {
    endSession(req.headers.get('authorization'));
    return json({ ok: true });
  },
  'POST decoy': async ({ req, db }) =>
    json(setDecoy(db, reporterSession(req), await bodyOf(decoyBody, req))),

  'GET passkey': ({ req, db }) => json(passkeyStatus(db, reporterSession(req))),
  'POST passkey': async ({ req, db }) =>
    json(setPasskey(db, reporterSession(req), await bodyOf(passkeySetBody, req)), 201),
  'DELETE passkey': ({ req, db }) => {
    clearPasskey(db, reporterSession(req));
    return json({ ok: true });
  },
  'POST passkey/challenge': async ({ req, db }) =>
    json(passkeyChallenge(db, await bodyOf(caseCodeBody, req))),
  'POST passkey/login': async ({ req, db }) =>
    json(loginWithPasskey(db, await bodyOf(loginBody, req))),

  'GET recovery': ({ req, db }) => json(recoveryStatus(db, reporterSession(req))),
  'POST recovery': async ({ req, db }) =>
    json(setRecovery(db, reporterSession(req), await bodyOf(recoverySetBody, req)), 201),
  'DELETE recovery': ({ req, db }) => {
    clearRecovery(db, reporterSession(req));
    return json({ ok: true });
  },
  'POST recover': async ({ req, db }) => json(startRecovery(db, await bodyOf(loginBody, req))),
  'POST recover/finish': async ({ req, db }) =>
    json(finishRecovery(db, reporterSession(req), await bodyOf(recoverFinishBody, req))),
};

/** Rute `/api/auth/*`: akun anonim, kunci sandi (passkey), dan pemulihan. */
export const akun: Handler = (ctx) => {
  const [a, b, c] = ctx.seg;
  if (a !== 'auth') return;
  return ROUTES[`${ctx.method} ${[b, c].filter(Boolean).join('/')}`]?.(ctx);
};
