# Audit kompetisi Gema (Fase A)

Tanggal: 23 Nov 2026. Kode: repo ini (v1.2.0 + penyempurnaan UI v14).

**Cakupan yang benar-benar saya baca:** `src/server/{router,db,util,logic (sesi, login, OPRF, createReport, advanceStatus, tick),seed}.ts`, `src/proxy.ts`, `src/app/api/[...path]/route.ts`, `src/lib/asr-config.ts`, daftar dan jumlah uji, serta ukuran aset yang saya ukur sendiri di Chromium. **Yang tidak saya baca baris demi baris:** isi paket kripto (`packages/*`, hanya jumlah uji dan hasil lulus), `logic-akun.ts`, `logic-satgas.ts`, dan seluruh komponen UI selain yang diaudit pada fase UI. Bagian itu saya beri status "diuji tetapi tidak diaudit ulang" di bawah, bukan "terbukti benar".

Skor di akhir adalah estimasi subjektif berbasis bukti ini, bukan skor resmi lomba.

## A. Penilaian eksekutif

**Sudah sangat baik.** Arsitektur berlapis dan konsisten (UI, router, logika, backend penyimpanan yang dapat diganti, paket kripto terpisah). Kontrol akses diuji (20 pemeriksaan), sesi disimpan sebagai hash dan tahan restart, login membandingkan dua slot tanpa hubung-singkat (tanpa kebocoran waktu), CSP bernonce tanpa `unsafe-inline` untuk skrip, tidak ada sink XSS (`innerHTML`, `eval`, dan sejenisnya tidak ditemukan), autentikasi memakai header Bearer sehingga CSRF berbasis cookie tidak relevan. 164 uji lulus.

**Benar-benar inovatif (dan terbukti sebagian):** brankas yang kuncinya hanya di perangkat korban; pencocokan pola lewat OPRF tanpa server melihat nama; eskalasi bersyarat; Empat Mata dua lapis; Bukti Pemilik tanpa membuka identitas. Ini jarang digabung dalam satu alur penanganan kasus.

**Yang melemahkan skor:**

1. Narasi terlalu banyak "fitur kripto" sehingga juri harus menyusun ceritanya sendiri.
2. Mode demo menyala bawaan dan punya titik reset tanpa autentikasi (P0, di bawah).
3. Konfirmasi "tersimpan" dikirim sebelum data benar-benar ditulis ke penyimpanan (P1).
4. Sisi Satgas belum menjawab "siapa yang bertanggung jawab atas kasus ini" (tidak ada penugasan).
5. Dikte suara bergantung pada unduhan model dari luar saat demo (risiko jaringan venue).

**Risiko terbesar:** deploy lomba yang lupa mengatur variabel lingkungan membuat siapa pun dapat mengosongkan seluruh basis data lewat satu permintaan tanpa login.

**Perubahan berdampak tertinggi:** (1) kunci mode demo yang aman-secara-bawaan, (2) satu alur emas 5 sampai 7 menit yang bisa diputar ulang dan punya uji asap, (3) halaman bukti teknis yang memperlihatkan pasangan lolos/gagal (utuh vs diubah, satu persetujuan vs dua), (4) pernyataan batas yang jujur di setiap klaim.

## B. Posisi produk

Narasi **Lindungi, Hubungkan, Pertanggungjawabkan** cocok dengan kode:

| Pilar               | Isi (terbukti di kode)                                                               | Fitur pendukung                                                          |
| ------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| Lindungi            | brankas terenkripsi di perangkat, draf, bukti, Keluar cepat, kunci diam, Kode Paksa  | pemulihan orang tepercaya, passkey, dikte lokal, pendamping di perangkat |
| Hubungkan           | pencocokan OPRF, ambang k, eskalasi bersyarat                                        | Bukti Pemilik                                                            |
| Pertanggungjawabkan | tenggat hari kerja, Tangga Eskalasi, jejak audit berantai hash, anchor harian, Papan | Empat Mata, verifikasi publik                                            |

