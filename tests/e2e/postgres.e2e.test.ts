/** Backend Postgres dijalankan di Postgres sungguhan (PGlite, WASM) lewat router yang sama. */
import { PGlite } from '@electric-sql/pglite';
// helpers dulu: ia mengatur GEMA_DATA_DIR sebelum db.ts dimuat
import { call, newAccount, setup, submitReport } from '../helpers';
import { beforeAll, describe, expect, it } from 'vitest';
import { flush, getDb, swapBackend } from '@/server/db';
import { postgresBackend, type Queryable } from '@/server/backends/postgres';

const pg = new PGlite();
const log: string[] = [];
const spy: Queryable = {
  async query(text, params) {
    log.push(text.trim().split(/\s+/).slice(0, 3).join(' '));
    return pg.query(text, params as never) as never;
  },
};
const backend = postgresBackend(spy);

beforeAll(async () => {
  swapBackend(backend);
  await setup(); // memuat router → seed demo ke Postgres
}, 180_000);

describe('backend Postgres', () => {
  it('seed demo tersimpan sebagai satu baris per koleksi', async () => {
    await flush(await getDb());
    const { rows } = await pg.query('SELECT key FROM gema_state ORDER BY key');
    const keys = rows.map((r) => (r as { key: string }).key);
    expect(keys).toEqual(
      expect.arrayContaining([
        'institutions',
        'reports',
        'evidence',
        'fingerprints',
        'audit',
        'approvals',
      ]),
    );
    const blobs = await pg.query('SELECT count(*)::int AS n FROM gema_blobs');
    expect((blobs.rows[0] as { n: number }).n).toBeGreaterThan(0);
  });

  it('laporan dan blob bukti bertahan setelah "restart" (muat ulang dari Postgres)', async () => {
    const acc = await newAccount();
    const content = 'isi bukti untuk uji Postgres';
    const { res, built } = await submitReport(acc, 'Dr. Postgres Uji', {}, content);
    expect(res.status).toBe(201);
    const evId = res.data.evidence[0].id;
    await flush(await getDb());

    // restart: buang cache proses, backend sama
    swapBackend(backend);
    const reloaded = await getDb();
    expect(reloaded.evidence[evId]).toBeTruthy();
    expect(
      Object.values(reloaded.reports).some(
        (r) =>
          r.reporter_id ===
          Object.values(reloaded.reporters).find((x) => x.case_code === acc.code)?.id,
      ),
    ).toBe(true);
    const blob = await call('GET', `evidence/${evId}/blob`, { token: acc.token });
    expect(blob.status).toBe(200);
    expect((blob.data as Uint8Array).length).toBe(built.evidence[0].blob.length);
  }, 180_000);

  it('hanya koleksi yang berubah yang ditulis ulang', async () => {
    await flush(await getDb());
    log.length = 0;
    const db = await getDb();
    db.clock.demoOffsetMs += 1; // ubah satu koleksi saja
    await flush(db);
    const writes = log.filter((l) => l.startsWith('INSERT INTO gema_state'));
    expect(writes).toHaveLength(1);
  });

  it('menghapus laporan menghapus blobnya di Postgres (crypto-shredding)', async () => {
    const acc = await newAccount();
    const { res } = await submitReport(acc, 'Pak Hapus Postgres', {});
    const evId = res.data.evidence[0].id;
    const repId = (await call('GET', 'me/reports', { token: acc.token })).data.reports[0].id;
    expect((await pg.query('SELECT 1 FROM gema_blobs WHERE id = $1', [evId])).rows.length).toBe(1);
    expect((await call('DELETE', `reports/${repId}`, { token: acc.token })).status).toBe(200);
    expect((await pg.query('SELECT 1 FROM gema_blobs WHERE id = $1', [evId])).rows.length).toBe(0);
  }, 180_000);

  it('mode Postgres mewajibkan kunci OPRF dari secret manager', async () => {
    const { secretSeed } = await import('@/server/db');
    const prev = process.env.DATABASE_URL;
    const master = process.env.GEMA_OPRF_MASTER;
    delete process.env.GEMA_OPRF_MASTER;
    process.env.DATABASE_URL = 'postgres://x';
    expect(() => secretSeed()).toThrow(/GEMA_OPRF_MASTER/);
    process.env.DATABASE_URL = prev;
    if (prev === undefined) delete process.env.DATABASE_URL;
    if (master) process.env.GEMA_OPRF_MASTER = master;
  });
});
