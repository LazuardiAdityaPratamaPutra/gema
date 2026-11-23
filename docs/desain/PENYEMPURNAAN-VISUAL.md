# Penyempurnaan visual v16.2 (bukan redesain)

Metode: tangkapan layar semua halaman prioritas di 1280 dan 390 px sebelum dan sesudah (`docs/desain/gambar/`), dibaca bersama `AUDIT-UI.md` dan token di `src/styles/00-token.css`. Penilaian visual ini oleh pembuat, bukan uji pengguna.

## Dipertahankan (identitas yang sudah kuat)

Palet navy/kuning/kraft/mint, pita miring, Archivo + Atkinson Hyperlegible Next + IBM Plex Mono, warna zona, amplop kraft, kalender tenggat, tabel Satgas dengan kartu "paling mendesak".

## Lima masalah dan perbaikannya

| #   | Masalah                                                                                                                                                                                | Perbaikan                                                                                                                                                                                                                                                                                  | Berkas                                             |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------- |
| 1   | Judul beranda "Bukti aman." menjanjikan keamanan; layar pertama tanpa batas dan kendali pengguna; tiga tombol bersaing                                                                 | Judul "Bukti tersimpan. Penanganan terlihat."; kalimat kendali ("Kamu yang memutuskan kapan, dan apakah…") dan batas ("Gema tidak bisa menjamin anonimitas…") dengan tautan ke Batas jujur; tombol hero menjadi "Pahami dulu" dan "Coba demo 5 menit"; judul halaman (`<title>`) disamakan | `app/page.tsx`, `app/layout.tsx`, `08-presisi.css` |
| 2   | Kartu kecocokan (brankas) dan hasil /pahami berwarna hijau "berhasil" dan menampilkan "keyakinan tinggi" tanpa batasan                                                                 | Kartu netral (putih); kalimat batasan: keyakinan menunjukkan banyaknya penanda yang sama, petunjuk bukan kepastian atau tuduhan, tidak menunjukkan benar atau beratnya kejadian                                                                                                            | `brankas/[id]/page.tsx`, `pahami/page.tsx`         |
| 3   | Konfirmasi eskalasi: satu paragraf padat                                                                                                                                               | Tiga pernyataan pendek berlabel (siapa membaca, yang perlu diperiksa, penarikan); isi dan kalimat penarikan tidak berubah                                                                                                                                                                  | `brankas/[id]/page.tsx`, `08-presisi.css`          |
| 4   | Langkah 1 laporan: kotak hijau 399 px (desktop) dan 666 px (mobile) sebelum kolom pertama, dan kalimat "Identitasmu tidak ada di sana karena tidak pernah diminta" yang melebihi bukti | Dua poin utama tetap terlihat, dua penjelasan teknis dilipat dalam `details.more` yang sudah ada; kartu netral; kalimat identitas diganti pernyataan jujur; penanda chevron untuk semua `details.more` (sebelumnya tanpa penanda)                                                          | `brankas/baru/page.tsx`, `08-presisi.css`          |
| 5   | Kasus Satgas: alat jarang pakai (bukti kepemilikan) di urutan kedua                                                                                                                    | Dipindah ke setelah "Perkembangan" (satu baris JSX, tanpa perubahan logika)                                                                                                                                                                                                                | `satgas/kasus/[id]/page.tsx`                       |

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

| #   | Kelemahan                                       | Perubahan                                                                                                                                  | Hasil ukur                                                           |
| --- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| 1   | Aksi status kasus Satgas terlalu jauh           | Blok "Penanggung jawab" dan "Perkembangan" dipindah tepat setelah kartu Laporan; isi berkas tidak berubah (dibuktikan dengan diff terurut) | Posisi "Perkembangan" di 1280px: 2474 → 1112px                       |
| 2   | Langkah 1 laporan panjang di ponsel             | Penjelasan "Sebelum mengisi" menjadi `<details>`: terbuka di layar ≥48em, terlipat di layar sempit                                         | Kolom pertama (`#inst`) di 390px kini di 429px dari atas layar 844px |
| 3   | Banner dan toast "Tersimpan dan terkunci" ganda | Toast dihapus; banner di halaman detail (role=status) tetap                                                                                | Tidak ada pengumuman ganda                                           |
| 4   | Ruang kosong "Butuh bicara…" di /pahami         | Sudah berupa pintu lipat dengan panah; jarak bawah berasal dari padding bagian halaman, tidak diubah                                       | Tinggi lipatan 59px di 1280px                                        |
| 5   | H1 halaman dalam ±72px                          | `clamp(2.1rem, 5vw, 3.5rem)` hanya untuk `.ph h1`                                                                                          | 72px → 56px di 1280px; 33,6px di ≤390px; beranda tidak berubah       |

