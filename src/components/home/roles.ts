/** Isi pemilih peran di beranda: satu entri per tempat berdiri pada alur satu kasus. */
export type Peran = (typeof ROLES)[number];

export const ROLES = [
  {
    id: 'penyintas',
    tahap: 'Menyimpan',
    tab: 'Saya penyintas',
    color: 'var(--c-penyintas)',
    head: 'Simpan dulu. Putuskan nanti.',
    pts: [
      'Tulis, atau ceritakan dengan suara. Semuanya dikunci di perangkatmu.',
      'Tanpa nama, email, atau telepon. Hanya kode dan enam kata.',
      'Satgas baru tahu bila kamu memilih mengirim (eskalasi), dan bisa ditarik selama Satgas belum membuka kasusnya.',
    ],
    cta: { href: '/mulai', label: 'Buat brankas tanpa nama' },
    alt: { href: '/pahami', label: 'Ragu? Pahami dulu' },
  },
  {
    id: 'saksi',
    tahap: 'Mencocokkan',
    tab: 'Saya tahu kejadian serupa',
    color: 'var(--c-saksi)',
    head: 'Kamu mungkin bukan satu-satunya.',
    pts: [
      'Simpan laporanmu. Nama terlapor disamarkan di perangkatmu.',
      'Bila ada laporan lain tentang orang yang sama, kamu diberi tahu. Tidak ada identitas yang terbuka.',
      'Kamu menentukan berapa laporan cocok sebelum diberi tahu.',
    ],
    cta: { href: '/mulai', label: 'Simpan dan cek pola' },
    alt: { href: '/panduan#batas', label: 'Seakurat apa?' },
  },
  {
    id: 'satgas',
    tahap: 'Menangani',
    tab: 'Saya di Satgas',
    color: 'var(--c-satgas)',
    head: 'Kasus masuk, jam berjalan.',
    pts: [
      'Dosir terbuka hanya setelah penyintas mengeskalasi. Tiap pembukaan tercatat.',
      'Tenggat hari kerja sesuai Permendikbudristek 55/2024. Ringkasan dan draf surat disiapkan otomatis.',
      'Kunci Satgas dibuat dan disimpan di perangkat Ketua.',
    ],
    cta: { href: '/satgas/masuk', label: 'Masuk Satgas' },
    alt: { href: '/demo', label: 'Coba dengan data demo', soloDemo: true },
  },
  {
    id: 'publik',
    tahap: 'Memantau',
    tab: 'Saya memantau kampus',
    color: 'var(--c-publik)',
    head: 'Angka kampus, bukan kasus orang.',
    pts: [
      'Papan menampilkan persen tepat waktu per kuartal, dengan derau agar tak ada kasus yang bisa ditebak.',
      'Siapa pun bisa memeriksa keutuhan bukti tanpa akun.',
      'Akar harian dirancang untuk diarsipkan ke repositori publik.',
    ],
    cta: { href: '/papan', label: 'Lihat papan akuntabilitas' },
    alt: { href: '/verifikasi', label: 'Periksa bukti' },
  },
] as const;
