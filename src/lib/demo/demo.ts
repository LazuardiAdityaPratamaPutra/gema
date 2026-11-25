/** Konstanta Mode Demo — data fiktif. Ditampilkan sengaja di /demo dan README agar juri dapat langsung mencoba. */
export const DEMO_INSTITUTION_ID = 'inst-demo';

export const DEMO_ACCOUNTS = [
  {
    key: 'maya',
    nama: 'Maya',
    peran: 'Penyintas (laporan tersimpan, ada gema)',
    caseCode: 'MAYA7KQ2X9PD',
    passphrase: 'ajaib baung cakrawala gagah kenang lembut',
  },
  {
    key: 'rafi',
    nama: 'Rafi',
    peran: 'Saksi (pelapor kedua pada terlapor yang sama)',
    caseCode: 'RAFA4MN8T3VC',
    passphrase: 'bukit damai hamparan jalin kasih mekar',
  },
  {
    key: 'dewa',
    nama: 'Dewa',
    peran: 'Pelapor dengan kasus tereskalasi dan terlambat',
    caseCode: 'DEWA5HN2K8QX',
    passphrase: 'cahaya embun fajar harum indah lentera',
  },
] as const;

export const DEMO_MEMBERS = [
  { email: 'ketua@contoh.ac.id', nama: 'Akun demo: Ketua Satgas', role: 'Ketua' },
  { email: 'anggota@contoh.ac.id', nama: 'Akun demo: Anggota Satgas', role: 'Anggota' },
  { email: 'auditor@contoh.ac.id', nama: 'Akun demo: Auditor', role: 'Auditor' },
  { email: 'pimpinan@contoh.ac.id', nama: 'Akun demo: Pimpinan', role: 'Pimpinan' },
  { email: 'pengawas@contoh.ac.id', nama: 'Akun demo: Pengawas Kemdiktisaintek', role: 'Pengawas' },
] as const;

export const DEMO_PASSWORD = 'contoh-demo-2026';

/** Fakultas UPN Veteran Jawa Timur menurut situs PPMB resmi (ppmb.upnjatim.ac.id), ditambah unit non-fakultas. */
export const DEMO_UNITS = [
  { id: 'u-feb', nama: 'Fakultas Ekonomi dan Bisnis', tipe: 'Fakultas' as const },
  { id: 'u-fp', nama: 'Fakultas Pertanian', tipe: 'Fakultas' as const },
  { id: 'u-ft', nama: 'Fakultas Teknik dan Sains', tipe: 'Fakultas' as const },
  { id: 'u-fisip', nama: 'Fakultas Ilmu Sosial, Budaya, dan Politik', tipe: 'Fakultas' as const },
  { id: 'u-fad', nama: 'Fakultas Arsitektur dan Desain', tipe: 'Fakultas' as const },
  { id: 'u-fh', nama: 'Fakultas Hukum', tipe: 'Fakultas' as const },
  { id: 'u-fik', nama: 'Fakultas Ilmu Komputer', tipe: 'Fakultas' as const },
  { id: 'u-fk', nama: 'Fakultas Kedokteran', tipe: 'Fakultas' as const },
  { id: 'u-pasca', nama: 'Program Pascasarjana', tipe: 'Unit kerja' as const },
  { id: 'u-bem', nama: 'Unit Kegiatan Mahasiswa', tipe: 'Unit kerja' as const },
];

export const DEMO_CHAT = `31/10/2026 21.14 - Pak Hendra: Revisi bab 3 belum saya terima. Besok jam 8 malam ke ruangan saya saja.
31/10/2026 21.15 - Maya: Bisa di jam konsultasi siang, Pak?
31/10/2026 21.16 - Pak Hendra: Malam saja. Jangan ajak teman. Ini urusan kita berdua.
31/10/2026 21.18 - Maya: Saya kurang nyaman kalau malam, Pak.
31/10/2026 21.20 - Pak Hendra: Kamu mau lulus tepat waktu atau tidak?
31/10/2026 21.21 - Pak Hendra: Jangan bilang siapa-siapa soal ini.
01/11/2026 08.02 - Maya: Selamat pagi Pak. Saya kirim revisinya lewat email saja ya.
01/11/2026 08.40 - Pak Hendra: Saya tidak menerima revisi lewat email.
01/11/2026 08.41 - Pak Hendra: IMG-20261101-WA0007.jpg (file terlampir)
01/11/2026 08.43 - Pak Hendra: Datang malam ini, atau nilaimu saya tahan.
`;

export const DEMO_NOTE_SAKSI = `Catatan saksi (fiktif)
Tanggal 2 November 2026 saya melihat Maya keluar dari ruang dosen sekitar pukul 21.30 dalam keadaan menangis.
Saya tidak tahu apa yang terjadi di dalam. Ini catatan saya sendiri.
`;
