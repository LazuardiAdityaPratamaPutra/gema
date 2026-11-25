import { useState } from 'react';
import { formatCaseCode } from '@gema/crypto';
import { island } from '@/lib/ui/island-bus';
import { SkeletonLines } from '@/components/Skeleton';
import { buildRecoveryCard, triggerDownload } from '@/lib/vault/proof';

export type Cred = { caseCode: string; passphrase: string };

/** Kode Kasus dan enam kata sandi yang baru dibuat; atau keterangan sedang disiapkan. */
export function CredentialCard({ cred }: { cred: Cred | null }) {
  return (
    <div className={cred ? 'card' : 'card cred-wait'} aria-live="polite">
      {!cred ? (
        <SkeletonLines label="Menyiapkan kunci" />
      ) : (
        <>
          <div className="field">
            <span className="label">Kode</span>
            <code className="hash title-md">{formatCaseCode(cred.caseCode)}</code>
          </div>
          <div className="field mb-0">
            <span className="label">Kata sandi (6 kata)</span>
            <ol
              style={{
                margin: 0,
                paddingLeft: '1.4rem',
                columns: '2 160px',
                fontFamily: 'var(--mono)',
              }}
            >
              {cred.passphrase.split(' ').map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ol>
          </div>
        </>
      )}
    </div>
  );
}

/** Unduh kartu cetak atau salin kode dan kata sandi untuk disimpan pelapor. */
export function CredentialActions({ cred }: { cred: Cred | null }) {
  const [copied, setCopied] = useState(false);
  return (
    <>
      <div className="row my-md">
        <button
          className="btn ghost sm"
          type="button"
          disabled={!cred}
          onClick={async () =>
            cred &&
            triggerDownload(
              'kartu-catatan.pdf',
              await buildRecoveryCard(cred.caseCode, cred.passphrase, location.origin),
              'application/pdf',
            )
          }
        >
          Unduh kartu cetak (PDF)
        </button>
        <button
          className="btn ghost sm"
          type="button"
          disabled={!cred}
          data-done={copied}
          onClick={() =>
            cred &&
            void navigator.clipboard
              ?.writeText(`${formatCaseCode(cred.caseCode)}\n${cred.passphrase}`)
              .then(
                () => {
                  island.toast('Kode dan kata sandi disalin');
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2200);
                },
                () => island.toast('Gagal menyalin, catat manual'),
              )
          }
        >
          {copied ? 'Tersalin' : 'Salin'}
        </button>
      </div>
      <p className="small muted">
        Kartu cetak berjudul netral, &quot;Kartu catatan pribadi&quot;, agar tidak menarik perhatian
        bila ditemukan orang lain.
      </p>
    </>
  );
}
