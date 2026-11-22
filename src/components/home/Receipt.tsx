'use client';
import { useEffect, useState } from 'react';

const HASH = 'fec0ab92b480521f2e5d872065a1c7f48eb7cf13951e9924da3620311ac16eed';
const HEX = '0123456789abcdef';

/** Sertifikat bukti yang dijepit di map plastik, seperti berkas di tata usaha kampus. */
export function Receipt() {
  const [n, setN] = useState(HASH.length);
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    // Mulai dari kosong lalu mengetik; direset lewat frame agar tidak memanggil setState langsung di efek.
    const restart = requestAnimationFrame(() => setN(0));
    const t = setInterval(
      () =>
        setN((v) => {
          if (v >= HASH.length) {
            clearInterval(t);
            return v;
          }
          return v + 2;
        }),
      28,
    );
    return () => {
      cancelAnimationFrame(restart);
      clearInterval(t);
    };
  }, []);
  const shown =
    HASH.slice(0, n) +
    Array.from({ length: HASH.length - n }, (_, i) => HEX[(i * 7 + n) % 16]).join('');
  const done = n >= HASH.length;
  return (
    <div className="rc-folder">
      <span className="rc-tab">Bukti</span>
      <figure className="receipt" aria-label="Contoh sertifikat bukti">
        <p className="rc-top">Sertifikat bukti E-0312</p>
        <p className="rc-file">
          chat-bimbingan.txt<small>778 B, 19 pesan terbaca</small>
        </p>
        <p className="rc-label">Sidik SHA-256</p>
        <code className="rc-hash" data-done={done}>
          {shown.slice(0, 32)}
          <br />
          {shown.slice(32)}
        </code>
        <dl className="rc-meta">
          <div>
            <dt>Dicatat</dt>
            <dd>12 Nov 2026, 22.23</dd>
          </div>
          <div>
            <dt>Akar harian</dt>
            <dd>13 Nov 2026</dd>
          </div>
        </dl>
        <span className="rc-stamp" data-on={done}>
          <b>Utuh</b>
          <small>tercatat Gema</small>
        </span>
        <figcaption className="sr">
          Contoh: berkas chat tercatat dengan sidik dan masuk akar harian.
        </figcaption>
      </figure>
    </div>
  );
}
