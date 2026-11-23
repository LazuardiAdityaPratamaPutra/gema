import Link from 'next/link';
import { NextStep } from '@/components/NextStep';
import { RoleChooser } from '@/components/home/RoleChooser';
import { EvidenceCheck } from '@/components/home/EvidenceCheck';
import { DeadlineClock } from '@/components/home/DeadlineClock';
import { Receipt } from '@/components/home/Receipt';

export default function Home() {
  return (
    <>
      <section className="band band-hero" aria-labelledby="judul">
        <div className="hero-orbs" aria-hidden="true">
          <i className="orb orb-sun" />
          <i className="orb orb-ring" />
        </div>
        <div className="wrap home-hero">
          <div className="hero-top">
            <div>
              <h1 id="judul">Bukti tersimpan. Penanganan terlihat.</h1>
              <p className="sub">
                Simpan bukti kekerasan seksual di kampus tanpa nama, email, atau telepon, lalu
                pantau Satgas menanganinya tepat waktu. Kamu yang memutuskan kapan, dan apakah,
                laporanmu sampai ke Satgas.
              </p>
              <p className="sub hero-batas">
                Gema tidak bisa menjamin anonimitas: isi ceritamu tetap bisa menunjukkan siapa kamu.{' '}
                <Link href="/panduan#batas">Baca batasnya</Link>
              </p>
              <div className="hero-cta">
                <Link href="/pahami" className="btn teal">
                  Pahami dulu
                </Link>
                <Link href="/demo" className="btn ghost">
                  Coba demo 5 menit
                </Link>
              </div>
            </div>
            <Receipt />
          </div>
        </div>
      </section>
      <section className="wrap pick" aria-label="Pilih posisimu">
        <RoleChooser />
      </section>
      <EvidenceCheck />
      <DeadlineClock />
      <section className="wrap limits" aria-label="Batas jujur">
        <details>
          <summary>Yang tidak bisa kami janjikan</summary>
          <ul>
            <li>
              Lupa kata sandi berarti isi hilang, kecuali kamu sudah menyiapkan pemulihan lewat dua
              orang tepercaya.
            </li>
            <li>
              Keluar cepat menghapus draf dan sesi di perangkat ini, tetapi tidak riwayat peramban.
            </li>
            <li>Pencocokan hanya sebaik ejaan nama yang ditulis.</li>
            <li>Prototipe lomba, belum diaudit pihak independen.</li>
          </ul>
        </details>
      </section>
      <div className="wrap">
        <NextStep
          title="Belum siap melapor? Simpan buktinya saja."
          acts={[
            { href: '/mulai', label: 'Buat brankas tanpa nama' },
            { href: '/papan', label: 'Lihat papan kampus', ghost: true },
          ]}
        >
          Tanpa nama, email, atau telepon. Kamu yang memutuskan kapan Satgas tahu.
        </NextStep>
      </div>
    </>
  );
}
