# Audit UI Gema: 19 halaman, desktop 1280 dan mobile 390

Metode: tangkapan layar semua halaman (termasuk halaman masuk: Brankas, 3 langkah laporan, detail, pengaturan, Satgas, dosir, radar, audit, kunci) ditambah inventaris gaya terhitung (`getComputedStyle`) pada tombol, input, kartu, lencana, heading, paragraf, dan jarak bagian. Angka di bawah adalah hasil ukur, bukan perkiraan.

Batasan: penilaian visual ini oleh pembuat, bukan uji pengguna. Skor "UI 9+" adalah target, bukan hasil yang sudah dibuktikan.

## Ukuran sebelum perbaikan

| Aspek            | Temuan terukur                                                                                                                                                   |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tinggi tombol    | 8 tinggi berbeda: 32, 36, 40, 42, 44, 50, 52/53, 64                                                                                                              |
| Radius tombol    | 999px, 14px, 50%, 0 (tombol tautan)                                                                                                                              |
| Radius komponen  | 14 macam nilai `border-radius` di CSS (6, 8, 10, 12, 14, 18, 20, 22, 24, 28, 999, 50%)                                                                           |
| Lencana          | 6 varian; tinggi 22 sampai 36; font 11,84px (di bawah ambang baca nyaman); radius 8 dan 999 bercampur                                                            |
| Heading          | H2 dengan 8 ukuran (20, 22,4, 24, 27,2, 46,4, 48 ...), H1 dengan 3 ukuran (69, 72, 102)                                                                          |
| Paragraf         | 9 kombinasi ukuran/line-height; 14,4 / 14,08 / 14,72 / 13,6 / 15,2 px berdekatan tanpa alasan; utilitas `.title-sm/.title-md` (`!important`) menimpa skala judul |
| Status interaksi | `:hover` 37, `:active` 4, `:focus-visible` 2 aturan, `:disabled` 0, `aria-busy` 0                                                                                |
| Target sentuh    | Beberapa tombol teks setinggi 16 sampai 28px                                                                                                                     |

## Temuan, urut prioritas

### P1: tampak rusak atau tidak rapi

1. **Banner "Mode demo" hanya selebar ±560px** di desktop, bukan selebar layar. Penyebab: aturan global `p { max-width: 65ch }` mengenai `<p class="nb-demo">` dan `.nb-offline`. Kotak peringatan `<p class="card warn">` di formulir juga lebih sempit daripada kolom input di bawahnya (ketidaksejajaran tepi kanan).
2. **Beranda mobile: judul hero menabrak lingkaran kuning**; huruf "Penanganan" terbaca di atas lingkaran.
3. **Formulir laporan langkah 1: kotak penjelasan hijau setinggi ±400px (desktop) dan ±780px (mobile)** mendorong kolom pertama jauh di bawah lipatan. Isinya penting (permintaan sebelumnya), tetapi bentuknya tembok teks dengan empat sub-judul bertingkat sama.

### P2: inkonsistensi sistem

4. Tinggi, radius, dan padding tombol tidak mengikuti satu skala (lihat tabel).
5. Lencana tidak punya satu definisi; font 11,84px terlalu kecil.
6. Skala heading tidak sistematis; H2 di dalam kartu (20 dan 22,4) bersaing dengan H2 bagian (27,2).
7. Radius komponen tidak berskala: input 14, kartu 20, kotak peringatan 12 sampai 28.
8. Status `:disabled` tidak ada untuk input, select, textarea; tidak ada status `aria-busy` pada tombol yang memuat; `:active` hanya di sebagian tombol.
9. Fokus: satu aturan global di `05-tata-usaha-kampus.css`, tetapi tiap komponen punya penanganan sendiri (kartu pilihan memakai `:has`), tanpa bentuk yang seragam.

### P3: ritme dan keterbacaan

10. Item daftar (`li`) dan `dd` tidak punya batas lebar: daftar bernomor di Demo mencapai ±85 karakter per baris (target ≤ 70). Paragraf sudah tertahan 65ch oleh aturan global; metrik awal saya (lebar ÷ setengah ukuran font) melebih-lebihkan angka paragraf, jadi hanya daftar yang dihitung sebagai temuan.
11. Tabel kasus Satgas di mobile: tiap kasus ±430px; label "Pola/Aksi" memakan separuh lebar. Bisa disusun ulang menjadi kartu dengan satu baris judul + metadata.
12. Navbar mobile padat (merek, Mulai, Keluar cepat, menu) pada 390px.
13. Jarak antar bagian: 8 pasang padding vertikal berbeda tanpa pola.

## Yang sengaja tidak diubah

Palet, tiga keluarga font, pita warna dan bentuk geometris, warna zona Pelapor/Satgas/Publik, semua fitur dan komponen.

## Hasil perbaikan (ukur ulang dengan metode yang sama)

| Aspek                                                | Sebelum                                  | Sesudah                                                                                                       |
| ---------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Tinggi kontrol (tombol, tombol navbar, tombol sandi) | 32 sampai 64 (8 nilai)                   | 44 dan 52 (dua skala: biasa dan utama)                                                                        |
| Lencana                                              | 6 varian, font 11,84px                   | satu definisi `.pill` 24px, 12,8px, radius pil                                                                |
| Ukuran H2                                            | 8                                        | 4 (token `--h-feature`, `--h-block`, `--h-card`, `--h-sub`)                                                   |
| Radius                                               | 14 nilai acak                            | token `--r-sm/md/lg/pill` (komponen baru mengikuti; lapisan lama dibiarkan agar pita dan motif tidak berubah) |
| Status                                               | `:disabled` input 0, `aria-busy` 0       | disabled input, hover input, `aria-invalid`, `aria-busy` + penanda putar di aksi utama, `:active` seragam     |
| Fokus                                                | cincin biru, tidak terbaca di pita gelap | cincin biru + halo putih, terbukti terbaca di pita malam, mawar, dan kuning                                   |
| axe (WCAG 2.0/2.1/2.2 A dan AA)                      | tidak diuji dengan tag 2.1 A             | 21 halaman x 3 lebar (1280, 390, 320): nol pelanggaran; tanpa luapan horizontal                               |
| Panjang baris isi                                    | daftar sampai ±85 karakter               | median 54 sampai 78 karakter per baris di halaman yang diukur                                                 |

### Temuan yang muncul saat QA dan sudah diperbaiki

- Nama aksesibel tombol "Mulai" di navbar mobile tidak memuat teks yang tampak (WCAG 2.5.3, label dalam nama). Sekarang nama berasal dari teks yang tampak.
- Huruf "g" pada merek dihitung sebagai teks tampak; kini digambar CSS.
- Teks sekunder jejak status kartu laporan kurang kontras di atas warna kartu; kini `--ink-2`.
- Sasaran sentuh: tautan footer 24 menjadi 44px; kotak centang/radio 21 menjadi 24px.

### Yang tidak bisa saya buktikan

- Skor "UI 9+" tidak terukur. Yang terukur: konsistensi, kontras, sasaran sentuh, luapan, dan perilaku status. Penilaian estetika perlu mata orang lain.
- Pengujian tetap memakai Chromium (emulasi mobile), bukan perangkat nyata dan bukan pembaca layar sungguhan.
- Tombol istilah (`term-btn`) di dalam kalimat tetap lebih kecil dari 24px; dikecualikan oleh WCAG 2.5.8 untuk target sebaris, dan area klik diperluas dengan elemen semu.
