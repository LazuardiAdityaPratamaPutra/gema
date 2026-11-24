import type { Metadata } from 'next';
import { NextStep } from '@/components/NextStep';
import { OpenOnHash } from '@/components/OpenOnHash';
import { Rujukan } from '@/components/Rujukan';
import { BatasFold, DataFold, PendampingFold } from './Bagian';
export const metadata: Metadata = { title: 'Panduan dan batas jujur' };

export default function Panduan() {
  return (
    <div className="narrow">
      <OpenOnHash />
      <header className="ph" data-tab="Panduan">
        <h1>Cara kerja, dan apa yang tidak bisa kami janjikan</h1>
      </header>
      <section id="bantuan" className="card alert my-lg">
        <h2 className="title-md">Bila kamu butuh bantuan sekarang</h2>
        <p>
          Gema bukan layanan darurat. Layanan di bawah bisa dihubungi tanpa menunggu Satgas, dengan
          atau tanpa laporan di Gema.
        </p>
        <Rujukan />
      </section>

      <DataFold />

      <PendampingFold />

      <BatasFold />
      <NextStep
        title="Sudah cukup jelas?"
        acts={[
          { href: '/mulai', label: 'Buat brankas tanpa nama' },
          { href: '/pahami', label: 'Pahami dulu', ghost: true },
        ]}
      >
        Kamu bisa mulai tanpa nama. Keluar cepat menghapus draf dan sesi di perangkat ini, tetapi
        tidak riwayat peramban.
      </NextStep>
    </div>
  );
}
