'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { NextStep } from '@/components/NextStep';
import { LoadError } from '@/components/LoadError';
import { SkeletonCampusCards } from '@/components/Skeleton';
import { Ilustrasi } from '@/components/Ilustrasi';

type Row = {
  id: string;
  nama: string;
  kota: string;
  fiktif: boolean;
  epsilon: number;
  kuartal: {
    kuartal: string;
    enough: boolean;
    persen: number | null;
    median: string | null;
    jumlah: string | null;
  }[];
};

type Quarter = Row['kuartal'][number];

function QuarterRow({ k }: { k: Quarter }) {
  return (
    <tr>
      <th scope="row" className="rowhead">
        {k.kuartal}
      </th>
      {k.enough ? (
        <>
          <td>
            <strong>{k.persen}%</strong> <span className="muted small">dari {k.jumlah}</span>
            <span className="bar" role="img" aria-label={`${k.persen} persen tepat waktu`}>
              <i style={{ width: `${k.persen}%` }} />
            </span>
          </td>
          <td>{k.median}</td>
        </>
      ) : (
        <td colSpan={2} className="muted">
          Data belum cukup untuk ditampilkan
        </td>
      )}
    </tr>
  );
}

function CampusCard({ r }: { r: Row }) {
  return (
    <section className="card" aria-labelledby={`h-${r.id}`}>
      <header className="campus-head">
        <h2 id={`h-${r.id}`} style={{ fontSize: '1.35rem', margin: 0 }}>
          {r.nama}
        </h2>
        <p className="campus-meta muted small">
          {r.fiktif && <span className="pill amber">Mode demo</span>}
          <span>
            {r.kota}, ε = {r.epsilon}
          </span>
        </p>
      </header>
      <div
        className="tablewrap"
        role="region"
        aria-label={`Kepatuhan tenggat per kuartal, ${r.nama}`}
        tabIndex={0}
      >
        <table className="keep">
          <caption className="sr">Kepatuhan tenggat per kuartal, {r.nama}</caption>
          <thead>
            <tr>
              <th scope="col">Kuartal</th>
              <th scope="col">Tepat waktu</th>
              <th scope="col">Median</th>
            </tr>
          </thead>
          <tbody>
            {r.kuartal.length === 0 ? (
              <tr>
                <td colSpan={3} className="muted">
                  Belum ada kuartal yang tercatat. Angka muncul setelah ada kasus tereskalasi yang
                  jatuh tempo.
                </td>
              </tr>
            ) : (
              r.kuartal.map((k) => <QuarterRow key={k.kuartal} k={k} />)
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function Papan() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    api<Row[]>('public/compliance')
      .then(setRows)
      .catch((e) => setError(e.message));
  }, []);
  return (
    <div className="wrap">
      <header className="ph" data-tab="Papan akuntabilitas">
        <Ilustrasi motif="papan" />
        <h1>Seberapa tepat waktu UPN Veteran Jawa Timur menangani?</h1>
        <p className="lede">
          Persentase kasus tereskalasi yang ditangani dalam tenggat, per kuartal. Angka diberi derau
          acak kecil (privasi diferensial) agar tidak ada kasus tunggal yang dapat ditebak. Kuartal
          dengan kasus terlalu sedikit tidak ditampilkan.
        </p>
      </header>
      {error && <LoadError what="papan" message={error} />}
      <div className="mt-lg papan-grid" data-loading={!rows && !error}>
        {!rows && !error && (
          <>
            <span className="sr" role="status">
              Memuat papan
            </span>
            <SkeletonCampusCards n={1} />
          </>
        )}
        {rows?.map((r) => (
          <CampusCard key={r.id} r={r} />
        ))}
      </div>
      <p className="small muted" style={{ marginTop: '2rem' }}>
        Batas jujur: angka berderau bisa berbeda beberapa poin dari nilai sebenarnya, dan Satgas
        dapat memilih menampilkan atau menyembunyikan papan ini.
      </p>
      <NextStep
        title="Bagaimana papan ini terisi?"
        acts={[
          { href: '/mulai', label: 'Simpan buktimu dulu' },
          { href: '/satgas/masuk', label: 'Masuk sebagai Satgas', ghost: true },
        ]}
      >
        Angka muncul dari kasus tereskalasi yang jatuh tempo dalam satu kuartal. Penyintas tetap
        bisa menyimpan bukti tanpa menunggu.
      </NextStep>
    </div>
  );
}
