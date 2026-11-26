'use client';
import { useSyncExternalStore } from 'react';
import { api } from '@/lib/api';

let nilai: boolean | null = null;
let dimulai = false;
const pendengar = new Set<() => void>();

function muat() {
  if (dimulai) return;
  dimulai = true;
  api<{ demo: boolean }>('public/config')
    .then((r) => {
      nilai = r.demo === true;
    })
    .catch(() => {
      nilai = false;
    })
    .finally(() => pendengar.forEach((f) => f()));
}

function langgan(f: () => void) {
  pendengar.add(f);
  muat();
  return () => {
    pendengar.delete(f);
  };
}

/** Apakah Mode Demo aktif di server. Salah (false) sampai jawaban datang, jadi tautan demo tidak sempat tampil di mode sungguhan. */
export function useDemoAktif(): boolean {
  return useSyncExternalStore(
    langgan,
    () => nilai === true,
    () => false,
  );
}
