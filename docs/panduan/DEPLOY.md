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

Di balik proksi (Railway, Fly, Nginx), atur `GEMA_TRUSTED_PROXIES` sesuai jumlah proksi (bawaan 1) agar pembatas laju memakai alamat klien asli.

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
