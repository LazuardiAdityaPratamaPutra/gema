/** Eskalasi Bersyarat: laporan baru dieskalasi sendiri hanya bila cukup pelapor berbeda cocok pada terlapor yang sama. */
import { beforeAll, describe, expect, it } from 'vitest';
import { b64u, randomBytes } from '@gema/crypto';
import { wrapForSatgas } from '@gema/pq-kem';
import { call, newAccount, setup, submitReport } from './helpers';

beforeAll(setup, 120_000);

const wrap = async (inst: any, escId: string) =>
  wrapForSatgas(randomBytes(32), inst.publicKey, { institutionId: inst.id, escalationId: escId });

async function inst() {
  const r = await call('GET', 'public/institutions');
  return r.data.find((i: any) => i.id === 'inst-demo');
}
async function myReport(token: string) {
  return (await call('GET', 'me/reports', { token })).data.reports[0];
}

describe('Eskalasi Bersyarat', () => {
  it('menunggu sampai syarat terpenuhi, lalu mengeskalasi kedua laporan atas persetujuan awal', async () => {
    const i = await inst();
    const a = await newAccount();
    const b = await newAccount();
    const nama = 'Dr. Candra Pratama Uji Bersyarat';
    expect((await submitReport(a, nama, {})).res.status).toBe(201);
    const ra = await myReport(a.token);

    const eid = b64u(randomBytes(9));
    const set = await call('POST', `reports/${ra.id}/bersyarat`, {
      token: a.token,
      body: { escalationId: eid, wrapped: await wrap(i, eid), minSize: 2, prioritas: true },
    });
    expect(set.status).toBe(201);
    expect(set.data.fired).toBe(false);
    const pending = await myReport(a.token);
    expect(pending.status).toBe('tersimpan');
    expect(pending.conditional).toEqual({ minSize: 2, prioritas: true });
    expect(pending.escalation).toBeNull();

    // Pelapor kedua dengan terlapor yang sama memicu eskalasi laporan pertama.
    expect((await submitReport(b, nama, {})).res.status).toBe(201);
    const done = await myReport(a.token);
    expect(done.status).toBe('tereskalasi');
    expect(done.conditional).toBeNull();
    expect(done.escalation.sumber).toBe('bersama');
    expect(done.escalation.events.map((e: any) => e.label).join(' ')).toMatch(/otomatis/);
    // Laporan kedua tidak memasang syarat, jadi tetap tersimpan.
    expect((await myReport(b.token)).status).toBe('tersimpan');

    // Satgas melihat kasus Prioritas tanpa tahu siapa pelapornya.
    const k = await call('POST', 'satgas/login', { body: { demoRole: 'Ketua' } });
    const cases = await call('GET', 'satgas/cases', { token: k.data.token });
    const mine = cases.data.cases.find((c: any) => c.alias === done.escalation.alias);
    expect(mine).toBeTruthy();
    expect(mine.prioritas).toBe(true);
  }, 120_000);

  it('langsung berjalan bila klaster sudah memenuhi syarat saat dipasang', async () => {
    const i = await inst();
    const a = await newAccount();
    const b = await newAccount();
    const nama = 'Prof. Dewi Anjani Uji Langsung';
    await submitReport(a, nama, {});
    await submitReport(b, nama, {});
    const rb = await myReport(b.token);
    const eid = b64u(randomBytes(9));
    const set = await call('POST', `reports/${rb.id}/bersyarat`, {
      token: b.token,
      body: { escalationId: eid, wrapped: await wrap(i, eid), minSize: 2 },
    });
    expect(set.data.fired).toBe(true);
    expect((await myReport(b.token)).status).toBe('tereskalasi');
  }, 120_000);

  it('dapat dicabut sebelum terpenuhi; setelah dicabut laporan baru tidak memicu apa pun', async () => {
    const i = await inst();
    const a = await newAccount();
    const b = await newAccount();
    const nama = 'Bapak Eko Saputra Uji Cabut';
    await submitReport(a, nama, {});
    const ra = await myReport(a.token);
    const eid = b64u(randomBytes(9));
    await call('POST', `reports/${ra.id}/bersyarat`, {
      token: a.token,
      body: { escalationId: eid, wrapped: await wrap(i, eid), minSize: 2 },
    });
    const del = await call('DELETE', `reports/${ra.id}/bersyarat`, { token: a.token });
    expect(del.status).toBe(200);
    await submitReport(b, nama, {});
    const after = await myReport(a.token);
    expect(after.status).toBe('tersimpan');
    expect(after.conditional).toBeNull();
  }, 120_000);

  it('menolak syarat di luar 2 sampai 5, pembungkus kosong, dan laporan orang lain', async () => {
    const i = await inst();
    const a = await newAccount();
    const other = await newAccount();
    await submitReport(a, 'Ibu Fitri Uji Tolak', {});
    const ra = await myReport(a.token);
    const eid = b64u(randomBytes(9));
    const wrapped = await wrap(i, eid);
    for (const minSize of [1, 6, 'x'])
      expect(
        (
          await call('POST', `reports/${ra.id}/bersyarat`, {
            token: a.token,
            body: { escalationId: eid, wrapped, minSize },
          })
        ).status,
      ).toBe(400);
    expect(
      (
        await call('POST', `reports/${ra.id}/bersyarat`, {
          token: a.token,
          body: { escalationId: eid, wrapped: {}, minSize: 2 },
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await call('POST', `reports/${ra.id}/bersyarat`, {
          token: other.token,
          body: { escalationId: eid, wrapped, minSize: 2 },
        })
      ).status,
    ).toBe(404);
  }, 120_000);

  it('menarik eskalasi juga mencabut syarat agar tidak dieskalasi ulang', async () => {
    const i = await inst();
    const a = await newAccount();
    const b = await newAccount();
    const c = await newAccount();
    const nama = 'Pak Gunawan Uji Tarik';
    await submitReport(a, nama, {});
    const ra = await myReport(a.token);
    const eid = b64u(randomBytes(9));
    await call('POST', `reports/${ra.id}/bersyarat`, {
      token: a.token,
      body: { escalationId: eid, wrapped: await wrap(i, eid), minSize: 2 },
    });
    await submitReport(b, nama, {});
    expect((await myReport(a.token)).status).toBe('tereskalasi');
    expect(
      (await call('POST', `reports/${ra.id}/withdraw`, { token: a.token, body: {} })).status,
    ).toBe(200);
    await submitReport(c, nama, {});
    expect((await myReport(a.token)).status).toBe('tersimpan');
  }, 180_000);
});
