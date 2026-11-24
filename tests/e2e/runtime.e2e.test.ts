/** Sesi, pembatas laju, dan tantangan bertahan saat server restart. */
import { beforeAll, describe, expect, it } from 'vitest';
// helpers dulu: ia mengatur GEMA_DATA_DIR sebelum db.ts dimuat
import { call, dir, newAccount, setup } from '../helpers';
import { b64u, randomBytes } from '@gema/crypto';
import { fileBackend } from '@/server/backends/file';
import { flush, getDb, swapBackend } from '@/server/db';

beforeAll(setup, 120_000);

async function restart() {
  await flush(await getDb());
  swapBackend(fileBackend(dir));
  await getDb();
}

describe('keadaan runtime bertahan setelah restart', () => {
  it('sesi pelapor dan Satgas tetap berlaku', async () => {
    const acc = await newAccount();
    const ketua = (await call('POST', 'satgas/login', { body: { demoRole: 'Ketua' } })).data.token;
    await restart();
    expect((await call('GET', 'me/reports', { token: acc.token })).status).toBe(200);
    expect((await call('GET', 'satgas/me', { token: ketua })).status).toBe(200);
  }, 60_000);

  it('keluar menghapus sesi secara permanen', async () => {
    const acc = await newAccount();
    await call('POST', 'auth/logout', { token: acc.token });
    await restart();
    expect((await call('GET', 'me/reports', { token: acc.token })).status).toBe(401);
  }, 60_000);

  it('hitungan gagal masuk tidak direset oleh restart', async () => {
    const acc = await newAccount();
    const bad = () =>
      call('POST', 'auth/login', { body: { caseCode: acc.code, authKey: b64u(randomBytes(32)) } });
    for (let i = 0; i < 4; i++) expect((await bad()).status).toBe(401);
    await restart();
    expect((await bad()).status).toBe(401); // percobaan ke-5
    expect((await bad()).status).toBe(429);
  }, 60_000);

  it('tantangan Bukti Pemilik yang belum dipakai tetap berlaku', async () => {
    const ketua = (await call('POST', 'satgas/login', { body: { demoRole: 'Ketua' } })).data.token;
    const caseId = (await call('GET', 'satgas/cases', { token: ketua })).data.cases[0].id;
    const ch = (await call('POST', `satgas/cases/${caseId}/challenge`, { token: ketua, body: {} }))
      .data.challenge;
    await restart();
    const r = await call('POST', `satgas/cases/${caseId}/verify-owner`, {
      token: ketua,
      body: { challenge: ch, proof: 'x' },
    });
    expect(r.status).toBe(200); // dikenal (bukan 410); buktinya salah, bukan tantangannya
    expect(r.data.valid).toBe(false);
  }, 60_000);

  it('token yang tersimpan hanya berupa hash, bukan token asli', async () => {
    const acc = await newAccount();
    await flush(await getDb());
    const fs = await import('node:fs');
    const path = await import('node:path');
    const raw = fs.readFileSync(path.join(dir, 'db.json'), 'utf8');
    expect(raw.includes(acc.token)).toBe(false);
  }, 60_000);
});
