/** Pemulihan lewat orang tepercaya: fungsi klien asli dijalankan terhadap router. */
import { beforeAll, describe, expect, it } from 'vitest';
import { b64u, deriveAccountKeys, fromB64u, randomBytes, unwrapKey } from '@gema/crypto';
import { AAD } from '@/lib/report-format';
import type { ReporterSession } from '@/lib/store';
import {
  clearRecovery,
  makeShares,
  recoverAccount,
  recoveryStatus,
  secretFromShares,
  setupRecovery,
} from '@/lib/recovery';
import { call, installFetch, ITER, newAccount, setup, submitReport } from './helpers';

beforeAll(async () => {
  await setup();
  installFetch();
}, 120_000);

const sessionOf = (acc: Awaited<ReturnType<typeof newAccount>>): ReporterSession => ({
  token: acc.token,
  scopeId: acc.scope,
  kek: b64u(acc.keys.kek),
  caseCode: acc.code,
  vault: { t: 'real' },
});

describe('bagian rahasia', () => {
  it('dua bagian mana pun memulihkan rahasia yang sama; satu bagian, ganda, dan rusak ditolak', () => {
    const r = randomBytes(32);
    const s = makeShares(r);
    for (const [i, j] of [
      [0, 1],
      [0, 2],
      [2, 1],
    ])
      expect(secretFromShares([s[i], s[j]])).toEqual(r);
    expect(() => secretFromShares([s[0]])).toThrow(/dua bagian/i);
    expect(() => secretFromShares([s[0], s[0]])).toThrow(/sama/);
    expect(() => secretFromShares([s[0], s[1].slice(0, -2) + 'AA'])).toThrow(/salah ketik/);
    expect(() => secretFromShares([s[0], 'asal'])).toThrow(/tidak dikenali/);
  });
});

describe('pemulihan akun', () => {
  it('lupa kata sandi: Kode Kasus + dua bagian memulihkan laporan dengan kata sandi baru', async () => {
    const acc = await newAccount();
    const nama = 'Dr. Pemulihan Uji Satu';
    await submitReport(acc, nama, {});
    const s = sessionOf(acc);
    expect((await recoveryStatus(s)).set).toBe(false);
    const shares = await setupRecovery(s);
    expect(shares).toHaveLength(3);
    expect((await recoveryStatus(s)).set).toBe(true);

    // kata sandi lama hilang → pulihkan dengan bagian 1 dan 3
    const baru = 'kata sandi baru yang segar sekali';
    await recoverAccount(acc.code, [shares[0], shares[2]], baru);

    // kata sandi lama tidak lagi berlaku
    const lama = await call('POST', 'auth/login', {
      body: { caseCode: acc.code, authKey: b64u(acc.keys.authKey) },
    });
    expect(lama.status).toBe(401);
    // kata sandi baru berlaku dan laporan terbaca dengan kunci baru
    const k = await deriveAccountKeys(acc.code, baru, ITER);
    const login = await call('POST', 'auth/login', {
      body: { caseCode: acc.code, authKey: b64u(k.authKey) },
    });
    expect(login.status).toBe(200);
    const rep = (await call('GET', 'me/reports', { token: login.data.token })).data.reports[0];
    const dek = await unwrapKey(k.kek, fromB64u(rep.secrets.dek_wrapped_klien), AAD.dek);
    expect(dek).toHaveLength(32);
    // pemulihan sekali pakai: harus dipasang ulang
    expect(
      (await recoveryStatus({ ...s, token: login.data.token, scopeId: login.data.scopeId })).set,
    ).toBe(false);
    await expect(
      recoverAccount(acc.code, [shares[0], shares[1]], 'sandi lain lagi untuk uji'),
    ).rejects.toThrow();
  }, 180_000);

  it('bagian salah atau Kode Kasus salah ditolak seragam, lalu dibatasi laju', async () => {
    const acc = await newAccount();
    const s = sessionOf(acc);
    await setupRecovery(s);
    const asing = makeShares(randomBytes(32));
    for (let i = 0; i < 5; i++)
      await expect(
        recoverAccount(acc.code, [asing[0], asing[1]], 'sandi baru uji lagi'),
      ).rejects.toThrow(/tidak cocok/);
    await expect(
      recoverAccount(acc.code, [asing[0], asing[1]], 'sandi baru uji lagi'),
    ).rejects.toThrow(/Terlalu banyak/);
  }, 120_000);

  it('akun tanpa pemulihan: pesan sama seperti bagian salah (tidak membocorkan keberadaan)', async () => {
    const acc = await newAccount();
    const asing = makeShares(randomBytes(32));
    await expect(
      recoverAccount(acc.code, [asing[0], asing[1]], 'sandi baru uji tiga'),
    ).rejects.toThrow(/tidak cocok/);
    await expect(
      recoverAccount('ABCDEFGH2345', [asing[0], asing[1]], 'sandi baru uji tiga'),
    ).rejects.toThrow(/tidak cocok/);
  }, 60_000);

  it('dapat dicabut; setelah dicabut bagian lama tak berguna', async () => {
    const acc = await newAccount();
    const s = sessionOf(acc);
    const shares = await setupRecovery(s);
    await clearRecovery(s);
    expect((await recoveryStatus(s)).set).toBe(false);
    await expect(
      recoverAccount(acc.code, [shares[0], shares[1]], 'sandi baru uji empat'),
    ).rejects.toThrow(/tidak cocok/);
  }, 120_000);

  it('sesi pemulihan tidak bisa dipakai tanpa pemulihan aktif, dan Kode Paksa tak boleh sama dengan sandi baru', async () => {
    const acc = await newAccount();
    const fin = await call('POST', 'auth/recover/finish', {
      token: acc.token,
      body: { authKey: b64u(randomBytes(32)), vaultBlob: '', deks: [] },
    });
    expect(fin.status).toBe(403);
  }, 60_000);
});
