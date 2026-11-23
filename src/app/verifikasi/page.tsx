'use client';
import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { sha256Async, toHex } from '@gema/crypto';
import { CERT_STATEMENT, verifyCertificate, type EvidenceCertificate } from '@gema/merkle';
import { api } from '@/lib/api';
import { fetchCertificate } from '@/lib/proof';
import { fmtBytes, shortHash } from '@/lib/format';
import { Term } from '@/components/Term';

type Result = {
  cert: EvidenceCertificate | null;
  fileHash: string;
  ok: boolean;
  detail: string;
  name: string;
  size: number;
};

function Verifikasi() {
  const qid = useSearchParams().get('id');
  const [cert, setCert] = useState<EvidenceCertificate | null>(null);
  const [res, setRes] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (qid)
      fetchCertificate(qid)
        .then(setCert)
        .catch(() => setError('ID bukti tidak ditemukan.'));
  }, [qid]);

  async function check(f: File | undefined) {
    if (!f) return;
    setBusy(true);
    setError('');
    setRes(null);
    try {
      const hash = toHex(await sha256Async(new Uint8Array(await f.arrayBuffer())));
      let c = cert;
      if (!c) {
        const r = await api<{ found: boolean; proof?: Omit<EvidenceCertificate, 'statement'> }>(
          `public/lookup/${hash}`,
        );
        if (r.found && r.proof) c = { ...r.proof, statement: CERT_STATEMENT };
      }
      if (!c)
        setRes({
          cert: null,
          fileHash: hash,
          ok: false,
          detail:
            'Tidak ada catatan untuk berkas ini. Berkas mungkin belum pernah diunggah ke Gema, atau sudah berubah satu bit pun dari aslinya.',
          name: f.name,
          size: f.size,
        });
      else {
        const v = verifyCertificate(c, hash);
        setRes({
          cert: c,
          fileHash: hash,
          ok: v.summary === 'cocok',
          detail: v.detail,
          name: f.name,
          size: f.size,
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memeriksa.');
    }
    setBusy(false);
  }

  return (
    <div className="narrow">
      <header className="ph" data-tab="Verifikasi publik">
        <h1>Apakah berkas ini utuh?</h1>
        <p className="lede">
          Pilih berkas. Sidik SHA-256 dihitung di perangkatmu; berkasnya tidak dikirim ke mana pun.
          Hanya sidiknya yang dicocokkan dengan catatan.
        </p>
      </header>
      {cert && (
        <p className="card tint small">
          Memeriksa terhadap sertifikat <code>{cert.evidenceId}</code>, dicatat {cert.uploadedAt}.
        </p>
      )}
      <label className="drop light" htmlFor="f">
        <span>
          Pilih berkas yang diperiksa<small>Foto, dokumen, ekspor chat, apa saja</small>
        </span>
        <input id="f" type="file" onChange={(e) => void check(e.target.files?.[0])} />
      </label>
      {busy && <p role="status">Menghitung sidik…</p>}
      {error && (
        <p className="err" role="alert">
          {error}
        </p>
      )}
      {res && (
        <section className={`card ${res.ok ? 'tint' : 'alert'}`} role="status" aria-live="polite">
          <h2 className="title-md">{res.ok ? 'Utuh dan tercatat' : 'Tidak cocok'}</h2>
          <p>{res.detail}</p>
          {!res.ok && (
            <p className="small">
              Tidak cocok belum berarti buktimu hilang. Ada dua kemungkinan: berkas yang kamu pilih
              bukan versi aslinya (misalnya sudah dikompres, dipotong, atau diekspor ulang), atau
              isinya memang berubah. Catatan di Gema tidak terpengaruh. Coba berkas aslinya.
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
            <button
              type="button"
              className="btn ghost sm"
              onClick={() => {
                setRes(null);
                document.getElementById('f')?.focus();
              }}
            >
              Periksa berkas lain
            </button>
            {!res.ok && (
              <Link href="/mulai" className="btn teal sm">
                Simpan bukti dengan sertifikat
              </Link>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
export default function Page() {
  return (
    <Suspense>
      <Verifikasi />
    </Suspense>
  );
}
