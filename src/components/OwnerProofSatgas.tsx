'use client';
import { useState } from 'react';
import { api } from '@/lib/api';
import type { SatgasSession } from '@/lib/store';

/** Satgas memastikan orang yang mengaku pelapor benar-benar pemilik laporan, tanpa tahu siapa dia. */
export function OwnerProofSatgas({ session, caseId }: { session: SatgasSession; caseId: string }) {
  const [challenge, setChallenge] = useState('');
  const [proof, setProof] = useState('');
  const [result, setResult] = useState<{ valid: boolean; reason: string | null } | null>(null);
  const [err, setErr] = useState('');

  async function ask() {
    setErr('');
    setResult(null);
    try {
      const r = await api<{ challenge: string }>(`satgas/cases/${caseId}/challenge`, {
        token: session.token,
        body: {},
      });
      setChallenge(r.challenge);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Gagal membuat tantangan.');
    }
  }
  async function check() {
    setErr('');
    try {
      setResult(
        await api(`satgas/cases/${caseId}/verify-owner`, {
          token: session.token,
          body: { challenge, proof: proof.trim() },
        }),
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Gagal memeriksa bukti.');
    }
  }

  return (
    <section className="card my-lg" aria-labelledby="bp">
      <h2 className="title-sm" id="bp">
        Pastikan lawan bicara adalah pemilik laporan
      </h2>
      <p>
        Bila seseorang menghubungimu mengaku sebagai pelapor kasus ini, buat tantangan lalu kirim
        lewat jalur kontaknya. Pelapor membalas dengan bukti dari brankasnya. Hasilnya hanya
        &quot;sah&quot; atau &quot;tidak sah&quot;; pemeriksaan ini tidak membuka identitas pelapor.
        Tantangan berlaku 15 menit dan sekali pakai.
      </p>
      <button className="btn ghost" onClick={() => void ask()}>
        Buat tantangan
      </button>
      {challenge && (
        <>
          <p className="my-md">
            Tantangan: <code className="share">{challenge}</code>
          </p>
          <div className="field">
            <label htmlFor="bukti-pemilik">Bukti dari pelapor</label>
            <textarea
              id="bukti-pemilik"
              value={proof}
              onChange={(e) => setProof(e.target.value)}
              rows={2}
              spellCheck={false}
              className="mono"
            />
          </div>
          <button className="btn teal" disabled={!proof.trim()} onClick={() => void check()}>
            Periksa bukti
          </button>
        </>
      )}
      {result && (
        <p className={result.valid ? 'card tint' : 'card alert'} role="status">
          {result.valid ? (
            <strong>Sah: orang ini memegang kunci laporan ini.</strong>
          ) : (
            <strong>Tidak sah. {result.reason}</strong>
          )}
        </p>
      )}
      {err && (
        <p className="err" role="alert">
          {err}
        </p>
      )}
    </section>
  );
}
