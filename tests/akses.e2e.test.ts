/** Audit kontrol akses untuk endpoint baru: tanpa sesi, lintas akun, lintas peran, dan celah melewati Empat Mata. */
import { beforeAll, describe, expect, it } from 'vitest';
import { b64u, randomBytes } from '@gema/crypto';
import { wrapForSatgas } from '@gema/pq-kem';
import { call, newAccount, setup, submitReport } from './helpers';

beforeAll(setup, 120_000);

const login = async (role: string) =>
  (await call('POST', 'satgas/login', { body: { demoRole: role } })).data.token as string;

describe('tanpa sesi → 401', () => {
  const cases: [string, string][] = [
    ['GET', 'auth/recovery'],
    ['POST', 'auth/recovery'],
    ['DELETE', 'auth/recovery'],
    ['GET', 'auth/passkey'],
    ['POST', 'auth/passkey'],
    ['DELETE', 'auth/passkey'],
    ['POST', 'auth/recover/finish'],
    ['POST', 'reports/abc/bersyarat'],
    ['DELETE', 'reports/abc/bersyarat'],
    ['POST', 'reports/abc/owner'],
    ['POST', 'satgas/panel'],
    ['GET', 'satgas/approvals'],
    ['POST', 'satgas/approvals/x/approve'],
    ['POST', 'satgas/cases/x/approval'],
    ['POST', 'satgas/cases/x/challenge'],
    ['POST', 'satgas/cases/x/verify-owner'],
  ];
  for (const [m, p] of cases)
    it(`${m} ${p}`, async () =>
      expect((await call(m, p, m === 'GET' ? {} : { body: {} })).status).toBe(401));
});

describe('lintas akun dan lintas peran', () => {
  it('akun lain tidak dapat memasang syarat atau kunci pemilik di laporan orang', async () => {
    const a = await newAccount();
    const b = await newAccount();
    await submitReport(a, 'Dr. Akses Uji ' + b64u(randomBytes(3)), {});
    const rep = (await call('GET', 'me/reports', { token: a.token })).data.reports[0];
    expect(
      (await call('POST', `reports/${rep.id}/bersyarat`, { token: b.token, body: { minSize: 2 } }))
        .status,
    ).toBe(404);
    expect((await call('DELETE', `reports/${rep.id}/bersyarat`, { token: b.token })).status).toBe(
      404,
    );
    expect(
      (await call('POST', `reports/${rep.id}/owner`, { token: b.token, body: { ownerPub: 'x' } }))
        .status,
    ).toBe(404);
  }, 60_000);

  it('peran tanpa wewenang ditolak untuk panel, persetujuan, dan tantangan', async () => {
    const auditor = await login('Auditor');
    const pengawas = await login('Pengawas');
    const ketua = await login('Ketua');
    const caseId = (await call('GET', 'satgas/cases', { token: ketua })).data.cases[0].id;
    for (const t of [auditor, pengawas]) {
      expect(
        (await call('POST', 'satgas/panel', { token: t, body: { mode: '2dari3' } })).status,
      ).toBe(403);
      expect((await call('GET', 'satgas/approvals', { token: t })).status).toBe(403);
      expect(
        (await call('POST', `satgas/cases/${caseId}/approval`, { token: t, body: {} })).status,
      ).toBe(403);
      expect(
        (await call('POST', `satgas/cases/${caseId}/challenge`, { token: t, body: {} })).status,
      ).toBe(403);
    }
    // sesi pelapor tidak bisa memakai rute Satgas
    const acc = await newAccount();
    expect(
      (await call('POST', 'satgas/panel', { token: acc.token, body: { mode: '2dari3' } })).status,
    ).toBe(401);
  }, 60_000);
});

describe('Empat Mata tidak bisa dilewati', () => {
  it('unduhan bukti mentah terkunci sampai disetujui, dan persetujuan tak bisa dipinjam anggota lain', async () => {
    const ketua = await login('Ketua');
    const anggota = await login('Anggota');
    const pimpinan = await login('Pimpinan');
    // kasus baru dengan bukti terunggah
    const acc = await newAccount();
    const { built } = await submitReport(acc, 'Pak Celah Uji ' + b64u(randomBytes(3)), {});
    const rep = (await call('GET', 'me/reports', { token: acc.token })).data.reports[0];
    const inst = (await call('GET', 'public/institutions')).data.find(
      (i: any) => i.id === 'inst-demo',
    );
    const escalationId = b64u(randomBytes(9));
    const wrapped = await wrapForSatgas(built.dek, inst.publicKey, {
      institutionId: inst.id,
      escalationId,
    });
    await call('POST', `reports/${rep.id}/escalate`, {
      token: acc.token,
      body: { escalationId, mode: 'tunggal', wrapped },
    });
    const mine = (await call('GET', 'me/reports', { token: acc.token })).data.reports[0];
    const evId = mine.evidence[0].id;
    const caseId = (await call('GET', 'satgas/cases', { token: ketua })).data.cases.find(
      (c: any) => c.alias === mine.escalation.alias,
    ).id;

    await call('POST', 'satgas/panel', { token: ketua, body: { mode: '2dari3' } });
    expect((await call('GET', `evidence/${evId}/blob`, { token: ketua })).status).toBe(403);
    expect((await call('GET', `satgas/cases/${caseId}`, { token: ketua })).status).toBe(403);

    const aid = (await call('POST', `satgas/cases/${caseId}/approval`, { token: ketua, body: {} }))
      .data.approval.id;
    await call('POST', `satgas/approvals/${aid}/approve`, { token: pimpinan, body: {} });
    expect((await call('GET', `evidence/${evId}/blob`, { token: ketua })).status).toBe(200);
    // Anggota tidak mewarisi persetujuan milik Ketua
    expect((await call('GET', `evidence/${evId}/blob`, { token: anggota })).status).toBe(403);
    // pelapor lain tidak dapat mengunduh bukti orang
    const other = await newAccount();
    expect((await call('GET', `evidence/${evId}/blob`, { token: other.token })).status).toBe(403);
    await call('POST', 'satgas/panel', { token: ketua, body: { mode: 'tunggal' } });
  }, 120_000);
});

describe('sesi lama dicabut setelah pemulihan', () => {
  it('token yang sudah ada sebelum pemulihan tidak berlaku lagi', async () => {
    const { setupRecovery, recoverAccount } = await import('@/lib/recovery');
    const { installFetch } = await import('./helpers');
    installFetch();
    const acc = await newAccount();
    const stolen = acc.token; // misalnya sesi di perangkat yang hilang
    const shares = await setupRecovery({
      token: acc.token,
      scopeId: acc.scope,
      kek: b64u(acc.keys.kek),
      caseCode: acc.code,
      vault: { t: 'real' },
    });
    await recoverAccount(acc.code, [shares[0], shares[1]], 'sandi baru segar untuk uji cabut');
    expect((await call('GET', 'me/reports', { token: stolen })).status).toBe(401);
  }, 120_000);
});
