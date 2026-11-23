/** Zona warna halaman, dipakai CSS lewat html[data-zone]. */
export function zoneOf(path: string): string {
  if (path === '/') return 'home';
  if (/^\/(brankas|mulai|masuk|pulihkan)/.test(path)) return 'lapor';
  if (path.startsWith('/satgas')) return 'satgas';
  if (path.startsWith('/papan')) return 'papan';
  if (path.startsWith('/demo')) return 'demo';
  return 'cek';
}
