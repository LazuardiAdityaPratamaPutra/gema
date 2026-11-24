'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { DEMO_ACCOUNTS } from '@/lib/demo/demo';
import { login } from '@/lib/vault/vault-client';
import { DemoClock, DemoLogins } from './DemoParts';
import { useDemo } from './useDemo';

export default function Demo() {
  const router = useRouter();
  const { info, msg, busy, run } = useDemo();

  return (
    <div className="wrap">
      <header className="ph">
        <h1>Lihat seluruh alur dalam lima menit</h1>
        <p className="lede">
          Semua nama, kampus, dan kasus di sini rekaan. Kunci Satgas demo sengaja dibuat publik. Jam
          Demo bisa dimajukan agar tenggat dan tangga eskalasi terlihat tanpa menunggu.
        </p>
        <div className="hero-cta">
          <button
            type="button"
            className="btn teal"
            disabled={busy}
            aria-busy={busy}
            onClick={() =>
              run(async () => {
                const a = DEMO_ACCOUNTS[0];
                await login(a.caseCode, a.passphrase);
                router.push('/brankas');
              })
            }
          >
            {busy ? 'Masuk…' : `Mulai sebagai ${DEMO_ACCOUNTS[0].nama}`}
          </button>
          <Link href="/verifikasi" className="btn ghost">
            Periksa keutuhan bukti
          </Link>
        </div>
      </header>

      <h2 className="title-md" id="skenario">
        Empat hal yang sudah disiapkan untuk dilihat
      </h2>
      <ol className="stack" aria-labelledby="skenario" style={{ paddingLeft: '1.2rem' }}>
        <li>
          <strong>Maya dan Rafi</strong> melaporkan terlapor yang sama secara terpisah. Masuklah
          sebagai Maya: akan muncul pemberitahuan pola tanpa membuka identitas Rafi.
        </li>
        <li>
          <strong>Dewa</strong> sudah mengeskalasi dua kasus. Satu sudah terlambat melewati tenggat
          tingkat 2.
        </li>
        <li>
          Majukan Jam Demo, lalu masuk sebagai <strong>Ketua</strong> atau <strong>Pimpinan</strong>{' '}
          untuk melihat tangga eskalasi.
        </li>
        <li>
          Terbitkan akar harian, lalu buka <Link href="/verifikasi">Verifikasi</Link> dan periksa
          berkas bukti.
        </li>
      </ol>

      {msg && (
        <p className="card warn" role="status">
          {msg}
        </p>
      )}

      <DemoLogins info={info} busy={busy} run={run} />

      <DemoClock info={info} busy={busy} run={run} />
    </div>
  );
}
