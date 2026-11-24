'use client';
import { useEffect, useRef, useState, type RefObject } from 'react';

/**
 * Status menu ponsel. Menu terbuka hanya untuk halaman tempat ia dibuka, jadi pindah halaman
 * otomatis menutupnya. Klik di luar dan tombol Esc juga menutupnya.
 */
export function useMenu(path: string): {
  open: boolean;
  setOpen: (next: boolean) => void;
  boxRef: RefObject<HTMLElement | null>;
} {
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === path;
  const boxRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: PointerEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpenOn(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenOn(null);
    };
    document.addEventListener('pointerdown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return { open, setOpen: (next) => setOpenOn(next ? path : null), boxRef };
}
