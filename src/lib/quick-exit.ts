/**
 * Keluar Cepat: hapus semua data lokal lalu alihkan ke situs netral.
 * Memakai location.replace agar halaman ini tidak tersisa sebagai entri "kembali".
 * Batas yang jujur: riwayat peramban di luar kendali halaman web tetap bisa menyimpan kunjungan sebelumnya.
 */
/** Teks batas perlindungan, ditampilkan dekat setiap tombol Keluar cepat. */
export const QUICK_EXIT_LIMITS =
  'Menghapus draf dan sesi di perangkat ini, lalu membuka Google. Laporan yang sudah tersimpan tetap aman: masuk lagi dengan Kode dan kata sandimu. Tidak menghapus riwayat peramban. Hapus riwayat sendiri, atau pakai jendela privat.';

const NEUTRAL_URL = 'https://www.google.com/';

async function wipeLocal(): Promise<void> {
  try {
    sessionStorage.clear();
    localStorage.clear();
  } catch {
    /* abaikan */
  }
  try {
    const dbs = (await indexedDB.databases?.()) ?? [];
    await Promise.all(
      dbs.map((d) =>
        d.name
          ? new Promise<void>((res) => {
              const r = indexedDB.deleteDatabase(d.name!);
              r.onsuccess = r.onerror = r.onblocked = () => res();
            })
          : Promise.resolve(),
      ),
    );
  } catch {
    /* abaikan */
  }
  try {
    const keys = await caches?.keys?.();
    await Promise.all((keys ?? []).map((k) => caches.delete(k)));
  } catch {
    /* abaikan */
  }
}

export async function quickExit() {
  // Sembunyikan seketika dan netralkan judul tab, sebelum penghapusan yang bisa memakan waktu.
  try {
    document.documentElement.style.visibility = 'hidden';
    document.title = 'Google';
  } catch {
    /* abaikan */
  }
  await wipeLocal();
  window.location.replace(NEUTRAL_URL);
}
