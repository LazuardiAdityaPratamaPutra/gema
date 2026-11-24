import { ChatSignals } from '@/components/ChatSignals';
import { Term } from '@/components/Term';
import { fmtBytes, fmtDateTime, shortHash } from '@/lib/ui/format';
import type { BuktiMeta } from '@/lib/laporan/report-format';
import type { ReportView } from '@/lib/vault/vault-client';

type Evidence = ReportView['evidence'][number];

type Props = {
  evidence: Evidence[];
  metaFor: (sha: string) => BuktiMeta['items'][number] | undefined;
  onCertificate: (ev: Evidence, kind: 'pdf' | 'html') => void;
  onDownload: (ev: Evidence) => void;
};

/** Daftar bukti beserta tombol sertifikat, Paket Bukti, dan unduh berkas asli. */
export function EvidenceList({ evidence, metaFor, onCertificate, onDownload }: Props) {
  return (
    <section className="my-xl sensitive" aria-labelledby="bukti">
      <h2 className="title-md" id="bukti">
        Bukti dan sertifikat
      </h2>
      {evidence.length === 0 && <p className="muted">Belum ada berkas.</p>}
      {evidence.map((ev) => {
        const m = metaFor(ev.sha256);
        return (
          <article key={ev.id} className="card" style={{ marginBottom: '1rem' }}>
            <div className="row row-between">
              <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{m?.nama ?? 'Berkas'}</h3>
              <span className={`pill ${ev.anchored ? 'teal' : 'amber'}`}>
                {ev.anchored ? (
                  <>
                    <Term k="akar">Akar harian</Term> terbit
                  </>
                ) : (
                  <>
                    Menunggu <Term k="akar">akar harian</Term>
                  </>
                )}
              </span>
            </div>
            <p className="small muted" style={{ margin: '.3rem 0 .6rem' }}>
              {fmtBytes(ev.ukuran)}, diunggah {fmtDateTime(ev.uploadedAt)}
              {ev.messageCount ? `, ${ev.messageCount} pesan tercatat` : ''}
            </p>
            <code className="hash" title={ev.sha256}>
              {shortHash(ev.sha256, 16)}
            </code>
            {m?.messages?.length ? <ChatSignals messages={m.messages} /> : null}
            <div className="row" style={{ marginTop: '.8rem' }}>
              <button className="btn ghost sm" onClick={() => onCertificate(ev, 'pdf')}>
                Sertifikat (PDF)
              </button>
              <button className="btn ghost sm" onClick={() => onCertificate(ev, 'html')}>
                Paket Bukti (HTML offline)
              </button>
              <button className="btn ghost sm" onClick={() => onDownload(ev)}>
                Unduh berkas asli
              </button>
            </div>
          </article>
        );
      })}
      <p className="small muted">
        Sertifikat membuktikan berkas tidak berubah sejak waktu pengunggahan. Ia tidak membuktikan
        bahwa isi berkas benar.
      </p>
    </section>
  );
}
