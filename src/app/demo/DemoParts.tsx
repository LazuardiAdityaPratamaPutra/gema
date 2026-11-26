import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import Link from 'next/link';
import { island } from '@/lib/ui/island-bus';
import { salin } from '@/lib/ui/salin';
import { satgasStore, type SatgasSession } from '@/lib/store';
import { login } from '@/lib/vault/vault-client';
import type { DemoAccount, Info, Run } from './useDemo';

type Props = { busy: boolean; run: Run };

/** Satu baris pilihan akun: nama tebal, keterangan kecil, tombol Masuk. */
function AccountRow({
  title,
  sub,
  busy,
  onEnter,
}: {
  title: string;
  sub: string;
  busy: boolean;
  onEnter: () => void;
}) {
  return (
    <div className="row" style={{ justifyContent: 'space-between', marginBottom: '.7rem' }}>
      <span>
        <strong>{title}</strong>
        <br />
        <span className="small muted">{sub}</span>
      </span>
      <button className="btn ghost sm" disabled={busy} aria-busy={busy} onClick={onEnter}>
        Masuk
      </button>
    </div>
  );
}

/** Masuk ke peran Satgas demo; akun pelapor hanya ada bila fixture uji dimuat, selain itu pelapor membuat brankas sendiri. */
export function DemoLogins({ info, busy, run }: Props & { info: Info | null }) {
  const router = useRouter();
  const asReporter = (a: DemoAccount) =>
    run(async () => {
      await login(a.caseCode, a.passphrase);
      router.push('/brankas');
    });
  const asStaff = (role: string) =>
    run(async () => {
      const r = await api<SatgasSession>('satgas/login', { body: { demoRole: role } });
      satgasStore.set(r);
      router.push(role === 'Auditor' ? '/satgas/audit' : '/satgas');
    });
  return (
    <div className="grid g2 mt-lg">
      <section className="card" aria-labelledby="pel">
        <h2 className="title-md" id="pel">
          Masuk sebagai pelapor
        </h2>
        {info && info.accounts.length === 0 && (
          <>
            <p>
              Demo ini kosong. Buat brankasmu sendiri, simpan laporan karangan, lalu eskalasi untuk
              melihatnya di sisi Satgas.
            </p>
            <Link href="/mulai" className="btn teal">
              Buat brankas baru
            </Link>
          </>
        )}
        {info?.accounts.map((a) => (
          <AccountRow
            key={a.key}
            title={a.nama}
            sub={a.peran}
            busy={busy}
            onEnter={() => void asReporter(a)}
          />
        ))}
      </section>
      <section className="card" aria-labelledby="sat">
        <h2 className="title-md" id="sat">
          Masuk sebagai Satgas
        </h2>
        {info && (
          <p className="small m-0" style={{ marginBottom: '.9rem' }}>
            Kata sandi semua akun demo: <code>{info.password}</code>{' '}
            <button
              type="button"
              className="btn ghost sm"
              onClick={() => void salin(info.password).then((ok) => ok && island.toast('Disalin'))}
            >
              Salin
            </button>
          </p>
        )}
        {info?.members.map((m) => (
          <AccountRow
            key={m.role}
            title={m.role}
            sub={m.email}
            busy={busy}
            onEnter={() => void asStaff(m.role)}
          />
        ))}
      </section>
    </div>
  );
}

/** Memajukan jam, menerbitkan akar harian, dan mengembalikan data demo. */
export function DemoClock({ info, busy, run }: Props & { info: Info | null }) {
  return (
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
  );
}
