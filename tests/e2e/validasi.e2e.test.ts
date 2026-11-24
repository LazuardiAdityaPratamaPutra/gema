/** Masukan salah bentuk di setiap rute yang membaca JSON dijawab 4xx, tidak pernah 5xx, dan galat tidak memuat nilai kiriman. */
import { beforeAll, describe, expect, it } from 'vitest';
import { call, newAccount, setup, submitReport } from '../helpers';

beforeAll(setup, 120_000);

const SALAH: Record<string, unknown> = {
  null: null,
  larik: [],
  teks: 'x',
  angka: 123,
  boolean: true,
  kosong: {},
  bersarang: { a: { b: [1, { c: 2 }] } },
  tipeSalah: {
    caseCode: 5,
    authKey: {},
    slots: 'x',
    blinded: 7,
    inputs: 'x',
    mode: [],
    to: 9,
    days: 'x',
    k: 'x',
    ownerPub: 5,
    memberId: 7,
    wrapped: 'x',
    escalationId: 3,
    challenge: 1,
    proof: 2,
    catatan_ciphertext: 4,
    publicKey: 'x',
  },
};

type Who = 'tamu' | 'pelapor' | 'ketua';

describe('validasi isi permintaan', () => {
  it('semua rute JSON menjawab 4xx untuk isi salah bentuk', async () => {
    const acc = await newAccount();
    const ketua = (await call('POST', 'satgas/login', { body: { demoRole: 'Ketua' } })).data
      .token as string;
    const { res } = await submitReport(acc, 'Pak Validasi', { role: 'dosen' });
    expect(res.status).toBe(201);
    const rid = res.data.id as string;
    const tokenOf = (w: Who) => (w === 'pelapor' ? acc.token : w === 'ketua' ? ketua : undefined);

    const rute: [string, string, Who][] = [
      ['POST', 'auth/register', 'tamu'],
      ['POST', 'auth/login', 'tamu'],
      ['POST', 'auth/passkey/challenge', 'tamu'],
      ['POST', 'auth/passkey/login', 'tamu'],
      ['POST', 'auth/recover', 'tamu'],
      ['POST', 'satgas/login', 'tamu'],
      ['POST', 'cron/commit-ref', 'tamu'],
      ['POST', 'oprf/evaluate', 'pelapor'],
      ['POST', 'fp/hmac', 'pelapor'],
      ['POST', 'reports', 'pelapor'],
      ['POST', 'auth/decoy', 'pelapor'],
      ['POST', 'auth/passkey', 'pelapor'],
      ['POST', 'auth/recovery', 'pelapor'],
      ['POST', 'auth/recover/finish', 'pelapor'],
      ['POST', `reports/${rid}/settings`, 'pelapor'],
      ['POST', `reports/${rid}/escalate`, 'pelapor'],
      ['POST', `reports/${rid}/owner`, 'pelapor'],
      ['POST', `reports/${rid}/bersyarat`, 'pelapor'],
      ['POST', 'satgas/panel', 'ketua'],
      ['POST', 'satgas/key', 'ketua'],
    ];

    const lolos5xx: string[] = [];
    for (const [m, p, who] of rute) {
      for (const [nama, body] of Object.entries(SALAH)) {
        const r = await call(m, p, { token: tokenOf(who), body });
        if (r.status >= 500) lolos5xx.push(`${p} <- ${nama}: ${r.status}`);
      }
    }
    expect(lolos5xx).toEqual([]);
  }, 300_000);

  it('galat menyebut nama kolom, bukan nilai yang dikirim', async () => {
    const rahasia = 'NILAI-RAHASIA-JANGAN-DIPANTULKAN';
    const r = await call('POST', 'auth/login', { body: { caseCode: rahasia, authKey: 42 } });
    expect(r.status).toBe(400);
    expect(JSON.stringify(r.data)).not.toContain(rahasia);
    expect(r.data.error).toContain('authKey');
  });

  it('kolom berlebih diabaikan dan permintaan sah tetap diterima', async () => {
    const acc = await newAccount();
    const r = await call('POST', 'auth/login', {
      body: { caseCode: acc.code, authKey: 'tidak-cocok', kolomAsing: { x: 1 } },
    });
    expect(r.status).toBeLessThan(500);
    expect(r.data.error).not.toContain('kolomAsing');
  });
  it('hash bukti rusak ditolak tanpa meninggalkan laporan setengah jadi', async () => {
    const acc = await newAccount();
    const rusak = {
      institutionId: 'inst-demo',
      unitId: 'u-ft',
      k: 2,
      secrets: { narasi_ciphertext: 'a', dek_wrapped_klien: 'b', bukti_meta_ciphertext: 'c' },
      fingerprints: [],
      evidence: [{ clientId: 'x', sha256: 'zz', messageRoot: null, messageCount: null, tipe: 't' }],
    };
    // Lebih dari batas 3 laporan aktif: bila sisa percobaan tertinggal, laporan sah akan ditolak.
    for (let i = 0; i < 4; i++) {
      const r = await call('POST', 'reports', { token: acc.token, body: rusak });
      expect(r.status).toBe(400);
      expect(r.data.error).toContain('Hash bukti tidak valid');
    }
    expect((await call('GET', 'me/reports', { token: acc.token })).data.reports).toHaveLength(0);
    const { res } = await submitReport(acc, 'Pak Setelah Rusak', { role: 'dosen' });
    expect(res.status).toBe(201);
  });
});
