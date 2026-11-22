'use client';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

/** Memberi label kolom pada tiap sel agar tabel bisa ditumpuk sebagai kartu di layar sempit. */
export function TableLabels() {
  const path = usePathname();
  useEffect(() => {
    const apply = () =>
      document.querySelectorAll('main table').forEach((t) => {
        const heads = [...t.querySelectorAll('thead th')].map((h) => h.textContent?.trim() ?? '');
        t.querySelectorAll('tbody tr').forEach((tr) =>
          [...tr.children].forEach((c, i) => {
            if (heads[i] && c.getAttribute('data-label') !== heads[i])
              c.setAttribute('data-label', heads[i]);
          }),
        );
      });
    apply();
    const main = document.querySelector('main');
    if (!main) return;
    const mo = new MutationObserver(apply);
    mo.observe(main, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, [path]);
  return null;
}