Satu kalimat nilai: _korban memegang kendali atas buktinya, kasus yang serupa bisa saling terhubung tanpa nama dibuka, dan kampus tidak bisa diam-diam menundanya._

Disembunyikan dari pitch utama (tetap ada di kode): istilah OPRF, ML-KEM, Shamir, Schnorr. Tidak boleh dipakai: "satu-satunya", "pertama", "tak pernah ada", "anonim mutlak". Gema memakai Kode Kasus tanpa email, tetapi **tidak** menjamin anonimitas dari penyedia jaringan atau pihak yang memegang perangkat; klaimnya harus "tidak meminta identitas", bukan "tidak bisa dilacak".

## C. Kesesuaian masalah dan solusi

| Masalah pengguna                 | Akar                                      | Solusi Gema                       | Bukti                                   | Celah                                                                   |
| -------------------------------- | ----------------------------------------- | --------------------------------- | --------------------------------------- | ----------------------------------------------------------------------- |
| Takut bukti hilang atau dibantah | bukti ada di ponsel, mudah dihapus/diubah | sidik SHA-256 + Merkle + anchor   | `merkle.test.ts` (11), verifier mandiri | sidik dihitung klien; server tidak bisa memeriksa isi terenkripsi       |
| Tak tahu apakah ada korban lain  | laporan terisolasi per kasus              | OPRF + ambang k                   | `oprf.test.ts`, `matching.test.ts`      | efektif hanya bila nama diketik serupa; dibatasi 8 evaluasi per laporan |
| Takut melapor jika sendirian     | eskalasi langsung membuka identitas       | eskalasi bersyarat                | `bersyarat.e2e` (5)                     | pelapor tetap bisa dikenali lewat isi cerita                            |
| Kasus diam di kampus             | tak ada tenggat terlihat                  | tenggat hari kerja, tangga, Papan | `tick`, uji API                         | tak ada penugasan penanggung jawab                                      |
| Satu orang Satgas membuka semua  | tak ada pemisahan                         | Empat Mata 2-dari-3               | `empat-mata.e2e` (4)                    | kolusi dua anggota tidak dicegah                                        |
| Kehilangan kode                  | kunci hanya di perangkat                  | pemulihan 2-dari-3                | `pemulihan.e2e` (6)                     | bergantung pada kesiapan orang tepercaya                                |
| Mengaku-ngaku sebagai pelapor    | tak ada bukti kepemilikan                 | Bukti Pemilik (Schnorr)           | `zk.test.ts` (5)                        | hanya membuktikan penguasaan kunci brankas                              |

## D. Inventaris fitur (status berdasar bukti)

Legenda: **T** terverifikasi (diuji + kode dibaca), **U** diuji tetapi kode tidak saya audit ulang, **S** sebagian, **B** belum ada.

