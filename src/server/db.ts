/**
 * Penyimpanan data. Backend dipilih lewat lingkungan:
 *   tanpa DATABASE_URL  → berkas di .data/ (db.json + blobs/), satu instans
 *   DATABASE_URL=postgres://… → PostgreSQL (gema_state + gema_blobs), lihat backends/postgres.ts
 * Kunci HMAC/OPRF dipisah dari data aplikasi: .data/secrets.json di mode berkas; di mode Postgres WAJIB
 * lewat GEMA_OPRF_MASTER (secret manager), tidak pernah disimpan di basis data.
 * Antarmuka yang dipakai kode lain hanya getDb(), persist(), blob*().
 */
import fs from 'node:fs';
import path from 'node:path';
import { fromHex, randomBytes, toHex } from '@gema/crypto';
import { fileBackend } from './backends/file';
import type { Backend } from './backends/types';
import type { DB } from './types';

const DATA_DIR = process.env.GEMA_DATA_DIR || path.join(process.cwd(), '.data');
const SECRET_FILE = path.join(DATA_DIR, 'secrets.json');

type G = typeof globalThis & {
  __gemaDb?: Promise<DB>;
  __gemaSaveTimer?: NodeJS.Timeout;
  __gemaFp?: Map<string, Set<string>>;
  __gemaBackend?: Promise<Backend>;
  __gemaTestBackend?: Backend;
  __gemaLoaded?: DB;
};
const g = globalThis as G;

/** Backend aktif. Uji dapat memasang backend sendiri lewat swapBackend(). */
function backend(): Promise<Backend> {
  return (g.__gemaBackend ??= (async () => {
    if (g.__gemaTestBackend) return g.__gemaTestBackend;
    const url = process.env.DATABASE_URL;
    if (url) {
      const { connectPostgres } = await import('./backends/postgres');
      return connectPostgres(url);
    }
    return fileBackend(DATA_DIR);
  })());
}

/** Hanya untuk uji: ganti backend lalu muat ulang. */
export function swapBackend(b: Backend) {
  g.__gemaTestBackend = b;
  g.__gemaLoaded = undefined;
  g.__gemaBackend = undefined;
  g.__gemaDb = undefined;
}

function emptyDb(): DB {
  return {
    v: 1,
    institutions: {},
    units: [],
    reporters: {},
    slots: [],
    reports: {},
    evidence: {},
    fingerprints: [],
    escalations: {},
    events: [],
    ladder: [],
    members: {},
    anchors: [],
    audit: [],
    radar: [],
    compliance: [],
    approvals: [],
    runtime: { sessions: {}, hits: {}, challenges: {} },
    clock: { demoOffsetMs: 0 },
    meta: { seededAt: 0 },
  };
}

export function secretSeed(): Uint8Array {
  if (process.env.GEMA_OPRF_MASTER) return fromHex(process.env.GEMA_OPRF_MASTER);
  if (process.env.DATABASE_URL)
    throw new Error(
      'Mode Postgres mewajibkan GEMA_OPRF_MASTER (64 heksadesimal) dari secret manager.',
    );
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (fs.existsSync(SECRET_FILE))
    return fromHex(JSON.parse(fs.readFileSync(SECRET_FILE, 'utf8')).master);
  const master = toHex(randomBytes(32));
  fs.writeFileSync(SECRET_FILE, JSON.stringify({ master }), { mode: 0o600 });
  return fromHex(master);
}

/** Basis data yang sudah dimuat. Router selalu memanggil getDb() lebih dulu, jadi aman dipakai sinkron di sesi dan pembatas laju. */
export function loadedDb(): DB {
  if (!g.__gemaLoaded) throw new Error('Basis data belum dimuat');
  return g.__gemaLoaded;
}

export function getDb(): Promise<DB> {
  if (!g.__gemaDb) {
    g.__gemaDb = (async () => {
      const be = await backend();
      const db = (await be.load()) ?? emptyDb();
      db.approvals ??= []; // data lama dari sebelum mode Empat Mata
      db.runtime ??= { sessions: {}, hits: {}, challenges: {} };
      if (!db.meta.seededAt) {
        const { seedDemo } = await import('./seed');
        await seedDemo(db);
        await be.save(db);
      }
      rebuildIndex(db);
      g.__gemaLoaded = db;
      return db;
    })();
  }
  return g.__gemaDb;
}

/** Simpan tertunda 300 ms agar banyak perubahan beruntun jadi satu penulisan. */
export function persist(db: DB) {
  if (g.__gemaSaveTimer) return;
  g.__gemaSaveTimer = setTimeout(() => {
    g.__gemaSaveTimer = undefined;
    backend()
      .then((be) => be.save(db))
      .catch((e) => console.error('gagal menyimpan db', e));
  }, 300);
}

/** Tulis sekarang juga dan tunggu selesai (dipakai uji dan saat proses berhenti). */
export async function flush(db: DB) {
  if (g.__gemaSaveTimer) {
    clearTimeout(g.__gemaSaveTimer);
    g.__gemaSaveTimer = undefined;
  }
  await (await backend()).save(db);
}

/** Indeks fingerprint kuat → himpunan laporan, untuk deteksi klaster cepat pada 100 ribu entri. */
export function rebuildIndex(db: DB) {
  const idx = new Map<string, Set<string>>();
  for (const f of db.fingerprints) {
    const k = `${f.tingkat}|${f.fp_hash}`;
    let s = idx.get(k);
    if (!s) idx.set(k, (s = new Set()));
    s.add(f.report_id);
  }
  g.__gemaFp = idx;
}

export function fpIndex(): Map<string, Set<string>> {
  if (!g.__gemaFp) g.__gemaFp = new Map();
  return g.__gemaFp;
}

export async function resetDb(): Promise<DB> {
  g.__gemaDb = undefined;
  g.__gemaLoaded = undefined;
  await (await backend()).reset();
  return getDb();
}

/* ---------- blob terenkripsi ---------- */
export const blobWrite = async (id: string, data: Uint8Array) =>
  (await backend()).blobWrite(id, data);
export const blobRead = async (id: string) => (await backend()).blobRead(id);
export const blobDelete = async (id: string) => (await backend()).blobDelete(id);
