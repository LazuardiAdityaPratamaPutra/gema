import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/archivo/wght.css';
import '@fontsource-variable/atkinson-hyperlegible-next';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import '@/styles/00-token.css';
import '@/styles/01-dasar.css';
import '@/styles/02-beranda-dan-bagian-umum.css';
import '@/styles/03-pendamping.css';
import '@/styles/04-brankas-dan-panduan.css';
import '@/styles/05-tata-usaha-kampus.css';
import '@/styles/06-navigasi-dan-langkah.css';
import '@/styles/07-palet-dan-pita.css';
import '@/styles/08-presisi.css';
import '@/styles/09-warna-60-30-10.css';
import '@/styles/10-pinus.css';
import '@/styles/11-tonal.css';
import '@/styles/12-modern.css';
import '@/styles/13-utilitas.css';
import { Navbar } from '@/components/Navbar';
import { QuickExit } from '@/components/QuickExit';
import { Footer } from '@/components/Footer';
import { TableLabels } from '@/components/TableLabels';
import { IdleLock } from '@/components/IdleLock';
import { SmoothScroll } from '@/components/motion/SmoothScroll';
import { MotionLayer } from '@/components/motion/MotionLayer';

export const metadata: Metadata = {
  title: { default: 'Gema: bukti tersimpan, penanganan terlihat', template: '%s | Gema' },
  description:
    'Brankas bukti terenkripsi, pencocokan privat, dan jam akuntabilitas untuk penanganan kekerasan seksual di perguruan tinggi.',
  robots: { index: true, follow: true },
  // Tujuan Keluar Cepat tidak perlu tahu halaman asalnya.
  referrer: 'no-referrer',
};
// Nonce CSP dibuat per permintaan, jadi semua halaman dirender dinamis.
export const dynamic = 'force-dynamic';

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#F3F7F4' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>
        <a className="skip" href="#isi">
          Lewati ke konten
        </a>
        <Navbar />
        <QuickExit />
        <IdleLock />
        <SmoothScroll />
        <MotionLayer />
        <main id="isi" tabIndex={-1}>
          {children}
        </main>
        <Footer />
        <TableLabels />
      </body>
    </html>
  );
}
