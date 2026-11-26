/** Daftar menu navbar per peran. Nama menu memakai bahasa sehari-hari dan menyebut isi halamannya. */
/** `sheetOnly`: hanya di menu ponsel, karena di layar lebar logo sudah membawa ke halaman utama. */
export type Link_ = { href: string; label: string; hint: string; sheetOnly?: boolean };
export type Cta = { href: string; label: string; short: string };

const BERANDA: Link_ = {
  href: '/',
  label: 'Beranda',
  hint: 'Halaman utama Gema',
  sheetOnly: true,
};
const KENALI: Link_ = {
  href: '/pahami',
  label: 'Kenali kekerasan',
  hint: 'Apakah yang kualami termasuk kekerasan?',
};
const KINERJA: Link_ = {
  href: '/papan',
  label: 'Kinerja Satgas',
  hint: 'Seberapa cepat Satgas menangani kasus',
};
const BANTUAN: Link_ = {
  href: '/panduan',
  label: 'Bantuan',
  hint: 'Cara kerja Gema dan kontak darurat',
};

export const GUEST: Link_[] = [
  BERANDA,
  KENALI,
  KINERJA,
  BANTUAN,
  { href: '/satgas/masuk', label: 'Masuk Satgas', hint: 'Khusus anggota Satgas kampus' },
];
export const REPORTER: Link_[] = [
  { href: '/brankas', label: 'Laporanku', hint: 'Laporan dan bukti yang tersimpan' },
  KENALI,
  { href: '/verifikasi', label: 'Cek bukti', hint: 'Cek apakah berkas bukti masih utuh' },
  {
    href: '/brankas/pengaturan',
    label: 'Pengaturan',
    hint: 'Keamanan akun, pemulihan, dan passkey',
  },
  BANTUAN,
];
export function satgasLinks(role: string): Link_[] {
  const out: Link_[] = [];
  if (['Ketua', 'Anggota', 'Pimpinan'].includes(role))
    out.push({ href: '/satgas', label: 'Kasus', hint: 'Daftar kasus dan tenggatnya' });
  if (role === 'Pengawas')
    out.push({ href: '/satgas', label: 'Pengawasan', hint: 'Angka kasus yang terlambat' });
  if (role === 'Pimpinan')
    out.push({ href: '/satgas/radar', label: 'Pola kasus', hint: 'Pola per unit dan periode' });
  if (['Auditor', 'Ketua'].includes(role))
    out.push({
      href: '/satgas/audit',
      label: 'Jejak audit',
      hint: 'Riwayat tindakan, dan apakah ada yang diubah',
    });
  if (role === 'Ketua')
    out.push({ href: '/satgas/kunci', label: 'Kunci Satgas', hint: 'Buat atau muat kunci Satgas' });
  out.push(KINERJA);
  out.push(BANTUAN);
  return out;
}
