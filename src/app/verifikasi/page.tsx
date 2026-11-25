'use client';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { EvidenceCertificate } from '@gema/merkle';
import { fetchCertificate } from '@/lib/vault/proof';
import { checkFile, type Result } from './cek';
import { ResultCard } from './ResultCard';
import { Ilustrasi } from '@/components/Ilustrasi';

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
      setRes(await checkFile(f, cert));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memeriksa.');
    }
    setBusy(false);
  }

  return (
    <div className="narrow">
      <header className="ph" data-tab="Verifikasi publik">
        <Ilustrasi motif="verifikasi" />
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
        <ResultCard
          res={res}
          onReset={() => {
            setRes(null);
            document.getElementById('f')?.focus();
          }}
        />
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