| Fitur                              | Frontend | Backend                               | Penyimpanan          | Keamanan                | Uji                       | Status                                                |
| ---------------------------------- | -------- | ------------------------------------- | -------------------- | ----------------------- | ------------------------- | ----------------------------------------------------- |
| Brankas + draf + bukti             | ya       | ya                                    | file/Postgres + blob | AES-GCM di klien        | api.e2e, ux (Playwright)  | T                                                     |
| Login Kode+passphrase              | ya       | ya, dua slot, batas 5/15 mnt per kode | sesi hash            | waktu-konstan           | api, akses                | T                                                     |
| Kontrol akses                      | n/a      | ya                                    | n/a                  | 401/403/404 diuji       | akses.e2e (5 uji, 20 cek) | T                                                     |
| Pencocokan OPRF                    | ya       | ya, kuota 8/24/60                     | indeks fingerprint   | titik tervalidasi       | oprf, matching            | U                                                     |
| Integritas bukti (Merkle + anchor) | ya       | ya                                    | anchor harian        | sidik dari klien        | merkle (11)               | U                                                     |
| Eskalasi bersyarat                 | ya       | ya                                    | `Report.conditional` | kunci tersegel          | bersyarat.e2e             | U                                                     |
| Empat Mata                         | ya       | ya                                    | `approvals`          | 30 mnt, pemohon berbeda | empat-mata.e2e            | U                                                     |
| Pemulihan                          | ya       | ya                                    | `Reporter.recovery`  | sesi lama dicabut       | pemulihan.e2e             | T                                                     |
| Passkey PRF                        | ya       | ya                                    | `Reporter`           | autentikator virtual    | passkey.e2e               | U (tanpa perangkat keras)                             |
| Bukti Pemilik                      | ya       | ya                                    | tantangan di runtime | sekali pakai 15 mnt     | bukti-pemilik.e2e         | U                                                     |
| Dikte suara (Whisper base)         | ya       | n/a                                   | n/a                  | audio tak dikirim       | asr-config.test (3)       | **S**: akurasi tidak terukur; model diunduh dari luar |
| Pendamping di perangkat            | ya       | n/a                                   | n/a                  | lokal                   | pendamping.test (10)      | U                                                     |
| Dosir Satgas + status              | ya       | ya                                    | events               | peran                   | api.e2e                   | T                                                     |
| Penugasan penanggung jawab         | tidak    | tidak                                 | tidak                | n/a                     | tidak                     | **B**                                                 |
| Papan akuntabilitas                | ya       | ya                                    | snapshot kuartal     | agregat                 | api.e2e                   | U                                                     |
| Mode demo                          | ya       | ya                                    | seed                 | **lihat P0**            | smoke manual              | **S** (tidak aman bawaan)                             |
| Keluar cepat, kunci diam, samaran  | ya       | n/a                                   | n/a                  | lokal                   | ux/ux3 (Playwright)       | T (hanya Chromium)                                    |

## E. Temuan berprioritas

| ID  | Prioritas | Temuan                                                                                                 | Bukti kode                                                 | Dampak                                                                                                             | Perbaikan                                                                                           | Berkas                                                  |
| --- | --------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| F1  | P0        | Demo aktif bila `GEMA_DEMO` tak diatur; `POST /api/demo/reset` tanpa autentikasi memanggil `resetDb()` | `router.ts` rute `demo`, `process.env.GEMA_DEMO === 'off'` | siapa pun dapat menghapus seluruh data dari internet pada deploy yang lupa env; masuk Satgas demo tanpa kata sandi | aktif hanya bila `GEMA_DEMO=on` di produksi; reset hanya bila semua institusi berstatus demo        | `server/demo-flag.ts` (baru), `router.ts`, `layout.tsx` |
| F2  | P0        | Akun Satgas demo dibuat selalu dengan kata sandi publik `contoh-demo-2026`                             | `seed.ts` `hashPassword(DEMO_PASSWORD)`                    | kredensial publik tetap sah walau `GEMA_DEMO=off`                                                                  | kata sandi acak bila demo nonaktif                                                                  | `seed.ts`                                               |
| F3  | P1        | IP diambil dari entri pertama `x-forwarded-for`                                                        | `router.ts` `clientIp`                                     | pembatas buat-akun (20/hari) dan kuota OPRF per jaringan dilewati dengan satu header                               | ambil entri dari kanan sesuai jumlah proksi tepercaya                                               | `util.ts`, `router.ts`                                  |
| F4  | P1        | Konfirmasi dikirim sebelum data ditulis (penyimpanan tertunda 300 ms)                                  | `db.ts` `persist()`                                        | laporan/eskalasi yang sudah "berhasil" hilang bila proses mati dalam 300 ms                                        | tunggu `flush` sebelum membalas permintaan pengubah                                                 | `router.ts`                                             |
| F5  | P2        | Badan unggahan dibaca penuh ke memori sebelum dicek ukuran                                             | `router.ts` PUT blob                                       | satu pelapor bisa membuat server memakai memori besar                                                              | tolak lewat `content-length` lebih dulu                                                             | `router.ts`                                             |
| F6  | P1        | Sidik berkas dan akar pesan adalah klaim klien; server tak dapat memverifikasi                         | `createReport` menerima `sha256` apa adanya                | bukan celah (E2E memang begitu) tetapi klaim "bukti tak bisa dibantah" harus dibatasi                              | ubah kalimat di UI/pitch: yang dibuktikan adalah "berkas ini sama dengan yang dicatat pada waktu T" | docs, UI teks                                           |
| F7  | P1        | Model Whisper diunduh dari huggingface.co saat pertama dipakai                                         | `asr-config.ts`, CSP `connect-src`                         | demo gagal tanpa internet; klaim "offline" tidak benar pada pemakaian pertama                                      | cadangan jelas (ketik manual), panduan host sendiri, pratinjau status unduhan                       | UI Dictate, docs                                        |
| F8  | P1        | Tidak ada penugasan kasus; "siapa yang bertanggung jawab" tak terjawab                                 | `types.ts` Escalation tanpa assignee                       | sisi Satgas terasa dasbor, bukan alur kerja                                                                        | tambah penanggung jawab (diaudit)                                                                   | types, logic-satgas, UI                                 |
| F9  | P2        | Pembatas laju login hanya per Kode Kasus                                                               | `loginReporter`                                            | penyerang yang tahu kode dapat mengunci korban 15 menit                                                            | tambah pembatas per IP; kunci per kode tetap                                                        | `logic/`                                                |
| F10 | P2        | Persisten satu penulis; tanpa transaksi lintas koleksi                                                 | `db.ts`                                                    | satu instans saja                                                                                                  | batas diakui                                                                                        | docs                                                    |
| F11 | P3        | Tidak ada uji asap alur emas satu perintah                                                             | `tests/`                                                   | demo tak bisa diverifikasi ulang cepat                                                                             | skrip `npm run demo:smoke`                                                                          | scripts                                                 |

