'use client';
import { useState } from 'react';

/** Menjalankan satu aksi pengaturan: tombol terkunci selama berjalan, hasilnya jadi pesan satu baris. */
export function useRun() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  async function run(fn: () => Promise<void>, ok: string) {
    setBusy(true);
    setMsg('');
    try {
      await fn();
      setMsg(ok);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Gagal.');
    }
    setBusy(false);
  }
  return { busy, msg, run };
}
export type Run = ReturnType<typeof useRun>['run'];
