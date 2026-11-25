'use client';
import { useState } from 'react';
import { island } from '@/lib/ui/island-bus';

/** Menjalankan satu aksi pengaturan: tombol terkunci selama berjalan, hasilnya jadi pesan satu baris. */
export function useRun() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [ok, setOk] = useState(true);
  async function run(fn: () => Promise<void>, okMsg: string) {
    setBusy(true);
    setMsg('');
    try {
      await fn();
      setOk(true);
      setMsg(okMsg);
      if (okMsg) island.toast(okMsg.length > 70 ? `${okMsg.slice(0, 67)}…` : okMsg);
    } catch (e) {
      setOk(false);
      setMsg(e instanceof Error ? e.message : 'Gagal.');
    }
    setBusy(false);
  }
  return { busy, msg, ok, run };
}
export type Run = ReturnType<typeof useRun>['run'];
