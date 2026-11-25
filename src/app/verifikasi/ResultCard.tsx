import Link from 'next/link';
import { CERT_STATEMENT } from '@gema/merkle';
import { Term } from '@/components/Term';
import { fmtBytes, shortHash } from '@/lib/ui/format';
import type { Result } from './cek';

export function ResultCard({ res, onReset }: { res: Result; onReset: () => void }) {
  return (
    <section
      className={`card hasil-cek ${res.ok ? 'tint' : 'alert'}`}
      role="status"
      aria-live="polite"
    >
      <div className="integrity" data-ok={res.ok}>
        <h2 className="title-md">{res.ok ? 'Utuh dan tercatat' : 'Tidak cocok'}</h2>
        <span>{res.detail}</span>
      </div>
      {!res.ok && (
        <p className="small">
          Tidak cocok belum berarti buktimu hilang. Ada dua kemungkinan: berkas yang kamu pilih
          bukan versi aslinya (misalnya sudah dikompres, dipotong, atau diekspor ulang), atau isinya
          memang berubah. Catatan di Gema tidak terpengaruh. Coba berkas aslinya.
        </p>
      )}
      <p className="small muted">
        {res.name}, {fmtBytes(res.size)}
      </p>
      <code className="hash">{res.fileHash}</code>
      {res.cert?.anchor && (
        <p className="small" style={{ marginTop: '.8rem' }}>
          <Term k="akar">Akar harian</Term> {res.cert.anchor.date}:{' '}
          <code>{shortHash(res.cert.anchor.root)}</code>
        </p>
      )}
      <p className="small muted mt-md">{CERT_STATEMENT}</p>
      <div className="row mt-md">
        <button type="button" className="btn ghost sm" onClick={onReset}>
          Periksa berkas lain
        </button>
        {!res.ok && (
          <Link href="/mulai" className="btn teal sm">
            Simpan bukti dengan sertifikat
          </Link>
        )}
      </div>
    </section>
  );
}
