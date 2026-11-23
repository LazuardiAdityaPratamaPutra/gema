'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { SatgasBar } from '@/components/SatgasBar';
import { useSatgas } from '@/components/useSatgas';
import { api } from '@/lib/api';
import { fmtDate, fmtDateTime } from '@/lib/format';
import type { SlaView } from '@/lib/vault-client';
import { LoadError } from '@/components/LoadError';

type Case = {
  id: string;
  alias: string;
  sla: SlaView;
  status: string;
  escalatedAt: number;
  prioritas?: boolean;
  penanggungJawab?: string | null;
  sumber?: string;
  unit?: string;
  cluster?: { total: number; tereskalasi: number; tersegel: number };
  opened?: boolean;
};
type Waiting = { id: string; alias: string; requester: string | null; requestedAt: number }[];
type Ladder = { alias: string; tingkat: number; hariTerlambat: number; at: number; ke: string }[];

export default function Kasus() {
  const { session } = useSatgas();
  const [cases, setCases] = useState<Case[] | null>(null);
  const [ladder, setLadder] = useState<Ladder>([]);
  const [agregat, setAgregat] = useState<number | null>(null);
  const [err, setErr] = useState('');
  const [waiting, setWaiting] = useState<Waiting>([]);
  useEffect(() => {
    if (!session || !['Ketua', 'Anggota', 'Pimpinan'].includes(session.member.role)) return;
    const poll = () =>
      api<{ menungguKamu: Waiting }>('satgas/approvals', { token: session.token })
        .then((r) => setWaiting(r.menungguKamu))
        .catch(() => undefined);
    void poll();
    const t = setInterval(poll, 5000);
    return () => clearInterval(t);
  }, [session]);
  useEffect(() => {
    if (!session) return;
    const t = session.token;
    const role = session.member.role;
    if (['Ketua', 'Anggota', 'Pimpinan'].includes(role))
      api<{ cases: Case[] }>('satgas/cases', { token: t })
        .then((r) => setCases(r.cases))
        .catch((e) => setErr(e.message));
    if (['Ketua', 'Pimpinan', 'Pengawas'].includes(role))
      api<{ events?: Ladder; agregat?: { kasusTerlambatT3: number } }>('satgas/ladder', {
        token: t,
      })
        .then((r) => {
          setLadder(r.events ?? []);
          setAgregat(r.agregat?.kasusTerlambatT3 ?? null);
        })
        .catch(() => undefined);
  }, [session]);
  if (!session)
    return (
      <div className="narrow">
        <p role="status">Memeriksa sesi…</p>
      </div>
    );
  return (
    <div className="wrap">
      <header className="ph">
        <SatgasBar s={session} />
        <h1>{session.member.role === 'Pengawas' ? 'Pengawasan' : 'Kasus tereskalasi'}</h1>
      </header>
      {err && <LoadError what="daftar kasus" message={err} />}
      {waiting.length > 0 && session && (
        <section className="card alert my-md" aria-labelledby="menunggu">
          <h2 className="title-sm" id="menunggu">
            Menunggu persetujuanmu (Empat Mata)
          </h2>
          <ul className="plain-list">
            {waiting.map((w) => (
              <li key={w.id} className="row row-between">
                <span>
                  <strong>{w.requester ?? 'Anggota lain'}</strong> meminta membuka{' '}
                  <strong>{w.alias}</strong> ({fmtDateTime(w.requestedAt)}).
                </span>
                <button
                  className="btn teal sm"
                  onClick={() =>
                    void api(`satgas/approvals/${w.id}/approve`, {
                      token: session.token,
                      body: {},
                    })
                      .then(() => setWaiting((x) => x.filter((y) => y.id !== w.id)))
                      .catch((e) => setErr(e.message))
                  }
                >
                  Setujui
                </button>
              </li>
            ))}
          </ul>
          <p className="small muted m-0">
            Setujui hanya bila kamu tahu permintaan ini sah. Persetujuanmu dicatat dengan namamu.
          </p>
        </section>
      )}
      {agregat !== null && (
        <div className="card">
          <p className="m-0">
            Kasus yang mencapai tingkat 3 dan belum selesai:{' '}
            <strong className="title-md">{agregat}</strong>. Pengawas hanya menerima angka agregat,
            bukan identitas kasus.
          </p>
        </div>
      )}
      {ladder.length > 0 && (
        <section className="card alert my-md" aria-labelledby="tg">
          <h2 className="title-sm" id="tg">
            Tangga eskalasi tenggat
          </h2>
          <ul style={{ margin: 0, paddingLeft: '1.2rem' }}>
            {ladder.map((l, i) => (
              <li key={i}>
                <strong>{l.alias}</strong>: tingkat {l.tingkat}, terlambat {l.hariTerlambat} hari
                kerja, diteruskan ke {l.ke} ({fmtDate(l.at)})
              </li>
            ))}
          </ul>
        </section>
      )}
      {cases &&
        cases.length > 0 &&
        ['Ketua', 'Anggota'].includes(session.member.role) &&
        (() => {
          const c = cases[0];
          return (
            <section className="next urgent" aria-labelledby="mendesak">
              <div>
                <h2 id="mendesak">Paling mendesak: {c.alias}</h2>
                <p>
                  {c.sla.terlambat
                    ? `Terlambat, sudah di tingkat ${c.sla.tingkat}.`
                    : c.sla.hariSisa != null
                      ? `Tenggat tindak lanjut ${c.sla.hariSisa} hari kerja lagi.`
                      : `Status ${c.status.toLowerCase()}.`}
                  {c.prioritas ? ' Ditandai prioritas karena ada relasi kuasa.' : ''}
                </p>
              </div>
              <div className="next-acts">
                <Link href={`/satgas/kasus/${c.id}`} className="btn teal">
                  Buka kasus
                </Link>
              </div>
            </section>
          );
        })()}
      {cases && (
        <div
          className="tablewrap card"
          style={{ padding: 0, marginTop: '1rem' }}
          role="region"
          aria-label="Daftar kasus tereskalasi"
          tabIndex={0}
        >
          <table data-row-title>
            <caption className="sr">Daftar kasus tereskalasi</caption>
            <thead>
              <tr>
                <th scope="col">Kasus</th>
                <th scope="col">Status</th>
                <th scope="col">Penanggung jawab</th>
                <th scope="col">Tenggat</th>
                {session.member.role !== 'Pimpinan' && <th scope="col">Pola</th>}
                <th scope="col">
                  <span className="sr">Aksi</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {cases.map((c) => (
                <tr key={c.id}>
                  <td>
                    <strong>{c.alias}</strong>
                    {c.prioritas && (
                      <>
                        {' '}
                        <span className="pill prio">Prioritas</span>
                      </>
                    )}
                    {c.unit && <div className="muted small">{c.unit}</div>}
                  </td>
                  <td>{c.status}</td>
                  <td>{c.penanggungJawab ?? <span className="muted">Belum ditugaskan</span>}</td>
                  <td>
                    {fmtDate(c.sla.due)}{' '}
                    {c.sla.terlambat ? (
                      <span className="pill rose">Terlambat T{c.sla.tingkat}</span>
                    ) : (
                      c.sla.hariSisa != null && (
                        <span className={`pill ${c.sla.h2 ? 'amber' : ''}`}>
                          {c.sla.hariSisa} hari kerja
                        </span>
                      )
                    )}
                  </td>
                  {session.member.role !== 'Pimpinan' && (
                    <td>{c.cluster && c.cluster.total > 1 ? `${c.cluster.total} laporan` : '-'}</td>
                  )}
                  <td>
                    {['Ketua', 'Anggota', 'Pimpinan'].includes(session.member.role) && (
                      <Link href={`/satgas/kasus/${c.id}`} className="btn ghost sm">
                        {session.member.role === 'Pimpinan' ? 'Lihat status' : 'Buka kasus'}
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
              {cases.length === 0 && (
                <tr>
                  <td colSpan={6} className="muted">
                    Belum ada kasus. Penyintas yang memilih eskalasi akan muncul di sini.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
