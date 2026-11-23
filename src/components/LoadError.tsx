'use client';

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
