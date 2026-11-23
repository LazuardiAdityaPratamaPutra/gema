'use client';
import { useId, useState, type ReactNode } from 'react';
import { GLOSARIUM, type IstilahKey } from '@/lib/glosarium';

/**
 * Istilah teknis dengan penjelasan sederhana tepat di dekatnya.
 * Tombol (bukan tooltip hover) agar bisa dibuka dengan keyboard dan layar sentuh.
 */
export function Term({
  k,
  question = false,
  children,
}: {
  k: IstilahKey;
  /** Teks tombol sudah berupa pertanyaan, jadi tidak perlu sufiks untuk pembaca layar. */
  question?: boolean;
  children: ReactNode;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  return (
    <span className="term">
      <button
        type="button"
        className="term-btn"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen(!open)}
      >
        {children}
        {!question && <span className="sr"> (apa artinya?)</span>}
      </button>
      {open && (
        <span id={id} className="term-tip" role="note">
          {GLOSARIUM[k]}
        </span>
      )}
    </span>
  );
}
