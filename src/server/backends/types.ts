import type { DB } from '../types';

/** Lapisan penyimpanan. Kode lain hanya memakai db.ts; backend dipilih lewat DATABASE_URL. */
export interface Backend {
  /** null bila belum ada data (pertama kali jalan) */
  load(): Promise<DB | null>;
  /** menulis hanya bagian yang berubah sejak penyimpanan terakhir */
  save(db: DB): Promise<void>;
  blobWrite(id: string, data: Uint8Array): Promise<void>;
  blobRead(id: string): Promise<Uint8Array | null>;
  blobDelete(id: string): Promise<void>;
  /** hapus semua data aplikasi (hanya dipakai Mode Demo) */
  reset(): Promise<void>;
}
