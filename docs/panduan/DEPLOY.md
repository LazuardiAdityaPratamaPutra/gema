# Deploy

Next.js 16 membutuhkan Node 20+. Server memakai disk (`.data/`), jadi gunakan host dengan disk persisten (VPS, Railway/Fly dengan volume), satu instans.

```bash
npm ci && npm run build
GEMA_DEMO=on PORT=3000 npm start
```

**Mode Demo di produksi harus dinyatakan `GEMA_DEMO=on`.** Tanpa variabel itu, `npm start` menjalankan mode sungguhan (lihat di bawah): tidak ada akun, data, atau tautan demo, dan `POST /api/demo/reset` mati. Untuk deploy demo publik, pasang `GEMA_DEMO=on`. Titik reset menolak bekerja bila basis data memuat institusi non-demo.

## Mode sungguhan (tanpa demo)

Untuk dipakai kampus: pelapor mengisi laporan, admin Satgas menanganinya dengan akun nyata. Tanpa data, akun, atau tautan demo.

```bash
export GEMA_SATGAS_AKUN='[{"email":"ketua@kampus.ac.id","nama":"Nama Ketua","role":"Ketua","password":"sandi-panjang-rahasia"}]'
GEMA_DEMO=off PORT=3000 npm start
```

- `GEMA_SATGAS_AKUN` adalah daftar JSON akun admin. Tiap akun punya `email`, `nama`, `role` (Ketua, Anggota, Auditor, Pimpinan, atau Pengawas), dan `password` (minimal 12 karakter). Harus ada minimal satu Ketua. Simpan nilai ini sebagai rahasia di host, jangan di git.
- Akun dibuat saat server mulai. Mengubah kata sandi atau peran di variabel lalu memulai ulang server memperbaruinya. Akun yang dihapus dari variabel tidak dihapus otomatis.
- Salah isi variabel membuat server menolak melayani dan mencatat sebabnya, supaya kesalahan terlihat saat deploy.
- Basis data harus baru. Basis data yang dibuat dalam Mode Demo ditolak oleh mode sungguhan; kosongkan `.data/` atau pakai basis data lain.
- **Langkah pertama Ketua:** masuk di `/satgas/masuk`, buka halaman Kunci, lalu "Buat dan umumkan kunci baru", dan simpan berkas cadangannya di dua tempat terpisah. Sampai itu dilakukan, eskalasi ditolak dengan pesan yang jelas dan laporan pelapor tetap tersimpan. Ini mencegah dosir nyata terkunci ke kunci yang bukan milik Satgas.
- Gema tidak dapat memulihkan kunci Satgas yang hilang.
- **Empat Mata** (persetujuan dua orang untuk membuka dosir) bawaannya mati. Ketua mengaktifkannya di halaman Kunci. Server menolak aktivasi bila akun panel (Ketua, Anggota, Pimpinan) kurang dari dua, supaya dosir tidak terkunci tanpa ada yang bisa menyetujui. Siapkan minimal dua akun di `GEMA_SATGAS_AKUN` sebelum mengaktifkannya.
- **Mematikan Empat Mata** tidak bisa dilakukan Ketua sendirian. Ketua meminta, anggota panel lain (Anggota atau Pimpinan) menyetujui di halaman Kasus ("Menunggu persetujuanmu"), lalu Ketua menekan tombolnya lagi dalam 30 menit. Izinnya sekali pakai dan semuanya tercatat di audit.
- **Surel peringatan keterlambatan (opsional).** Isi `GEMA_SMTP_URL` (mis. `smtps://pengguna:sandi@smtp.kampus.ac.id:465`), `GEMA_EMAIL_DARI` (mis. `Gema <gema@kampus.ac.id>`), dan `GEMA_APP_URL` (alamat Gema untuk tautan masuk). Saat kasus naik tingkat, satu surel dikirim ke tiap akun penerima: T1 Ketua, T2 Pimpinan, T3 Pengawas. Isinya hanya jumlah kasus dan tingkatnya, tanpa alias atau isi laporan. Gagal kirim hanya tercatat di audit dan tidak menghentikan penjadwal. Tanpa variabel itu tidak ada surel, dan peringatan tetap muncul di aplikasi. Mode demo tidak pernah mengirim surel.
- **Memegang kunci Satgas.** Kunci sengaja tidak disimpan di peramban (hilang saat tab ditutup) supaya tidak ada salinan yang tertinggal di perangkat. Pilih "Pecah jadi 3 bagian" saat membuat kunci: tiga pemegang berbeda, dan dua bagian cukup untuk membuka. Sebelum dipakai sungguhan, uji sekali: rakit kunci dari dua bagian di `/satgas/kunci` dan buka satu kasus uji. Jangan simpan dua bagian di tempat yang sama. Kehilangan dua bagian berarti dosir yang sudah dikunci tidak bisa dibuka lagi, dan Gema tidak dapat memulihkannya.
- Tangga eskalasi waktu (T1 Ketua, T2 Pimpinan, T3 Pengawas agregat) hanya naik bila `POST /api/cron/tick` dipanggil. Workflow GitHub `anchor-harian` sudah memanggilnya sekali sehari (00.15 WIB), cukup karena ambang dihitung dalam hari kerja. Syaratnya: isi secrets repositori `GEMA_URL` dan `GEMA_CRON_SECRET`, pasang `GEMA_CRON_SECRET` yang sama di server, lalu aktifkan workflow itu di tab Actions (sekarang masih Disabled).

