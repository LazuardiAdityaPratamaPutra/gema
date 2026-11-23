# Penyempurnaan visual v16.2 (bukan redesain)

Metode: tangkapan layar semua halaman prioritas di 1280 dan 390 px sebelum dan sesudah (`docs/gambar-visual/`), dibaca bersama `AUDIT-UI.md` dan token di `src/styles/00-token.css`. Penilaian visual ini oleh pembuat, bukan uji pengguna.

## Dipertahankan (identitas yang sudah kuat)

Palet navy/kuning/kraft/mint, pita miring, Archivo + Atkinson Hyperlegible Next + IBM Plex Mono, warna zona, amplop kraft, kalender tenggat, tabel Satgas dengan kartu "paling mendesak".

## Lima masalah dan perbaikannya

| #   | Masalah                                                                                                                                                                                | Perbaikan                                                                                                                                                                                                                                                                                  | Berkas                                              |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------- |
| 1   | Judul beranda "Bukti aman." menjanjikan keamanan; layar pertama tanpa batas dan kendali pengguna; tiga tombol bersaing                                                                 | Judul "Bukti tersimpan. Penanganan terlihat."; kalimat kendali ("Kamu yang memutuskan kapan, dan apakah…") dan batas ("Gema tidak bisa menjamin anonimitas…") dengan tautan ke Batas jujur; tombol hero menjadi "Pahami dulu" dan "Coba demo 5 menit"; judul halaman (`<title>`) disamakan | `app/page.tsx`, `app/layout.tsx`, `07b-presisi.css` |
| 2   | Kartu kecocokan (brankas) dan hasil /pahami berwarna hijau "berhasil" dan menampilkan "keyakinan tinggi" tanpa batasan                                                                 | Kartu netral (putih); kalimat batasan: keyakinan menunjukkan banyaknya penanda yang sama, petunjuk bukan kepastian atau tuduhan, tidak menunjukkan benar atau beratnya kejadian                                                                                                            | `brankas/[id]/page.tsx`, `pahami/page.tsx`          |
| 3   | Konfirmasi eskalasi: satu paragraf padat                                                                                                                                               | Tiga pernyataan pendek berlabel (siapa membaca, yang perlu diperiksa, penarikan); isi dan kalimat penarikan tidak berubah                                                                                                                                                                  | `brankas/[id]/page.tsx`, `07b-presisi.css`          |
| 4   | Langkah 1 laporan: kotak hijau 399 px (desktop) dan 666 px (mobile) sebelum kolom pertama, dan kalimat "Identitasmu tidak ada di sana karena tidak pernah diminta" yang melebihi bukti | Dua poin utama tetap terlihat, dua penjelasan teknis dilipat dalam `details.more` yang sudah ada; kartu netral; kalimat identitas diganti pernyataan jujur; penanda chevron untuk semua `details.more` (sebelumnya tanpa penanda)                                                          | `brankas/baru/page.tsx`, `07b-presisi.css`          |
| 5   | Kasus Satgas: alat jarang pakai (bukti kepemilikan) di urutan kedua                                                                                                                    | Dipindah ke setelah "Perkembangan" (satu baris JSX, tanpa perubahan logika)                                                                                                                                                                                                                | `satgas/kasus/[id]/page.tsx`                        |

Catatan koreksi: satu dugaan masalah gugur saat diperiksa. Kotak unggah yang tampak kuning pada tangkapan layar ternyata status `:hover` dari kursor otomatis; tampilan bawaannya putih. Tidak diubah.

## Uji

`tests/klaim.test.ts` bertambah menjadi 19 uji: juga menjaga "identitasmu tidak ada di sana" dan "bukti aman" agar tidak kembali.

## Kelemahan desain yang masih ada

- Aksi status kasus Satgas ("Lanjut ke: Verifikasi") tetap di bagian bawah halaman kasus (±2500 px di desktop); header menampilkan status dan tenggat, tetapi aksinya jauh dari bacaan dosir.
- Langkah 1 laporan tetap panjang di mobile (kolom pertama di ±860 px).
- Detail brankas menampilkan banner "Tersimpan dan terkunci" sekaligus toast bertulisan sama.
- Bagian "Butuh bicara dengan seseorang sekarang?" di /pahami menyisakan ruang kosong besar saat tertutup.
- Judul halaman besar di zona Satgas dan Pelapor (±70 px) belum dikalibrasi ulang.
- Belum ada uji pengguna, pembaca layar, atau perangkat nyata.

## Putaran v16.3: kelemahan yang tersisa

| # | Kelemahan | Perubahan | Hasil ukur |
|---|-----------|-----------|------------|
| 1 | Aksi status kasus Satgas terlalu jauh | Blok "Penanggung jawab" dan "Perkembangan" dipindah tepat setelah kartu Laporan; isi berkas tidak berubah (dibuktikan dengan diff terurut) | Posisi "Perkembangan" di 1280px: 2474 → 1112px |
| 2 | Langkah 1 laporan panjang di ponsel | Penjelasan "Sebelum mengisi" menjadi `<details>`: terbuka di layar ≥48em, terlipat di layar sempit | Kolom pertama (`#inst`) di 390px kini di 429px dari atas layar 844px |
| 3 | Banner dan toast "Tersimpan dan terkunci" ganda | Toast dihapus; banner di halaman detail (role=status) tetap | Tidak ada pengumuman ganda |
| 4 | Ruang kosong "Butuh bicara…" di /pahami | Sudah berupa pintu lipat dengan panah; jarak bawah berasal dari padding bagian halaman, tidak diubah | Tinggi lipatan 59px di 1280px |
| 5 | H1 halaman dalam ±72px | `clamp(2.1rem, 5vw, 3.5rem)` hanya untuk `.ph h1` | 72px → 56px di 1280px; 33,6px di ≤390px; beranda tidak berubah |

Verifikasi: `npm run check` lulus (198 lulus, 1 dilewati), build berhasil; axe WCAG 2.2 AA nol pelanggaran di /pahami, /panduan, /demo, /mulai, langkah 1, dan halaman kasus pada 1280/390/320px; tanpa overflow horizontal; zoom 200% dan 400% tanpa overflow; skrip alur eskalasi, galat, dan klik ganda lulus.

Belum bisa dilakukan: uji dengan pengguna sungguhan, pembaca layar nyata, dan perangkat Android fisik.
