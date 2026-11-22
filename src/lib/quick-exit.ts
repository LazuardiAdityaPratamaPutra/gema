/**
 * Keluar Cepat: hapus semua data lokal lalu alihkan ke situs netral.
 * Memakai location.replace agar halaman ini tidak tersisa sebagai entri "kembali".
 * Batas yang jujur: riwayat peramban di luar kendali halaman web tetap bisa menyimpan kunjungan sebelumnya.
 */
export const NEUTRAL_URL = 'https://id.wikipedia.org/wiki/Cuaca';

export async function wipeLocal(): Promise<void> {
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
  await wipeLocal();
  window.location.replace(NEUTRAL_URL);
}
