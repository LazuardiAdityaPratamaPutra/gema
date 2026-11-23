'use client';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { useReporter } from '@/components/useReporter';
import type { ReporterSession } from '@/lib/store';
import { api } from '@/lib/api';
import {
  downloadEvidence,
  listReports,
  openReport,
  type InstitutionInfo,
  type ReportView,
} from '@/lib/vault-client';
import type { BuktiMeta, Narasi } from '@/lib/report-format';
import { Rujukan } from '@/components/Rujukan';
import {
  buildCertificatePdf,
  buildProofPackage,
  fetchCertificate,
  triggerDownload,
} from '@/lib/proof';
import { fmtBytes, fmtDate } from '@/lib/format';
import { EscalationPanel } from './EscalationPanel';
import { EvidenceList } from './EvidenceList';
import { ReportSettings } from './ReportSettings';
import { LoadError } from '@/components/LoadError';
import { VeilBar } from '@/components/Veil';

type Plain = { dek: Uint8Array; narasi: Narasi; meta: BuktiMeta };
type Loaded = 'hilang' | { report: ReportView; plain: Plain; inst: InstitutionInfo | null };

/** Mengambil laporan lalu membukanya dengan kunci di perangkat ini. Tanpa efek samping pada state. */
async function fetchReport(session: ReporterSession, id: string): Promise<Loaded> {
  const report = (await listReports(session)).find((x) => x.id === id);
  if (!report) return 'hilang';
  const plain = await openReport(session, report);
  const institutions = await api<InstitutionInfo[]>('public/institutions');
  return { report, plain, inst: institutions.find((i) => i.id === report.institutionId) ?? null };
}

function Detail() {
  const { id } = useParams<{ id: string }>();
  const isNew = useSearchParams().get('baru') === '1';
  const router = useRouter();
  const { session } = useReporter();
  const [r, setR] = useState<ReportView | null>(null);
  const [plain, setPlain] = useState<Plain | null>(null);
  const [inst, setInst] = useState<InstitutionInfo | null>(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const apply = useCallback(
    (l: Loaded) => {
      if (l === 'hilang') {
        router.replace('/brankas');
        return;
      }
      setR(l.report);
      setPlain(l.plain);
      setInst(l.inst);
    },
    [router],
  );
  const load = useCallback(async () => {
    if (session) apply(await fetchReport(session, id));
  }, [session, id, apply]);
  useEffect(() => {
    if (!session) return;
    fetchReport(session, id)
      .then(apply)
      .catch((e) => setMsg(e.message));
  }, [session, id, apply]);

  if (session && !r && msg)
    return (
      <div className="narrow">
        <LoadError
          what="laporan ini"
          message={msg}
          onRetry={() => {
            setMsg('');
            fetchReport(session, id)
              .then(apply)
              .catch((e) => setMsg(e.message));
          }}
        />
      </div>
    );
  if (!session || !r || !plain)
    return (
      <div className="narrow">
        <p role="status">Membuka laporan…</p>
      </div>
    );
  const act = async (fn: () => Promise<unknown>, ok: string, onDone?: () => void) => {
    setBusy(true);
    setMsg('');
    try {
      await fn();
      await load();
      setMsg(ok);
      onDone?.();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Gagal.');
    }
    setBusy(false);
  };
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
      {isNew && (
        <div className="card tint" role="status" style={{ marginBottom: '1.5rem' }}>
          <strong>Tersimpan dan terkunci.</strong> Hanya kamu yang bisa membacanya. Tidak ada yang
          dikirim ke Satgas.
        </div>
      )}
      <header className="ph">
        <Link href="/brankas" className="back">
          Kembali ke Brankasmu
        </Link>
        <h1>{r.institutionNama}</h1>
        <p className="muted">
          {r.unitNama}, dibuat {fmtDate(r.createdAt)}, terlapor:{' '}
          <strong style={{ color: 'inherit' }}>{n.terlapor.nama}</strong>
        </p>
      </header>
      {msg && (
        <p className="card warn small" role="status">
          {msg}
        </p>
      )}

      {r.match.notify && (
        <section className="card my-lg" aria-labelledby="pola">
          <h2 className="title-md" id="pola">
            Ada pola yang cocok
          </h2>
          <p>
            Terlapor ini tampaknya juga muncul dalam laporan lain di kampus yang sama (kelompok{' '}
            {r.match.size} laporan, keyakinan <strong>{r.match.confidence}</strong>
            {r.match.weak ? `, ${r.match.weak} kecocokan lemah` : ''}). Kamu tidak melihat siapa
            mereka, dan mereka tidak melihatmu.
          </p>
          <p className="small muted">
            Keyakinan menunjukkan seberapa banyak penanda yang sama (nama terlapor, ditambah peran,
            periode, atau tempat bila diisi). Ini petunjuk, bukan kepastian dan bukan tuduhan, dan
            tidak menunjukkan seberapa benar atau berat kejadiannya.
          </p>
          {r.match.flagFast && (
            <p className="small">
              Jarak antar laporan ini pendek, sehingga ditandai untuk perhatian lebih cepat bila
              dieskalasi.
            </p>
          )}
        </section>
      )}

      <VeilBar defaultOn what="Isi laporan dan bukti" />
      <section aria-labelledby="isi" className="card my-lg sensitive">
        <h2 className="title-md" id="isi">
          Isi laporan
        </h2>
        <dl style={{ margin: 0, display: 'grid', gap: '.9rem' }}>
          {(
            [
              ['Kejadian', n.apa],
              ['Kapan', n.kapan],
              ['Di mana', n.dimana],
              ['Saksi', n.saksi],
              ['Dampak', n.dampak],
              ['Catatan bukti', n.bukti],
            ] as const
          )
            .filter(([, v]) => v)
            .map(([k, v]) => (
              <div key={k}>
                <dt className="label mb-0">{k}</dt>
                <dd style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{v}</dd>
              </div>
            ))}
        </dl>
      </section>

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
