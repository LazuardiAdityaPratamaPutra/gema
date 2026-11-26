'use client';
import { HeaderPhoto } from '@/components/HeaderPhoto';
import { useEffect, useState } from 'react';
import { SatgasBar } from '@/components/SatgasBar';
import { useSatgas } from '@/components/useSatgas';
import { api } from '@/lib/api';
import { LoadError } from '@/components/LoadError';
import { SkeletonPage, SkeletonTable } from '@/components/Skeleton';

type Snap = {
  unit: string;
  periode: string;
  bucket: '3-5' | '6-10' | '>10' | null;
  polaBerulang: boolean;
  epsilon: number;
};

/** Tabel unit kali periode. Sel kosong berarti data terlalu sedikit untuk ditampilkan. */
function TabelRadar({ snaps }: { snaps: Snap[] }) {
  const periods = [...new Set(snaps.map((x) => x.periode))].sort().reverse();
  const units = [...new Set(snaps.map((x) => x.unit))];
  const cell = (u: string, p: string) => snaps.find((x) => x.unit === u && x.periode === p);
  return (
    <div
      className="tablewrap card"
      style={{ padding: 0 }}
      role="region"
      aria-label="Radar pola per unit dan periode"
      tabIndex={0}
    >
      <table>
        <caption className="sr">Radar pola per unit dan periode</caption>
        <thead>
          <tr>
            <th scope="col">Unit</th>
            {periods.map((p) => (
              <th scope="col" key={p}>
                {p}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {units.map((u) => (
            <tr key={u}>
              <th scope="row" className="rowhead">
                {u}
              </th>
              {periods.map((p) => {
                const c = cell(u, p);
                return (
                  <td key={p}>
                    {c?.bucket ? (
                      <>
                        {c.bucket}{' '}
                        {c.polaBerulang && <span className="pill rose">Pola berulang</span>}
                      </>
                    ) : (
                      <span className="muted">-</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Radar() {
  const { session } = useSatgas();
  const [s, setS] = useState<Snap[] | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    if (session)
      api<{ snapshots: Snap[] }>('satgas/radar', { token: session.token })
        .then((r) => setS(r.snapshots))
        .catch((x) => setErr(x.message));
  }, [session]);
  if (!session)
    return (
      <div className="narrow">
        <SkeletonPage label="Memeriksa sesi" />
      </div>
    );
  return (
    <div className="wrap">
      <header className="ph ph-foto">
        <HeaderPhoto />
        <SatgasBar s={session} />
        <h1>Radar pola</h1>
        <p className="lede">
          Gambaran per unit dan periode, dalam rentang jumlah berderau. Tidak ada nama, tidak ada
          kasus tunggal. Sel kosong berarti data terlalu sedikit untuk ditampilkan.
        </p>
      </header>
      {err && <LoadError what="radar pola" message={err} />}
      {!s && !err && <SkeletonTable label="Memuat radar pola" />}
      {s && <TabelRadar snaps={s} />}
      <p className="small muted mt-md">
        Batas jujur: ini sinyal untuk memprioritaskan pencegahan, bukan bukti tentang individu mana
        pun.
      </p>
    </div>
  );
}
