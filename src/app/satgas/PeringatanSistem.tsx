'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { SatgasSession } from '@/lib/store';

/** Penjadwal atau jangkar harian yang mati: Ketua dan Auditor harus tahu, sebab kasus terlambat tidak akan naik. */
export function PeringatanSistem({ session }: { session: SatgasSession }) {
  const [daftar, setDaftar] = useState<string[]>([]);
  const peran = session.member.role;
  useEffect(() => {
    if (session.institution.demo || !['Ketua', 'Auditor'].includes(peran)) return;
    api<{ peringatan: string[] }>('satgas/kesehatan', { token: session.token })
      .then((r) => setDaftar(r.peringatan))
      .catch(() => undefined);
  }, [session, peran]);
  if (daftar.length === 0) return null;
  return (
    <section className="card warn" role="alert" aria-labelledby="sistem-judul">
      <h2 id="sistem-judul" className="title-md">
        Jaminan otomatis tidak berjalan
      </h2>
      <ul>
        {daftar.map((d) => (
          <li key={d}>{d}</li>
        ))}
      </ul>
    </section>
  );
}
