import fs from 'node:fs';
import path from 'node:path';
import type { DB } from '../types';
import type { Backend } from './types';

const safe = (id: string) => id.replace(/[^A-Za-z0-9_-]/g, '');

/** Berkas JSON + blob di disk. Cocok untuk satu instans dengan disk persisten. */
export function fileBackend(dir: string): Backend {
  const dbFile = path.join(dir, 'db.json');
  const blobDir = path.join(dir, 'blobs');
  const ensure = () => fs.mkdirSync(blobDir, { recursive: true });
  return {
    async load() {
      ensure();
      return fs.existsSync(dbFile) ? (JSON.parse(fs.readFileSync(dbFile, 'utf8')) as DB) : null;
    },
    async save(db) {
      ensure();
      const tmp = dbFile + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(db));
      fs.renameSync(tmp, dbFile);
    },
    async blobWrite(id, data) {
      ensure();
      fs.writeFileSync(path.join(blobDir, safe(id)), data);
    },
    async blobRead(id) {
      const p = path.join(blobDir, safe(id));
      return fs.existsSync(p) ? new Uint8Array(fs.readFileSync(p)) : null;
    },
    async blobDelete(id) {
      const p = path.join(blobDir, safe(id));
      if (fs.existsSync(p)) fs.rmSync(p);
    },
    async reset() {
      if (fs.existsSync(dbFile)) fs.rmSync(dbFile);
      fs.rmSync(blobDir, { recursive: true, force: true });
    },
  };
}
