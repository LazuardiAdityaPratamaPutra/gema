import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import type { ReporterSession } from '@/lib/store';
import type { ReportView } from '@/lib/vault/vault-client';

type Props = {
  session: ReporterSession;
  r: ReportView;
  busy: boolean;
  act: (fn: () => Promise<unknown>, ok: string, onDone?: () => void) => Promise<void>;
};

/** Satu kotak centang pengaturan laporan; perubahan langsung disimpan ke server. */
function PengaturanCentang({
  session,
  r,
  act,
  kunci,
  nilai,
  children,
}: Pick<Props, 'session' | 'r' | 'act'> & {
  kunci: 'includeWeak' | 'optIn';
  nilai: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="check">
      <input
        type="checkbox"
        checked={nilai}
        onChange={(e) =>
          act(
            () =>
              api(`reports/${r.id}/settings`, {
                token: session.token,
                body: { [kunci]: e.target.checked },
              }),
            'Pengaturan disimpan.',
          )
        }
      />
      <span>{children}</span>
    </label>
  );
}

/** Pengaturan pemberitahuan dan penghapusan laporan. */
export function ReportSettings({ session, r, busy, act }: Props) {
  const router = useRouter();
  const [confirmDel, setConfirmDel] = useState(false);
  return (
    <section className="my-xl" aria-labelledby="atur">
      <h2 className="title-md" id="atur">
        Pengaturan laporan
      </h2>
      <PengaturanCentang
        session={session}
        r={r}
        act={act}
        kunci="includeWeak"
        nilai={r.includeWeak}
      >
        Sertakan kecocokan lemah dalam pemberitahuan
      </PengaturanCentang>
      <PengaturanCentang session={session} r={r} act={act} kunci="optIn" nilai={r.optIn}>
        Bersedia dihubungi lewat Satgas bila ada laporan cocok
      </PengaturanCentang>
      <hr />
      {!confirmDel ? (
        <button
          className="btn danger sm"
          disabled={busy}
          aria-busy={busy}
          onClick={() => setConfirmDel(true)}
        >
          Hapus laporan selamanya
        </button>
      ) : (
        <div className="card alert">
          <p>
            <strong>Hapus selamanya?</strong> Kunci laporan dimusnahkan dan tidak dapat dipulihkan
            oleh siapa pun.
          </p>
          <div className="row">
            <button
              className="btn danger"
              disabled={busy}
              aria-busy={busy}
              onClick={() =>
                void act(async () => {
                  await api(`reports/${r.id}`, { method: 'DELETE', token: session.token });
                  router.push('/brankas');
                }, '')
              }
            >
              Ya, hapus
            </button>
            <button className="btn ghost" onClick={() => setConfirmDel(false)}>
              Batal
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
