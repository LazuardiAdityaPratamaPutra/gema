'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { markLocked } from '@/lib/lock-note';
import { reporterStore, satgasStore } from '@/lib/store';

const IDLE_MS = 5 * 60_000;
const WARN_MS = 30_000;
const EVENTS = ['pointerdown', 'keydown', 'touchstart', 'scroll'] as const;

/** Batas diam dapat diperpendek lewat sessionStorage `gema.idle-ms` (dipakai pengujian). */
function idleLimit(): number {
  try {
    return Number(sessionStorage.getItem('gema.idle-ms')) || IDLE_MS;
  } catch {
    return IDLE_MS;
  }
}

/**
 * Mengunci sesi setelah lama tidak ada aktivitas, dengan peringatan 30 detik sebelumnya.
 * Sebelum mengunci, halaman yang punya pekerjaan belum tersimpan (formulir laporan) diminta menyimpannya lewat
 * event `gema:before-lock`, jadi pengguna tidak kehilangan isiannya.
 */
export function IdleLock() {
  const router = useRouter();
  const reporter = reporterStore.use();
  const satgas = satgasStore.use();
  const token = reporter?.token ?? satgas?.token ?? null;
  const [left, setLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!token) return;
    const limit = idleLimit();
    const warnAt = Math.min(WARN_MS, limit / 2);
    let last = Date.now();
    let locking = false;
    const bump = () => {
      last = Date.now();
    };
    EVENTS.forEach((e) => window.addEventListener(e, bump, { passive: true }));
    const lock = async () => {
      locking = true;
      const tasks: Promise<unknown>[] = [];
      window.dispatchEvent(new CustomEvent('gema:before-lock', { detail: { tasks } }));
      await Promise.race([Promise.allSettled(tasks), new Promise((r) => setTimeout(r, 2000))]);
      void api('auth/logout', { method: 'POST', token }).catch(() => undefined);
      markLocked();
      const toStaff = !!satgasStore.get();
      reporterStore.clear();
      satgasStore.clear();
      setLeft(null);
      router.replace(toStaff ? '/satgas/masuk' : '/masuk');
    };
    const timer = setInterval(() => {
      if (locking) return;
      const idle = Date.now() - last;
      if (idle >= limit) void lock();
      else setLeft(idle >= limit - warnAt ? Math.ceil((limit - idle) / 1000) : null);
    }, 1000);
    return () => {
      clearInterval(timer);
      EVENTS.forEach((e) => window.removeEventListener(e, bump));
    };
  }, [token, router]);

  if (!token || left === null) return null;
  return (
    <div className="idle-warn" role="alert">
      <p className="m-0">
        Tidak ada aktivitas. Layar dikunci dalam {left} detik. Isianmu yang belum selesai disimpan
        sebagai draf dulu.
      </p>
      <button type="button" className="btn teal sm" onClick={() => setLeft(null)}>
        Tetap masuk
      </button>
    </div>
  );
}