Verifikasi: `npm run check` lulus (198 lulus, 1 dilewati), build berhasil; axe WCAG 2.2 AA nol pelanggaran di /pahami, /panduan, /demo, /mulai, langkah 1, dan halaman kasus pada 1280/390/320px; tanpa overflow horizontal; zoom 200% dan 400% tanpa overflow; skrip alur eskalasi, galat, dan klik ganda lulus.

Belum bisa dilakukan: uji dengan pengguna sungguhan, pembaca layar nyata, dan perangkat Android fisik.

## Putaran alur: satu jalur utama

Masalah: pengguna baru melihat banyak pintu masuk sekaligus (enam tautan navbar, tombol Demo setara dengan tombol utama) dan tidak tahu langkah berikutnya setelah menyimpan kode.

| Perubahan                                                                                                                  | Berkas                           |
| -------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| Navbar tamu dari 6 ke 3 tautan (Pahami dulu, Papan, Bantuan). Periksa bukti, Demo, dan Masuk Satgas pindah ke footer.      | `Navbar.tsx`, `Footer.tsx`       |
| Beranda: satu tombol utama ("Pahami dulu"). Demo menjadi tautan pendukung dengan keterangan "data fiktif".                 | `app/page.tsx`, `08-presisi.css` |
| `/mulai`: keterangan "Berikutnya: tiga langkah singkat" tepat di atas tombol, dan draf boleh ditinggalkan kapan saja.      | `app/mulai/page.tsx`             |
| `/demo`: daftar skenario diberi judul dan label aksesibel.                                                                 | `app/demo/page.tsx`              |
| Tes `pemulihan.e2e` dibuat deterministik (sebelumnya gagal acak bila akhiran bagian pemulihan kebetulan sama dengan "AA"). | `tests/pemulihan.e2e.test.ts`    |

Tidak diubah: logika, API, enkripsi, dan perilaku eskalasi. "Pahami dulu" sudah punya tombol utama "Simpan dulu, tanpa nama" setelah hasil muncul, dan `/brankas/baru` sudah punya penunjuk 3 langkah.

Belum teruji: apakah pengguna sungguhan memang lebih mudah menemukan jalurnya. Perubahan ini hipotesis desain, bukan hasil uji pengguna.

## Putaran warna: aturan 60-30-10, tanpa kesan sketsa

Masalah: situs memakai sekitar delapan keluarga warna yang bersaing (navy, kuning, merah muda, cokelat kraft, mint, oranye, biru, merah), dan tiap zona halaman punya pita warna raksasa sendiri. Tombol sekunder berupa outline, ada 7 garis putus-putus, sekitar 17 garis 1,5px dan 9 garis 2px di CSS, panel yang dimiringkan, dan lembar ringkasan Satgas yang berupa kertas buku tulis bergaris.

Palet baru (satu berkas, `src/styles/09-warna-60-30-10.css`, diimpor terakhir; hapus impornya di `layout.tsx` untuk kembali ke tampilan lama):

| Porsi | Warna                                               | Dipakai untuk                                                                   |
| ----- | --------------------------------------------------- | ------------------------------------------------------------------------------- |
| 60%   | netral terang `#eef1f8`, permukaan putih, `#e3e8f6` | latar halaman, kartu, panel, baris tabel                                        |
| 30%   | navy `#1b1552` (identitas lama)                     | hero, kepala halaman, pita jam di beranda, kaki halaman, teks                   |
| 10%   | kuning `#ffc21a`                                    | hanya aksi utama (satu tombol utama per layar)                                  |
| -     | hijau, kuning tua, merah status; tautan biru        | fungsional (status, peringatan, tautan), tidak dihitung sebagai warna dekoratif |

Perubahan utama:

