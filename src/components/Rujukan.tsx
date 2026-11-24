import { JENIS_LABEL, NASIONAL, type RujukanKampus } from '@/lib/ui/rujukan';

/** Direktori rujukan: layanan kampus (bila ada) lalu layanan nasional. */
export function Rujukan({
  kampus = [],
  namaKampus,
  compact = false,
}: {
  kampus?: RujukanKampus[];
  namaKampus?: string;
  compact?: boolean;
}) {
  return (
    <div className="rujukan">
      {kampus.length > 0 && (
        <>
          <p className="rj-head">Di {namaKampus ?? 'kampus'}</p>
          <ul>
            {kampus.map((k) => (
              <li key={k.nama}>
                <span className="rj-tag">{JENIS_LABEL[k.jenis]}</span>
                <b>{k.nama}</b>
                <small>
                  {k.kontak}
                  {k.catatan ? `, ${k.catatan}` : ''}
                </small>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="rj-head">Layanan nasional</p>
      <ul>
        {NASIONAL.slice(0, compact ? 3 : undefined).map((l) => (
          <li key={l.nama}>
            <b>{l.nama}</b>
            <small>
              {l.untuk}
              {l.jam ? `, ${l.jam}` : ''}
            </small>
            <span className="rj-links">
              {l.kontak.map((c) =>
                c.href ? (
                  <a key={c.label} href={c.href} rel="noreferrer">
                    {c.label}
                  </a>
                ) : (
                  <span key={c.label}>{c.label}</span>
                ),
              )}
            </span>
          </li>
        ))}
      </ul>
      <p className="small muted" style={{ margin: '.6rem 0 0' }}>
        Nomor diperiksa November 2026. Pastikan lagi di situs resmi layanan sebelum menghubungi.
      </p>
    </div>
  );
}
