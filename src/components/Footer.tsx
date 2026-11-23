import Link from 'next/link';
import { Echo, Wordmark } from './Echo';
export function Footer() {
  return (
    <footer className="footer">
      <div className="wrap">
        <div className="footer-brand">
          <Echo size={34} tone="putih" />
          <Wordmark height={34} />
        </div>
        <p>
          Gema menyimpan bukti dan mencatat waktu penanganan. Bukan layanan darurat, bukan nasihat
          hukum.
        </p>
        <nav aria-label="Tautan kaki">
          <Link href="/panduan#bantuan">Bantuan segera</Link>
          <Link href="/panduan#batas">Batas jujur</Link>
          <Link href="/verifikasi">Periksa bukti</Link>
          <Link href="/bukti-teknis">Bukti teknis</Link>
          <Link href="/demo">Coba demo</Link>
          <Link href="/satgas/masuk">Masuk Satgas</Link>
        </nav>
      </div>
    </footer>
  );
}
