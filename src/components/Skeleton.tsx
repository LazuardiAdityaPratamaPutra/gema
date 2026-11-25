/** Kerangka tampilan selagi data dimuat: bentuknya meniru isi akhir agar halaman tidak melompat. */

function Bar({ w, h, className }: { w?: string; h?: string; className?: string }) {
  return (
    <span
      className={`sk ${className ?? ''}`}
      style={{ width: w ?? '100%', height: h ?? '0.9rem' }}
      aria-hidden="true"
    />
  );
}

/** Pembungkus: satu pengumuman untuk pembaca layar, isi kerangka disembunyikan darinya. */
function Wrap({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className} role="status" aria-busy="true">
      <span className="sr">{label}</span>
      {children}
    </div>
  );
}

/** Kartu kampus di Papan. */
export function SkeletonCampusCards({ n = 3 }: { n?: number }) {
  return (
    <>
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="card sk-card" aria-hidden="true">
          <Bar w="62%" h="1.3rem" />
          <Bar w="30%" h="1.4rem" className="sk-pill" />
          <Bar w="40%" />
          <div className="sk-rows">
            <Bar h="2.4rem" />
            <Bar h="2.4rem" />
            <Bar h="2.4rem" />
          </div>
        </div>
      ))}
    </>
  );
}

/** Berkas laporan di brankas. */
export function SkeletonFiles({
  n = 2,
  label = 'Memuat laporanmu',
}: {
  n?: number;
  label?: string;
}) {
  return (
    <Wrap label={label} className="sk-files">
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="sk-file" aria-hidden="true">
          <Bar w="7rem" h="1.4rem" className="sk-tab" />
          <div className="sk-file-body">
            <Bar w="5rem" h="3.2rem" />
            <div className="sk-file-main">
              <Bar w="9rem" h="0.8rem" />
              <Bar w="55%" h="1.4rem" />
              <Bar w="38%" />
            </div>
            <Bar w="30%" h="3rem" />
          </div>
        </div>
      ))}
    </Wrap>
  );
}

/** Halaman yang menunggu sesi atau isi: judul, kalimat pengantar, dan satu kartu. */
export function SkeletonPage({ label = 'Memuat halaman' }: { label?: string }) {
  return (
    <Wrap label={label} className="sk-page">
      <Bar w="55%" h="2.6rem" />
      <Bar w="80%" />
      <Bar w="64%" />
      <div className="card sk-card" aria-hidden="true">
        <Bar w="40%" h="1.2rem" />
        <Bar />
        <Bar w="90%" />
      </div>
    </Wrap>
  );
}

/** Dua baris isi kartu kecil, mis. kunci yang sedang dibuat. */
export function SkeletonLines({ label, n = 3 }: { label: string; n?: number }) {
  return (
    <Wrap label={label} className="sk-lines">
      {Array.from({ length: n }, (_, i) => (
        <Bar
          key={i}
          w={i === 0 ? '100%' : i === n - 1 ? '46%' : '82%'}
          h={i === 0 ? '2.6rem' : '1rem'}
        />
      ))}
    </Wrap>
  );
}

/** Tabel di halaman Satgas: kepala dan beberapa baris, dalam kartu yang sama dengan tabel asli. */
export function SkeletonTable({ rows = 4, label }: { rows?: number; label: string }) {
  return (
    <Wrap label={label} className="card sk-table">
      <Bar h="2.2rem" />
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="sk-trow" aria-hidden="true">
          <Bar w="70%" h="1.1rem" />
          <Bar w="55%" />
          <Bar w="62%" />
          <Bar w="48%" />
        </div>
      ))}
    </Wrap>
  );
}
