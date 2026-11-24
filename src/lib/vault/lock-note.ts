'use client';
import { useSyncExternalStore } from 'react';

/** Penanda bahwa layar dikunci otomatis, agar halaman masuk bisa menjelaskannya. Hilang saat tab ditutup. */
const KEY = 'gema.locked';

export function markLocked() {
  try {
    sessionStorage.setItem(KEY, '1');
  } catch {
    /* abaikan */
  }
}

export function clearLockNote() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* abaikan */
  }
}

export function useLockNote(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => {
      try {
        return sessionStorage.getItem(KEY) === '1';
      } catch {
        return false;
      }
    },
    () => false,
  );
}
