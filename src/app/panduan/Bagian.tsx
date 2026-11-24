export function DataFold() {
  return (
    <details className="fold" id="data">
      <summary>
        <h2>Yang terjadi pada datamu</h2>
        <span>5 hal</span>
      </summary>
      <ul>
        <li>
          <strong>Kode dan kata sandi</strong> dibuat di perangkatmu. Dari keduanya diturunkan dua
          kunci terpisah: satu untuk masuk, satu untuk mengunci laporan. Server tidak pernah
          menerima kunci pengunci.
        </li>
        <li>
          <strong>Laporan dan berkas</strong> dienkripsi dengan AES-256-GCM sebelum dikirim. Server
          menyimpan data terkunci.
        </li>
        <li>
          <strong>Pencocokan nama</strong> memakai OPRF (RFC 9497): nama disamarkan di perangkatmu,
          server menandatangani tanpa melihatnya, dan hasilnya hanya berupa sidik yang tidak bisa
          dibalik. Kampus tidak mendapat daftar nama.
        </li>
        <li>
          <strong>Eskalasi</strong> membungkus kunci laporan untuk Satgas memakai kombinasi ECDH
          P-256 dan ML-KEM-768, supaya tetap aman bila komputer kuantum kelak ada.
        </li>
        <li>
          <strong>Sertifikat bukti</strong> mencatat sidik berkas dalam pohon Merkle harian. Siapa
          pun dapat memeriksanya, bahkan tanpa internet, lewat Paket Bukti.
        </li>
      </ul>
    </details>
  );
}

export function PendampingFold() {
  return (
    <details className="fold" id="pendamping">
      <summary>
        <h2>Pendamping di perangkat</h2>
        <span>6 bantuan</span>
      </summary>
      <p>
        Gema punya beberapa bantuan otomatis. Semuanya berjalan di perangkatmu. Tidak ada cerita,
        suara, atau chat yang dikirim ke layanan AI mana pun.
      </p>
      <ul>
        <li>
          <strong>Pahami dulu</strong>: mencocokkan ceritamu dengan bentuk kekerasan di
          Permendikbudristek 55/2024 (Pasal 7 dan Pasal 12). Pencocokan berbasis kata dan frasa,
          bukan model bahasa besar.
        </li>
        <li>
          <strong>Penanda pesan chat</strong>: menyorot pesan yang meminta dirahasiakan, menjanjikan
          nilai, mengancam, mengajak bertemu berdua, atau dikirim larut malam.
        </li>
        <li>
          <strong>Bicara saja</strong>: suara diubah jadi teks oleh model Whisper yang berjalan di
          peramban. Model pengenal suara perlu diunduh terlebih dahulu (dari Hugging Face atau
          server kampus) dan dapat digunakan kembali ketika tersedia di perangkat; rekamanmu tidak
          ikut terkirim.
        </li>
        <li>
          <strong>Pengingat kronologi</strong>: pertanyaan lembut bila waktu, tempat, atau saksi
          belum disebut. Boleh diabaikan.
        </li>
        <li>
          <strong>Ringkasan dosir untuk Satgas</strong>: kutipan pokok laporan dan draf surat,
          disusun dari isi laporan tanpa menambah fakta, dan selalu ditandai draf.
        </li>
        <li>
          <strong>Pembacaan nama</strong>: gelar dan sapaan dibuang sebelum nama disamarkan, dan
          &quot;Hendra W.&quot; dikenali sebagai kecocokan lemah dengan &quot;Hendra Wijaya&quot;.
        </li>
      </ul>
      <p className="small muted">
        Semua penanda bisa keliru: kata yang tidak umum bisa terlewat, dan kata umum bisa salah
        ditandai. Penanda tidak pernah menilai apakah ceritamu benar.
      </p>
    </details>
  );
}

export function BatasFold() {
  return (
    <details className="fold" id="batas">
      <summary>
        <h2>Batas jujur</h2>
        <span>8 batas</span>
      </summary>
      <ul>
        <li>
          <strong>Isi laporan bisa mengungkap identitas.</strong> Cerita, dokumen, tangkapan layar,
          tanggal, tempat, dan detail lain bisa menunjukkan siapa pelapor atau orang lain, walau
          Gema tidak meminta nama, email, atau telepon. Periksa apa yang kamu tulis dan unggah
          sebelum eskalasi, karena setelah itu Satgas dapat membacanya.
        </li>
        <li>
          <strong>Lupa kata sandi berarti isi hilang.</strong> Tidak ada tombol &ldquo;lupa
          sandi&rdquo; yang bisa dipakai siapa saja, dan itu disengaja. Satu-satunya jalan adalah
          pemulihan lewat dua orang tepercaya yang harus kamu siapkan sebelumnya di Pengaturan.
        </li>
        <li>
          <strong>Keluar Cepat</strong> menghapus draf dan sesi di perangkat ini lalu mengalihkan
          halaman. Laporan yang sudah tersimpan tetap aman di brankas. Ia tidak menghapus riwayat
          peramban yang sudah merekam kunjungan ke situs ini. Gunakan jendela privat bila perangkat
          dipakai bersama.
        </li>
        <li>
          <strong>Pencocokan hanya sebaik nama yang ditulis.</strong> Ejaan yang sangat berbeda atau
          nama panggilan bisa lolos. Pencocokan lemah ditandai sebagai lemah.
        </li>
        <li>
          <strong>Sertifikat tidak membuktikan kebenaran isi.</strong> Ia membuktikan berkas tidak
          berubah sejak waktu pengunggahan. Penerimaannya sebagai alat bukti ditentukan lembaga yang
          berwenang.
        </li>
        <li>
          <strong>Papan Akuntabilitas berderau.</strong> Angkanya sengaja sedikit tidak tepat untuk
          melindungi kasus tunggal.
        </li>
        <li>
          <strong>Mode cadangan (HMAC)</strong>, bila dipakai sebuah kampus, memberi perlindungan
          lebih lemah daripada OPRF dan diberi label jelas.
        </li>
        <li>
          <strong>Masih prototipe.</strong> Belum diaudit pihak independen. Jangan dipakai untuk
          kasus nyata sebelum ditinjau.
        </li>
      </ul>
    </details>
  );
}
