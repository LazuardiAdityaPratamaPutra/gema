import type { Metadata } from 'next';
import { NextStep } from '@/components/NextStep';
import { OpenOnHash } from '@/components/OpenOnHash';
import { Rujukan } from '@/components/Rujukan';
import { BatasFold, DataFold, PendampingFold } from './Bagian';
import { Ilustrasi } from '@/components/Ilustrasi';
export const metadata: Metadata = { title: 'Panduan dan batas jujur' };

export default function Panduan() {
  return (
    <div className="narrow panduan">
      <OpenOnHash />
      <header className="ph" data-tab="Panduan">
        <Ilustrasi motif="panduan" />
        <h1>Cara kerja, dan apa yang tidak bisa kami janjikan</h1>
      </header>
      <div className="panduan-grid">
        <section id="bantuan" className="card alert">
          <h2 className="title-md">Bila kamu butuh bantuan sekarang</h2>
          <p>
            Gema bukan layanan darurat. Layanan di bawah bisa dihubungi tanpa menunggu Satgas,
            dengan atau tanpa laporan di Gema.
          </p>
          <Rujukan />
        </section>

        <div className="panduan-sisi">
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
            Kamu bisa mulai tanpa nama. Keluar cepat menghapus draf dan sesi di perangkat ini,
            tetapi tidak riwayat peramban.
          </NextStep>
        </div>
      </div>
    </div>
  );
}
