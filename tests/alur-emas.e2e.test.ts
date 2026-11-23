/**
 * Alur emas: satu skenario deterministik yang sama dengan yang diperagakan di video demo.
 * Setiap langkah memeriksa pasangan lolos/gagal, bukan sekadar "tampil".
 *
 *  1. Bukti utuh lolos, bukti diubah satu karakter gagal
 *  2. Syarat bersyarat belum terpenuhi: Satgas belum melihat apa pun
 *  3. Syarat terpenuhi: kasus muncul tanpa identitas pelapor
 *  4. Empat Mata: satu orang terkunci; setelah anggota lain berbeda menyetujui, terbuka
 *  5. Status hanya maju satu langkah; jejak audit berantai hash utuh
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { b64u, randomBytes, sha256, toHex, utf8 } from '@gema/crypto';
import { wrapForSatgas } from '@gema/pq-kem';
import { call, newAccount, setup, submitReport } from './helpers';

beforeAll(setup, 120_000);

const login = async (role: string) =>
  (await call('POST', 'satgas/login', { body: { demoRole: role } })).data.token as string;

describe('alur emas Gema', () => {
  it('berjalan dari laporan sampai pertanggungjawaban', async () => {
    const BERKAS = 'ekspor chat fiktif: "jangan bilang siapa-siapa"';
    const nama = 'Dr. Contoh Alur Emas Fiktif';
    const a = await newAccount();
    const b = await newAccount();

    // 1. Integritas bukti: asli lolos, diubah gagal
    expect((await submitReport(a, nama, {}, BERKAS)).res.status).toBe(201);
    const mine = (await call('GET', 'me/reports', { token: a.token })).data.reports[0];
    const sidik = mine.evidence[0].sha256 as string;
    expect(sidik).toBe(toHex(sha256(utf8(BERKAS))));
    await call('POST', 'demo/anchor-now');
    const asli = await call('GET', `public/lookup/${sidik}`);
    expect(asli.data.found).toBe(true);
    const diubah = toHex(sha256(utf8(BERKAS + '.')));
    expect(diubah).not.toBe(sidik);
    expect((await call('GET', `public/lookup/${diubah}`)).data.found).toBe(false);

    // 2. Bersyarat: syarat 2 pelapor belum terpenuhi → belum ada kasus untuk Satgas
    const inst = (await call('GET', 'public/institutions')).data.find(
      (i: { id: string }) => i.id === 'inst-demo',
    );
    const ketua = await login('Ketua');
    const sebelum = (await call('GET', 'satgas/cases', { token: ketua })).data.cases.length;
    const eid = b64u(randomBytes(9));
    const set = await call('POST', `reports/${mine.id}/bersyarat`, {
      token: a.token,
      body: {
        escalationId: eid,
        wrapped: await wrapForSatgas(randomBytes(32), inst.publicKey, {
          institutionId: inst.id,
          escalationId: eid,
        }),
        minSize: 2,
        prioritas: true,
      },
    });
    expect(set.status).toBe(201);
    expect(set.data.fired).toBe(false);
    expect((await call('GET', 'satgas/cases', { token: ketua })).data.cases.length).toBe(sebelum);
    expect((await call('GET', 'me/reports', { token: a.token })).data.reports[0].status).toBe(
      'tersimpan',
    );

    // 3. Pelapor kedua pada terlapor yang sama → syarat terpenuhi, kasus muncul tanpa identitas
    expect((await submitReport(b, nama, {})).res.status).toBe(201);
    const done = (await call('GET', 'me/reports', { token: a.token })).data.reports[0];
    expect(done.status).toBe('tereskalasi');
    const daftar = (await call('GET', 'satgas/cases', { token: ketua })).data.cases;
    expect(daftar.length).toBe(sebelum + 1);
    const kasus = daftar.find((c: { alias: string }) => c.alias === done.escalation.alias);
    expect(kasus.prioritas).toBe(true);
    expect(JSON.stringify(kasus)).not.toContain(a.code); // Kode Kasus pelapor tidak ada di sisi Satgas
    expect(JSON.stringify(kasus)).not.toContain(a.scope);

    // 4. Empat Mata: satu pihak tidak cukup
    await call('POST', 'satgas/panel', { token: ketua, body: { mode: '2dari3' } });
    const terkunci = await call('GET', `satgas/cases/${kasus.id}`, { token: ketua });
    expect(terkunci.status).toBe(403);
    const minta = await call('POST', `satgas/cases/${kasus.id}/approval`, {
      token: ketua,
      body: {},
    });
    expect(minta.status).toBe(201);
    const aid = minta.data.approval.id;
    expect(
      (await call('POST', `satgas/approvals/${aid}/approve`, { token: ketua, body: {} })).status,
    ).toBe(403); // tidak bisa menyetujui permintaan sendiri
    expect((await call('GET', `satgas/cases/${kasus.id}`, { token: ketua })).status).toBe(403);
    const pimpinan = await login('Pimpinan');
    expect(
      (await call('POST', `satgas/approvals/${aid}/approve`, { token: pimpinan, body: {} })).status,
    ).toBe(200);
    expect((await call('GET', `satgas/cases/${kasus.id}`, { token: ketua })).status).toBe(200);

    // 5. Status maju satu langkah saja; jejak audit berantai hash utuh
    const lompat = await call('POST', `satgas/cases/${kasus.id}/status`, {
      token: ketua,
      body: { to: 'Rekomendasi' },
    });
    expect(lompat.status).toBe(409);
    const maju = await call('POST', `satgas/cases/${kasus.id}/status`, {
      token: ketua,
      body: { to: 'Verifikasi' },
    });
    expect(maju.status).toBe(200);
    const log = (await call('GET', 'satgas/audit', { token: ketua })).data.entries as {
      prev_hash: string;
      hash: string;
      aksi: string;
    }[];
    const urut = [...log].reverse(); // terlama dulu
    for (let i = 1; i < urut.length; i++) expect(urut[i].prev_hash).toBe(urut[i - 1].hash);
    expect(log.map((e) => e.aksi)).toEqual(
      expect.arrayContaining(['setujui-akses-dosir', 'ubah-status:Verifikasi']),
    );
  }, 180_000);
});

describe('penanggung jawab kasus', () => {
  it('hanya Ketua yang menugaskan, hanya ke Ketua/Anggota institusi yang sama, tercatat di audit', async () => {
    const ketua = await login('Ketua');
    const anggota = await login('Anggota');
    const pimpinan = await login('Pimpinan');
    const kasus = (await call('GET', 'satgas/cases', { token: ketua })).data.cases[0];
    const team = (await call('GET', 'satgas/team', { token: ketua })).data.members as {
      id: string;
      nama: string;
      role: string;
    }[];
    const raka = team.find((m) => m.role === 'Anggota')!;
    expect((await call('GET', 'satgas/team', { token: anggota })).status).toBe(403);
    expect(
      (
        await call('POST', `satgas/cases/${kasus.id}/assign`, {
          token: anggota,
          body: { memberId: raka.id },
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await call('POST', `satgas/cases/${kasus.id}/assign`, {
          token: ketua,
          body: { memberId: 'tidak-ada' },
        })
      ).status,
    ).toBe(400);
    const ok = await call('POST', `satgas/cases/${kasus.id}/assign`, {
      token: ketua,
      body: { memberId: raka.id },
    });
    expect(ok.status).toBe(200);
    expect(ok.data.penanggungJawab).toBe(raka.nama);
    // terlihat di daftar (juga untuk Pimpinan, demi akuntabilitas)
    for (const t of [ketua, pimpinan]) {
      const row = (await call('GET', 'satgas/cases', { token: t })).data.cases.find(
        (c: { id: string }) => c.id === kasus.id,
      );
      expect(row.penanggungJawab).toBe(raka.nama);
    }
    const log = (await call('GET', 'satgas/audit', { token: ketua })).data.entries.map(
      (e: { aksi: string }) => e.aksi,
    );
    expect(log).toContain('tugaskan-kasus');
    // dapat dicabut
    expect(
      (
        await call('POST', `satgas/cases/${kasus.id}/assign`, {
          token: ketua,
          body: { memberId: null },
        })
      ).data.penanggungJawab,
    ).toBeNull();
  }, 60_000);
});
