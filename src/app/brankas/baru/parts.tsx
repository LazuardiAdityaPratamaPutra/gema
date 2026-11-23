import { fmtBytes } from '@/lib/format';

/** Lampiran dari draf yang belum dipasang lagi. Isinya tidak ikut tersimpan, jadi harus dipilih ulang atau dilewati dengan sadar. */
export function MissingFiles({
  items,
  onPick,
  onSkip,
  tone,
}: {
  items: { nama: string; size: number }[];
  onPick: () => void;
  onSkip: (nama: string) => void;
  tone: 'warn' | 'alert';
}) {
  if (items.length === 0) return null;
  return (
    <section className={`card ${tone} small`} aria-labelledby="belum-terlampir">
      <h2 id="belum-terlampir" className="title-sm m-0">
        {items.length} berkas dari draf belum terlampir
      </h2>
      <p className="m-0">
        Isi berkas tidak ikut tersimpan di draf. Kalau kamu mengunci sekarang, berkas ini tidak akan
        ada di laporanmu.
      </p>
      <ul className="plain-list">
        {items.map((m) => (
          <li key={m.nama} className="row row-between">
            <span>
              <strong>{m.nama}</strong>{' '}
              <span className="muted">{fmtBytes(m.size)}, belum terlampir</span>
            </span>
            <button
              type="button"
              className="btn ghost sm"
              aria-label={`Lewati ${m.nama}, kunci tanpa berkas ini`}
              onClick={() => onSkip(m.nama)}
            >
              Lewati
            </button>
          </li>
        ))}
      </ul>
      <button type="button" className="btn teal sm" onClick={onPick}>
        Pilih ulang berkas
      </button>
    </section>
  );
}

/** Satu bagian tinjauan dengan tombol Ubah yang menyebut bagiannya untuk pembaca layar. */
export function ReviewPart({
  title,
  onEdit,
  editLabel,
  children,
}: {
  title: string;
  onEdit: () => void;
  editLabel: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card review-part sensitive">
      <div className="row row-between">
        <h2 className="title-sm m-0">{title}</h2>
        <button type="button" className="btn ghost sm" aria-label={editLabel} onClick={onEdit}>
          Ubah
        </button>
      </div>
      {children}
    </section>
  );
}
