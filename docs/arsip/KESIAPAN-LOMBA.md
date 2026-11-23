# Kesiapan lomba Gema

Dokumen ini jujur tentang apa yang terbukti dan apa yang belum. Skor adalah estimasi subjektif pembuat, bukan skor resmi lomba.

## 1. Alur emas (5 sampai 7 menit)

Semua langkah memakai data fiktif dan dapat diulang: `Reset` di halaman Demo mengembalikan keadaan awal (hanya bila basis data berisi institusi demo), jam demo bisa dimajukan, dan tidak ada layanan luar yang dibutuhkan kecuali unduhan model dikte (opsional).

| Menit | Langkah                     | Yang diperlihatkan                                                                | Bukti otomatis                                 |
| ----- | --------------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------- |
| 0:00  | Beranda lalu `/pahami`      | masalah dan batas jujur ("bukan layanan darurat, bukan nasihat hukum")            | uji UI                                         |
| 0:45  | `/mulai` lalu buat brankas  | Kode Kasus dan kata sandi dibuat di perangkat; tidak ada email                    | `api.e2e`                                      |
| 1:30  | Laporan baru, tiga langkah  | konteks privasi, draf tersimpan, tinjauan lengkap, kunci                          | `ux.py`, `ux3.py`                              |
| 2:30  | `/bukti-teknis` bagian 1    | berkas utuh cocok, diubah satu karakter gagal                                     | `alur-emas.e2e` langkah 1                      |
| 3:00  | Pencocokan                  | pelapor kedua pada terlapor sama; OPRF (bagian 3 halaman bukti teknis)            | `bersyarat.e2e`, `oprf.test`                   |
| 3:45  | Eskalasi bersyarat          | sebelum ambang: Satgas tak melihat apa pun; sesudah: kasus muncul tanpa identitas | `alur-emas.e2e` langkah 2 dan 3                |
| 4:30  | Satgas, Empat Mata          | dosir terkunci; satu pihak tak cukup; anggota lain menyetujui                     | `alur-emas.e2e` langkah 4                      |
| 5:15  | Penanggung jawab dan status | Ketua menugaskan; status maju satu langkah; jejak audit                           | `alur-emas.e2e` langkah 5 dan penanggung jawab |
| 6:00  | Papan dan jam demo          | tenggat terlambat naik tangga, publik dapat melihat                               | `api.e2e`                                      |
| 6:30  | Penutup                     | batas jujur dan langkah berikutnya                                                | n/a                                            |

Perintah uji alur emas tanpa peramban: `npx vitest run tests/alur-emas.e2e.test.ts` (sekitar 1 detik). Uji peramban penuh ada di folder skrip tim (`ux.py`, `ux2.py`, `ux3.py`) dan memakai Playwright.

Persiapan sebelum tampil: `GEMA_DEMO=on`, `.data` bersih, satu server, buka `/bukti-teknis` sekali, dan bila memakai dikte, unduh model sekali saat ada internet (model disimpan peramban).

## 2. Posisi dan kalimat inti

"Korban memegang kendali atas buktinya, kasus yang serupa bisa saling terhubung tanpa nama dibuka, dan kampus tidak bisa diam-diam menundanya." Tiga pilar: Lindungi, Hubungkan, Pertanggungjawabkan.

## 3. Tanya-jawab juri

**Apakah ini anonim?** Gema tidak meminta nama, email, atau telepon. Itu berbeda dari anonimitas mutlak: penyedia jaringan, pemegang perangkat, dan isi cerita sendiri tetap bisa mengungkap identitas. Karena itu kami menyebutnya "tidak meminta identitas", bukan "tidak bisa dilacak".

**Kalau server dibobol?** Isi laporan dan bukti terenkripsi di perangkat; server tidak memegang kuncinya. Yang bocor: metadata seperti waktu, unit, dan jumlah bukti. Kunci induk OPRF di server memengaruhi pencocokan, bukan isi.

**Bagaimana Anda tahu bukti tidak dipalsukan?** Yang dibuktikan hanya bahwa berkas ini identik dengan yang dicatat pada waktu T. Sidik dihitung di perangkat pelapor, jadi sistem tidak membuktikan keaslian percakapan atau pelakunya.

**Apa gunanya pencocokan kalau ejaan nama berbeda?** Gema membuat beberapa varian ejaan dan kode fonetik, tetapi kecocokan tidak sempurna. Kecocokan bukan bukti kesalahan; ia hanya memberi tahu bahwa ada laporan lain yang serupa dan memicu pilihan eskalasi oleh pelapor.

**Satgas bisa menyalahgunakan?** Dosir hanya terbuka setelah eskalasi, dan pada mode Empat Mata butuh persetujuan anggota berbeda, dengan jejak audit berantai hash. Kolusi dua anggota tidak dicegah; itu batas yang kami akui.

