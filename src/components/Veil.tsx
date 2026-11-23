'use client';
import { useEffect, useState } from 'react';

/**
 * Menyamarkan isi sensitif (kelas `.sensitive`) agar tidak terbaca orang di sekitar.
 * Samar lagi otomatis saat tab disembunyikan atau berpindah aplikasi. Hanya efek visual: pembaca layar tetap membaca isinya.
 */
export function VeilBar({ defaultOn, what }: { defaultOn: boolean; what: string }) {
  const [on, setOn] = useState(defaultOn);
  useEffect(() => {
    document.documentElement.dataset.veil = on ? 'on' : 'off';
    return () => {
      delete document.documentElement.dataset.veil;
    };
  }, [on]);
  useEffect(() => {
    const hide = () => {
      if (document.visibilityState === 'hidden') setOn(true);
    };
    document.addEventListener('visibilitychange', hide);
    return () => document.removeEventListener('visibilitychange', hide);
  }, []);
  return (
    <div className="veilbar" role="group" aria-label="Privasi layar">
      <p className="m-0 small" role="status">
        {on
          ? `${what} disamarkan agar tidak terbaca orang di sekitarmu. Pastikan tidak ada yang melihat layarmu sebelum menampilkannya.`
          : `${what} terlihat. Samarkan lagi bila ada orang di dekatmu.`}
      </p>
      <button type="button" className="btn ghost sm" aria-pressed={!on} onClick={() => setOn(!on)}>
        {on ? 'Tampilkan isi' : 'Samarkan lagi'}
      </button>
    </div>
  );
}
