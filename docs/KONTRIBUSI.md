# Panduan kontributor

## Menjalankan

```bash
npm install
npm run dev          # http://localhost:3000, Mode Demo aktif secara bawaan di pengembangan
npm run check        # typecheck + eslint + stylelint + prettier + seluruh tes
```

Mode sungguhan dan variabel lingkungan dijelaskan di [panduan/DEPLOY.md](panduan/DEPLOY.md).

## Menambah endpoint API

Contoh nyata: fitur "mundur karena konflik kepentingan" (`POST /api/satgas/cases/:id/mundur`).

1. **Aturan bisnis** di `src/server/logic/` atau `src/server/logic-satgas.ts`. Fungsi menerima `db` dan sesi, memeriksa syarat, melempar `HttpError` bila ditolak, mengubah `db`, lalu memanggil `audit(...)` dan `persist(db)`. Contoh: `mundurDariKasus`.
2. **Skema badan permintaan** di `src/server/routes/schemas.ts` (zod). Baca badan dengan `bodyOf(skema, req)`; jangan memakai `req.json()` langsung.
3. **Rute** di berkas kelompoknya di `src/server/routes/`. Daftarkan sebagai kunci `"METODE aksi"` pada tabel rute (lihat `OWN_CHECK` dan `STAFF_ONLY` di `routes/satgas.ts`). Periksa peran dengan `satgasSession` atau `reporterSession`.
4. **Bentuk respons** untuk klien lewat `src/server/routes/views.ts`. Jangan mengembalikan objek `db` mentah; pilih kolom yang memang perlu dilihat.
5. **Tes e2e** di `tests/e2e/`. Pakai `setup` dan `call` dari `tests/helpers.ts`. Uji juga jalur yang ditolak (peran salah, status salah), bukan hanya jalur sukses.

## Menambah halaman atau tombol

1. Halaman baru: folder di `src/app/<rute>/page.tsx`. Komponen yang hanya dipakai halaman itu ditaruh di folder yang sama.
2. Panggil API dengan `api(path, { token, method, body })` dari `src/lib/api.ts`. Sesi diambil dari `useReporter()` atau `useSatgas()`.
3. Tampilkan keadaan muat dengan komponen di `src/components/Skeleton.tsx` dan galat dengan `LoadError`. Kerangka harus meniru bentuk isi akhir agar halaman tidak melompat.
4. Satu komponen, satu tugas. Bila fungsi komponen mendekati 80 baris, pecah menjadi subkomponen atau hook, seperti `src/app/brankas/baru/page.tsx` (`useBaru`, `Langkah`).
5. Menu navigasi diatur di `src/components/navbar/links.ts` dan diuji di `tests/unit/navbar-model.test.ts`.

## Menambah gaya

Baca [desain/CSS.md](desain/CSS.md). Singkatnya: tambahkan ke berkas komponennya, jangan menimpa selektor di lapisan lain, pakai token dari `00-token.css`. `tests/unit/css-hutang.test.ts` akan gagal bila ada deklarasi mati, kelas atau variabel tak terpakai, atau selektor yang makin tersebar.

## Sebelum membuka PR

- `npm run check` hijau.
- Perubahan tampilan: buka halaman terkait di lebar 390 dan 1280 px, dan jalankan pemeriksaan aksesibilitas (axe-core).
- Perubahan yang menyentuh kripto, sesi, atau peran: tambahkan tes untuk jalur yang ditolak, dan jelaskan di PR mengapa tidak melemahkan jaminan privasi.
- Jangan menambahkan baris atribusi alat otomatis ke pesan commit atau deskripsi PR.
