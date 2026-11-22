'use client';
import Link from 'next/link';
import { useRef, useState } from 'react';

const ROLES = [
  {
    id: 'penyintas',
    tab: 'Saya penyintas',
    color: 'var(--c-penyintas)',
    head: 'Simpan dulu. Putuskan nanti.',
    pts: [
      'Tulis, atau ceritakan dengan suara. Semuanya dikunci di perangkatmu.',
      'Tanpa nama, email, atau telepon. Hanya kode dan enam kata.',
      'Satgas baru tahu bila kamu memilih eskalasi, dan itu bisa ditarik.',
    ],
    cta: { href: '/mulai', label: 'Buat brankas anonim' },
    alt: { href: '/pahami', label: 'Ragu? Pahami dulu' },
  },
  {
    id: 'saksi',
    tab: 'Saya tahu kejadian serupa',
    color: 'var(--c-saksi)',
    head: 'Kamu mungkin bukan satu-satunya.',
    pts: [
      'Simpan laporanmu. Nama terlapor disamarkan di perangkatmu.',
      'Bila ada laporan lain tentang orang yang sama, kamu diberi tahu. Tidak ada identitas yang terbuka.',
      'Kamu menentukan berapa laporan cocok sebelum diberi tahu.',
    ],
    cta: { href: '/mulai', label: 'Simpan dan cek pola' },
    alt: { href: '/panduan#batas', label: 'Seakurat apa?' },
  },
  {
    id: 'satgas',
    tab: 'Saya di Satgas',
    color: 'var(--c-satgas)',
    head: 'Kasus masuk, jam berjalan.',
    pts: [
      'Dosir terbuka hanya setelah penyintas mengeskalasi. Tiap pembukaan tercatat.',
      'Tenggat hari kerja sesuai Permendikbudristek 55/2024. Ringkasan dan draf surat disiapkan otomatis.',
      'Kunci Satgas dibuat dan disimpan di perangkat Ketua.',
    ],
    cta: { href: '/satgas/masuk', label: 'Masuk Satgas' },
    alt: { href: '/demo', label: 'Coba dengan data demo' },
  },
  {
    id: 'publik',
    tab: 'Saya memantau kampus',
    color: 'var(--c-publik)',
    head: 'Angka kampus, bukan kasus orang.',
    pts: [
      'Papan menampilkan persen tepat waktu per kuartal, dengan derau agar tak ada kasus yang bisa ditebak.',
      'Siapa pun bisa memeriksa keutuhan bukti tanpa akun.',
      'Akar harian dirancang untuk diarsipkan ke repositori publik.',
    ],
    cta: { href: '/papan', label: 'Lihat papan akuntabilitas' },
    alt: { href: '/verifikasi', label: 'Periksa bukti' },
  },
] as const;

export function RoleChooser() {
  const [i, setI] = useState(0);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const r = ROLES[i];
  const move = (n: number) => {
    const k = (n + ROLES.length) % ROLES.length;
    setI(k);
    refs.current[k]?.focus();
  };
  return (
    <div className="chooser" style={{ ['--c' as string]: r.color }}>
      <div
        className="tabs"
        role="tablist"
        aria-label="Pilih posisimu"
        aria-orientation="vertical"
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
            className="tab"
            style={{ ['--dc' as string]: x.color }}
            onClick={() => setI(k)}
          >
            <span className="dot" aria-hidden="true" />
            {x.tab}
          </button>
        ))}
      </div>
      <div className="panel" role="tabpanel" id="panel-role" aria-labelledby={`tab-${r.id}`}>
        <div
          key={r.id}
          className="panel-in"
          style={{ display: 'flex', flexDirection: 'column', gap: '1.4rem', flex: 1 }}
        >
          <h2>{r.head}</h2>
          <ul className="pts">
            {r.pts.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
          <div className="row">
            <Link className="btn teal" href={r.cta.href}>
              {r.cta.label}
            </Link>
            <Link className="btn ghost" href={r.alt.href}>
              {r.alt.label}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
