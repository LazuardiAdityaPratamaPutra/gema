/** Mode Empat Mata: dosir hanya terbuka bila anggota lain yang berbeda menyetujui. */
import { beforeAll, describe, expect, it } from 'vitest';
import { cabutEmpatMata, call, setup } from '../helpers';

beforeAll(setup, 120_000);

const login = async (role: string) =>
  (await call('POST', 'satgas/login', { body: { demoRole: role } })).data.token as string;

describe('Mode Empat Mata', () => {
  it('hanya Ketua yang boleh mengubah mode panel', async () => {
    const anggota = await login('Anggota');
    expect(
      (await call('POST', 'satgas/panel', { token: anggota, body: { mode: '2dari3' } })).status,
    ).toBe(403);
    const ketua = await login('Ketua');
    expect(
      (await call('POST', 'satgas/panel', { token: ketua, body: { mode: 'ngawur' } })).status,
    ).toBe(400);
    const ok = await call('POST', 'satgas/panel', { token: ketua, body: { mode: '2dari3' } });
    expect(ok.data.panelMode).toBe('2dari3');
    expect((await call('GET', 'satgas/me', { token: ketua })).data.institution.panelMode).toBe(
      '2dari3',
    );
  });

  it('dosir terkunci sampai anggota lain menyetujui; persetujuan tidak bisa untuk diri sendiri', async () => {
    const ketua = await login('Ketua');
    const pimpinan = await login('Pimpinan');
    const anggota = await login('Anggota');
    const cases = await call('GET', 'satgas/cases', { token: ketua });
    const id = cases.data.cases[0].id;

    const locked = await call('GET', `satgas/cases/${id}`, { token: ketua });
    expect(locked.status).toBe(403);
    expect(locked.data.needApproval).toBe(true);

    const req = await call('POST', `satgas/cases/${id}/approval`, { token: ketua, body: {} });
    expect(req.status).toBe(201);
    const aid = req.data.approval.id;
    // permintaan kedua tidak menggandakan
    expect(
      (await call('POST', `satgas/cases/${id}/approval`, { token: ketua, body: {} })).data.approval
        .id,
    ).toBe(aid);

    expect(
      (await call('POST', `satgas/approvals/${aid}/approve`, { token: ketua, body: {} })).status,
    ).toBe(403);
    const auditor = await login('Auditor');
    expect(
      (await call('POST', `satgas/approvals/${aid}/approve`, { token: auditor, body: {} })).status,
    ).toBe(403);

    const waiting = await call('GET', 'satgas/approvals', { token: pimpinan });
    expect(waiting.data.menungguKamu.map((a: any) => a.id)).toContain(aid);

    expect(
      (await call('POST', `satgas/approvals/${aid}/approve`, { token: pimpinan, body: {} })).status,
    ).toBe(200);
    expect((await call('GET', `satgas/cases/${id}`, { token: ketua })).status).toBe(200);
    // persetujuan hanya berlaku untuk pemohon: Anggota tetap terkunci
    expect((await call('GET', `satgas/cases/${id}`, { token: anggota })).status).toBe(403);
    // jejak audit mencatat permintaan dan persetujuan
    const log = (await call('GET', 'satgas/audit', { token: ketua })).data.entries.map(
      (e: any) => e.aksi,
    );
    expect(log).toEqual(
      expect.arrayContaining(['minta-persetujuan-dosir', 'setujui-akses-dosir', 'ubah-mode-panel']),
    );
  });

  it('persetujuan kedaluwarsa setelah 30 menit (jam demo)', async () => {
    const ketua = await login('Ketua');
    const pimpinan = await login('Pimpinan');
    const cases = await call('GET', 'satgas/cases', { token: ketua });
    const id = cases.data.cases[1].id;
    const aid = (await call('POST', `satgas/cases/${id}/approval`, { token: ketua, body: {} })).data
      .approval.id;
    await call('POST', `satgas/approvals/${aid}/approve`, { token: pimpinan, body: {} });
    expect((await call('GET', `satgas/cases/${id}`, { token: ketua })).status).toBe(200);
    await call('POST', 'demo/advance', { body: { days: 1 } });
    expect((await call('GET', `satgas/cases/${id}`, { token: ketua })).status).toBe(403);
  });

  it('mode tunggal tidak meminta persetujuan', async () => {
    const ketua = await login('Ketua');
    await cabutEmpatMata(ketua, await login('Pimpinan'));
    const cases = await call('GET', 'satgas/cases', { token: ketua });
    expect(
      (await call('GET', `satgas/cases/${cases.data.cases[0].id}`, { token: ketua })).status,
    ).toBe(200);
  });

  it('Ketua tidak bisa mematikan Empat Mata sendirian; butuh persetujuan anggota lain', async () => {
    const ketua = await login('Ketua');
    const pimpinan = await login('Pimpinan');
    const anggota = await login('Anggota');
    await call('POST', 'satgas/panel', { token: ketua, body: { mode: '2dari3' } });

    const minta = await call('POST', 'satgas/panel', { token: ketua, body: { mode: 'tunggal' } });
    expect(minta.status).toBe(409);
    expect(minta.data.error).toMatch(/persetujuan anggota panel lain/);
    expect((await call('GET', 'satgas/me', { token: ketua })).data.institution.panelMode).toBe(
      '2dari3',
    );

    // Ketua tidak bisa menyetujui permintaannya sendiri; Auditor/Pengawas tidak berwenang
    const milikku = await call('GET', 'satgas/approvals', { token: ketua });
    const mine = milikku.data.milikku.find((x: { cabut?: boolean }) => x.cabut);
    expect(
      (await call('POST', `satgas/approvals/${mine.id}/approve`, { token: ketua, body: {} }))
        .status,
    ).toBe(403);

    // permintaan yang sama tidak menggandakan antrean
    await call('POST', 'satgas/panel', { token: ketua, body: { mode: 'tunggal' } });
    const antre = await call('GET', 'satgas/approvals', { token: anggota });
    expect(antre.data.menungguKamu.filter((x: { cabut?: boolean }) => x.cabut)).toHaveLength(1);

    await call('POST', `satgas/approvals/${mine.id}/approve`, { token: pimpinan, body: {} });
    const ok = await call('POST', 'satgas/panel', { token: ketua, body: { mode: 'tunggal' } });
    expect(ok.status).toBe(200);
    expect(ok.data.panelMode).toBe('tunggal');

    // izin sekali pakai: mematikan lagi setelah mengaktifkan ulang butuh persetujuan baru
    await call('POST', 'satgas/panel', { token: ketua, body: { mode: '2dari3' } });
    expect(
      (await call('POST', 'satgas/panel', { token: ketua, body: { mode: 'tunggal' } })).status,
    ).toBe(409);
    await cabutEmpatMata(ketua, pimpinan);
  });
});
