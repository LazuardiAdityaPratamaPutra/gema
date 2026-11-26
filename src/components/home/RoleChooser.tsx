'use client';
import Link from 'next/link';
import { useRef, useState } from 'react';
import { useDemoAktif } from '@/lib/ui/useDemoAktif';
import { ROLES } from './roles';

export function RoleChooser() {
  const [i, setI] = useState(0);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const r = ROLES[i];
  const demo = useDemoAktif();
  const sembunyikanAlt = 'soloDemo' in r.alt && !demo;
  const move = (n: number) => {
    const k = (n + ROLES.length) % ROLES.length;
    setI(k);
    refs.current[k]?.focus();
  };
  return (
    <div className="peran" style={{ ['--c' as string]: r.color, ['--k' as string]: i }}>
      <div
        className="peran-jalur"
        role="tablist"
        aria-label="Pilih posisimu"
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
            e.preventDefault();
            move(i + 1);
          }
          if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
            e.preventDefault();
            move(i - 1);
          }
        }}
      >
        {ROLES.map((x, k) => (
          <button
            key={x.id}
            ref={(el) => {
              refs.current[k] = el;
            }}
            role="tab"
            id={`tab-${x.id}`}
            aria-selected={k === i}
            aria-controls="panel-role"
            tabIndex={k === i ? 0 : -1}
            className="peran-titik"
            data-lalu={k < i}
            onClick={() => setI(k)}
          >
            <span className="peran-node" aria-hidden="true" />
            <b>{x.tab}</b>
            <small>{x.tahap}</small>
          </button>
        ))}
      </div>
      <div className="peran-isi" role="tabpanel" id="panel-role" aria-labelledby={`tab-${r.id}`}>
        <div key={r.id} className="peran-masuk">
          <h2>{r.head}</h2>
          <div className="peran-badan">
            <ul className="peran-poin">
              {r.pts.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
            <div className="row">
              <Link className="btn teal" href={r.cta.href}>
                {r.cta.label}
              </Link>
              {!sembunyikanAlt && (
                <Link className="btn ghost" href={r.alt.href}>
                  {r.alt.label}
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