## F. Model ancaman ringkas

**Aset:** isi laporan dan bukti (terenkripsi klien); kunci brankas (perangkat korban); kode kasus; kunci Satgas; jejak audit; integritas anchor.

**Pelaku:** terlapor yang punya akses sosial; anggota Satgas tunggal yang berniat buruk; operator server; penyerang jaringan; pihak yang memegang perangkat bersama; pengunjung internet (abuse).

**Batas kepercayaan:** perangkat korban (dipercaya sepenuhnya); server (tidak dipercaya untuk isi, dipercaya untuk ketersediaan dan urutan); Satgas (dipercaya hanya setelah eskalasi dan, bila Empat Mata aktif, setelah dua orang berbeda).

| Risiko                        | Mitigasi yang ada                                                        | Sisa risiko                                                                              |
| ----------------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| Server/DB dibobol             | isi terenkripsi klien; kunci tidak di server; sesi disimpan sebagai hash | metadata (waktu, unit, jumlah bukti) terlihat; kunci OPRF induk di berkas/secret manager |
| Insider tunggal               | Empat Mata                                                               | kolusi dua anggota; pemegang kunci Satgas yang dibagi                                    |
| Perangkat bersama             | Keluar cepat, kunci diam, samaran layar                                  | tidak menghapus riwayat peramban; samaran tidak berlaku bagi pembaca layar               |
| Penyalahgunaan (spam laporan) | batas akun/kuota                                                         | **F3 (dilewati dengan header)**                                                          |
| Replay                        | tantangan sekali pakai 15 menit; persetujuan 30 menit                    | tidak ada penguncian ulang jika token bocor di perangkat                                 |
| Penghapusan/pencadangan       | tidak ada kebijakan retensi                                              | belum dirancang                                                                          |
| Data demo bocor ke produksi   | institusi bertanda `demo`                                                | **F1/F2**                                                                                |

## G. UX (ringkasan; detail visual di `AUDIT-UI.md`)

