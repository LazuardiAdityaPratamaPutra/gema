import Link from 'next/link';
import { count, fmtWhen } from '@/lib/ui/format';
import type { ReportView } from '@/lib/vault/vault-client';
import { fileStatus, type Tone } from './status';

const TAB: Record<Tone, string> = {
  saved: 'Disimpan',
  esc: 'Di Satgas',
  late: 'Satgas terlambat',
  done: 'Selesai',
};
const TAHAP = ['Disimpan', 'Di Satgas', 'Selesai'];
const TAHAP_ARIA = ['disimpan', 'di Satgas', 'selesai'];

/** Satu berkas laporan di daftar brankas: tab status, jejak tahap, dan petunjuk langkah berikutnya. */
export function FileCard({ r }: { r: ReportView }) {
  const { step, tone, next } = fileStatus(r);
  return (
    <li data-tone={tone}>
      <span className="file-tab">{TAB[tone]}</span>
      <Link href={`/brankas/${r.id}`} className="file">
        <ol className="track" aria-label={`Tahap: ${TAHAP_ARIA[step]}`}>
          {TAHAP.map((l, i) => (
            <li key={l} data-on={i <= step} aria-current={i === step ? 'step' : undefined}>
              <span />
              {l}
            </li>
          ))}
        </ol>
        <div className="file-main">
          <p className="file-meta">
            {fmtWhen(r.createdAt)}, {count(r.evidence.length, { other: 'bukti' })}
            {r.escalation ? `, ${r.escalation.alias}` : ''}
          </p>
          <h2>{r.unitNama}</h2>
          <p className="file-inst">{r.institutionNama}</p>
          <p className="file-trust">
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
              <rect
                x="3"
                y="7"
                width="10"
                height="7"
                rx="1.6"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <path
                d="M5.5 7V5.2a2.5 2.5 0 0 1 5 0V7"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              />
            </svg>
            Terenkripsi di perangkatmu sebelum disimpan
          </p>
        </div>
        <div className="file-next">
          <b>{next.t}</b>
          <small>{next.s}</small>
        </div>
      </Link>
    </li>
  );
}
