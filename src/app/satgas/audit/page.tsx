'use client';
import { useEffect, useState } from 'react';
import { SatgasBar } from '@/components/SatgasBar';
import { useSatgas } from '@/components/useSatgas';
import { api } from '@/lib/api';
import { fmtDateTime, shortHash } from '@/lib/format';

type Entry = {
  id: string;
  aktor: string;
  aksi: string;
  objek: string;
  at: number;
  prev_hash: string;
  hash: string;
};

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
        <p role="status">Memeriksa sesi…</p>
      </div>
    );
  // Rantai: entri[i].prev_hash harus sama dengan entri[i+1].hash (daftar terbaru lebih dulu).
  const broken = e
    ? e.entries.some((x, i) => i < e.entries.length - 1 && x.prev_hash !== e.entries[i + 1].hash)
    : false;
  return (
    <div className="wrap">
      <header className="ph">
        <SatgasBar s={session} />
        <h1>Jejak audit</h1>
        <p className="lede">
          Setiap pembukaan dosir, perubahan status, dan catatan tercatat dalam rantai hash. Mengubah
          satu entri lama akan memutus rantai.
        </p>
      </header>
      {err && (
        <p className="err" role="alert">
          {err}
        </p>
      )}
      {e && (
        <p className={`card ${broken ? 'alert' : 'tint'}`} role="status">
          {broken
            ? 'Rantai tidak utuh: ada entri yang berubah.'
            : `Rantai utuh pada ${e.entries.length} entri terakhir dari ${e.total}.`}
        </p>
      )}
      <div className="tablewrap card" style={{ padding: 0, marginTop: '1rem' }}>
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
            {e?.entries.map((x) => (
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
    </div>
  );
}
