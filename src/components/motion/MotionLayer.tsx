'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { animate, hover, inView } from 'motion';

const TARGETS = '.card, .next, .cal, .hasil-card, .t-fig';

/**
 * Animasi masuk dan hover untuk kartu (Motion). Hanya elemen di bawah lipatan layar yang disembunyikan
 * lebih dulu, sehingga tidak ada kedipan di bagian atas halaman. Kartu yang dirender belakangan
 * (setelah data tiba) ikut didaftarkan. Dilewati bila pengguna meminta gerak dikurangi.
 */
export function MotionLayer() {
  const path = usePathname();
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const stops: Array<() => void> = [];
    const done = new WeakSet<Element>();
    const touched: HTMLElement[] = [];

    const wire = (el: HTMLElement) => {
      if (done.has(el)) return;
      done.add(el);
      touched.push(el);
      if (el.getBoundingClientRect().top > innerHeight * 0.92) {
        el.style.opacity = '0';
        stops.push(
          inView(
            el,
            () => {
              animate(
                el,
                { opacity: [0, 1], y: [28, 0] },
                { duration: 0.7, ease: [0.22, 1, 0.36, 1] },
              );
            },
            { amount: 'some' },
          ),
        );
      }
      stops.push(
        hover(el, () => {
          animate(el, { y: -4 }, { duration: 0.25, ease: 'easeOut' });
          return () => animate(el, { y: 0 }, { duration: 0.3, ease: 'easeOut' });
        }),
      );
    };
    const scan = () => document.querySelectorAll<HTMLElement>(TARGETS).forEach(wire);

    scan();
    let frame = 0;
    const mo = new MutationObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(scan);
    });
    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      mo.disconnect();
      cancelAnimationFrame(frame);
      for (const s of stops) s();
      for (const el of touched) el.style.opacity = '';
    };
  }, [path]);
  return null;
}
