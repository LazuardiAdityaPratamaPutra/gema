'use client';
import { useEffect } from 'react';
import { quickExit } from '@/lib/quick-exit';

/** Keluar Cepat selalu terlihat di semua halaman. Esc dua kali juga memicunya. */
export function QuickExit() {
  useEffect(() => {
    let last = 0;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.repeat) return;
      const now = Date.now();
      if (now - last < 600) void quickExit();
      last = now;
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return null;
}
