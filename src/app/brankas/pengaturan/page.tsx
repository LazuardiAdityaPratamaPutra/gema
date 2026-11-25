'use client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Term } from '@/components/Term';
import { SkeletonPage } from '@/components/Skeleton';
import { useReporter } from '@/components/useReporter';
import { KodePaksa } from './KodePaksa';
import { Passkey } from './Passkey';
import { Pemulihan } from './Pemulihan';
import { useRun } from './useRun';

export default function Pengaturan() {
  const { session } = useReporter();
  const { busy, msg, ok, run } = useRun();
  const justRecovered = useSearchParams().get('pulih') === '1';
  if (!session)
    return (
      <div className="narrow">
        <SkeletonPage label="Memeriksa sesi" />
      </div>
    );

  return (
    <div className="narrow">
      <header className="ph">
        <Link href="/brankas" className="back">
          Kembali ke Brankasmu
        </Link>
        <h1>Pengaturan keamanan</h1>
        <p className="lede">
          <Term k="kodePaksa">Kode Paksa</Term> dan pemulihan. Bila dipaksa membuka brankas,
          masukkan kata sandi kedua. Brankas akan menampilkan isi tiruan yang kamu tentukan. Dari
          luar, tidak ada tanda bahwa ada brankas lain.
        </p>
      </header>
      {justRecovered && (
        <p className="card tint" role="status">
          Brankasmu pulih dan kata sandi barumu aktif. Bagian pemulihan yang lama sudah tidak
          berlaku; pasang yang baru di bawah.
        </p>
      )}
      {msg && (
        <p
          className={`umpan-lekat ${ok ? 'card tint small umpan-ok' : 'card warn small'}`}
          role={ok ? 'status' : 'alert'}
        >
          {msg}
        </p>
      )}
      <KodePaksa session={session} busy={busy} run={run} />
      <Passkey session={session} busy={busy} run={run} />
      <Pemulihan session={session} busy={busy} run={run} />
      <p className="small muted mt-lg">
        Batas jujur: ini melindungi dari pemaksaan sederhana. Penyerang yang menguasai server dan
        dapat membandingkan banyak akun dapat memperkirakan keberadaan slot kedua dari ukuran yang
        seragam, bukan dari isinya. Pemulihan: dua orang tepercaya yang berkolusi dan tahu Kode
        Kasusmu dapat mengambil alih brankas, jadi pilih orang yang tidak saling berhubungan.
      </p>
    </div>
  );
}