- Kepala halaman dalam: dari pita warna zona selebar layar menjadi panel navy di dalam halaman (satu warna untuk semua zona).
- Tombol: aksi utama kuning dengan teks navy; sekunder berupa permukaan lembut tanpa garis; Keluar cepat dan aksi berbahaya berupa permukaan merah muda lembut.
- Kartu, daftar rujukan, chip, lipatan, area unggah, pilihan radio, dan tab memakai isian warna, bukan garis. Tabel memakai baris bergantian dan kepala berwarna.
- Panel peran, amplop bukti, pita jam, dan kartu ajakan di beranda disatukan ke palet yang sama; poin panel memakai titik terisi, bukan garis vertikal.
- Lembar ringkasan Satgas tidak lagi berupa kertas bergaris dengan garis margin merah. Elemen yang dimiringkan diluruskan (kartu bukti, catatan brankas, penanda langkah). Stempel "UTUH" sengaja dipertahankan sebagai satu-satunya elemen khas.

Sengaja tidak diubah demi aksesibilitas: batas kolom isian (input, textarea, select) dan cincin fokus keyboard tetap ada, dan pilihan radio yang terpilih memakai cincin navy 2px agar tidak hanya bergantung pada warna. Warna status dan sorotan (`mark`, bilah veil, pil prioritas) tetap fungsional.

Hasil ukur: axe WCAG 2.2 AA nol pelanggaran pada 15 halaman x 3 lebar (1280, 390, 320px) = 45 kombinasi, tanpa overflow horizontal. Pemindaian otomatis DOM setelah perubahan hanya menemukan garis pada indikator kecil (lampu status, penanda langkah, garis waktu, stempel). `npm run check` lulus (198 tes lulus, 1 dilewati); skrip alur eskalasi, galat, dan klik ganda lulus.

Belum teruji: apakah pengguna sungguhan menilai tampilan baru lebih nyaman, dan tampilan pada layar fisik (kontras warna sesuai kalibrasi layar berbeda).

### Lanjutan: layout kepala halaman dan tautan

- Kepala halaman dalam di layar lebar (>= 62em) kini asimetris: judul besar di kiri, pengantar dan tombol sejajar di kanan bawah. Di layar sempit tetap satu kolom. Hanya berlaku untuk kepala halaman yang punya judul dan pengantar.
- Tautan teks memakai navy bergaris bawah (putih di permukaan gelap), sehingga biru tidak lagi menjadi warna ke-4. Garis bawah memastikan tautan tidak hanya dibedakan lewat warna.
- Hasil ulang: axe nol pelanggaran (45 kombinasi), tanpa overflow pada 390 dan 320px serta zoom 200% dan 400%, `npm run check` lulus (198 tes lulus, 1 dilewati), skrip alur eskalasi, galat, dan klik ganda lulus.
- Sengaja dipertahankan: stempel "UTUH" di beranda sebagai satu-satunya elemen khas.

### Lanjutan 2: tanpa kemiringan, tombol demo kembali berupa tombol

- Semua elemen yang dimiringkan diluruskan: kartu bukti, catatan brankas, penanda langkah, kartu ajakan, lembar tumpuk, dan stempel "UTUH" (stempelnya tetap ada, hanya tegak). Potongan diagonal di bawah hero dan pita jam dihapus; tepi kini lurus. Lingkaran dekoratif hero dipotong di batas hero (`overflow: clip`) supaya tidak menimpa bagian berikutnya.
- "Coba demo 5 menit" di beranda kembali berupa tombol sekunder di samping tombol utama. Versi tautan teks kecil sebelumnya terlalu mudah terlewat padahal demo adalah jalan masuk utama bagi juri dan penonton. Tetap hanya satu tombol utama (kuning) per layar.
- Pemindaian otomatis (transform dan clip-path pada 11 halaman) tidak menemukan elemen miring atau diagonal yang tersisa selain segitiga penutup amplop pada ilustrasi.
- Hasil ulang: axe nol pelanggaran (45 kombinasi), `npm run check` lulus (198 tes lulus, 1 dilewati), skrip alur eskalasi, galat, dan klik ganda lulus.

## Putaran palet: Obsidian 60, Porcelain 30, Ion Blue 10

Palet diganti sesuai permintaan: Obsidian `#08090D` (60%: latar halaman, hero, kepala halaman, navigasi, kaki), Porcelain `#EEF0F6` (30%: kartu dan panel isi, kolom isian), Ion Blue `#2454FF` (10%: aksi utama dan penanda merek).

