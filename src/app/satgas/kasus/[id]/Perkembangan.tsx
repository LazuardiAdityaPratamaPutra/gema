import { api } from '@/lib/api';
import { fmtDateTime } from '@/lib/ui/format';
import type { SatgasSession } from '@/lib/store';
import { STATUSES, type Detail } from './dosir';

type Props = {
  session: SatgasSession;
  d: Detail;
  caseId: string;
  notes: Record<string, string>;
  act: (fn: () => Promise<unknown>) => Promise<void>;
};

/** Linimasa kasus dan tombol memajukan status sesuai peran. */
export function Perkembangan({ session, d, caseId: id, notes, act }: Props) {
  const role = session.member.role;
  const idx = STATUSES.indexOf(d.escalation.status);
  return (
    <section className="my-lg">
      <h2 className="title-md">Perkembangan</h2>
      <ul className="timeline">
        {d.events.map((e) => (
          <li key={e.id}>
            <strong>{e.label}</strong>{' '}
            <span className="muted small">
              {fmtDateTime(e.at)}, {e.actor}
            </span>
            {notes[e.id] && <p style={{ margin: '.3rem 0 0' }}>{notes[e.id]}</p>}
          </li>
        ))}
      </ul>
      {(idx < STATUSES.length - 1 && role !== 'Anggota') ||
      (role === 'Anggota' && idx < STATUSES.length - 2) ? (
        <div className="row">
          {role !== 'Pimpinan' && idx < STATUSES.length - 2 && (
            <button
              className="btn teal sm"
              onClick={() =>
                void act(() =>
                  api(`satgas/cases/${id}/status`, {
                    token: session.token,
                    body: { to: STATUSES[idx + 1] },
                  }),
                )
              }
            >
              Lanjut ke: {STATUSES[idx + 1]}
            </button>
          )}
          {(role === 'Ketua' || role === 'Pimpinan') && idx < STATUSES.length - 1 && (
            <button
              className="btn ghost sm"
              onClick={() =>
                void act(() =>
                  api(`satgas/cases/${id}/status`, {
                    token: session.token,
                    body: { to: 'Selesai' },
                  }),
                )
              }
            >
              Tandai selesai
            </button>
          )}
        </div>
      ) : null}
    </section>
  );
}
