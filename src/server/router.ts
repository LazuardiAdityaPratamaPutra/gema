import { flush, getDb, loadedDb, registerSeeder } from './db';
import { seedDemo } from './seed';
import { HttpError } from './util';
import { akun } from './routes/akun';
import { json, type Handler } from './routes/context';
import { cron } from './routes/cron';
import { demo } from './routes/demo';
import { pelapor } from './routes/pelapor';
import { publik } from './routes/publik';
import { satgas } from './routes/satgas';

// Titik perakitan: penyimpanan (db) tidak mengimpor seed, jadi pengisinya didaftarkan di sini.
registerSeeder(seedDemo);

/** Urutan penting: penangan pertama yang mengembalikan respons menang. */
const HANDLERS: Handler[] = [publik, akun, pelapor, satgas, demo, cron];

export async function route(method: string, seg: string[], req: Request): Promise<Response> {
  const ctx = { method, seg, req, db: await getDb() };
  for (const handle of HANDLERS) {
    const res = await handle(ctx);
    if (res) return res;
  }
  throw new HttpError(404, 'Rute tidak ditemukan');
}

export async function handle(req: Request, method: string, seg: string[]): Promise<Response> {
  try {
    const res = await route(method, seg, req);
    // permintaan pengubah baru dijawab setelah datanya benar-benar ditulis (bukan hanya dijadwalkan)
    if (method !== 'GET' && res.status < 400) await flush(loadedDb());
    return res;
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    console.error('[api]', e);
    return json({ error: 'Terjadi kesalahan di server.' }, 500);
  }
}
