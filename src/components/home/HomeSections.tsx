import Image from 'next/image';
import Link from 'next/link';
import { DemoLink } from '@/components/DemoLink';
import { NextStep } from '@/components/NextStep';
import { Words } from '@/components/motion/Words';
import { Receipt } from './Receipt';

export function Hero() {
  return (
    <section className="t-band t-hero" aria-labelledby="judul">
      <Image
        src="/gambar/senja-bukit.jpg"
        alt=""
        fill
        preload
        fetchPriority="high"
        sizes="100vw"
        quality={78}
        className="t-bg"
      />
      <div className="wrap t-hero-grid">
        <div className="t-hero-copy">
          <Words as="h1" id="judul" text="Bukti tersimpan. Penanganan terlihat." onLoad />
          <p className="t-sub">
            Simpan bukti kekerasan seksual di kampus tanpa nama, email, atau telepon, lalu pantau
            Satgas menanganinya tepat waktu.
          </p>
          <div className="hero-cta">
            <Link href="/pahami" className="btn teal">
              Pahami dulu
            </Link>
            <DemoLink className="btn ghost">Coba demo 5 menit</DemoLink>
          </div>
          <p className="hero-batas">
            Gema tidak bisa menjamin anonimitas: isi ceritamu tetap bisa menunjukkan siapa kamu.{' '}
            <Link href="/panduan#batas">Baca batasnya</Link>
          </p>
        </div>
      </div>
    </section>
  );
}

export function ProofBand() {
  return (
    <section className="t-proof-band" aria-labelledby="sidik">
      <Image
        src="/gambar/sertifikat-cahaya.jpg"
        alt=""
        fill
        sizes="100vw"
        quality={70}
        className="t-bg"
      />
      <div className="wrap t-proof">
        <div className="t-proof-copy">
          <Words as="h2" id="sidik" text="Kamu yang memutuskan." />
          <p>Kamu yang memutuskan kapan, dan apakah, laporanmu sampai ke Satgas.</p>
        </div>
        <div className="t-fig">
          <Receipt />
          <p className="t-cap">Contoh sertifikat bukti. Semua isinya data fiktif.</p>
        </div>
      </div>
    </section>
  );
}

export function Limits() {
  return (
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
          <li>Masih prototipe, belum diaudit pihak independen.</li>
        </ul>
      </details>
    </section>
  );
}

export function Closer() {
  return (
    <section className="t-band t-closer">
      <Image
        src="/gambar/senja-berjalan.jpg"
        alt=""
        fill
        sizes="100vw"
        quality={70}
        className="t-bg"
      />
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
    </section>
  );
}
