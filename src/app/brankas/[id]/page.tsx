'use client';
import { useParams, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { LoadError } from '@/components/LoadError';
import { Rujukan } from '@/components/Rujukan';
import { useReporter } from '@/components/useReporter';
import { fmtBytes } from '@/lib/ui/format';
import { downloadEvidence, type ReportView } from '@/lib/vault/vault-client';
import {
  buildCertificatePdf,
  buildProofPackage,
  fetchCertificate,
  triggerDownload,
} from '@/lib/vault/proof';
import { MatchNote, NewBanner, ReportBody, ReportHeader } from './DetailParts';
import { EscalationPanel } from './EscalationPanel';
import { EvidenceList } from './EvidenceList';
import { ReportSettings } from './ReportSettings';
import { useReportDetail } from './useReportDetail';

function Detail() {
  const { id } = useParams<{ id: string }>();
  const isNew = useSearchParams().get('baru') === '1';
  const { session } = useReporter();
  const { r, plain, inst, msg, setMsg, busy, act, retry } = useReportDetail(session, id);

  if (session && !r && msg)
    return (
      <div className="narrow">
        <LoadError what="laporan ini" message={msg} onRetry={retry} />
      </div>
    );
  if (!session || !r || !plain)
    return (
      <div className="narrow">
        <p role="status">Membuka laporan…</p>
      </div>
    );
  const metaFor = (sha: string) => plain.meta.items.find((m) => m.sha256 === sha);

  async function cert(ev: ReportView['evidence'][number], kind: 'pdf' | 'html') {
    const m = metaFor(ev.sha256);
    const c = await fetchCertificate(ev.id);
    if (kind === 'pdf')
      triggerDownload(
        `sertifikat-${ev.id}.pdf`,
        await buildCertificatePdf(c, {
          namaBerkas: m?.nama ?? 'berkas',
          ukuran: fmtBytes(ev.ukuran),
          origin: location.origin,
        }),
        'application/pdf',
      );
    else triggerDownload(`paket-bukti-${ev.id}.html`, await buildProofPackage(c), 'text/html');
  }
  async function download(ev: ReportView['evidence'][number]) {
    const bytes = await downloadEvidence(session!, ev.id, plain!.dek);
    triggerDownload(metaFor(ev.sha256)?.nama ?? 'bukti', bytes);
  }

  const n = plain.narasi;
  return (
    <div className="wrap" style={{ maxWidth: 860 }}>
      {isNew && <NewBanner />}
      <ReportHeader r={r} narasi={n} />
      {msg && (
        <p className="card warn small" role="status">
          {msg}
        </p>
      )}
      <MatchNote match={r.match} />
      <ReportBody n={n} />
      <EvidenceList
        evidence={r.evidence}
        metaFor={metaFor}
        onCertificate={(ev, kind) => void cert(ev, kind)}
        onDownload={(ev) => void download(ev)}
      />
      <EscalationPanel
        session={session}
        r={r}
        dek={plain.dek}
        narasi={n}
        inst={inst}
        busy={busy}
        setMsg={setMsg}
        act={act}
      />
      <details className="help-fold" aria-label="Bantuan yang bisa kamu hubungi">
        <summary>
          <span>
            <b>Butuh bicara dengan seseorang?</b>
            <small>Psikolog, bantuan hukum, SAPA 129. Tidak perlu menunggu Satgas.</small>
          </span>
        </summary>
        <Rujukan kampus={inst?.rujukan} namaKampus={inst?.nama} />
      </details>
      <ReportSettings session={session} r={r} busy={busy} act={act} />
    </div>
  );
}

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="narrow">
          <p role="status">Membuka…</p>
        </div>
      }
    >
      <Detail />
    </Suspense>
  );
}
