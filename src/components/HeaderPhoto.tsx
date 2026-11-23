import Image from 'next/image';

/** Foto dekoratif di belakang kepala halaman Satgas. Teks di atasnya diatur oleh `.ph-foto`. */
export function HeaderPhoto() {
  return (
    <Image
      src="/gambar/gedung-satgas.jpg"
      alt=""
      fill
      sizes="(min-width: 75em) 1180px, 100vw"
      quality={70}
      className="ph-bg"
    />
  );
}
