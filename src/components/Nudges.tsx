'use client';
import { useDeferredValue, useMemo } from 'react';
import { nudges } from '@gema/pendamping';

/** Pertanyaan lembut untuk bagian kronologi yang belum muncul. */
export function Nudges({ text, filled }: { text: string; filled: Parameters<typeof nudges>[1] }) {
  const t = useDeferredValue(text);
  const list = useMemo(() => nudges(t, filled), [t, filled]);
  if (!list.length) return null;
  return (
    <ul className="nudges" aria-live="polite" aria-label="Saran untuk melengkapi">
      {list.map((n) => (
        <li key={n.id}>{n.teks}</li>
      ))}
    </ul>
  );
}
