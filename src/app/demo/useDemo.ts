'use client';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';

export type DemoAccount = {
  key: string;
  nama: string;
  peran: string;
  caseCode: string;
  passphrase: string;
};

export type Info = {
  accounts: DemoAccount[];
  offsetDays: number;
  pendingAnchors: number;
  members: { email: string; nama: string; role: string }[];
  password: string;
};

/** Keadaan Mode Demo dari server, dan pembungkus aksi: tombol terkunci, hasilnya jadi satu pesan. */
export function useDemo() {
  const [info, setInfo] = useState<Info | null>(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(
    () =>
      api<Info>('demo/info')
        .then(setInfo)
        .catch((e) => setMsg(e.message)),
    [],
  );
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const run = async (fn: () => Promise<string | void>) => {
    setBusy(true);
    setMsg('');
    try {
      const m = await fn();
      if (m) setMsg(m);
      await refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Gagal.');
    }
    setBusy(false);
  };
  return { info, msg, busy, run };
}
export type Run = ReturnType<typeof useDemo>['run'];
