'use client';
import { useEffect } from 'react';

/** Membuka lipatan (<details>) yang menjadi tujuan tautan #bagian, lalu menggulir ke sana. */
export function OpenOnHash() {
  useEffect(() => {
    const openTarget = () => {
      const id = decodeURIComponent(location.hash.slice(1));
      const el = id ? document.getElementById(id) : null;
      if (el instanceof HTMLDetailsElement && !el.open) {
        el.open = true;
        el.scrollIntoView();
      }
    };
    openTarget();
    window.addEventListener('hashchange', openTarget);
    return () => window.removeEventListener('hashchange', openTarget);
  }, []);
  return null;
}
