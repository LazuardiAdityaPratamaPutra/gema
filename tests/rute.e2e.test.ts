/** Pemetaan rute: setiap modul di src/server/routes menjawab jalurnya, dan jalur asing berakhir 404. */
import { beforeAll, describe, expect, it } from 'vitest';
import { call, newAccount, setup } from './helpers';

beforeAll(setup, 120_000);

const demoToken = async (role: string) =>
  (await call('POST', 'satgas/login', { body: { demoRole: role } })).data.token as string;

describe('router', () => {
  it('jalur tak dikenal dan metode yang tidak cocok dijawab 404', async () => {
    expect((await call('GET', 'tidak-ada')).status).toBe(404);
    expect((await call('GET', 'public/tidak-ada')).status).toBe(404);
    expect((await call('DELETE', 'public/institutions')).status).toBe(404);
  });
});

describe('rute publik', () => {
  it('health, daftar institusi, dan anchor tersedia tanpa masuk', async () => {
    expect((await call('GET', 'public/health')).data.ok).toBe(true);
    const inst = await call('GET', 'public/institutions');
    expect(inst.status).toBe(200);
    expect(await call('GET', 'public/anchors')).toMatchObject({ status: 200 });
  });
});

describe('rute akun', () => {
  it('pendaftaran menolak data tidak lengkap dan kode yang salah bentuk', async () => {
    expect(
      (await call('POST', 'auth/register', { body: { caseCode: 'x', slots: [] } })).status,
    ).toBe(400);
  });

  it('masuk dengan kunci salah ditolak seragam, keluar mencabut sesi', async () => {
    const acc = await newAccount();
    const bad = await call('POST', 'auth/login', {
      body: { caseCode: acc.code, authKey: 'AAAA' },
    });
    expect(bad.status).toBe(401);
    expect((await call('GET', 'me/reports', { token: acc.token })).status).toBe(200);
    await call('POST', 'auth/logout', { token: acc.token });
    expect((await call('GET', 'me/reports', { token: acc.token })).status).toBe(401);
  });
});

describe('rute pelapor', () => {
  it('butuh sesi pelapor; sesi Satgas tidak diterima', async () => {
    expect((await call('GET', 'me/reports')).status).toBe(401);
    const ketua = await demoToken('Ketua');
    expect((await call('GET', 'me/reports', { token: ketua })).status).toBe(401);
  });

  it('laporan milik orang lain atau yang tidak ada dijawab 404', async () => {
    const acc = await newAccount();
    const r = await call('POST', 'reports/tidak-ada/escalate', {
      token: acc.token,
      body: { escalationId: 'x', mode: 'tunggal', wrapped: {} },
    });
    expect(r.status).toBe(404);
  });
});

describe('rute Satgas', () => {
  it('butuh sesi Satgas; sesi pelapor tidak diterima', async () => {
    expect((await call('GET', 'satgas/cases')).status).toBe(401);
    const acc = await newAccount();
    expect((await call('GET', 'satgas/cases', { token: acc.token })).status).toBe(401);
  });

  it('mengganti kunci hanya untuk Ketua; audit hanya Auditor dan Ketua', async () => {
    const anggota = await demoToken('Anggota');
    expect((await call('POST', 'satgas/key', { token: anggota, body: {} })).status).toBe(403);
    expect((await call('GET', 'satgas/audit', { token: anggota })).status).toBe(403);
    const auditor = await demoToken('Auditor');
    expect((await call('GET', 'satgas/audit', { token: auditor })).status).toBe(200);
  });

  it('masuk dengan sandi salah ditolak', async () => {
    const r = await call('POST', 'satgas/login', {
      body: { email: 'tidak@ada.id', password: 'salah-salah' },
    });
    expect(r.status).toBe(401);
  });
});

describe('rute cron', () => {
  it('catatan komit selalu butuh rahasia; tick hanya bila rahasia dikonfigurasi', async () => {
    const was = process.env.GEMA_CRON_SECRET;
    try {
      delete process.env.GEMA_CRON_SECRET;
      expect((await call('POST', 'cron/commit-ref', { body: {} })).status).toBe(401);
      expect((await call('GET', 'cron/tick')).status).toBe(200);
      process.env.GEMA_CRON_SECRET = 'rahasia-uji';
      expect((await call('GET', 'cron/tick')).status).toBe(401);
      expect((await call('GET', 'cron/tick', { token: 'rahasia-uji' })).status).toBe(200);
      const salah = await call('POST', 'cron/commit-ref', {
        token: 'rahasia-uji',
        body: { date: '1999-01-01', commitRef: 'zzz' },
      });
      expect(salah.status).toBe(400);
    } finally {
      if (was === undefined) delete process.env.GEMA_CRON_SECRET;
      else process.env.GEMA_CRON_SECRET = was;
    }
  });
});
