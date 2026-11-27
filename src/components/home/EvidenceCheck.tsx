'use client';
import { Words } from '@/components/motion/Words';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import type { EvidenceCertificate } from '@gema/merkle';
import { api } from '@/lib/api';
import { fmtBytes } from '@/lib/ui/format';

type R = { kind: 'wait' } | { kind: 'ok' | 'bad'; title: string; detail: string; id?: string };

/** Hitung sidik berkas di perangkat, cari catatannya, lalu susun hasil untuk ditampilkan. */
async function verdictFor(f: File): Promise<R> {
  try {
    // Pustaka kripto hanya dimuat saat dipakai, supaya tidak membebani muat awal beranda.
    const [{ sha256Async, toHex }, { CERT_STATEMENT, verifyCertificate }] = await Promise.all([
      import('@gema/crypto'),
      import('@gema/merkle'),
    ]);
    const hash = toHex(await sha256Async(new Uint8Array(await f.arrayBuffer())));
    const r = await api<{ found: boolean; proof?: Omit<EvidenceCertificate, 'statement'> }>(
      `public/lookup/${hash}`,
    );
    if (!r.found || !r.proof) {
      return {
        kind: 'bad',
        title: 'Tidak ada catatan untuk berkas ini',
        detail: `${f.name} (${fmtBytes(f.size)}) belum pernah diunggah ke Gema, atau sudah berubah dari aslinya.`,
      };
    }
    const v = verifyCertificate({ ...r.proof, statement: CERT_STATEMENT }, hash);
    const ok = v.summary === 'cocok';
    return {
      kind: ok ? 'ok' : 'bad',
      title: ok ? 'Utuh dan tercatat' : 'Tidak cocok',
      detail: ok
        ? v.detail
        : `${v.detail} Ini belum berarti buktimu hilang: mungkin berkas yang dipilih bukan versi aslinya, atau isinya memang berubah. Catatan di Gema tidak terpengaruh.`,
      id: r.proof.evidenceId,
    };
  } catch (e) {
    return {
      kind: 'bad',
      title: 'Gagal memeriksa',
      detail: e instanceof Error ? e.message : 'Coba lagi.',
    };
  }
}

function Envelope({ onFile }: { onFile: (f?: File) => void }) {
  const [over, setOver] = useState(false);
  return (
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
        onFile(e.dataTransfer.files[0]);
      }}
    >
      <span className="env-flap" aria-hidden="true" />
      <span className="env-stamp" aria-hidden="true" />
      <svg className="env-post" viewBox="0 0 120 56" aria-hidden="true" focusable="false">
        <circle cx="30" cy="28" r="22" />
        <circle cx="30" cy="28" r="15" />
        <path d="M58 14h58M58 24h58M58 34h58M58 44h58" />
      </svg>
      <span className="env-text">
        Masukkan berkas ke sini
        <small>atau ketuk untuk memilih foto, dokumen, atau ekspor chat</small>
      </span>
      <input
        type="file"
        onChange={(e) => {
          onFile(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
    </label>
  );
}

function Verdict({ res }: { res: R | null }) {
  return (
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
  );
}

/** Urutan kerja cek berkas, dari amplop sampai hasil. */
const LANGKAH = [
  { judul: 'Taruh berkasnya di amplop', isi: 'Tidak perlu akun.' },
  { judul: 'Sidiknya dihitung di perangkatmu', isi: 'Berkasnya tidak dikirim ke mana pun.' },
  {
    judul: 'Dicocokkan dengan catatan Gema',
    isi: 'Kamu langsung tahu berkas itu masih sama atau sudah berbeda.',
  },
] as const;

/** Periksa keutuhan berkas langsung dari beranda: sidik dihitung di perangkat, berkas tidak dikirim. */
export function EvidenceCheck() {
  const [res, setRes] = useState<R | null>(null);
  async function check(f?: File) {
    if (!f) return;
    setRes({ kind: 'wait' });
    setRes(await verdictFor(f));
  }
  return (
    <section className="verify" aria-labelledby="cek">
      <Image
        src="/gambar/amplop-kertas.jpg"
        alt=""
        fill
        sizes="100vw"
        quality={60}
        className="t-bg"
      />
      <div className="wrap v-wrap">
        <div className="v-copy">
          <Words as="h2" id="cek" text="Ada yang bilang buktimu diedit?" />
          <ol className="v-alur">
            {LANGKAH.map((l) => (
              <li key={l.judul}>
                <b>{l.judul}</b>
                <span>{l.isi}</span>
              </li>
            ))}
          </ol>
        </div>
        <div>
          <Envelope onFile={(f) => void check(f)} />
          <Verdict res={res} />
        </div>
      </div>
    </section>
  );
}
