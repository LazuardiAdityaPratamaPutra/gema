# Changelog putaran prioritas (v16)

Lingkup sengaja sempit: dua kelompok P1 dari `RENCANA-PRIORITAS.md`. Tidak ada redesain, tidak ada dependensi baru, tidak ada fitur baru.

## Kelompok 1: klaim sesuai bukti

- Konfirmasi eskalasi tidak lagi berkata "Identitas tetap anonim". Kini: Gema tidak meminta nama/email/telepon, tetapi isi cerita dan bukti bisa memuat petunjuk identitas; eskalasi bisa ditarik selama Satgas belum membuka kasus.
- "Buat brankas anonim" menjadi "Buat brankas tanpa nama" (Navbar, RoleChooser, beranda, panduan, masuk); "secara anonim" di beranda menjadi "tanpa nama, email, atau telepon"; "Simpan dulu, anonim" menjadi "Simpan dulu, tanpa nama"; teks bukti kepemilikan Satgas tidak lagi menyebut "anonim".
- README, naskah demo, dan skrip uji peramban disesuaikan.
- Uji baru `tests/klaim.test.ts` (8 uji) gagal bila frasa janji berlebihan kembali ke antarmuka.

## Kelompok 2: dikte tahan jaringan buruk

- Offline dan model belum ada di cache: pengguna diberi tahu **sebelum** merekam, mikrofon tidak diminta.
- Offline dengan model di cache atau online: perilaku tidak berubah.
- Galat dibedakan (offline, unduhan gagal, memori, lain-lain) dan tidak menampilkan teks pengecualian mentah.
- Klaim "sekitar 80 MB" dihapus karena tidak pernah diukur.
- Uji baru `tests/asr-galat.test.ts` (5 uji).

## Verifikasi yang benar-benar dijalankan

| Pemeriksaan                                                                                 | Hasil                                                              |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `npm run check` (lint, tipe, stylelint, prettier, vitest)                                   | lulus; 187 lulus, 1 dilewati (sebelumnya 174)                      |
| Peramban Chromium, 21 halaman × 1280/390/320 dengan axe (wcag2a/aa, 21a/aa, 22aa), overflow | 0 bermasalah, setelah tiap kelompok                                |
| Alur dikte offline di 1280/390/320                                                          | tidak merekam, pesan tampil, tanpa pelanggaran axe, tanpa overflow |
| Dikte online                                                                                | tetap mulai merekam                                                |
| E2E alur AI Satgas                                                                          | berjalan, tanpa galat konsol                                       |
| Fungsi lama dihapus?                                                                        | Tidak. Hanya teks dan satu pemeriksaan awal yang ditambahkan       |

## Sisa masalah (jujur)

- Pembuktian akurasi dan latensi Whisper belum terukur; tidak ada audio dan unduhan model di lingkungan ini. Unduh model di venue sebelum demo, atau host sendiri lewat `NEXT_PUBLIC_GEMA_MODEL_HOST`.
- Cache model dideteksi lewat nama cache bawaan `transformers-cache`; bila pustaka mengubahnya, deteksi offline-dengan-model jatuh ke "belum ada" (aman, hanya lebih konservatif).
- Tidak diuji dengan pembaca layar sungguhan, Android sungguhan, atau pengguna sungguhan.
- Tombol istilah `term-btn` kecil (17-22 px) hanya sebaris dalam teks; dikecualikan WCAG 2.5.8 tetapi masih bisa diperbaiki.
- Paket kripto, `logic-akun.ts`, `logic-satgas.ts` belum diaudit ulang baris demi baris; perlu audit independen.
- Kolusi dua anggota Satgas, batas satu penulis, kebijakan retensi/penghapusan data, deploy nyata dengan `GEMA_DEMO=on`, video demo, proposal, surat orisinalitas: pekerjaan tim.
