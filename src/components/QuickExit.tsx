'use client';
import { useEffect } from 'react';
import { reporterStore, satgasStore } from '@/lib/store';
import { quickExit } from '@/lib/ui/quick-exit';

const PROTECTED = /^\/(brankas|satgas)(\/|$)/;

/**
 * Keluar Cepat: Esc dua kali di halaman mana pun.
 * Tidak memicu saat IME sedang menyusun teks, saat Esc sudah dipakai komponen lain, atau bersama tombol pengubah.
 * Ponsel tidak punya tombol Esc, jadi tombol di navbar tetap jalur utama di sana.
 */
export function QuickExit() {
  useEffect(() => {
    let last = 0;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.repeat || e.isComposing || e.defaultPrevented) return;
      if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
      const now = Date.now();
      if (now - last < 600) void quickExit();
      last = now;
    };
    // Tombol Kembali dapat memulihkan halaman dari cache tanpa memuat ulang. Tanpa sesi, muat ulang agar isinya tidak tampil.
    const onShow = (e: PageTransitionEvent) => {
      if (!e.persisted || !PROTECTED.test(location.pathname)) return;
      if (location.pathname.startsWith('/satgas/masuk')) return;
      if (!reporterStore.get() && !satgasStore.get()) location.reload();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pageshow', onShow);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pageshow', onShow);
    };
  }, []);
  return null;
}
