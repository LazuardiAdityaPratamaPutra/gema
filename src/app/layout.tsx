import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/archivo/wdth.css';
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
import '@/styles/08-utilitas.css';
import { Navbar } from '@/components/Navbar';
import { QuickExit } from '@/components/QuickExit';
import { Footer } from '@/components/Footer';
import { TableLabels } from '@/components/TableLabels';

export const metadata: Metadata = {
  title: { default: 'Gema: bukti aman, keadilan terukur', template: '%s | Gema' },
  description:
    'Brankas bukti terenkripsi, pencocokan privat, dan jam akuntabilitas untuk penanganan kekerasan seksual di perguruan tinggi.',
  robots: { index: true, follow: true },
};
// Nonce CSP dibuat per permintaan, jadi semua halaman dirender dinamis.
export const dynamic = 'force-dynamic';

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#0E0F12' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>
        <a className="skip" href="#isi">
          Lewati ke konten
        </a>
        <Navbar />
        <QuickExit />
        <main id="isi" tabIndex={-1}>
          {children}
        </main>
        <Footer />
        <TableLabels />
      </body>
    </html>
  );
}
