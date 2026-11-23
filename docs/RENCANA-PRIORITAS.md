# Rencana prioritas terpilih (bukan redesain)

Dipilih dari `AUDIT-KOMPETISI.md` memakai delapan kriteria: fungsi kritis, keamanan/kebenaran, kegunaan alur inti, kejelasan inovasi, dampak skor, dampak visual, risiko regresi, usaha. Semua P0 sudah selesai di putaran sebelumnya. Yang tersisa dan layak untuk dikerjakan sekarang adalah dua kelompok P1 berisiko rendah. Yang sengaja **tidak** dikerjakan dijelaskan di bagian akhir.

## Kelompok 1 (P1): klaim di antarmuka tidak boleh melebihi bukti

**Masalah.** Teks konfirmasi eskalasi berbunyi "Identitas tetap anonim". Itu tidak dapat dijamin: Satgas membaca seluruh isi cerita dan bukti, dan cerita bisa memuat petunjuk tentang siapa pelapor. Label "Buat brankas anonim" dan "secara anonim" di beranda berjanji lebih dari yang dibuktikan arsitektur (Gema tidak meminta identitas, tetapi tidak dapat menjamin anonimitas dari jaringan, perangkat, atau isi cerita). Penyintas yang memutuskan eskalasi berdasarkan kalimat itu bisa mengambil keputusan dengan informasi yang salah, dan juri yang menguji klaim akan menemukannya.

**Bukti.** `src/app/brankas/[id]/page.tsx:365`, `src/components/OwnerProofSatgas.tsx:48`, `src/app/page.tsx:21`, `Navbar.tsx:114`, `RoleChooser.tsx:16`, `src/app/pahami/page.tsx:96`, `src/app/masuk/page.tsx:140`, `src/app/panduan/page.tsx:153`, README baris 13 dan 98.

**Dampak.** Keselamatan keputusan pengguna, kredibilitas teknis, kesesuaian dengan aturan "jangan klaim anonimitas yang tidak dijamin".

**Berkas.** Teks di berkas di atas, `README.md`, `docs/NASKAH-DEMO.md`, satu uji baru.

**Risiko.** Rendah: hanya teks. Satu-satunya regresi mungkin skrip uji peramban yang mencari label tombol lama; saya perbarui bersamaan.

**Kriteria penerimaan.**

- Konfirmasi eskalasi menyebut apa yang tidak diminta Gema (nama, email, telepon) dan memperingatkan bahwa isi cerita dan bukti dapat memuat petunjuk identitas, serta bahwa eskalasi dapat ditarik.
- Tidak ada "anonim" sebagai janji di antarmuka pelapor; padanannya "tanpa nama, email, atau telepon".
- Kata "aktor audit" internal `pelapor-anonim` boleh tetap (itu label jejak audit, bukan janji).

**Uji.** `tests/klaim.test.ts` membaca sumber antarmuka dan gagal bila frasa janji berlebihan muncul lagi; uji peramban yang ada dijalankan ulang.

## Kelompok 2 (P1): dikte suara tidak boleh menggagalkan korban yang sudah merekam

**Masalah.** Peringatan bahwa model harus diunduh baru muncul setelah pengguna selesai bicara. Bila offline atau host model tak terjangkau, rekaman terbuang dan pesan galat menampilkan teks mentah pengecualian. Klaim "sekitar 80 MB" tidak pernah diukur. Untuk demo di jaringan venue, ini risiko gagal-di-depan-juri.

**Bukti.** `src/components/Dictate.tsx` (pesan di bawah tombol dan blok `catch`), `src/workers/asr.worker.ts` (model diunduh dari `MODEL_HOST` saat pertama dipakai), CSP `connect-src` huggingface.

**Dampak.** Ketahanan demo, kepercayaan pengguna, kejujuran klaim "di perangkat".

**Berkas.** `src/lib/asr.ts` (cek cache model), `src/lib/asr-config.ts` (pemetaan galat menjadi pesan manusiawi, fungsi murni), `src/components/Dictate.tsx`, `src/lib/asr-config.test.ts`.

**Risiko.** Rendah-sedang: menyentuh alur rekam. Perilaku bawaan tidak berubah saat online atau model sudah ada; yang baru hanya pemeriksaan sebelum merekam saat offline tanpa model, dan teks pesan.

**Kriteria penerimaan.**

- Offline dan model belum ada: pengguna diberi tahu **sebelum** merekam, dengan jalan keluar (ketik sendiri).
- Offline tetapi model sudah ada di cache: dikte tetap jalan.
- Pesan galat tidak menampilkan teks pengecualian mentah dan membedakan "tidak ada koneksi" dari kegagalan lain.
- Tidak ada angka ukuran yang tidak terukur; ukuran sebenarnya ditampilkan dari kemajuan unduhan.

**Uji.** Uji unit untuk pemetaan galat dan keputusan "boleh merekam"; uji peramban dengan Chromium offline (model belum ada: pesan awal; mikrofon tidak diminta).

## Sengaja tidak dikerjakan (dan alasannya)

| Hal                                                         | Alasan                                                                                                |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Redesain atau polesan visual lanjutan                       | UI sudah diaudit di v14; dampak skor kecil dibanding risiko regresi                                   |
| Fitur baru di luar inti (notifikasi, unggahan massal, dll.) | Tidak menjawab celah audit                                                                            |
| Kebijakan retensi/penghapusan data                          | P2, butuh keputusan produk dan hukum, bukan sekadar kode                                              |
| Skema Postgres relasional / multi-penulis                   | P2, usaha besar, tidak dibutuhkan untuk demo                                                          |
| Audit ulang paket kripto                                    | Perlu pihak independen; saya tidak boleh mengaku sudah menjamin                                       |
| Mengukur akurasi Whisper                                    | Butuh audio dan jaringan unduh yang tidak ada di lingkungan ini; protokol uji ada di dokumen kesiapan |
