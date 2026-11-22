import type { DB } from '../types';
import type { Backend } from './types';

/** Bagian yang dibutuhkan dari klien Postgres; `pg.Pool` dan PGlite sama-sama memenuhinya. */
export interface Queryable {
  query(text: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
}

export const SCHEMA = [
  `
CREATE TABLE IF NOT EXISTS gema_state (
  key        text PRIMARY KEY,
  data       jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
`,
  `CREATE TABLE IF NOT EXISTS gema_blobs (
  id         text PRIMARY KEY,
  data       bytea NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
`,
];

/**
 * Satu baris per koleksi (institutions, reports, evidence, …). Saat menyimpan, hanya koleksi yang
 * isinya berubah sejak penyimpanan terakhir yang ditulis. Blob terenkripsi disimpan sebagai bytea.
 *
 * Batas jujur: ini penyimpanan dokumen, bukan skema relasional dengan RLS, dan hanya satu instans
 * penulis yang aman (penulisan terakhir menang). Bagi penerapan sungguhan, pecah per tabel.
 */
export function postgresBackend(db: Queryable): Backend {
  const last = new Map<string, string>();
  let ready: Promise<unknown> | null = null;
  // Satu pernyataan per panggilan: klien tertentu (PGlite) menolak banyak perintah sekaligus.
  const init = () =>
    (ready ??= (async () => {
      for (const ddl of SCHEMA) await db.query(ddl);
    })());

  return {
    async load() {
      await init();
      const { rows } = await db.query('SELECT key, data FROM gema_state');
      if (!rows.length) return null;
      const out: Record<string, unknown> = {};
      for (const r of rows) {
        out[r.key as string] = r.data;
        last.set(r.key as string, JSON.stringify(r.data));
      }
      return out as unknown as DB;
    },
    async save(state) {
      await init();
      for (const [key, value] of Object.entries(state)) {
        const json = JSON.stringify(value);
        if (last.get(key) === json) continue;
        await db.query(
          `INSERT INTO gema_state (key, data) VALUES ($1, $2::jsonb)
           ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
          [key, json],
        );
        last.set(key, json);
      }
    },
    async blobWrite(id, data) {
      await init();
      await db.query(
        `INSERT INTO gema_blobs (id, data) VALUES ($1, $2)
         ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`,
        [id, Buffer.from(data)],
      );
    },
    async blobRead(id) {
      await init();
      const { rows } = await db.query('SELECT data FROM gema_blobs WHERE id = $1', [id]);
      const d = rows[0]?.data as Uint8Array | undefined;
      return d ? new Uint8Array(d) : null;
    },
    async blobDelete(id) {
      await init();
      await db.query('DELETE FROM gema_blobs WHERE id = $1', [id]);
    },
    async reset() {
      await init();
      await db.query('TRUNCATE gema_state, gema_blobs');
      last.clear();
    },
  };
}

/** Membuka koneksi dari DATABASE_URL. `pg` dimuat hanya bila dipakai. */
export async function connectPostgres(url: string): Promise<Backend> {
  const { Pool } = await import('pg');
  const pool = new Pool({
    connectionString: url,
    max: 5,
    ssl: /sslmode=disable|localhost|127\.0\.0\.1/.test(url)
      ? undefined
      : { rejectUnauthorized: true },
  });
  // Satu penulis saja: kunci penasihat dipegang selama proses hidup.
  const lock = await pool.connect();
  const got = await lock.query('SELECT pg_try_advisory_lock(727001) AS ok');
  if (!got.rows[0].ok)
    throw new Error(
      'Instans Gema lain sedang menulis ke basis data ini. Jalankan satu instans saja.',
    );
  return postgresBackend(pool as unknown as Queryable);
}
