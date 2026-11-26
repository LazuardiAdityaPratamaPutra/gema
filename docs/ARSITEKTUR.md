# Arsitektur Gema

Dokumen ini untuk engineer yang baru membuka repositori. Mulai dari sini, lalu baca [KONTRIBUSI.md](KONTRIBUSI.md) bila akan menambah fitur.

## Gambaran besar

Gema adalah satu aplikasi Next.js (App Router, React 19, TypeScript strict) yang memuat **klien** dan **server** dalam repositori yang sama.

```
Peramban pelapor / Satgas
   │  fetch /api/...  (src/lib/api.ts)
   ▼
src/app/api/[...path]/route.ts      jembatan tipis, hanya memanggil handle()
   ▼
src/server/router.ts                merangkai penangan: publik, akun, pelapor, satgas, demo, cron
   ▼
src/server/routes/*                 membaca permintaan, memeriksa sesi dan skema, membentuk respons
   ▼
src/server/logic/*                  aturan bisnis; satu berkas per domain
   ▼
src/server/db.ts + backends/        penyimpanan (berkas JSON atau PostgreSQL), satu objek DB di memori
```

**Prinsip yang tidak boleh dilanggar:** isi laporan dan bukti dienkripsi di perangkat pelapor. Server hanya menyimpan ciphertext dan metadata. Kode di `src/server/` tidak boleh meminta kunci pembuka isi laporan.

## Peta folder

| Folder                       | Isi                                                                                           |
| ---------------------------- | --------------------------------------------------------------------------------------------- |
| `src/app/`                   | Halaman (App Router). Satu folder per rute, komponen khusus halaman ada di sebelahnya.        |
| `src/components/`            | Komponen yang dipakai banyak halaman: navbar, kerangka muat, penanda.                         |
| `src/lib/`                   | Logika sisi klien: `vault/` (kunci, brankas), `laporan/` (penyusunan), `asr/` (dikte).        |
| `src/server/routes/`         | Satu berkas per kelompok rute API. `schemas.ts` memuat skema zod semua badan permintaan.      |
| `src/server/logic/`          | Aturan inti: sesi, akun, laporan, klaster, eskalasi, SLA, kepatuhan, jangkar, kesehatan.      |
| `src/server/logic-satgas.ts` | Aturan khusus Satgas: Empat Mata, mundur, Bukti Pemilik.                                      |
| `src/server/seed/`           | Data awal: akun peran Mode Demo, institusi, dan akun sungguhan dari variabel lingkungan.      |
| `src/styles/`                | CSS berlapis; urutan impor di `layout.tsx` adalah urutan cascade. Lihat `docs/desain/CSS.md`. |
| `packages/`                  | Pustaka tanpa dependensi UI: `crypto`, `oprf`, `pq-kem`, `merkle`, `zk`, `shamir`, `dp`, dll. |
| `tests/e2e/`                 | Uji alur API lengkap. `tests/unit/` untuk fungsi murni dan penjaga (CSS, bentuk kekerasan).   |

## Alur data satu laporan

1. **Pelapor membuat brankas** (`/mulai`): kunci diturunkan dari passphrase di perangkat; server menyimpan hash autentikasi dan blob terenkripsi.
2. **Menyusun laporan** (`/brankas/baru`): narasi dan bukti dienkripsi di perangkat (`src/lib/laporan/report-build.ts`), lalu dikirim sebagai `secrets` dan sidik OPRF.
3. **Eskalasi** (opsional, atas pilihan pelapor): kunci laporan dibungkus ke kunci publik Satgas (ECDH P-256 + ML-KEM-768). Setelah itu kasus muncul di Satgas dengan alias acak.
4. **Penanganan**: Satgas membuka dosir (di mode Empat Mata butuh persetujuan anggota lain), mengubah status, menambah catatan. Semua tercatat di jejak audit berantai hash.
5. **Keterlambatan**: `tick()` (dipanggil penjadwal harian dan saat daftar kasus dibuka) menaikkan tangga T1 sampai T3 dan menerbitkan jangkar Merkle harian.

## Peran dan akses

`Ketua`, `Anggota`, `Pimpinan`, `Auditor`, `Pengawas`, `Admin` (lihat `SatgasRole` di `src/server/types.ts`). Pemeriksaan peran dilakukan di server lewat `satgasSession(req, [peran...])`; menyembunyikan tombol di klien bukan pengamanan.

## Kebiasaan kode

- Komentar dan pesan galat berbahasa Indonesia, dalam kalimat yang menjelaskan **mengapa**.
- Fungsi kecil: ESLint menolak kompleksitas di atas 12, fungsi di atas 80 baris, lebih dari 6 parameter, dan kedalaman di atas 4. Pecah fungsinya; jangan naikkan ambang.
- Galat yang boleh dilihat pengguna dilempar sebagai `HttpError(status, pesan)`. Pesan tidak boleh memuat nilai rahasia.
- Setiap perubahan perilaku punya tes. `npm run check` harus hijau sebelum commit.
