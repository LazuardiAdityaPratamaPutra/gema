'use client';
import Link from 'next/link';
import { useState } from 'react';
import { sha256Async, toHex } from '@gema/crypto';
import { CERT_STATEMENT, verifyCertificate, type EvidenceCertificate } from '@gema/merkle';
import { api } from '@/lib/api';
import { fmtBytes } from '@/lib/format';

type R = { kind: 'wait' } | { kind: 'ok' | 'bad'; title: string; detail: string; id?: string };

/** Periksa keutuhan berkas langsung dari beranda: sidik dihitung di perangkat, berkas tidak dikirim. */
export function EvidenceCheck() {
  const [res, setRes] = useState<R | null>(null);
  const [over, setOver] = useState(false);
  async function check(f?: File) {
    if (!f) return;
    setRes({ kind: 'wait' });
    try {
      const hash = toHex(await sha256Async(new Uint8Array(await f.arrayBuffer())));
      const r = await api<{ found: boolean; proof?: Omit<EvidenceCertificate, 'statement'> }>(
        `public/lookup/${hash}`,
      );
      if (!r.found || !r.proof) {
        setRes({
          kind: 'bad',
          title: 'Tidak ada catatan untuk berkas ini',
          detail: `${f.name} (${fmtBytes(f.size)}) belum pernah diunggah ke Gema, atau sudah berubah dari aslinya.`,
        });
        return;
      }
      const v = verifyCertificate({ ...r.proof, statement: CERT_STATEMENT }, hash);
      setRes({
        kind: v.summary === 'cocok' ? 'ok' : 'bad',
        title: v.summary === 'cocok' ? 'Utuh dan tercatat' : 'Tidak cocok',
        detail:
          v.summary === 'cocok'
            ? v.detail
            : `${v.detail} Ini belum berarti buktimu hilang: mungkin berkas yang dipilih bukan versi aslinya, atau isinya memang berubah. Catatan di Gema tidak terpengaruh.`,
        id: r.proof.evidenceId,
      });
    } catch (e) {
      setRes({
        kind: 'bad',
        title: 'Gagal memeriksa',
        detail: e instanceof Error ? e.message : 'Coba lagi.',
      });
    }
  }
  return (
    <section className="verify" aria-labelledby="cek">
      <div className="wrap">
        <div>
          <h2 id="cek">Ada yang bilang buktimu diedit?</h2>
          <p>
            Masukkan berkasnya ke amplop ini. Sidiknya dihitung di perangkatmu lalu dicocokkan
            dengan catatan Gema. Berkasnya tidak dikirim ke mana pun, dan tidak perlu akun.
          </p>
        </div>
        <div>
          <label
            className="drop envelope"
            data-over={over}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(true);
            }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setOver(false);
              void check(e.dataTransfer.files[0]);
            }}
          >
            <span className="env-flap" aria-hidden="true" />
            <span className="env-text">
              Masukkan berkas ke sini
              <small>atau ketuk untuk memilih foto, dokumen, atau ekspor chat</small>
            </span>
            <input
              type="file"
              onChange={(e) => {
                void check(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </label>
          <div aria-live="polite">
            {res?.kind === 'wait' && (
              <p className="verdict wait" role="status">
                Menghitung sidik…
              </p>
            )}
            {res && res.kind !== 'wait' && (
              <p className={`verdict ${res.kind}`} role="status">
                <span>
                  <b>{res.title}</b>
                  <small>
                    {res.detail}{' '}
                    {res.id && <Link href={`/verifikasi?id=${res.id}`}>Lihat sertifikat</Link>}
                  </small>
                </span>
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