- Berkas baru `src/styles/07d-obsidian-porcelain-ion.css`, dimuat setelah 07c. Menghapus impornya di `layout.tsx` mengembalikan palet biru tua dan kuning sebelumnya.
- Token halaman dibalik ke mode gelap. Permukaan terang (kartu, panel, tanda terima, kalender, lipatan, label) memakai cakupan token sendiri sehingga teks di dalamnya tetap gelap.
- Ion Blue hanya untuk tombol utama dan merek. Warnanya 3,6:1 terhadap Obsidian, jadi tidak dipakai untuk teks kecil di latar gelap. Teks putih di atas Ion Blue 5,55:1.
- Aturan zona lama yang memberi latar kuning pada tombol di kepala halaman ditimpa (selisih spesifisitas ditemukan lewat axe).

Hasil uji: axe-core 0 pelanggaran pada 15 halaman × 3 lebar (1280, 390, 320); pemindaian miring/diagonal tidak menemukan apa pun; skrip eskalasi, kegagalan, dan klik ganda lolos. Belum diuji: pengguna nyata, pembaca layar sungguhan, perangkat Android.

Gambar tema ini sudah dihapus dari repositori (tema ditolak).

## Putaran redesain: palet Pinus (tema cerah) dan tata letak baru

Palet dipilih pengguna dari empat opsi: putih kehijauan `#F3F7F4` (latar), tinta hijau tua `#10241D` (teks), hijau pinus `#0E5A45` (aksi dan merek), hijau muda `#DDEBE3` (pita dan permukaan), madu `#F2A33A` dan `#FBE6C2` (tenggat dan penutup). Teks tombol 8,2:1, teks di latar 15:1.

Berkas `src/styles/10-pinus.css` menggantikan 07d (tema gelap). Menghapus impornya di `layout.tsx` kembali ke 07c.

Perubahan tata letak:

- Kepala halaman dalam tidak lagi berupa panel; judul besar langsung di atas latar, pengantar di kanan.
- Hero beranda: judul sampai 6,8rem, kartu bukti ditempatkan turun di kanan, satu lingkaran hijau muda sebagai satu-satunya ornamen.
- Pemilih peran: blok hijau muda berbulatan besar. Amplop bukti dan kalender memakai warna palet yang sama.
- Jam tenggat: pita hijau muda selebar layar, judul besar, salinan dan kalender berdampingan, tiga lampu satu baris.
- Penutup: blok madu, satu-satunya warna hangat di halaman.
- Footer terang, bukan gelap.

Uji: axe-core 0 pelanggaran pada 15 halaman × 3 lebar; skrip eskalasi, kegagalan, dan klik ganda lolos; pemindaian miring/diagonal bersih. Belum diuji: pengguna nyata, pembaca layar, Android.

## Putaran tema: editorial modern

Tema diganti ke editorial modern (bukan neo-brutalism: tanpa garis tebal, bayangan keras, atau warna mencolok). Palet Pinus dipertahankan.

- Berkas `src/styles/07f-editorial.css` dimuat setelah 07e. Menghapus impornya kembali ke tampilan 07e. Font serif Newsreader (paket `@fontsource-variable/newsreader`) untuk judul, Atkinson untuk isi dan antarmuka, Plex Mono untuk kode dan data.
- Judul serif berbobot ringan dan berukuran besar; pengantar halaman dalam bergaya standfirst (serif). Sudut kecil (4 sampai 8px), tombol persegi, tanpa bayangan, lingkaran dekoratif beranda dihapus.
- Beranda tersusun seperti sampul: judul selebar halaman, di bawahnya dua kolom berimbang antara standfirst dan kartu bukti. Bagian berikutnya tetap berbeda bentuk (blok hijau muda, dua kolom amplop, pita tenggat, blok madu).
- Elemen data (kode, tanggal, angka) tetap sans dan mono supaya terbaca jelas; kode brankas sempat ikut menjadi serif dan sudah dikembalikan.

Uji: axe-core 0 pelanggaran pada 15 halaman × 3 lebar; skrip eskalasi, kegagalan, dan klik ganda lolos; pemindaian miring bersih. Belum diuji: pengguna nyata, pembaca layar, Android.

## Putaran majalah: editorial modern dengan foto

