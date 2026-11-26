'use client';
import { useSyncExternalStore } from 'react';
import type { Vault } from '@/lib/laporan/report-format';

const EVT = 'gema:session';

function makeStore<T>(key: string) {
  let cache: { raw: string | null; value: T | null } = { raw: null, value: null };
  const read = (): T | null => {
    if (typeof window === 'undefined') return null;
    let raw: string | null = null;
    try {
      raw = sessionStorage.getItem(key);
    } catch {
      /* penyimpanan diblokir */
    }
    if (raw === cache.raw) return cache.value;
    cache = { raw, value: raw ? (JSON.parse(raw) as T) : null };
    return cache.value;
  };
  return {
    get: read,
    set(v: T) {
      try {
        sessionStorage.setItem(key, JSON.stringify(v));
      } catch {
        /* abaikan */
      }
      window.dispatchEvent(new Event(EVT));
    },
    clear() {
      try {
        sessionStorage.removeItem(key);
      } catch {
        /* abaikan */
      }
      window.dispatchEvent(new Event(EVT));
    },
    use(): T | null {
      return useSyncExternalStore(
        (cb) => {
          window.addEventListener(EVT, cb);
          return () => window.removeEventListener(EVT, cb);
        },
        read,
        () => null,
      );
    },
  };
}

export type ReporterSession = {
  token: string;
  scopeId: string;
  kek: string;
  caseCode: string;
  vault: Vault;
};
export type SatgasSession = {
  token: string;
  member: { nama: string; role: string; email: string };
  institution: { id: string; nama: string; demo: boolean; kunciSiap?: boolean };
};

/** Sesi disimpan di sessionStorage: hilang saat tab ditutup. Kunci tidak pernah masuk localStorage. */
export const reporterStore = makeStore<ReporterSession>('gema.r');
export const satgasStore = makeStore<SatgasSession>('gema.s');

/** useSyncExternalStore mengembalikan null di server; `hydrated` membedakan "belum dibaca" dari "tidak ada sesi". */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}
