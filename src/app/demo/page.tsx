'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { login } from '@/lib/vault/vault-client';
import { DemoClock, DemoLogins } from './DemoParts';
import { useDemo } from './useDemo';

export default function Demo() {
  const router = useRouter();
  const { info, msg, busy, run } = useDemo();
  const account = info?.accounts[0];

  return (
    <div className="wrap">
      <header className="ph">
        <h1>Coba seluruh alur dalam lima menit</h1>
        <p className="lede">
          Demo ini kosong: tidak ada laporan, kasus, atau angka rekaan. Semua yang muncul berasal
          dari percobaan yang dibuat di sini, dan basis datanya dipakai bersama. Kunci Satgas demo
          sengaja dibuat publik. Jam Demo bisa dimajukan agar tenggat dan tangga eskalasi terlihat
          tanpa menunggu.
        </p>
        <div className="hero-cta">
          {account ? (
            <button
              type="button"
              className="btn teal"
              disabled={busy}
              aria-busy={busy}
              onClick={() =>
                run(async () => {
                  await login(account.caseCode, account.passphrase);
                  router.push('/brankas');
                })
              }
            >
              {busy ? 'Masuk…' : `Mulai sebagai ${account.nama}`}
            </button>
          ) : (
            <Link href="/mulai" className="btn teal">
              Buat brankas baru
            </Link>
          )}
          <Link href="/verifikasi" className="btn ghost">
            Periksa keutuhan bukti
          </Link>
        </div>
      </header>

      <h2 className="title-md" id="skenario">
        Empat langkah mencobanya
      </h2>
      <ol className="stack" aria-labelledby="skenario" style={{ paddingLeft: '1.2rem' }}>
        <li>
          Buat brankas di <Link href="/mulai">Mulai</Link>, lalu catat Kode Kasus dan kata sandinya.
        </li>
        <li>
          Simpan satu laporan karangan dan pilih UPN Veteran Jawa Timur. Buka laporannya, lalu
          eskalasi.
        </li>
        <li>
          Majukan Jam Demo, lalu masuk sebagai <strong>Ketua</strong> atau <strong>Pimpinan</strong>{' '}
          untuk melihat kasus dan tangga eskalasi.
        </li>
        <li>
          Terbitkan akar harian, lalu buka <Link href="/verifikasi">Verifikasi</Link> dan periksa
          berkas buktimu.
        </li>
      </ol>
      <p className="small muted">
        Jangan memasukkan cerita atau data pribadi yang sebenarnya ke demo ini.
      </p>

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
