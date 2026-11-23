# Deploy

Next.js 16 membutuhkan Node 20+. Server memakai disk (`.data/`), jadi gunakan host dengan disk persisten (VPS, Railway/Fly dengan volume), satu instans.

```bash
npm ci && npm run build
GEMA_DEMO=on PORT=3000 npm start
```

**Mode Demo di produksi harus dinyatakan `GEMA_DEMO=on`.** Tanpa variabel itu, `npm start` menjalankan mode non-demo: masuk Satgas tanpa kata sandi dan `POST /api/demo/reset` mati, dan akun Satgas seed memakai kata sandi acak. Untuk deploy demo publik, pasang `GEMA_DEMO=on`. Titik reset menolak bekerja bila basis data memuat institusi non-demo.

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