Masukan: tampilan sebelumnya masih terasa neo-brutalism (blok warna tebal, tombol dan pil berlatar abu, kartu bertumpuk). Bahasa visual diganti total ke majalah, dengan foto yang dikirim pengguna (siluet sekelompok orang di bukit saat senja; Joey Zhou, Unsplash, `public/gambar/senja-bukit.jpg`, dimuat lewat `next/image`).

- Berkas `src/styles/07g-majalah.css`, dimuat setelah 07f. Menghapus impornya kembali ke 07f.
- Beranda: sampul foto penuh dengan judul serif di langit dan dua tombol di tanah gelap foto; pengantar menjadi standfirst di bawah sampul agar tidak menimpa siluet. Pemilih peran menjadi daftar isi serif bergaris bawah (bukan blok), sertifikat bukti menjadi figur bercatatan, amplop dua kolom, jam tenggat pita penuh, penutup berupa kalimat besar bergaris atas. Tiap bagian memakai komposisi berbeda.
- Seluruh situs: tombol persegi (2px), tombol sekunder berupa tautan bergaris bawah, kartu menjadi kolom dengan garis atas tipis, tabel bergaris tipis tanpa zebra, kepala halaman bergaris bawah, footer bergaris atas.
- Garis tipis 1px dipakai sengaja sebagai aturan majalah, bukan garis tebal bergaya sketsa. Jika masih terasa berlebihan, mudah dikurangi di 07g.
- Kontras teks di atas foto: judul gelap di atas langit diukur 7,7:1 pada titik terburuk. Teks di bawah berada di atas tanah foto yang hampir hitam ditambah gradien gelap.

Uji: axe-core 0 pelanggaran pada 15 halaman × 3 lebar (axe tidak menghitung kontras di atas gambar, sehingga teks sampul diukur manual dari tangkapan layar); skrip eskalasi, kegagalan, klik ganda lolos; pemindaian miring bersih. Belum diuji: pengguna nyata, pembaca layar, Android.

## Putaran tonal lembut dan gerak (GSAP, Motion, Lenis)

Masukan: tema editorial dan neo-brutalism tidak diinginkan; pakai layout tonal lembut dengan palet Pinus, tambah GSAP, Motion, dan Lenis.

- Lapisan editorial (`07f-editorial.css`, `07g-majalah.css`) dan font serif Newsreader dicabut. Lapisan baru `src/styles/11-tonal.css` dimuat setelah 07e. Lapisan lama 07c dan 07e tetap ada sebagai dasar, jadi ini belum "dasar bersih" sepenuhnya.
- Tema tonal: permukaan bertingkat dari keluarga hijau Pinus, sudut besar yang bervariasi, navigasi mengambang berbentuk pil, tanpa garis aturan.
- Beranda, tiap bagian berbeda bentuk: kartu sampul dengan foto berbentuk lengkung dan lingkaran madu "3 hari kerja"; pemilih peran berupa pil dengan panel bersudut tak sama; sertifikat bukti dengan lingkaran madu di belakang; panggung hijau pinus untuk amplop; panggung tonal untuk jam tenggat; penutup berupa pil memanjang. Warna kepala halaman dalam mengikuti zona.
- GSAP + ScrollTrigger (`components/motion/Words.tsx`): judul muncul per kata saat digulir (judul utama saat dimuat). Teks tetap utuh di DOM.
- Motion (`components/motion/MotionLayer.tsx`): kartu di bawah lipatan layar masuk dengan fade dan naik, kartu naik 4px saat di-hover. Kartu yang dirender belakangan ikut didaftarkan.
- Lenis (`components/motion/SmoothScroll.tsx`): gulir halus, disinkronkan dengan ScrollTrigger.
- Ketiganya mati bila pengguna memilih gerak dikurangi (prefers-reduced-motion).

Hasil ukur: axe-core 0 pelanggaran pada 15 halaman × 3 lebar; tanpa overflow horizontal pada 320, 390, 1280px; GSAP (kata bergeser 80,8px lalu 0 setelah discroll), Motion (opasitas 0 menjadi 1, hover mengangkat 4px), dan Lenis (kelas `lenis` aktif) terbukti berjalan; dengan gerak dikurangi ketiganya tidak aktif; skrip eskalasi, kegagalan, klik ganda lolos. Belum diuji: pengguna nyata, pembaca layar, Android, performa gulir di ponsel murah.

### Perbaikan tonal: foto utuh, radius seperlunya, tipografi satu skala

