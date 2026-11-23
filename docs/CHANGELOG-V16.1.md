# Changelog v16.1 (perbaikan temuan audit v16)

Lingkup: hanya temuan terverifikasi dari audit v16. Tanpa fitur baru, tanpa dependensi baru, tanpa perubahan kripto atau API.

**Koreksi atas `CHANGELOG-PRIORITAS.md` (v16):** changelog itu menyebut klaim "sekitar 80 MB" sudah dihapus. Itu hanya benar untuk `Dictate.tsx`; angka yang sama masih ada di Panduan, README, dan naskah demo sampai v16.1.

## Perubahan

| Temuan                | Perbaikan                                                                                                                                                                                                                                                                                                                        | Berkas                                                                  |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| P0 teks penarikan     | "Kamu bisa menariknya kapan saja" menjadi "Penarikan hanya dapat dilakukan sebelum Satgas membuka kasus." Teks serupa diseragamkan: "bisa ditarik selama Satgas belum membuka kasusnya" (RoleChooser, glosarium, README); syarat bersyarat "dicabut selama belum terpenuhi" (README)                                             | `brankas/[id]/page.tsx`, `RoleChooser.tsx`, `glosarium.ts`, `README.md` |
| P0 klaim 80 MB        | Diganti "perlu diunduh terlebih dahulu ... dapat digunakan kembali ketika tersedia di perangkat"                                                                                                                                                                                                                                 | `panduan/page.tsx`, `README.md`, `docs/NASKAH-DEMO.md`                  |
| P1 state eskalasi     | Kartu konfirmasi ditutup lewat callback sukses `act` (setelah API dan muat ulang berhasil); gagal tidak menutup dan tidak menampilkan sukses. Tombol "Eskalasi laporan ini" nonaktif saat `busy`. Bila `escalation.opened`, tombol Tarik diganti catatan "Satgas sudah membuka kasus ini, jadi persetujuan tidak dapat ditarik." | `brankas/[id]/page.tsx`                                                 |
| P1 peringatan privasi | Butir baru di Batas jujur ("Isi laporan bisa mengungkap identitas", sekarang 8 batas) dan catatan di langkah Tinjau sebelum "Kunci dan simpan"                                                                                                                                                                                   | `panduan/page.tsx`, `brankas/baru/page.tsx`                             |
| P1 uji klaim          | `tests/klaim.test.ts` dari 8 menjadi 17 uji; memindai `src/**` dan README/naskah/kesiapan/deploy: janji anonim, "tarik kapan saja", tiap kalimat "bisa menarik" harus memuat syarat, angka ukuran model, reset state konfirmasi, penjelasan batas penarikan, peringatan privasi, dan dasar API (409 setelah dibuka)              | `tests/klaim.test.ts`                                                   |
| Temuan baru oleh uji  | Naskah demo mengucapkan "tidak bisa dibantah belakangan"; diganti pernyataan keutuhan berkas                                                                                                                                                                                                                                     | `docs/NASKAH-DEMO.md`                                                   |
| P1 angka uji          | README dan KESIAPAN-LOMBA: 196 uji (hasil `npm test`, 23 Nov 2026)                                                                                                                                                                                                                                                               | `README.md`, `docs/KESIAPAN-LOMBA.md`                                   |

## Verifikasi

Lihat laporan akhir pada percakapan: `npm run check`, `npm run build`, `npm test` exit 0; 196 lulus, 1 dilewati; QA 63 kombinasi axe 0 bermasalah; uji peramban eskalasi di 1280/390/320.

## Sisa risiko

- Angka akurasi Whisper di README (54% / 92% pada 4 kalimat sintetis) berasal dari putaran sebelumnya dan tidak dapat direproduksi di lingkungan ini (tanpa akses model). Dinyatakan di README sebagai sintetis dan suara manusia belum diukur.
- Tidak diuji dengan pembaca layar, Android, atau pengguna nyata; hanya Chromium.
- Dikte tetap baru memberi tahu kegagalan unduhan setelah rekaman; siapkan model di perangkat demo.
- Jalur "Satgas membuka kasus" diuji di peramban hanya pada 1280 px (pelapor di 320/390 tidak mengulang langkah Satgas).
