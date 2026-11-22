'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { DEMO_ACCOUNTS } from '@/lib/demo';
import { login } from '@/lib/vault-client';
import { satgasStore, type SatgasSession } from '@/lib/store';

type Info = {
  offsetDays: number;
  pendingAnchors: number;
  members: { email: string; nama: string; role: string }[];
};

export default function Demo() {
  const router = useRouter();
  const [info, setInfo] = useState<Info | null>(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(
    () =>
      api<Info>('demo/info')
        .then(setInfo)
        .catch((e) => setMsg(e.message)),
    [],
  );
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const run = async (fn: () => Promise<string | void>) => {
    setBusy(true);
    setMsg('');
    try {
      const m = await fn();
      if (m) setMsg(m);
      await refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Gagal.');
    }
    setBusy(false);
  };

  return (
    <div className="wrap">
      <header className="ph" data-tab="Mode demo, data fiktif">
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

      <ol className="stack" style={{ paddingLeft: '1.2rem', maxWidth: '70ch' }}>
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

      <div className="grid g2 mt-lg">
        <section className="card" aria-labelledby="pel">
          <h2 className="title-md" id="pel">
            Masuk sebagai pelapor
          </h2>
          {DEMO_ACCOUNTS.map((a) => (
            <div
              key={a.key}
              className="row"
              style={{ justifyContent: 'space-between', marginBottom: '.7rem' }}
            >
              <span>
                <strong>{a.nama}</strong>
                <br />
                <span className="small muted">{a.peran}</span>
              </span>
              <button
                className="btn ghost sm"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await login(a.caseCode, a.passphrase);
                    router.push('/brankas');
                  })
                }
              >
                Masuk
              </button>
            </div>
          ))}
        </section>
        <section className="card" aria-labelledby="sat">
          <h2 className="title-md" id="sat">
            Masuk sebagai Satgas
          </h2>
          {info?.members.map((m) => (
            <div
              key={m.role}
              className="row"
              style={{ justifyContent: 'space-between', marginBottom: '.7rem' }}
            >
              <span>
                <strong>{m.role}</strong>
                <br />
                <span className="small muted">{m.nama}</span>
              </span>
              <button
                className="btn ghost sm"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    const r = await api<SatgasSession>('satgas/login', {
                      body: { demoRole: m.role },
                    });
                    satgasStore.set(r);
                    router.push(m.role === 'Auditor' ? '/satgas/audit' : '/satgas');
                  })
                }
              >
                Masuk
              </button>
            </div>
          ))}
        </section>
      </div>

      <section className="card tint mt-lg" aria-labelledby="jam">
        <h2 className="title-md" id="jam">
          Jam Demo
        </h2>
        <p>
          Maju {info ? info.offsetDays : '…'} hari dari waktu nyata. Akar harian menunggu:{' '}
          {info?.pendingAnchors ?? '…'} bukti.
        </p>
        <div className="row">
          {[1, 3, 7].map((n) => (
            <button
              key={n}
              className="btn ghost sm"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await api('demo/advance', { body: { days: n } });
                  return `Jam maju ${n} hari.`;
                })
              }
            >
              +{n} hari
            </button>
          ))}
          <button
            className="btn teal sm"
            disabled={busy}
            onClick={() =>
              run(async () => {
                const r = await api<{ sealed: boolean; size: number }>('demo/anchor-now', {
                  body: {},
                });
                return r.sealed
                  ? `Akar harian terbit untuk ${r.size} bukti.`
                  : 'Tidak ada bukti yang menunggu.';
              })
            }
          >
            Terbitkan akar harian
          </button>
          <button
            className="btn danger sm"
            disabled={busy}
            onClick={() =>
              run(async () => {
                await api('demo/reset', { body: {} });
                satgasStore.clear();
                return 'Data demo dikembalikan.';
              })
            }
          >
            Reset data demo
          </button>
        </div>
      </section>
    </div>
  );
}