Masukan: foto terpotong menjadi latar lengkung; radius dipakai di terlalu banyak bagian; tulisan kurang rapi.

- Foto kini tampil utuh pada rasio aslinya (3:2) di kolom kanan hero, dengan keterangan kredit. Lengkungan dan stiker "3 hari kerja" yang menutupinya dihapus.
- Radius hanya untuk elemen yang perlu: tombol (10px), kartu, foto, panel peran, dan kolom isian (8 sampai 14px). Hero, pita amplop, pita jam, penutup, kepala halaman dalam, dan footer kini pita datar tanpa sudut membulat. Navigasi menjadi bilah putih rata.
- Tipografi satu skala: h1 2,2 sampai 3,5rem (hero sampai 4,2rem), h2 1,7 sampai 2,4rem, isi 17px dengan tinggi baris 1,6, pengantar 1,15rem, lebar baris dibatasi. Judul dan kepala halaman tidak lagi berukuran raksasa.
- Kepala halaman dalam tidak lagi berpanel; hanya judul dan pengantar. Ornamen dekoratif (lingkaran madu) dihapus.

Uji: axe-core 0 pelanggaran (15 halaman x 3 lebar), tanpa overflow pada 320 dan 390px, skrip eskalasi, kegagalan, klik ganda lolos. Belum diuji: pengguna nyata, pembaca layar, Android.

- Sertifikat bukti sempat hilang di ponsel karena aturan lama menyembunyikan `.rc-folder` di layar sempit; sudah ditampilkan kembali (terukur 350x276 di 390px, 280x354 di 320px).

## Putaran modern: kedalaman dan navbar pil

- Banner "Mode demo: semua data di sini fiktif" dan kredit foto dihapus dari tampilan. Prop `demo` pada `Navbar` ikut dibuang.
- Navbar menjadi pil melayang berkaca (blur), tautan dalam kapsul segmen dengan penanda halaman putih, tombol utama gradasi pinus. Di ponsel, menu terbuka sebagai kartu melayang.
- Lapisan baru `src/styles/12-modern.css` menambah gradasi halus, bayangan berlapis, kilau di belakang foto dan sertifikat, pita pinus dan madu bergradasi, serta kaki halaman gelap. Menghapus impornya di `layout.tsx` mengembalikan tema tonal sebelumnya.
- Terukur: axe 0 pelanggaran (15 halaman × 3 lebar), tanpa overflow di 320/390/768/1280, `npm run check` 198 lulus, 1 dilewati.

## Hero berlatar foto penuh dan Keluar cepat

- Foto senja kini menjadi latar penuh hero (`next/image` dengan `fill`, `alt=""` karena dekoratif), bukan gambar berbingkai. Lapisan gelap searah menjaga keterbacaan teks putih. Kontras terukur dari piksel latar tepat di belakang teks: 6,06 (1280), 5,81 (1920), 6,99 (768), 7,08 (390), 4,54 (320).
- Keluar cepat kini membuka `https://www.google.com/` dengan judul tab "Google" (sebelumnya artikel Wikipedia "Cuaca"). Peramban memblokir halaman web yang membuka `chrome://newtab`.
- Label "Mode demo" dihapus dari navbar, kartu nama Satgas, dan kepala /demo. Keterangan "Data fiktif" tetap ada.

## Skala tombol

- Semua tombol memakai dua ukuran dan satu bentuk: besar 52 px (aksi utama di hero, penutup, dan formulir) dan kecil 44 px (`.btn.sm`, navbar, tombol sandi). Bentuknya pil penuh. Huruf 16 px dan 15 px, bobot 650.
- Sebelum ini terukur 42, 44, dan 52 px dengan radius 10 px dan 999 px bercampur, bahkan di dalam satu navbar. Sekarang seragam. Target sentuh tetap minimal 44 px.
- Di ponsel (≤ 35em) tombol di hero, panel peran, dan penutup selebar wadahnya.

## Foto latar per bagian

