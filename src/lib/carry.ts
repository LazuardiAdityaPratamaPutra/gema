/** Cerita yang ditulis di /pahami dibawa ke formulir laporan lewat sessionStorage tab ini, lalu dihapus. Keluar cepat juga menghapusnya. */
const CARRY_KEY = 'gema:cerita-awal';
export function takeCarried(): string {
  try {
    const v = sessionStorage.getItem(CARRY_KEY) ?? '';
    sessionStorage.removeItem(CARRY_KEY);
    return v;
  } catch {
    return '';
  }
}
export function carry(text: string) {
  try {
    if (text.trim()) sessionStorage.setItem(CARRY_KEY, text);
  } catch {
    /* abaikan */
  }
}
