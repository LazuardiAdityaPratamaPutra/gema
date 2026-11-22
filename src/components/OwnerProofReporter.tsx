'use client';
import { useState } from 'react';
import type { ReporterSession } from '@/lib/store';
import { makeOwnerProof, type ReportView } from '@/lib/vault-client';

/** Pelapor membuktikan ia pemilik laporan kepada Satgas tanpa membuka identitas atau isi. */
export function OwnerProofReporter({
  session,
  report,
  dek,
  alias,
}: {
  session: ReporterSession;
  report: ReportView;
  dek: Uint8Array;
  alias: string;
}) {
  const [challenge, setChallenge] = useState('');
  const [proof, setProof] = useState('');
  const [err, setErr] = useState('');
  const [copied, setCopied] = useState(false);

  async function make() {
    setErr('');
    setProof('');
    setCopied(false);
    try {
      setProof(await makeOwnerProof(session, report, dek, alias, challenge));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Gagal membuat bukti.');
    }
  }

  return (
    <details className="help-fold" aria-label="Buktikan aku pelapor kasus ini">
      <summary>
        <span>
          <b>Satgas menghubungimu dan ingin memastikan?</b>
          <small>Buktikan kamu pemilik laporan ini tanpa membuka identitas.</small>
        </span>
      </summary>
      <p>
        Minta Satgas membuat <strong>tantangan</strong> di halaman kasus, lalu tempel di sini. Gema
        membuat bukti matematis bahwa kamu memegang kunci laporan ini. Bukti hanya berlaku untuk
        tantangan itu, sekali pakai, dan tidak memuat kunci, nama, atau isi laporan.
      </p>
      <div className="field">
        <label htmlFor="tantangan">Tantangan dari Satgas</label>
        <input
          id="tantangan"
          value={challenge}
          onChange={(e) => setChallenge(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          className="mono"
        />
      </div>
      <button className="btn ghost" disabled={!challenge.trim()} onClick={() => void make()}>
        Buat bukti
      </button>
      {err && (
        <p className="err" role="alert">
          {err}
        </p>
      )}
      {proof && (
        <div className="my-md">
          <p className="small muted m-0">
            Kirim teks ini ke Satgas (jalur yang sama dengan tantangan):
          </p>
          <code className="share">{proof}</code>
          <button
            className="btn ghost sm mt-sm"
            onClick={() => void navigator.clipboard?.writeText(proof).then(() => setCopied(true))}
          >
            {copied ? 'Tersalin' : 'Salin bukti'}
          </button>
        </div>
      )}
    </details>
  );
}
