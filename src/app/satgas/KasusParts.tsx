import Link from 'next/link';
import { fmtDate } from '@/lib/ui/format';
import type { SatgasSession } from '@/lib/store';
import type { Case, Ladder } from './useKasus';

type Role = SatgasSession['member']['role'];

export function AggregateCard({ agregat }: { agregat: number }) {
  return (
    <div className="card">
      <p className="m-0">
        Kasus yang mencapai tingkat 3 dan belum selesai:{' '}
        <strong className="title-md">{agregat}</strong>. Pengawas hanya menerima angka agregat,
        bukan identitas kasus.
      </p>
    </div>
  );
}

export function LadderPanel({ ladder }: { ladder: Ladder }) {
  return (
    <section className="card alert my-md" aria-labelledby="tg">
      <h2 className="title-sm" id="tg">
        Tangga eskalasi tenggat
      </h2>
      <ul style={{ margin: 0, paddingLeft: '1.2rem' }}>
        {ladder.map((l, i) => (
          <li key={i}>
            <strong>{l.alias}</strong>: tingkat {l.tingkat}, terlambat {l.hariTerlambat} hari kerja,
            diteruskan ke {l.ke} ({fmtDate(l.at)})
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Kasus teratas daftar (sudah terurut menurut urgensi). */
export function UrgentCase({ c }: { c: Case }) {
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
}

function CaseRow({ c, role }: { c: Case; role: Role }) {
  return (
    <tr>
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
            <span className={`pill ${c.sla.h2 ? 'amber' : ''}`}>{c.sla.hariSisa} hari kerja</span>
          )
        )}
      </td>
      {role !== 'Pimpinan' && (
        <td>{c.cluster && c.cluster.total > 1 ? `${c.cluster.total} laporan` : '-'}</td>
      )}
      <td>
        {['Ketua', 'Anggota', 'Pimpinan'].includes(role) && (
          <Link href={`/satgas/kasus/${c.id}`} className="btn ghost sm">
            {role === 'Pimpinan' ? 'Lihat status' : 'Buka kasus'}
          </Link>
        )}
      </td>
    </tr>
  );
}

export function CaseTable({ cases, role }: { cases: Case[]; role: Role }) {
  return (
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
            {role !== 'Pimpinan' && <th scope="col">Pola</th>}
            <th scope="col">
              <span className="sr">Aksi</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {cases.map((c) => (
            <CaseRow key={c.id} c={c} role={role} />
          ))}
          {cases.length === 0 && (
            <tr>
              <td colSpan={role === 'Pimpinan' ? 5 : 6} className="muted">
                Belum ada kasus. Penyintas yang memilih eskalasi akan muncul di sini.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
