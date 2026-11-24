/** Pengaman bawaan: mode demo, kepercayaan IP, ketahanan penyimpanan, batas unggahan. */
import fs from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
// helpers dulu: ia mengatur GEMA_DATA_DIR sebelum db.ts dimuat
import { call, dir, newAccount, setup } from '../helpers';
import { b64u, generateCaseCode, randomBytes } from '@gema/crypto';
import { demoEnabled } from '@/server/demo-flag';
import { clientIpFrom } from '@/server/util';
import { getDb } from '@/server/db';
import { readSession } from '@/server/logic';
import { handle } from '@/server/router';

beforeAll(setup, 120_000);

describe('mode demo aman-secara-bawaan', () => {
  it('di produksi hanya aktif bila GEMA_DEMO=on', () => {
    const env = (e: Record<string, string>) => e as unknown as NodeJS.ProcessEnv;
    expect(demoEnabled(env({ NODE_ENV: 'production' }))).toBe(false);
    expect(demoEnabled(env({ NODE_ENV: 'production', GEMA_DEMO: 'off' }))).toBe(false);
    expect(demoEnabled(env({ NODE_ENV: 'production', GEMA_DEMO: 'on' }))).toBe(true);
    expect(demoEnabled(env({ NODE_ENV: 'development' }))).toBe(true);
    expect(demoEnabled(env({ NODE_ENV: 'development', GEMA_DEMO: 'off' }))).toBe(false);
  });

  it('demo nonaktif: reset dan masuk tanpa sandi ditolak', async () => {
    const was = process.env.GEMA_DEMO;
    process.env.GEMA_DEMO = 'off';
    try {
      expect((await call('POST', 'demo/reset')).status).toBe(404);
      const r = await call('POST', 'satgas/login', { body: { demoRole: 'Ketua' } });
      expect(r.status).toBe(401);
    } finally {
      if (was === undefined) delete process.env.GEMA_DEMO;
      else process.env.GEMA_DEMO = was;
    }
  });

  it('reset ditolak bila basis data memuat institusi non-demo', async () => {
    const db = await getDb();
    db.institutions['inst-nyata'] = {
      ...db.institutions['inst-demo'],
      id: 'inst-nyata',
      nama: 'Kampus Nyata',
      demo: false,
    };
    try {
      const r = await call('POST', 'demo/reset');
      expect(r.status).toBe(403);
      expect(Object.keys((await getDb()).institutions)).toContain('inst-nyata');
    } finally {
      delete db.institutions['inst-nyata'];
    }
  });
});

describe('alamat klien tidak bisa dipalsukan lewat x-forwarded-for', () => {
  it('memakai entri dari kanan sesuai jumlah proksi tepercaya', () => {
    expect(clientIpFrom('6.6.6.6, 203.0.113.9', 1)).toBe('203.0.113.9');
    expect(clientIpFrom('6.6.6.6, 7.7.7.7, 203.0.113.9', 1)).toBe('203.0.113.9');
    expect(clientIpFrom('6.6.6.6, 203.0.113.9, 10.0.0.1', 2)).toBe('203.0.113.9');
    expect(clientIpFrom('203.0.113.9', 3)).toBe('203.0.113.9');
    expect(clientIpFrom(null)).toBe('lokal');
  });

  it('pembatas buat-akun tidak dilewati dengan menambah entri palsu di kiri', async () => {
    const post = (spoof: string) => {
      const slot = () => ({ authKey: b64u(randomBytes(32)), vaultBlob: b64u(randomBytes(4096)) });
      return handle(
        new Request('http://localhost/api/auth/register', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-forwarded-for': `${spoof}, 198.51.100.77`,
          },
          body: JSON.stringify({ caseCode: generateCaseCode(), slots: [slot(), slot()] }),
        }),
        'POST',
        ['auth', 'register'],
      );
    };
    let ditolak = 0;
    for (let i = 0; i < 24; i++) if ((await post(`9.9.${i}.1`)).status === 429) ditolak++;
    expect(ditolak).toBeGreaterThanOrEqual(4); // batas 20 per jaringan, walau kiri selalu berganti
  }, 60_000);
});

describe('konfirmasi hanya setelah data ditulis', () => {
  it('permintaan pengubah sudah ada di disk saat dijawab (tanpa menunggu 300 ms)', async () => {
    const acc = await newAccount();
    const onDisk = JSON.parse(fs.readFileSync(path.join(dir, 'db.json'), 'utf8'));
    expect(
      Object.values(onDisk.reporters).some(
        (r) => (r as { case_code: string }).case_code === acc.code,
      ),
    ).toBe(true);
  }, 60_000);
});

describe('pencarian sidik tidak menjadi oracle keberadaan bukti nyata', () => {
  it('bukti institusi non-demo tidak dapat ditemukan lewat sidik', async () => {
    const acc = await newAccount();
    const sess = readSession('Bearer ' + acc.token);
    if (!sess || sess.kind !== 'reporter') throw new Error('sesi uji tidak ada');
    const db = await getDb();
    const sha = 'ab'.repeat(32);
    db.reports['lap-lookup'] = {
      ...Object.values(db.reports)[0],
      id: 'lap-lookup',
      scope_id: sess.scope_id,
    };
    db.evidence['ev-lookup'] = {
      ...Object.values(db.evidence)[0],
      id: 'ev-lookup',
      report_id: 'lap-lookup',
      sha256_asli: sha,
    };
    const inst = db.institutions[db.reports['lap-lookup'].institution_id];
    const was = inst.demo;
    try {
      inst.demo = true;
      expect((await call('GET', `public/lookup/${sha}`)).data.found).toBe(true);
      inst.demo = false;
      expect((await call('GET', `public/lookup/${sha}`)).data.found).toBe(false);
    } finally {
      inst.demo = was;
      delete db.reports['lap-lookup'];
      delete db.evidence['ev-lookup'];
    }
  }, 60_000);
});

describe('batas unggahan', () => {
  it('menolak badan terlalu besar lewat Content-Length sebelum membacanya', async () => {
    const acc = await newAccount();
    const sess = readSession('Bearer ' + acc.token);
    if (!sess || sess.kind !== 'reporter') throw new Error('sesi uji tidak ada');
    const db = await getDb();
    const rid = 'lap-uji-besar';
    db.reports[rid] = {
      ...Object.values(db.reports)[0],
      id: rid,
      scope_id: sess.scope_id,
      reporter_id: sess.reporter_id,
    };
    db.evidence['ev-uji-besar'] = {
      ...Object.values(db.evidence)[0],
      id: 'ev-uji-besar',
      report_id: rid,
    };
    const put = (len: number) =>
      handle(
        new Request('http://localhost/api/evidence/ev-uji-besar/blob', {
          method: 'PUT',
          headers: { authorization: 'Bearer ' + acc.token, 'content-length': String(len) },
          body: new Uint8Array(64),
        }),
        'PUT',
        ['evidence', 'ev-uji-besar', 'blob'],
      );
    expect((await put(30 * 1024 * 1024)).status).toBe(413);
    expect((await put(64)).status).toBe(200); // ukuran wajar tetap diterima
    delete db.reports[rid];
    delete db.evidence['ev-uji-besar'];
  }, 60_000);
});