Kekuatan: istilah dijelaskan di tempat, jeda dan lanjut, tinjauan lengkap, kondisi gagal yang menenangkan, keluar cepat. Kelemahan untuk lomba: tidak ada satu jalur "mulai demo" yang membawa juri dari masalah sampai hasil; penjelasan privasi tersebar di beberapa halaman; sisi Satgas belum menunjukkan penanggung jawab dan tahap prosedural.

## H. Rekayasa

Baik: TypeScript ketat, ESLint, Stylelint, 164 uji, backend penyimpanan abstrak, pola React rapi. Perlu: durabilitas sebelum konfirmasi (F4), batas memori unggahan (F5), kepercayaan proksi (F3), `GEMA_OPRF_MASTER` wajib di produksi (sudah untuk Postgres).

## I. Kinerja (diukur, localhost, Chromium, tanpa kompresi)

JS 472 sampai 602 KB per halaman publik, CSS 63 KB, font 121 sampai 136 KB; DOMContentLoaded 99 sampai 341 ms. Model Whisper tidak dimuat di halaman ini (hanya saat dikte). Bundel statis total 29 MB termasuk WASM onnxruntime (26 MB, hanya dimuat untuk dikte). Latensi inferensi dan memori Whisper **tidak diukur** (butuh audio dan unduhan model; jaringan sandbox tidak mengizinkan).

## J. Status perbaikan (Fase B sampai F, diverifikasi)

| ID  | Status          | Bukti                                                                                                                                                                                                                                                                                                |
| --- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F1  | **Selesai**     | `demoEnabled()`; di server produksi tanpa `GEMA_DEMO`: `demo/reset` 404, `demo/info` 404, masuk demo 401, banner tidak tampil (dicoba dengan `curl` pada `next start`); `GEMA_DEMO=on`: 200 dan banner tampil. Reset juga ditolak 403 bila ada institusi non-demo. Uji: `tests/keamanan.e2e.test.ts` |
| F2  | **Selesai**     | seed memakai kata sandi acak bila demo nonaktif                                                                                                                                                                                                                                                      |
| F3  | **Selesai**     | `clientIpFrom`; uji: 24 pendaftaran dengan entri kiri berganti tetap kena 429 setelah 20                                                                                                                                                                                                             |
| F4  | **Selesai**     | `handle()` menunggu `flush` sebelum membalas permintaan pengubah; uji: data sudah ada di `db.json` saat respons diterima                                                                                                                                                                             |
| F5  | **Selesai**     | 413 lewat `Content-Length` sebelum badan dibaca; ukuran wajar tetap 200                                                                                                                                                                                                                              |
| F6  | **Dokumentasi** | batas klaim ada di halaman Bukti teknis dan naskah juri                                                                                                                                                                                                                                              |
| F7  | **Sebagian**    | bukti teknis tidak bergantung model; dikte tetap butuh unduhan model sekali. Rekomendasi: unduh model sebelum demo (tahap "pemanasan" di naskah) atau host sendiri                                                                                                                                   | Putaran 3: pengecekan sebelum merekam, pesan galat manusiawi (offline vs unduhan gagal), klaim ukuran model yang tak terukur dihapus. |
| F8  | **Selesai**     | `POST satgas/cases/:id/assign` (Ketua), `GET satgas/team`, jejak audit, kolom "Penanggung jawab" dan kontrol di halaman kasus; uji di `tests/alur-emas.e2e.test.ts`                                                                                                                                  |
| F9  | **Selesai**     | pembatas login per jaringan (120 per 15 menit, longgar agar NAT kampus tidak terkunci) selain pembatas per Kode Kasus                                                                                                                                                                                |
| F10 | Dibiarkan       | batas satu penulis diakui di dokumentasi                                                                                                                                                                                                                                                             |
| F11 | **Selesai**     | `tests/alur-emas.e2e.test.ts` (satu skenario deterministik)                                                                                                                                                                                                                                          |
| F12 | **Selesai**     | uji: bukti non-demo tidak ditemukan lewat sidik                                                                                                                                                                                                                                                      |
