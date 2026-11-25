'use client';
import { useSyncExternalStore } from 'react';

/** Selisih gulir (px) sebelum navbar berganti dari bilah biasa ke gelembung melayang. */
const AMBANG = 8;

function subscribe(onChange: () => void) {
  window.addEventListener('scroll', onChange, { passive: true });
  return () => window.removeEventListener('scroll', onChange);
}

/** Benar bila halaman sudah digulir. Di server dan saat pertama dimuat dianggap belum (puncak halaman). */
export function useScrolled(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.scrollY > AMBANG,
    () => false,
  );
}
