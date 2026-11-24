'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { markLocked } from '@/lib/vault/lock-note';
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
  // Waktu aktivitas terakhir. Di ref agar tombol "Tetap masuk" ikut memperbaruinya.
  const lastRef = useRef(0);

  useEffect(() => {
    if (!token) return;
    const limit = idleLimit();
    const warnAt = Math.min(WARN_MS, limit / 2);
    let locking = false;
    const bump = () => {
      lastRef.current = Date.now();
    };
    bump();
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
      const idle = Date.now() - lastRef.current;
      if (idle >= limit) void lock();
      else setLeft(idle >= limit - warnAt ? Math.ceil((limit - idle) / 1000) : null);
    }, 1000);
    return () => {
      clearInterval(timer);
      EVENTS.forEach((e) => window.removeEventListener(e, bump));
    };
  }, [token, router]);

  if (!token || left === null) return null;
  // Klik tanpa peristiwa penunjuk atau papan ketik (mis. aktivasi oleh teknologi bantu) tidak
  // lewat pendengar window, jadi tombol memperbarui waktu aktivitas sendiri.
  const stayActive = () => {
    lastRef.current = Date.now();
    setLeft(null);
  };
  return (
    <div className="idle-warn" role="alert">
      {/* Pembaca layar mendengar pengumuman statis sekali. Angka hitung mundur hanya visual,
          supaya tidak dibacakan ulang tiap detik. */}
      <p className="m-0">
        <span className="sr">
          Tidak ada aktivitas. Layar akan dikunci sebentar lagi. Isianmu yang belum selesai disimpan
          sebagai draf dulu.
        </span>
        <span aria-hidden="true">
          Tidak ada aktivitas. Layar dikunci dalam {left} detik. Isianmu yang belum selesai disimpan
          sebagai draf dulu.
        </span>
      </p>
      <button type="button" className="btn teal sm" onClick={stayActive}>
        Tetap masuk
      </button>
    </div>
  );
}
