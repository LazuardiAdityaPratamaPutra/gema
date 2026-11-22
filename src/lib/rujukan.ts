/**
 * Layanan rujukan nasional. Nomor diperiksa dari sumber resmi/berita pada November 2026;
 * pengguna diminta memeriksa ulang di situs resmi sebelum menghubungi.
 */
export type Layanan = {
  nama: string;
  untuk: string;
  kontak: { label: string; href?: string }[];
  jam?: string;
};

export const NASIONAL: Layanan[] = [
  {
    nama: 'SAPA 129 (KemenPPPA)',
    untuk: 'Pengaduan dan pendampingan kekerasan terhadap perempuan dan anak',
    kontak: [
      { label: 'Telepon 129', href: 'tel:129' },
      { label: 'WhatsApp 0811-1129-129', href: 'https://wa.me/628111129129' },
    ],
  },
  {
    nama: 'Komnas Perempuan',
    untuk: 'Pengaduan dan rujukan ke lembaga layanan terdekat',
    kontak: [
      { label: '021-3903963', href: 'tel:+62213903963' },
      { label: 'pengaduan@komnasperempuan.go.id', href: 'mailto:pengaduan@komnasperempuan.go.id' },
    ],
    jam: 'Senin–Jumat, jam kerja',
  },
  {
    nama: 'LPSK',
    untuk: 'Permohonan perlindungan saksi dan korban bila menempuh jalur pidana',
    kontak: [
      { label: 'WhatsApp 0857-7001-0048', href: 'https://wa.me/6285770010048' },
      { label: 'lpsk.go.id', href: 'https://lpsk.go.id' },
    ],
  },
  {
    nama: 'Darurat',
    untuk: 'Bila kamu dalam bahaya saat ini',
    kontak: [
      { label: 'Panggilan darurat 112', href: 'tel:112' },
      { label: 'Polisi 110', href: 'tel:110' },
    ],
  },
];

export type RujukanKampus = {
  nama: string;
  jenis: 'psikolog' | 'hukum' | 'medis' | 'pendamping' | 'lainnya';
  kontak: string;
  catatan?: string;
};
export const JENIS_LABEL: Record<RujukanKampus['jenis'], string> = {
  psikolog: 'Psikolog',
  hukum: 'Bantuan hukum',
  medis: 'Medis',
  pendamping: 'Pendamping',
  lainnya: 'Lainnya',
};
