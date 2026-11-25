import Link from 'next/link';
import { ApprovalGate } from '@/components/ApprovalGate';
import { HeaderPhoto } from '@/components/HeaderPhoto';
import { Rujukan } from '@/components/Rujukan';
import { SatgasBar } from '@/components/SatgasBar';
import { VeilBar } from '@/components/Veil';
import type { Narasi } from '@/lib/laporan/report-format';
import type { SatgasSession } from '@/lib/store';
import { fmtDateTime } from '@/lib/ui/format';
import type { InstitutionInfo } from '@/lib/vault/vault-client';
import { RELASI_LABEL } from '@gema/pendamping';
import type { Detail } from './dosir';

/** Kepala halaman: foto, bilah Satgas, tautan kembali, dan judul. */
export function Head({
  session,
  title,
  children,
}: {
  session: SatgasSession;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="ph ph-foto">
      <HeaderPhoto />
      <SatgasBar s={session} />
      <Link href="/satgas" className="back">
        Kembali ke daftar kasus
      </Link>
      <h1>{title}</h1>
      {children}
    </header>
  );
}

/** Tampilan saat dosir menunggu persetujuan anggota lain. */
export function LockedDosir({
  session,
  id,
  onApproved,
}: {
  session: SatgasSession;
  id: string;
  onApproved: () => void;
}) {
  return (
    <div className="wrap">
      <Head session={session} title="Dosir terkunci" />
      <ApprovalGate session={session} caseId={id} onApproved={onApproved} />
    </div>
  );
}

/** Judul kasus dengan status, tenggat, dan penanda keterlambatan atau prioritas. */
export function DosirHeader({ session, d }: { session: SatgasSession; d: Detail }) {
  const { escalation, sla, report } = d;
  return (
    <Head session={session} title={escalation.alias}>
      <p className="muted">
        {report.unitNama}, {escalation.sumber}, status{' '}
        <strong style={{ color: 'inherit' }}>{escalation.status}</strong>, tenggat{' '}
        {fmtDateTime(sla.due)}
        {sla.terlambat && (
          <>
            {' '}
            <span className="pill rose">Terlambat T{sla.tingkat}</span>
          </>
        )}
        {escalation.prioritas && (
          <>
            {' '}
            <span className="pill prio">Prioritas, relasi kuasa</span>
          </>
        )}
      </p>
    </Head>
  );
}

/** Kelompok laporan yang cocok dengan kasus ini; kosong bila hanya satu. */
export function ClusterNote({ cluster }: { cluster: Detail['cluster'] }) {
  if (cluster.total <= 1) return null;
  return (
    <p className="card tint">
      Laporan ini bagian dari kelompok {cluster.total} laporan yang cocok ({cluster.tereskalasi}{' '}
      tereskalasi, {cluster.tersegel} masih tersegel dan tidak terbaca oleh siapa pun selain
      pelapornya).
    </p>
  );
}

/** Isi laporan yang sudah didekripsi, dengan tabir penutup bawaan. */
export function LaporanCard({ narasi }: { narasi: Narasi }) {
  const { terlapor } = narasi;
  return (
    <>
      <VeilBar defaultOn what="Isi laporan dan bukti" />
      <section className="card my-lg sensitive">
        <h2 className="title-md">Laporan</h2>
        <p>
          <strong>Terlapor:</strong> {terlapor.nama} ({terlapor.peran})
          {terlapor.relasi && (
            <>
              , <strong>Relasi:</strong> {RELASI_LABEL[terlapor.relasi]}
            </>
          )}
        </p>
        <p style={{ whiteSpace: 'pre-wrap' }}>{narasi.apa}</p>
        <p className="muted small">
          {[narasi.kapan, narasi.dimana]
            .filter(Boolean)
            .map((x) => x.trim().replace(/[.,]$/, ''))
            .join(', ')}
        </p>
      </section>
    </>
  );
}

/** Daftar rujukan layanan yang bisa disampaikan Satgas kepada pelapor. */
export function RujukanCard({ inst }: { inst: InstitutionInfo | null }) {
  return (
    <section className="card my-lg" aria-labelledby="rjk">
      <h2 className="title-sm" id="rjk">
        Rujukan untuk pelapor
      </h2>
      <p className="hint">
        Sampaikan pilihan ini saat menghubungi pelapor. Layanan kampus diatur Ketua Satgas.
      </p>
      <Rujukan kampus={inst?.rujukan} namaKampus={inst?.nama} compact />
    </section>
  );
}
