'use client';
import { useState } from 'react';
import { QUICK_EXIT_LIMITS, quickExit } from '@/lib/ui/quick-exit';
import { IExit } from '../Icons';

/** Tombol Keluar cepat di navbar, beserta penjelasan apa yang dihapusnya. */
export function QuickExitButton() {
  const [qxInfo, setQxInfo] = useState(false);
  return (
    <span
      className="nb-qx-wrap"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setQxInfo(false);
      }}
    >
      <button
        type="button"
        className="nb-qx"
        aria-label="Keluar cepat: hapus draf dan sesi di perangkat ini, lalu buka situs netral"
        aria-describedby="qx-desc"
        onClick={() => void quickExit()}
        title="Keluar cepat. Esc dua kali juga bisa, kapan saja"
      >
        <span className="nb-qx-long">Keluar cepat</span>
        <span className="nb-qx-short" aria-hidden="true">
          <IExit />
        </span>
      </button>
      <span id="qx-desc" className="sr">
        {QUICK_EXIT_LIMITS}
      </span>
      <button
        type="button"
        className="nb-qx-info"
        aria-expanded={qxInfo}
        aria-controls="qx-pop"
        aria-label="Apa yang dihapus Keluar cepat?"
        onClick={() => setQxInfo(!qxInfo)}
      >
        ?
      </button>
      <span id="qx-pop" className="nb-qx-pop" role="note" hidden={!qxInfo}>
        {QUICK_EXIT_LIMITS}
      </span>
    </span>
  );
}
