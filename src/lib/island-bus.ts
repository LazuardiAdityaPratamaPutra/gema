'use client';
import { useSyncExternalStore } from 'react';

/** Kanal kecil agar halaman mana pun dapat menampilkan kemajuan atau pesan singkat di dynamic island. */
export type IslandState =
  | { mode: 'idle' }
  | { mode: 'progress'; label: string; value?: number; total?: number }
  | { mode: 'toast'; label: string };

const IDLE: IslandState = { mode: 'idle' };
let state: IslandState = IDLE;
let timer: ReturnType<typeof setTimeout> | undefined;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
const set = (s: IslandState) => {
  state = s;
  emit();
};

export const island = {
  progress(label: string, value?: number, total?: number) {
    clearTimeout(timer);
    set({ mode: 'progress', label, value, total });
  },
  toast(label: string, ms = 2600) {
    clearTimeout(timer);
    set({ mode: 'toast', label });
    timer = setTimeout(() => set({ mode: 'idle' }), ms);
  },
  clear() {
    clearTimeout(timer);
    set({ mode: 'idle' });
  },
};

export function useIslandState(): IslandState {
  return useSyncExternalStore(
    (cb) => {
      subs.add(cb);
      return () => {
        subs.delete(cb);
      };
    },
    () => state,
    () => IDLE, // snapshot server harus objek yang sama di tiap panggilan
  );
}
