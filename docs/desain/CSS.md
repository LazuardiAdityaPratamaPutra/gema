# Peta CSS

CSS Gema ada di `src/styles/`, dimuat berurutan oleh `src/app/layout.tsx`. **Urutan impor adalah urutan cascade**: pada kekhususan sama, berkas yang lebih akhir menang.

## Lapisan

| Berkas                  | Isi                                                                                                  |
| ----------------------- | ---------------------------------------------------------------------------------------------------- |
| `00-token`              | Token warna, tipografi, jarak, gerak; font cadangan                                                  |
| `01-dasar`              | Reset, tipografi dasar, tombol, formulir, permukaan                                                  |
| `02`–`06`               | Komponen per area: beranda, pendamping, brankas dan panduan, visual tata usaha, navigasi dan langkah |
| `07-palet-dan-pita`     | Palet per zona dan pita warna                                                                        |
| `08-presisi`            | Satu definisi per komponen memakai token                                                             |
| `09-warna-60-30-10`     | Satu palet untuk semua zona                                                                          |
| `10-pinus`              | Palet Pinus dan tata letak baru                                                                      |
| `11-tonal`, `12-modern` | Tipografi satu skala dan penyempurnaan modern (termasuk navbar desktop, `forced-colors`)             |
| `13-utilitas`           | Utilitas jarak dan judul; memakai `!important` dengan sengaja                                        |
| `14-interaksi`          | Kerangka muat, status tombol, hover, tanda berhasil                                                  |

`07`–`12` adalah hasil beberapa putaran desain ulang yang ditumpuk di atas `02`–`06`. Karena itu satu komponen kadang punya aturan di lebih dari satu berkas.

## Aturan menambah gaya

1. Gaya komponen baru masuk ke berkas komponennya (`02`–`06`, atau `14` untuk interaksi), bukan ke lapisan `07`–`12`.
2. Jangan menulis ulang selektor yang sudah ada di berkas lain. Ubah aturan aslinya.
3. Warna, ukuran huruf, dan jarak memakai token dari `00-token.css`.
4. `!important` hanya di `13-utilitas`, di blok `prefers-reduced-motion`, dan di blok `forced-colors`.
5. Animasi hanya memakai `transform` dan `opacity`. Mengubah `width`, `height`, atau `left` memicu layout; jalur pemilih peran di beranda diisi dengan `scaleX`/`scaleY` untuk itu. Satu pengecualian yang disengaja: takik panel peran bergeser lewat `left`, karena posisinya persen dari wadah dan tidak bisa dinyatakan dengan `transform`.
6. Warna hijau dan madu memakai `--aksen` dan `--madu`. Untuk warna berlapis alfa dari token, pakai `color-mix(in srgb, var(--token) N%, transparent)`.
7. Radius besar (`--r-panel`) hanya untuk objek yang berdiri sendiri, seperti kartu foto di header halaman Satgas. Pita foto selebar layar tetap datar. Satu pengecualian yang disengaja sebagai lengkung penutup: sudut bawah hero dan sudut atas footer. Jangan menjadikan semua pita kartu melayang.
8. Tekstur kertas pada amplop cek berkas adalah SVG kecil di variabel `--kertas` (data URI, diizinkan oleh `img-src data:` di `src/proxy.ts`). Jangan memindahkannya ke berkas terpisah tanpa alasan: itu menambah satu permintaan jaringan.

## Penjaga otomatis

`tests/unit/css-hutang.test.ts` (bagian dari `npm run check`) gagal bila ada:

- deklarasi yang selalu tertimpa aturan berselektor sama yang lebih akhir,
- kelas CSS yang tidak dipakai di kode,
- `@keyframes` atau properti kustom yang tak dirujuk,
- selektor yang tersebar di lebih banyak berkas daripada batas `BATAS_SELEKTOR_TERSEBAR`. Turunkan angka ini setiap kali menggabungkan aturan; jangan naikkan.

## Utang yang tersisa

Sekitar 117 selektor masih tersebar di lebih dari satu berkas. Menggabungkannya tidak aman secara otomatis, karena aturan lain di antaranya menyentuh properti yang sama dan urutan cascade bisa berubah. Pembersihan berikutnya sebaiknya dikerjakan per komponen, dengan membandingkan gaya terhitung sebelum dan sesudah di tiga lebar layar.

Cara yang terbukti aman dan dipakai pada amplop serta sertifikat: di browser, rekam `getComputedStyle` semua elemen dan pseudo-elemen komponen (termasuk sebelum sidik selesai diketik, saat hover, dan saat berkas diseret) pada beberapa lebar dan dua mode gerak, hapus deklarasi yang dicurigai mati, lalu rekam ulang. Hasilnya harus identik. Hati-hati dengan pengukur otomatis yang mencabut deklarasi satu per satu: transisi CSS menutupi perubahan sesaat, dan keadaan yang tidak direkam (hasil cek berkas, sidik sedang diketik) membuatnya salah menandai deklarasi hidup sebagai mati. Dalam satu kasus pengukur menandai `color` amplop sebagai mati padahal menghapusnya mengubah warna turunannya menjadi kuning.
