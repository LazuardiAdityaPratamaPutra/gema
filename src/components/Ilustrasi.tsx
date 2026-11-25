/**
 * Ilustrasi abstrak untuk kepala halaman dan keadaan kosong. Tanpa wajah atau orang.
 * Hanya hiasan (`aria-hidden`); maknanya sudah ada di teks halaman. Warna mengikuti `currentColor`.
 */
export type Motif = 'brankas' | 'pahami' | 'panduan' | 'papan' | 'verifikasi';

const LINE = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 3,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

const SOFT = { ...LINE, fill: 'currentColor', fillOpacity: 0.16 } as const;
const MID = { ...LINE, fill: 'currentColor', fillOpacity: 0.3 } as const;

/** Brankas bergembok: tempat yang hanya bisa dibuka pemiliknya. */
function Brankas() {
  return (
    <>
      <path {...LINE} d="M56 52V40a24 24 0 0 1 48 0v12" />
      <rect {...SOFT} x="36" y="52" width="88" height="56" rx="10" />
      <circle cx="80" cy="76" r="8" fill="currentColor" />
      <path {...LINE} strokeWidth={5} d="M80 82v12" />
    </>
  );
}

/** Dua balon percakapan: bercerita dengan kata-kata sendiri. */
function Pahami() {
  return (
    <>
      <path
        {...SOFT}
        d="M32 18h56a14 14 0 0 1 14 14v26a14 14 0 0 1-14 14H52L36 86V72h-4a14 14 0 0 1-14-14V32a14 14 0 0 1 14-14z"
      />
      <circle cx="44" cy="45" r="4" fill="currentColor" />
      <circle cx="60" cy="45" r="4" fill="currentColor" />
      <circle cx="76" cy="45" r="4" fill="currentColor" />
      <path
        {...MID}
        d="M78 60h54a14 14 0 0 1 14 14v18a14 14 0 0 1-14 14h-4v12l-16-12H78a14 14 0 0 1-14-14V74a14 14 0 0 1 14-14z"
      />
      <path {...LINE} d="M80 78h42M80 92h28" />
    </>
  );
}

/** Jalur dengan tiga titik: ke mana bisa meminta bantuan. */
function Panduan() {
  return (
    <>
      <path {...LINE} d="M24 94C54 94 50 42 80 42s26 46 54 24" strokeDasharray="1 9" />
      <circle {...SOFT} cx="24" cy="94" r="10" />
      <circle {...SOFT} cx="80" cy="42" r="10" />
      <circle {...LINE} cx="134" cy="66" r="14" />
      <circle cx="134" cy="66" r="5" fill="currentColor" />
    </>
  );
}

/** Batang dengan garis tenggat: ketepatan waktu penanganan. */
function Papan() {
  return (
    <>
      <path {...LINE} d="M14 106h132" />
      <path {...LINE} d="M14 52h132" strokeDasharray="6 7" strokeWidth={2} />
      <rect {...SOFT} x="26" y="72" width="20" height="34" rx="4" />
      <rect {...MID} x="54" y="54" width="20" height="52" rx="4" />
      <rect {...SOFT} x="82" y="64" width="20" height="42" rx="4" />
      <rect {...MID} x="110" y="36" width="20" height="70" rx="4" />
    </>
  );
}

/** Tiga blok bertaut: rantai catatan yang tidak bisa disisipi diam-diam. */
function Verifikasi() {
  return (
    <>
      <rect {...SOFT} x="12" y="42" width="38" height="38" rx="9" />
      <rect {...SOFT} x="61" y="42" width="38" height="38" rx="9" />
      <rect {...MID} x="110" y="42" width="38" height="38" rx="9" />
      <path {...LINE} d="M50 61h11M99 61h11" />
      <path {...LINE} strokeWidth={4} d="M120 61l8 8 12-15" />
    </>
  );
}

const MOTIF: Record<Motif, () => React.JSX.Element> = {
  brankas: Brankas,
  pahami: Pahami,
  panduan: Panduan,
  papan: Papan,
  verifikasi: Verifikasi,
};

export function Ilustrasi({ motif }: { motif: Motif }) {
  const Gambar = MOTIF[motif];
  return (
    <svg className="ill" viewBox="0 0 160 120" aria-hidden="true" focusable="false">
      <Gambar />
    </svg>
  );
}
