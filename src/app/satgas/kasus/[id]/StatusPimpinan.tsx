'use client';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { LoadError } from '@/components/LoadError';
import { SkeletonPage } from '@/components/Skeleton';
import type { SatgasSession } from '@/lib/store';
import { fmtDateTime } from '@/lib/ui/format';
import { island } from '@/lib/ui/island-bus';
import type { Case } from '../../useKasus';
import { Head } from './DosirParts';
import { STATUSES } from './dosir';

/** Tahap tepat sebelum Selesai; status hanya maju satu langkah, jadi Pimpinan bertindak di sini. */
const TAHAP_AKHIR = STATUSES[STATUSES.length - 2];

/**
 * Tampilan Pimpinan: hanya status dan tenggat dari daftar kasus, tanpa membuka dosir.
 * Membuka dosir menandai kasus "dibuka" dan mengunci penarikan pelapor, jadi bukan untuk peran ini.
 */
export function StatusPimpinan({ session, id }: { session: SatgasSession; id: string }) {
  const [c, setC] = useState<Case | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    () =>
      api<{ cases: Case[] }>('satgas/cases', { token: session.token })
        .then((r) => {
          const hit = r.cases.find((x) => x.id === id);
          if (hit) setC(hit);
          else setErr('Kasus tidak ditemukan.');
        })
        .catch((e) => setErr(e.message)),
    [session.token, id],
  );
  useEffect(() => {
    void load();
  }, [load]);

  async function selesai() {
    setBusy(true);
    setErr('');
    try {
      await api(`satgas/cases/${id}/status`, { token: session.token, body: { to: 'Selesai' } });
      await load();
      island.toast('Kasus ditandai selesai.');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Gagal.');
    }
    setBusy(false);
  }

  if (!c)
    return (
      <div className="narrow">
        {err ? (
          <LoadError what="status kasus ini" message={err} />
        ) : (
          <SkeletonPage label="Membuka status" />
        )}
      </div>
    );
  return (
    <div className="wrap" style={{ maxWidth: 900 }}>
      <Head session={session} title={c.alias}>
        <p className="muted">
          {c.unit ? `${c.unit}, ` : ''}status{' '}
          <strong style={{ color: 'inherit' }}>
            <span className="stat" data-s={c.status}>
              <i aria-hidden="true" />
              {c.status}
            </span>
          </strong>
          , tenggat {fmtDateTime(c.sla.due)}
          {c.sla.terlambat && (
            <>
              {' '}
              <span className="pill rose">Terlambat T{c.sla.tingkat}</span>
            </>
          )}
        </p>
      </Head>
      <p className="card tint small">
        Sebagai Pimpinan kamu melihat status dan tenggat saja. Isi laporan dan bukti tidak terbuka
        untuk peran ini.
      </p>
      {err && (
        <p className="card warn small" role="alert">
          {err}
        </p>
      )}
      {c.status === TAHAP_AKHIR ? (
        <button
          className="btn teal"
          disabled={busy}
          aria-busy={busy}
          onClick={() => void selesai()}
        >
          Tandai selesai
        </button>
      ) : (
        c.status !== 'Selesai' && (
          <p className="small muted">
            Kamu dapat menandai kasus selesai setelah Satgas membawanya ke tahap {TAHAP_AKHIR}.
          </p>
        )
      )}
    </div>
  );
}
