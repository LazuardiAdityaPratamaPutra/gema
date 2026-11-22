/** Passkey PRF: sisi server (rahasia PRF disimulasikan; WebAuthn asli diuji di peramban). */
import { beforeAll, describe, expect, it } from 'vitest';
import { b64u, randomBytes } from '@gema/crypto';
import { call, newAccount, setup } from './helpers';

beforeAll(setup, 120_000);

const pk = () => ({
  credId: b64u(randomBytes(32)),
  salt: b64u(randomBytes(32)),
  authKey: b64u(randomBytes(32)),
  wrappedKek: b64u(randomBytes(60)),
});

describe('passkey', () => {
  it('pasang, masuk dengan passkey, dan sesi membuka brankas asli', async () => {
    const acc = await newAccount();
    const body = pk();
    expect((await call('GET', 'auth/passkey', { token: acc.token })).data.set).toBe(false);
    expect((await call('POST', 'auth/passkey', { token: acc.token, body })).status).toBe(201);
    expect((await call('GET', 'auth/passkey', { token: acc.token })).data.set).toBe(true);

    const ch = await call('POST', 'auth/passkey/challenge', { body: { caseCode: acc.code } });
    expect(ch.data).toEqual({ credId: body.credId, salt: body.salt });
    const login = await call('POST', 'auth/passkey/login', {
      body: { caseCode: acc.code, authKey: body.authKey },
    });
    expect(login.status).toBe(200);
    expect(login.data.wrappedKek).toBe(body.wrappedKek);
    expect(login.data.scopeId).toBe(acc.scope);
    const mine = await call('GET', 'me/reports', { token: login.data.token });
    expect(mine.status).toBe(200);
  }, 60_000);

  it('tantangan untuk kode tanpa passkey atau tak dikenal: palsu, stabil, seragam', async () => {
    const acc = await newAccount();
    const a = await call('POST', 'auth/passkey/challenge', { body: { caseCode: acc.code } });
    const b = await call('POST', 'auth/passkey/challenge', { body: { caseCode: acc.code } });
    const c = await call('POST', 'auth/passkey/challenge', { body: { caseCode: 'ZZZZZZZZZZZZ' } });
    expect(a.data).toEqual(b.data);
    expect(Object.keys(c.data).sort()).toEqual(['credId', 'salt']);
    expect(a.data.credId).not.toBe(c.data.credId);
  }, 60_000);

  it('rahasia salah ditolak seragam lalu dibatasi laju', async () => {
    const acc = await newAccount();
    await call('POST', 'auth/passkey', { token: acc.token, body: pk() });
    for (let i = 0; i < 5; i++)
      expect(
        (
          await call('POST', 'auth/passkey/login', {
            body: { caseCode: acc.code, authKey: b64u(randomBytes(32)) },
          })
        ).status,
      ).toBe(401);
    expect(
      (
        await call('POST', 'auth/passkey/login', {
          body: { caseCode: acc.code, authKey: b64u(randomBytes(32)) },
        })
      ).status,
    ).toBe(429);
  }, 60_000);

  it('dapat dicabut, dan data cacat ditolak', async () => {
    const acc = await newAccount();
    const body = pk();
    expect(
      (await call('POST', 'auth/passkey', { token: acc.token, body: { ...body, salt: 'x' } }))
        .status,
    ).toBe(400);
    await call('POST', 'auth/passkey', { token: acc.token, body });
    await call('DELETE', 'auth/passkey', { token: acc.token });
    expect(
      (
        await call('POST', 'auth/passkey/login', {
          body: { caseCode: acc.code, authKey: body.authKey },
        })
      ).status,
    ).toBe(401);
  }, 60_000);
});
