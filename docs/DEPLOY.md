# Deploy

Next.js 16 membutuhkan Node 20+. Server memakai disk (`.data/`), jadi gunakan host dengan disk persisten (VPS, Railway/Fly dengan volume), satu instans.

```bash
npm ci && npm run build
GEMA_DEMO=on PORT=3000 npm start
```

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
