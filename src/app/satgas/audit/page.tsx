'use client';
import { HeaderPhoto } from '@/components/HeaderPhoto';
import { useEffect, useState } from 'react';
import { SatgasBar } from '@/components/SatgasBar';
import { useSatgas } from '@/components/useSatgas';
import { api } from '@/lib/api';
import { fmtDateTime, shortHash } from '@/lib/ui/format';
import { LoadError } from '@/components/LoadError';
import { SkeletonPage, SkeletonTable } from '@/components/Skeleton';

type Entry = {
  id: string;
  aktor: string;
  aksi: string;
  objek: string;
  at: number;
  prev_hash: string;
  hash: string;
};

type Berkas = { entries: Entry[]; total: number };

/** Hasil pemeriksaan rantai hash di peramban. */
function RantaiAudit({ e, broken }: { e: Berkas; broken: boolean }) {
  return (
    <p className={`card integrity ${broken ? 'alert' : 'tint'}`} role="status" data-ok={!broken}>
      <b>{broken ? 'Rantai tidak utuh' : 'Rantai utuh'}</b>
      <span>
        {broken
          ? 'Ada entri yang berubah. Periksa entri yang ditandai sebelum melanjutkan.'
          : `Dihitung di peramban ini: ${e.entries.length} entri terakhir dari ${e.total} saling mengait tanpa putus.`}
      </span>
    </p>
  );
}

/** Tabel entri audit, terbaru lebih dulu. */
function TabelAudit({ entries }: { entries: Entry[] }) {
  return (
    <div
      className="tablewrap card"
      style={{ padding: 0, marginTop: '1rem' }}
      role="region"
      aria-label="Entri jejak audit"
      tabIndex={0}
    >
      <table>
        <caption className="sr">Entri jejak audit</caption>
        <thead>
          <tr>
            <th scope="col">Waktu</th>
            <th scope="col">Aktor</th>
            <th scope="col">Aksi</th>
            <th scope="col">Objek</th>
            <th scope="col">Hash</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((x) => (
            <tr key={x.id}>
              <td>{fmtDateTime(x.at)}</td>
              <td>{x.aktor}</td>
              <td>{x.aksi}</td>
              <td>{x.objek}</td>
              <td>
                <code>{shortHash(x.hash, 6)}</code>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Audit() {
  const { session } = useSatgas();
  const [e, setE] = useState<{ entries: Entry[]; total: number } | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    if (session)
      api<{ entries: Entry[]; total: number }>('satgas/audit', { token: session.token })
        .then(setE)
        .catch((x) => setErr(x.message));
  }, [session]);
  if (!session)
    return (
      <div className="narrow">
        <SkeletonPage label="Memeriksa sesi" />
      </div>
    );
  // Rantai: entri[i].prev_hash harus sama dengan entri[i+1].hash (daftar terbaru lebih dulu).
  const broken = e
    ? e.entries.some((x, i) => i < e.entries.length - 1 && x.prev_hash !== e.entries[i + 1].hash)
    : false;
  return (
    <div className="wrap">
      <header className="ph ph-foto">
        <HeaderPhoto />
        <SatgasBar s={session} />
        <h1>Jejak audit</h1>
        <p className="lede">
          Setiap pembukaan dosir, perubahan status, dan catatan tercatat dalam rantai hash. Mengubah
          satu entri lama akan memutus rantai.
        </p>
      </header>
      {err && <LoadError what="jejak audit" message={err} />}
      {!e && !err && <SkeletonTable label="Memuat jejak audit" rows={5} />}
      {e && <RantaiAudit e={e} broken={broken} />}
      {e && <TabelAudit entries={e.entries} />}
    </div>
  );
}
