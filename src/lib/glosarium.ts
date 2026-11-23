/** Penjelasan istilah teknis dalam bahasa sehari-hari. Satu sumber agar istilah yang sama selalu dijelaskan sama. */
export const GLOSARIUM = {
  sidik:
    'Sidik adalah kode unik dari isi sebuah berkas, seperti sidik jari. Berkas yang berubah satu huruf saja menghasilkan sidik yang berbeda, jadi bukti tidak bisa diganti diam-diam.',
  akar: 'Akar harian adalah satu kode ringkasan dari semua bukti yang tercatat pada hari itu, lalu diumumkan terbuka. Dari situ siapa pun bisa memeriksa bahwa bukti tidak ditambah atau diubah sesudahnya.',
  kodePaksa:
    'Kode Paksa adalah kata sandi kedua. Bila ada yang memaksamu membuka brankas, kata sandi ini menampilkan brankas tiruan yang tampak wajar, bukan isi aslimu.',
  eskalasi:
    'Eskalasi artinya kamu memilih mengirim laporan ke Satgas. Sebelum itu Satgas tidak tahu apa pun, dan kamu masih bisa menariknya kembali selama Satgas belum membuka kasusnya.',
  jembatanButa:
    'Jembatan Buta adalah cara mencocokkan nama terlapor antarlaporan tanpa ada pihak yang melihat nama aslinya, termasuk server Gema.',
  hmac: 'Mode cadangan adalah cara pencocokan nama yang lebih sederhana. Nama tetap tidak dikirim, tetapi lebih mudah ditebak oleh pihak yang menguasai server.',
  passkey:
    'Passkey memungkinkan kamu masuk dengan sidik jari, wajah, atau kunci keamanan di perangkatmu, tanpa mengetik kata sandi.',
  empatMata:
    'Empat Mata berarti isi kasus hanya terbuka bila dua anggota Satgas yang berbeda sepakat, sehingga tidak ada satu orang yang bisa membukanya sendirian.',
  kodeKasus:
    'Kode Kasus adalah pengenal brankasmu, dipasangkan dengan kata sandi enam kata. Tidak memuat nama, email, atau nomor telepon.',
} as const;

export type IstilahKey = keyof typeof GLOSARIUM;
