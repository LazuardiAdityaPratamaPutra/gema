/** Bukti Pemilik (nol-pengetahuan): Satgas memastikan lawan bicaranya pemilik laporan tanpa tahu identitasnya. */
import { beforeAll, describe, expect, it } from 'vitest';
import { b64u, randomBytes } from '@gema/crypto';
import { wrapForSatgas } from '@gema/pq-kem';
import { ownerKeyFromDek, proveOwnership } from '@gema/zk';
import { call, newAccount, setup, submitReport } from '../helpers';

beforeAll(setup, 120_000);

async function escalated() {
  const acc = await newAccount();
  const { built } = await submitReport(acc, 'Dr. Pemilik Uji ' + b64u(randomBytes(4)), {});
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
  const ketua = (await call('POST', 'satgas/login', { body: { demoRole: 'Ketua' } })).data
    .token as string;
  return {
    acc,
    dek: built.dek,
    rep: mine,
    escId: escalationId,
    alias: mine.escalation.alias as string,
    ketua,
  };
}

describe('Bukti Pemilik', () => {
  it('pemilik sah dibuktikan; bukti sekali pakai dan terikat alias + tantangan', async () => {
    const x = await escalated();
    expect(x.rep.hasOwnerKey).toBe(true);
    const cases = (await call('GET', 'satgas/cases', { token: x.ketua })).data.cases;
    const caseId = cases.find((c: any) => c.alias === x.alias).id;

    const ch = await call('POST', `satgas/cases/${caseId}/challenge`, { token: x.ketua, body: {} });
    expect(ch.status).toBe(201);
    const key = ownerKeyFromDek(x.dek);
    const proof = proveOwnership(key, `${x.alias}|${ch.data.challenge}`);
    const ok = await call('POST', `satgas/cases/${caseId}/verify-owner`, {
      token: x.ketua,
      body: { challenge: ch.data.challenge, proof },
    });
    expect(ok.data.valid).toBe(true);
    // sekali pakai: ulangi bukti yang sama → tantangan sudah habis
    const again = await call('POST', `satgas/cases/${caseId}/verify-owner`, {
      token: x.ketua,
      body: { challenge: ch.data.challenge, proof },
    });
    expect(again.status).toBe(410);

    // penyamar tanpa kunci gagal, dan percobaannya tercatat
    const ch2 = await call('POST', `satgas/cases/${caseId}/challenge`, {
      token: x.ketua,
      body: {},
    });
    const fake = proveOwnership(
      ownerKeyFromDek(randomBytes(32)),
      `${x.alias}|${ch2.data.challenge}`,
    );
    const bad = await call('POST', `satgas/cases/${caseId}/verify-owner`, {
      token: x.ketua,
      body: { challenge: ch2.data.challenge, proof: fake },
    });
    expect(bad.data.valid).toBe(false);
    // bukti untuk tantangan lain tidak berlaku di tantangan ini
    const wrongCtx = proveOwnership(key, `${x.alias}|lain`);
    expect(
      (
        await call('POST', `satgas/cases/${caseId}/verify-owner`, {
          token: x.ketua,
          body: { challenge: ch2.data.challenge, proof: wrongCtx },
        })
      ).data.valid,
    ).toBe(false);

    const log = (await call('GET', 'satgas/audit', { token: x.ketua })).data.entries.map(
      (e: any) => e.aksi,
    );
    expect(log).toEqual(expect.arrayContaining(['bukti-pemilik-sah', 'bukti-pemilik-gagal']));
  }, 120_000);

  it('tantangan tak dikenal ditolak; peran tanpa akses dosir tidak bisa membuat tantangan', async () => {
    const x = await escalated();
    const caseId = (await call('GET', 'satgas/cases', { token: x.ketua })).data.cases.find(
      (c: any) => c.alias === x.alias,
    ).id;
    expect(
      (
        await call('POST', `satgas/cases/${caseId}/verify-owner`, {
          token: x.ketua,
          body: { challenge: 'tidakada', proof: 'x' },
        })
      ).status,
    ).toBe(410);
    const auditor = (await call('POST', 'satgas/login', { body: { demoRole: 'Auditor' } })).data
      .token;
    expect(
      (await call('POST', `satgas/cases/${caseId}/challenge`, { token: auditor, body: {} })).status,
    ).toBe(403);
  }, 120_000);

  it('laporan lama mendaftarkan kunci sekali; kunci kedua ditolak', async () => {
    const acc = await newAccount();
    const { built } = await submitReport(acc, 'Pak Lama Uji ' + b64u(randomBytes(4)), {});
    const rep = (await call('GET', 'me/reports', { token: acc.token })).data.reports[0];
    // laporan baru sudah punya kunci → pendaftaran ulang ditolak
    const dup = await call('POST', `reports/${rep.id}/owner`, {
      token: acc.token,
      body: { ownerPub: ownerKeyFromDek(randomBytes(32)).publicKey },
    });
    expect(dup.status).toBe(409);
    expect(rep.hasOwnerKey).toBe(true);
    expect(
      (
        await call('POST', `reports/${rep.id}/owner`, {
          token: acc.token,
          body: { ownerPub: 'ngawur' },
        })
      ).status,
    ).toBe(409);
    void built;
  }, 60_000);
});
