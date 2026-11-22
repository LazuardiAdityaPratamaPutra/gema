'use client';
import type { SatgasSession } from '@/lib/store';

export function SatgasBar({ s }: { s: SatgasSession }) {
  const r = s.member.role;
  return (
    <div className="sbar">
      <p className="who">
        <span className="av" aria-hidden="true">
          {s.member.nama.replace(/^(Dr\.|Prof\.)\s*/, '').slice(0, 1)}
        </span>
        <span>
          <b>{s.member.nama}</b>
          <small>
            {r}
            {s.institution.demo ? ', Mode demo, data fiktif' : `, ${s.institution.nama}`}
          </small>
        </span>
      </p>
    </div>
  );
}