- Sertifikat: foto cahaya jendela pada tumpukan berkas, lapisan gelap searah. Pita amplop: foto kertas bertumpuk, dicampur `luminosity` 12% di atas gradasi pinus. Penutup: siluet berjalan saat senja, teks di kiri dan siluet di kanan. Kepala halaman Satgas: foto fasad kantor malam, banner bersudut 22 px.
- Semua foto dekoratif (`alt=""`), dimuat lewat `next/image` (`fill`, `sizes="100vw"`, kualitas 60 sampai 70). Kredit di `docs/KREDIT-FOTO.md`.
- Kontras terendah teks di atas foto (diukur dari piksel latar tanpa teks): sertifikat ≥ 5,7, pita amplop ≥ 4,8, penutup ≥ 11,9, kepala Satgas ≥ 7,0.

## Perbaikan logika dan mata sandi

- **Menu Satgas hilang saat ke Papan atau Panduan.** Navbar menentukan mode Satgas hanya dari awalan jalur `/satgas`, jadi membuka `/papan`, `/panduan`, atau `/bukti-teknis` memunculkan menu umum. Sekarang sesi Satgas yang aktif tetap memakai menu Satgas di halaman umum tersebut, kecuali ada brankas pelapor di perangkat yang sama. Tombol "Keluar sesi" ikut bertahan.
- **Tombol sandi** kini ikon mata 44×44 px (bukan teks "Tampilkan"), nama aksesibel "Tampilkan sandi", status lewat `aria-pressed`, dapat dioperasikan dengan Tab dan Enter. Ada di `/masuk` dan `/satgas/masuk` (komponen `PasswordEye`).
- **Pesan 403.** Membuka halaman yang bukan untuk perannya (mis. Ketua membuka Radar) dulu memunculkan "Belum bisa memuat… periksa koneksimu". Sekarang tertulis jelas bahwa perannya tidak punya akses, tanpa tombol coba lagi, dengan jalan kembali ke daftar kasus.

## Logo

- Tanda merek: anyaman busur 3×3 (kisi 72 px, busur seperempat lingkaran radius 12, garis 6) yang menyambung jadi satu jalur. Dua busur di tengah berwarna madu. Tulisan "gema" berasal dari Archivo 700 yang diubah menjadi path, jadi tidak bergantung font.
- Berkas di `public/logo/`: `gema-simbol.svg`, `gema-simbol-putih.svg`, `gema-logo.svg`, `gema-logo-putih.svg`, `gema-ikon.svg`, `gema-ikon-512.png`. Favicon `src/app/icon.svg` (garis lebih tebal untuk ukuran kecil) dan `src/app/apple-icon.png` (180 px).
- Komponen `Echo` (tanda) dan `Wordmark` (tulisan) di `src/components/Echo.tsx` dipakai di navbar dan footer. Pada lebar ≤ 23,7em tulisan disembunyikan dan hanya tanda yang tampil.

## Pembersihan kode dan struktur

- `src/server/router.ts` (789 baris, satu fungsi `route` 620 baris) dipecah menjadi 34 baris perakit plus modul di `src/server/routes/`: `publik`, `akun`, `pelapor`, `satgas`, `demo`, `cron`, serta `context` (sesi, galat, rahasia cron) dan `views` (bentuk respons). Perilaku sama, urutan pencocokan rute tetap.
- Knip: 63 ekspor tak terpakai dilepas, 12 simbol mati dihapus, `scripts/gen-wordlist.cjs` (skrip sekali pakai berjalur `/tmp`) dan `src/styles/07d-obsidian-porcelain-ion.css` (tak diimpor) dihapus, serta CSS `.brandmark` yang tergantikan logo SVG. Dependensi `zod`, `esbuild`, `@eslint/js`, dan `typescript-eslint` dicabut; `onnxruntime-web` dicatat karena dipakai `scripts/copy-ort.mjs`. Setelah ini perlu `npm install` agar `package-lock.json` selaras.
- Lapisan CSS diberi nomor berurutan tanpa celah (`00` sampai `13`); urutan impor tidak berubah.
- Dokumen dikelompokkan: `docs/panduan/` (pemasangan, naskah demo), `docs/desain/` (catatan visual, audit UI, kredit foto, `gambar/`), `docs/arsip/` (audit dan catatan perubahan lama).
- Pengujian tambahan: forced-colors (batas tombol ditambahkan), keyboard, pohon aksesibilitas, zoom 200% dan 400%, jarak teks, offline, emulasi Android, dan CPU 6x. Pada CPU 6x dengan jaringan 3G, TBT terukur 540 sampai 1229 md (0 pada CPU normal). Pembaca layar dan perangkat Android sungguhan belum diuji.
