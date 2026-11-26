/** Mode sungguhan (demo mati): akun admin dari variabel lingkungan, tanpa data rekaan, dan kunci Satgas milik Ketua. */
import { beforeAll, describe, expect, it } from 'vitest';
import { b64u, randomBytes } from '@gema/crypto';
import { generateHybridKeypair, wrapForSatgas } from '@gema/pq-kem';
import { call, newAccount, setup, submitReport } from '../helpers';
import { getDb } from '@/server/db';
import { parseAkunAdmin, provisionAdmin } from '@/server/seed/admin';

const INST = 'inst-upnjatim';
const SANDI = 'sandi-ketua-yang-panjang';
const akun = (password = SANDI) =>
  JSON.stringify([
    { email: 'Ketua@UPNJatim.ac.id', nama: 'Ketua Uji', role: 'Ketua', password },
    {
      email: 'anggota@upnjatim.ac.id',
      nama: 'Anggota Uji',
      role: 'Anggota',
      password: 'sandi-anggota-panjang',
    },
  ]);

beforeAll(async () => {
  process.env.GEMA_DEMO = 'off';
  process.env.GEMA_SATGAS_AKUN = akun();
  await setup();
}, 120_000);

const masuk = (email: string, password: string, extra: object = {}) =>
  call('POST', 'satgas/login', { body: { email, password, ...extra } });

describe('mode sungguhan: awal bersih', () => {
  it('hanya institusi asli, tanpa data rekaan dan tanpa akun demo', async () => {
    const db = await getDb();
    expect(Object.keys(db.institutions)).toEqual([INST]);
    expect(db.institutions[INST].demo).toBe(false);
    expect(db.institutions[INST].kunci_siap).toBe(false);
    expect(db.meta.contoh).toBeUndefined();
    expect(Object.keys(db.reports)).toHaveLength(0);
    expect(Object.keys(db.reporters)).toHaveLength(0);
    expect(
      Object.values(db.members)
        .map((m) => m.email)
        .sort(),
    ).toEqual(['anggota@upnjatim.ac.id', 'ketua@upnjatim.ac.id']);
    expect(Object.values(db.members).some((m) => m.email.endsWith('@contoh.ac.id'))).toBe(false);
  });

  it('config publik menyatakan demo mati, dan rute demo ditolak', async () => {
    expect((await call('GET', 'public/config')).data).toEqual({ demo: false });
    expect((await call('GET', 'demo/info')).status).toBe(404);
    expect((await call('POST', 'demo/reset')).status).toBe(404);
  });

  it('institusi publik menyatakan kunci belum siap', async () => {
    const r = await call('GET', 'public/institutions');
    expect(r.data).toHaveLength(1);
    expect(r.data[0]).toMatchObject({ id: INST, demo: false, kunciSiap: false });
  });
});

describe('mode sungguhan: masuk Satgas', () => {
  it('akun dari variabel lingkungan bisa masuk; email tidak peka huruf besar', async () => {
    const r = await masuk('KETUA@upnjatim.ac.id', SANDI);
    expect(r.status).toBe(200);
    expect(r.data.member.role).toBe('Ketua');
    expect(r.data.institution).toMatchObject({ id: INST, demo: false, kunciSiap: false });
  });

  it('sandi salah, akun tak dikenal, dan akun demo lama ditolak', async () => {
    expect((await masuk('ketua@upnjatim.ac.id', 'salah-salah-salah')).status).toBe(401);
    expect((await masuk('tidak-ada@upnjatim.ac.id', SANDI)).status).toBe(401);
    expect((await masuk('ketua@contoh.ac.id', 'contoh-demo-2026')).status).toBe(401);
  });

  it('demoRole tidak menggantikan sandi, juga bila email akun asli diberikan', async () => {
    expect((await masuk('ketua@upnjatim.ac.id', '', { demoRole: 'Ketua' })).status).toBe(401);
    expect(
      (
        await call('POST', 'satgas/login', {
          body: { email: 'ketua@upnjatim.ac.id', demoRole: 'Ketua' },
        })
      ).status,
    ).toBe(401);
    expect((await call('POST', 'satgas/login', { body: { demoRole: 'Ketua' } })).status).toBe(401);
  });

  it('kata sandi yang diganti di variabel lingkungan berlaku setelah muat ulang', async () => {
    process.env.GEMA_SATGAS_AKUN = akun('sandi-baru-yang-panjang');
    await provisionAdmin(await getDb());
    expect((await masuk('ketua@upnjatim.ac.id', SANDI)).status).toBe(401);
    expect((await masuk('ketua@upnjatim.ac.id', 'sandi-baru-yang-panjang')).status).toBe(200);
    process.env.GEMA_SATGAS_AKUN = akun();
    await provisionAdmin(await getDb());
    expect((await masuk('ketua@upnjatim.ac.id', SANDI)).status).toBe(200);
  });
});

