'use client';
import Link from 'next/link';

/**
 * Kegagalan memuat. Menegaskan bahwa tidak ada yang hilang, agar pengguna tidak mengira buktinya terhapus.
 * `message` adalah keterangan teknis dari server; ditampilkan kecil sebagai petunjuk.
 */
export function LoadError({
  what,
  message,
  onRetry,
}: {
  what: string;
  message?: string;
  onRetry?: () => void;
}) {
  // 403 dari server: bukan gangguan jaringan, jadi jangan menyuruh mencoba lagi.
  if (message && /tidak memiliki akses/i.test(message)) {
    return (
      <section className="card alert" role="alert">
        <h2 className="title-sm m-0">Peranmu tidak punya akses ke {what}</h2>
        <p className="m-0 mt-sm">
          Bagian ini dibatasi untuk peran tertentu. Tidak ada yang salah dengan akunmu, dan tidak
          ada data yang berubah.
        </p>
        <Link href="/satgas" className="btn ghost sm">
          Kembali ke daftar kasus
        </Link>
      </section>
    );
  }
  return (
    <section className="card alert" role="alert">
      <h2 className="title-sm m-0">Belum bisa memuat {what}</h2>
      <p className="m-0">
        Ini hanya soal memuat. Tidak ada yang terhapus atau berubah. Coba lagi, dan bila tetap
        gagal, periksa koneksimu.
      </p>
      {message && <p className="small muted m-0">Keterangan: {message}</p>}
      <button
        type="button"
        className="btn ghost sm"
        onClick={onRetry ?? (() => window.location.reload())}
      >
        Coba lagi
      </button>
    </section>
  );
}