**Apakah AI memutuskan kasus?** Tidak. Pendamping bekerja di perangkat, memberi saran dan draf yang dapat diubah, dan tidak menilai benar atau salah.

**Bagaimana dengan akurasi dikte suara?** Belum kami ukur dengan suara manusia. Hasilnya selalu dapat diedit dan tidak diperlakukan sebagai fakta. Model diunduh sekali dari host model; suara tidak dikirim.

**Apakah siap dipakai di kampus sungguhan?** Belum. Ini prototipe lomba: satu instans penulis, belum ada audit keamanan pihak ketiga, belum ada kebijakan retensi dan penghapusan, dan belum diuji dengan pembaca layar sungguhan atau pengguna nyata.

**Mengapa memakai kriptografi serumit itu?** Setiap bagian menjawab hambatan korban: kehilangan bukti (Merkle), takut sendirian (OPRF + ambang), kehilangan akses (pemulihan), penyalahgunaan internal (Empat Mata). Pitch menonjolkan manfaatnya, bukan istilahnya.

**Apa yang Anda perbaiki dari audit sendiri?** Mode demo yang tidak aman bawaan, pemalsuan alamat IP, konfirmasi sebelum data tertulis, dan pencarian sidik yang membocorkan keberadaan laporan. Semuanya ada di `docs/AUDIT-KOMPETISI.md` dengan uji.

## 4. Skor estimasi (subjektif, bukan skor resmi)

| Kategori               | Sebelum | Sesudah | Dasar bukti                                                                    | Keyakinan     |
| ---------------------- | ------- | ------- | ------------------------------------------------------------------------------ | ------------- |
| Relevansi masalah      | 9       | 9       | konteks Permendikbudristek 55/2024, alur nyata                                 | sedang        |
| Inovasi                | 8,5     | 8,5     | gabungan OPRF, bersyarat, Empat Mata, ZK                                       | sedang        |
| Kelengkapan fungsional | 8       | 8,5     | penanggung jawab ditambah; alur emas teruji                                    | sedang        |
| Rekayasa               | 8       | 8,5     | 198 uji (hasil `npm test`, 23 Nov 2026), durabilitas, batas unggahan           | sedang        |
| Keamanan               | 7       | 8       | 5 perbaikan terbukti; belum ada audit independen, kripto tidak saya baca ulang | rendah-sedang |
| UI/UX                  | 8       | 8,5     | audit UI v14; belum uji pengguna                                               | rendah        |
| Aksesibilitas          | 7,5     | 8       | axe 63 kombinasi nol pelanggaran; belum pembaca layar nyata                    | rendah        |
| Kredibilitas teknis    | 7,5     | 8,5     | halaman bukti teknis yang menghitung sungguhan                                 | sedang        |
| Kesiapan demo          | 6,5     | 8       | alur emas, reset aman, uji asap                                                | sedang        |
| Diferensiasi           | 8,5     | 8,5     | narasi tiga pilar                                                              | rendah        |
| Kesiapan presentasi    | 6       | 7,5     | naskah ada; **video, proposal, surat belum**                                   | tinggi        |

Lima perubahan paling berpengaruh ke skor: (1) rekam video demo mengikuti alur emas, (2) proposal yang memakai narasi tiga pilar dan batas jujur, (3) deploy dengan `GEMA_DEMO=on` dan uji dari ponsel nyata, (4) uji dengan satu atau dua pengguna nyata untuk alur laporan, (5) ukur dikte dengan suara fiktif dan siapkan cadangan bila internet venue mati.

## 5. Yang belum selesai

- **P1:** video demo, proposal, surat orisinalitas, deploy nyata, uji pembaca layar nyata, ukur akurasi dikte, unduh model sebelum demo (F7).
- **P2:** kebijakan retensi/penghapusan data, audit independen paket kripto, kolusi dua anggota, satu instans penulis.
- Tidak dicek ulang oleh saya dalam audit ini: isi `packages/*` (kripto) dan `logic-akun.ts` / `logic-satgas.ts` secara baris demi baris; keduanya hanya berstatus "teruji".

## 6. Verdict

Gema lebih kuat dari sebelumnya, terutama pada keamanan bawaan dan kemampuan diperagakan ulang. Inovasi paling meyakinkan: brankas yang kuncinya di korban digabung eskalasi bersyarat dan Empat Mata. Yang masih menahannya dari level juara: bukti dari pengguna nyata dan deliverable lomba (video, proposal). Perbaiki segera: unggahan model dan cadangan dikte untuk demo. Jangan diubah lagi: identitas visual, skema kripto yang sudah diuji, dan batas klaim jujur.
