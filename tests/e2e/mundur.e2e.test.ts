/** Mundur karena konflik kepentingan: yang mundur tidak bisa lagi membuka, menindak, atau menyetujui kasus itu. */
import { beforeAll, describe, expect, it } from 'vitest';
import { call, setup } from '../helpers';
import { loadedDb } from '@/server/db';

beforeAll(setup, 120_000);

const login = async (role: string) =>
  (await call('POST', 'satgas/login', { body: { demoRole: role } })).data.token as string;

type Row = { id: string; mundur?: boolean };
const daftar = async (token: string) =>
  (await call('GET', 'satgas/cases', { token })).data.cases as Row[];

describe('Mundur karena konflik kepentingan', () => {
  it('yang mundur terkunci dari kasus itu, yang lain tetap bisa', async () => {
    const ketua = await login('Ketua');
    const anggota = await login('Anggota');
    const id = (await daftar(ketua))[0].id;

    const r = await call('POST', `satgas/cases/${id}/mundur`, { token: anggota, body: {} });
    expect(r.status).toBe(200);

    for (const [metode, aksi, body] of [
      ['GET', '', undefined],
      ['POST', '/notes', { catatan_ciphertext: 'AAAA' }],
      ['POST', '/status', { to: 'Verifikasi' }],
      ['POST', '/approval', {}],
    ] as const) {
      const x = await call(metode, `satgas/cases/${id}${aksi}`, { token: anggota, body });
      expect(x.status, `${metode} ${aksi}`).toBe(403);
    }

    expect((await daftar(anggota)).find((c) => c.id === id)?.mundur).toBe(true);
    expect((await daftar(ketua)).find((c) => c.id === id)?.mundur).toBeUndefined();
    expect((await call('GET', `satgas/cases/${id}`, { token: ketua })).status).toBe(200);
  });

  it('dicatat sekali di audit dan terlihat di riwayat kasus, tanpa nama', async () => {
    const ketua = await login('Ketua');
    const anggota = await login('Anggota');
    const id = (await daftar(ketua))[0].id;
    await call('POST', `satgas/cases/${id}/mundur`, { token: anggota, body: {} }); // ulang: tidak menggandakan

    const log = (await call('GET', 'satgas/audit', { token: ketua })).data.entries.filter(
      (e: { aksi: string }) => e.aksi === 'mundur-konflik',
    );
    expect(log).toHaveLength(1);
    const events = (await call('GET', `satgas/cases/${id}`, { token: ketua })).data.events.filter(
      (e: { tipe: string }) => e.tipe === 'mundur',
    );
    expect(events).toHaveLength(1);
    expect(events[0].label).not.toMatch(/Anggota\b.*\b[A-Z][a-z]+ [A-Z]/);
  });

  it('peran di luar panel tidak bisa mundur, dan Ketua tidak bisa menugaskan yang sudah mundur', async () => {
    const ketua = await login('Ketua');
    const auditor = await login('Auditor');
    const id = (await daftar(ketua))[0].id;
    expect(
      (await call('POST', `satgas/cases/${id}/mundur`, { token: auditor, body: {} })).status,
    ).toBe(403);

    const tim = (await call('GET', 'satgas/team', { token: ketua })).data.members as {
      id: string;
      role: string;
    }[];
    const anggota = tim.find((m) => m.role === 'Anggota')!;
    const x = await call('POST', `satgas/cases/${id}/assign`, {
      token: ketua,
      body: { memberId: anggota.id },
    });
    expect(x.status).toBe(409);
  });

  it('penugasan otomatis lepas saat penanggung jawab mundur', async () => {
    const ketua = await login('Ketua');
    const anggota = await login('Anggota');
    const kasus = await daftar(ketua);
    const id = kasus[kasus.length - 1].id;
    const tim = (await call('GET', 'satgas/team', { token: ketua })).data.members as {
      id: string;
      role: string;
    }[];
    const a = tim.find((m) => m.role === 'Anggota')!;
    if (kasus.length > 1) {
      expect(
        (
          await call('POST', `satgas/cases/${id}/assign`, {
            token: ketua,
            body: { memberId: a.id },
          })
        ).status,
      ).toBe(200);
      await call('POST', `satgas/cases/${id}/mundur`, { token: anggota, body: {} });
      const pj = (await call('GET', `satgas/cases/${id}`, { token: ketua })).data.escalation
        .penanggungJawabId;
      expect(pj ?? null).toBeNull();
    }
  });

  it('yang sudah mundur tidak bisa menyetujui akses dosir kasus itu (Empat Mata)', async () => {
    const ketua = await login('Ketua');
    const anggota = await login('Anggota');
    const pimpinan = await login('Pimpinan');
    const kasus = await daftar(ketua);
    const id = kasus[kasus.length - 1].id;
    expect(
      (await call('POST', 'satgas/panel', { token: ketua, body: { mode: '2dari3' } })).status,
    ).toBe(200);
    await call('POST', `satgas/cases/${id}/mundur`, { token: anggota, body: {} });

    const req = await call('POST', `satgas/cases/${id}/approval`, { token: ketua, body: {} });
    const aid = req.data.approval.id;
    expect(
      (await call('POST', `satgas/approvals/${aid}/approve`, { token: anggota, body: {} })).status,
    ).toBe(403);
    expect(
      (await call('POST', `satgas/approvals/${aid}/approve`, { token: pimpinan, body: {} })).status,
    ).toBe(200);
  });

  it('endpoint kesehatan hanya untuk Ketua dan Auditor', async () => {
    const ketua = await login('Ketua');
    const anggota = await login('Anggota');
    expect((await call('GET', 'satgas/kesehatan', { token: ketua })).data.peringatan).toEqual([]);
    expect((await call('GET', 'satgas/kesehatan', { token: anggota })).status).toBe(403);
  });

  it('tick penjadwal mencatat kapan terakhir berjalan', async () => {
    expect((await call('GET', 'cron/tick')).status).toBe(200);
    expect(loadedDb().meta.cronTerakhir).toBeGreaterThan(Date.now() - 60_000);
  });
});
