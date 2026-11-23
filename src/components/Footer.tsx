import Link from 'next/link';
export function Footer() {
  return (
    <footer className="footer">
      <div className="wrap">
        <p>
          Gema menyimpan bukti dan mencatat waktu penanganan. Bukan layanan darurat, bukan nasihat
          hukum.
        </p>
        <nav aria-label="Tautan kaki">
          <Link href="/panduan#bantuan">Bantuan segera</Link>
          <Link href="/panduan#batas">Batas jujur</Link>
          <Link href="/bukti-teknis">Bukti teknis</Link>
          <Link href="/satgas/masuk">Masuk Satgas</Link>
        </nav>
      </div>
    </footer>
  );
}
