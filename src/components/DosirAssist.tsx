'use client';
import { useMemo, useState } from 'react';
import { drafts, summarize, type DosirInput } from '@gema/pendamping';

/** Ringkasan otomatis dan draf dokumen untuk Satgas. Dihitung di perangkat Satgas setelah dosir didekripsi. */
export function DosirAssist({ alias, input }: { alias: string; input: DosirInput }) {
  const r = useMemo(() => summarize(input), [input]);
  const tanggal = useMemo(
    () =>
      new Intl.DateTimeFormat('id-ID', { dateStyle: 'long', timeZone: 'Asia/Jakarta' }).format(
        new Date(),
      ),
    [],
  );
  const ds = useMemo(() => drafts(alias, input, r, tanggal), [alias, input, r, tanggal]);
  const [open, setOpen] = useState<number | null>(null);
  const [copied, setCopied] = useState<number | null>(null);
  const [texts, setTexts] = useState<Record<number, string>>({});
  return (
    <section className="assist" aria-labelledby="ringkas">
      <div className="assist-head">
        <h2 id="ringkas">Ringkasan otomatis</h2>
        <span className="draft-badge">Draf otomatis. Periksa sebelum dipakai.</span>
      </div>
      {r.perhatian.length > 0 && (
        <ul className="perhatian">
          {r.perhatian.map((p) => (
            <li key={p}>
              <mark>{p}</mark>
            </li>
          ))}
        </ul>
      )}
      <div className="assist-grid">
        <dl className="fakta">
          {r.fakta.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
        <div>
          <p className="label" style={{ marginBottom: '.3rem' }}>
            Pokok laporan
          </p>
          {r.inti.map((s) => (
            <blockquote key={s}>{s}</blockquote>
          ))}
          {r.bentuk.length > 0 && (
            <>
              <p className="label" style={{ margin: '1rem 0 .3rem' }}>
                Bentuk yang perlu ditelaah
              </p>
              <ul className="bentuk-mini">
                {r.bentuk.map((b) => (
                  <li key={b.form.id}>
                    <b>{b.form.label}</b> <small>{b.form.pasal}</small>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
      <p className="label" style={{ margin: '1.4rem 0 .5rem' }}>
        Draf dokumen
      </p>
      <div className="drafts">
        {ds.map((d, i) => (
          <div key={d.judul} className="draft" data-open={open === i}>
            <button
              type="button"
              className="draft-toggle"
              aria-expanded={open === i}
              onClick={() => setOpen(open === i ? null : i)}
            >
              {d.judul}
              <span aria-hidden="true">{open === i ? '–' : '+'}</span>
            </button>
            {open === i && (
              <div className="draft-body">
                <textarea
                  aria-label={d.judul}
                  rows={12}
                  value={texts[i] ?? d.isi}
                  onChange={(e) => setTexts((t) => ({ ...t, [i]: e.target.value }))}
                />
                <div className="row">
                  <button
                    type="button"
                    className="btn ghost sm"
                    onClick={() => {
                      void navigator.clipboard.writeText(texts[i] ?? d.isi).then(() => {
                        setCopied(i);
                        setTimeout(() => setCopied(null), 1800);
                      });
                    }}
                  >
                    {copied === i ? 'Tersalin' : 'Salin teks'}
                  </button>
                  <span className="small muted">
                    Disusun dari isi laporan, tidak menambah fakta. Ganti bagian [isi].
                  </span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