Di balik proksi (Railway, Fly, Nginx), atur `GEMA_TRUSTED_PROXIES` sesuai jumlah proksi (bawaan 1) agar pembatas laju memakai alamat klien asli.

### Konflik kepentingan dan catatan penanganan

- **Mundur dari kasus.** Ketua, Anggota, atau Pimpinan yang punya konflik kepentingan menekan "Saya punya konflik kepentingan dengan kasus ini" di halaman kasus. Setelah itu akunnya tidak bisa membuka, menindak, atau menyetujui akses kasus itu. Alasannya tidak disimpan. Kejadiannya tercatat di log audit dan tampil di riwayat kasus pelapor, tanpa nama. Pada mode Empat Mata, bila tersisa kurang dari dua anggota panel tanpa konflik, aplikasi memperingatkan; tambahkan akun panel agar kasus tetap bisa dibuka.
- **Catatan penanganan.** Pelapor yang kasusnya sudah dikirim ke Satgas bisa mengunduh kronologi (kirim, tenggat, status, peringatan keterlambatan, hash bukti) sebagai HTML mandiri untuk diserahkan ke pihak luar. Berkas dibuat di perangkat pelapor, tanpa nama, Kode Kasus, atau isi laporan. Sidiknya hanya menunjukkan berkas tidak diubah sejak diunduh; keaslian bukti tetap lewat Sertifikat Bukti.

- **Peringatan jaminan otomatis.** Di kampus sungguhan, Ketua dan Auditor melihat kotak peringatan di halaman Kasus bila penjadwal harian (workflow anchor-harian) tidak berjalan lebih dari dua hari, atau bukti tertinggal dari akar harian. Tanpa penjadwal, kasus yang terlambat tidak naik tingkat.
- **Waktu dibuka.** Pelapor melihat kapan Satgas membuka kasusnya, dan tanggal itu ikut di catatan penanganan. Kasus yang tak pernah dibuka lewat tenggat jadi bukti yang terbaca.

## PostgreSQL

Tanpa disk persisten (Vercel, kontainer tanpa volume), pakai PostgreSQL:

```bash
export DATABASE_URL='postgres://user:sandi@host:5432/gema'
export GEMA_OPRF_MASTER="$(openssl rand -hex 32)"   # simpan di secret manager; jangan hilang
GEMA_DEMO=off npm start
```

Tabel `gema_state` dan `gema_blobs` dibuat otomatis. Kunci induk OPRF/HMAC wajib lewat `GEMA_OPRF_MASTER` dan tidak pernah disimpan di basis data; kehilangannya membuat sidik pencocokan lama tak bisa dicocokkan lagi. Hanya satu instans penulis: instans kedua menolak start (kunci penasihat Postgres). Sesi, pembatas laju, dan tantangan ikut tersimpan di basis data (hanya hash token), tetapi belum aman dibagi antarinstans.

## CSP nonce

`src/proxy.ts` membuat nonce per permintaan, jadi semua halaman dirender dinamis. Bila di depan Gema ada CDN atau proxy yang menambah header CSP sendiri, pastikan ia tidak menimpa header dari aplikasi.

Anchor harian: panggil `POST /api/cron/tick` dari cron (mis. tiap jam) untuk menjalankan tangga eskalasi dan menerbitkan akar. Komit akar ke repositori publik agar `commit_ref` terisi (belum otomatis).
