'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { NextStep } from '@/components/NextStep';
import { LoadError } from '@/components/LoadError';
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
      <h2 id={`h-${r.id}`} style={{ fontSize: '1.35rem', margin: 0 }}>
        {r.nama}
      </h2>
      {r.fiktif && <span className="pill amber campus-tag">Data fiktif</span>}
      <p className="muted small">
        {r.kota}, ε = {r.epsilon}
      </p>
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
            {r.kuartal.map((k) => (
              <QuarterRow key={k.kuartal} k={k} />
            ))}
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
        <h1>Seberapa tepat waktu kampus menangani?</h1>
        <p className="lede">
          Persentase kasus tereskalasi yang ditangani dalam tenggat, per kuartal. Angka diberi derau
          acak kecil (privasi diferensial) agar tidak ada kasus tunggal yang dapat ditebak. Kuartal
          dengan kasus terlalu sedikit tidak ditampilkan.
        </p>
      </header>
      {error && <LoadError what="papan kampus" message={error} />}
      {!rows && !error && <p role="status">Memuat…</p>}
      <div className="grid g2 mt-lg">
        {rows?.map((r) => (
          <CampusCard key={r.id} r={r} />
        ))}
      </div>
      <p className="small muted" style={{ marginTop: '2rem' }}>
        Batas jujur: angka berderau bisa berbeda beberapa poin dari nilai sebenarnya, dan hanya
        kampus yang memilih menampilkannya yang muncul di sini.
      </p>
      <NextStep
        title="Kampusmu belum ada di sini?"
        acts={[
          { href: '/mulai', label: 'Simpan buktimu dulu' },
          { href: '/satgas/masuk', label: 'Masuk sebagai Satgas', ghost: true },
        ]}
      >
        Satgas dapat memilih menampilkan angka kepatuhan kampusnya. Penyintas tetap bisa menyimpan
        bukti tanpa menunggu.
      </NextStep>
    </div>
  );
}
