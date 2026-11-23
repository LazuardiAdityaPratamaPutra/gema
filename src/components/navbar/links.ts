/** Daftar menu navbar per peran. */
export type Link_ = { href: string; label: string; hint: string };
export type Cta = { href: string; label: string; short: string };

export const BERANDA: Link_ = { href: '/', label: 'Beranda', hint: 'Halaman utama Gema' };
export const GUEST: Link_[] = [
  BERANDA,
  { href: '/pahami', label: 'Pahami dulu', hint: 'Apakah yang kualami termasuk kekerasan?' },
  { href: '/papan', label: 'Papan', hint: 'Ketepatan waktu penanganan tiap kampus' },
  { href: '/panduan', label: 'Bantuan', hint: 'SAPA 129, Komnas Perempuan, LPSK' },
];
export const REPORTER: Link_[] = [
  BERANDA,
  { href: '/brankas', label: 'Brankas', hint: 'Laporan dan bukti yang tersimpan' },
  { href: '/pahami', label: 'Pahami dulu', hint: 'Bantuan menyusun cerita' },
  { href: '/verifikasi', label: 'Periksa', hint: 'Cek keutuhan berkas' },
  {
    href: '/brankas/pengaturan',
    label: 'Kode Paksa',
    hint: 'Brankas tiruan bila kamu dipaksa membuka',
  },
  { href: '/panduan', label: 'Bantuan', hint: 'Cara kerja dan kontak darurat' },
];
export function satgasLinks(role: string): Link_[] {
  const out: Link_[] = [];
  if (['Ketua', 'Anggota', 'Pimpinan'].includes(role))
    out.push({ href: '/satgas', label: 'Kasus', hint: 'Tenggat dan tangga eskalasi' });
  if (role === 'Pengawas')
    out.push({ href: '/satgas', label: 'Pengawasan', hint: 'Angka agregat tingkat 3' });
  if (role === 'Pimpinan')
    out.push({ href: '/satgas/radar', label: 'Radar', hint: 'Pola per unit dan periode' });
  if (['Auditor', 'Ketua'].includes(role))
    out.push({ href: '/satgas/audit', label: 'Jejak audit', hint: 'Apakah rantai hash utuh?' });
  if (role === 'Ketua')
    out.push({ href: '/satgas/kunci', label: 'Kunci', hint: 'Buat atau impor kunci Satgas' });
  out.push({ href: '/papan', label: 'Papan', hint: 'Ketepatan waktu penanganan' });
  out.push({ href: '/panduan', label: 'Panduan', hint: 'Cara kerja dan batas jujur' });
  return out;
}