describe('mode sungguhan: eskalasi menunggu kunci Ketua', () => {
  const wrap = (pub: any, escId: string) =>
    wrapForSatgas(randomBytes(32), pub, { institutionId: INST, escalationId: escId });

  it('ditolak sebelum Ketua membuat kunci, lalu berjalan sesudahnya', async () => {
    const pelapor = await newAccount();
    const { res } = await submitReport(pelapor, 'Dr. Contoh Sungguhan Uji', {}, 'bukti uji', INST);
    expect(res.status).toBe(201);
    const rep = (await call('GET', 'me/reports', { token: pelapor.token })).data.reports[0];

    const sebelum = (await call('GET', 'public/institutions')).data[0];
    const e1 = b64u(randomBytes(9));
    const tolak = await call('POST', `reports/${rep.id}/escalate`, {
      token: pelapor.token,
      body: { escalationId: e1, wrapped: await wrap(sebelum.publicKey, e1), mode: 'tunggal' },
    });
    expect(tolak.status).toBe(409);
    expect(tolak.data.error).toMatch(/belum menyiapkan kunci/i);
    const e2 = b64u(randomBytes(9));
    const tolakSyarat = await call('POST', `reports/${rep.id}/bersyarat`, {
      token: pelapor.token,
      body: { escalationId: e2, wrapped: await wrap(sebelum.publicKey, e2), minSize: 2 },
    });
    expect(tolakSyarat.status).toBe(409);
    expect((await call('GET', 'me/reports', { token: pelapor.token })).data.reports[0].status).toBe(
      'tersimpan',
    );

    const ketua = (await masuk('ketua@upnjatim.ac.id', SANDI)).data.token;
    const anggota = (await masuk('anggota@upnjatim.ac.id', 'sandi-anggota-panjang')).data.token;
    const baru = generateHybridKeypair();
    expect(
      (await call('POST', 'satgas/key', { token: anggota, body: { publicKey: baru.publicKey } }))
        .status,
    ).toBe(403);
    expect(
      (await call('POST', 'satgas/key', { token: ketua, body: { publicKey: baru.publicKey } }))
        .status,
    ).toBe(200);

    const sesudah = (await call('GET', 'public/institutions')).data[0];
    expect(sesudah.kunciSiap).toBe(true);
    expect(sesudah.publicKey).toEqual(baru.publicKey);
    expect((await call('GET', 'satgas/me', { token: ketua })).data.institution.kunciSiap).toBe(
      true,
    );

    const e3 = b64u(randomBytes(9));
    const ok = await call('POST', `reports/${rep.id}/escalate`, {
      token: pelapor.token,
      body: { escalationId: e3, wrapped: await wrap(sesudah.publicKey, e3), mode: 'tunggal' },
    });
    expect(ok.status).toBe(201);
  }, 120_000);
});

describe('parseAkunAdmin', () => {
  const ok = { email: 'a@b.ac.id', nama: 'A', role: 'Ketua', password: 'sandi-panjang-12' };
  it('menerima daftar yang sah dan membersihkan email', () => {
    expect(parseAkunAdmin(JSON.stringify([{ ...ok, email: ' A@B.ac.id ' }]))[0].email).toBe(
      'a@b.ac.id',
    );
    expect(parseAkunAdmin(undefined)).toEqual([]);
    expect(parseAkunAdmin('  ')).toEqual([]);
  });
  it.each([
    ['bukan JSON', '{rusak'],
    ['daftar kosong', '[]'],
    ['email salah', JSON.stringify([{ ...ok, email: 'tanpa-at' }])],
    ['email kembar', JSON.stringify([ok, { ...ok, role: 'Anggota' }])],
    ['sandi pendek', JSON.stringify([{ ...ok, password: 'pendek' }])],
    ['peran tak dikenal', JSON.stringify([{ ...ok, role: 'Raja' }])],
    ['nama kosong', JSON.stringify([{ ...ok, nama: ' ' }])],
    ['tanpa Ketua', JSON.stringify([{ ...ok, role: 'Anggota' }])],
  ])('menolak %s', (_, raw) => {
    expect(() => parseAkunAdmin(raw)).toThrow();
  });
});
