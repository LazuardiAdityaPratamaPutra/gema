import { api } from '@/lib/api';
import type { SatgasSession } from '@/lib/store';
import { fmtDateTime } from '@/lib/ui/format';
import type { Waiting } from './useKasus';

/** Permintaan membuka dosir dari anggota lain yang menunggu persetujuan (Empat Mata). */
export function WaitingPanel({
  session,
  waiting,
  setWaiting,
  setErr,
}: {
  session: SatgasSession;
  waiting: Waiting;
  setWaiting: (f: (w: Waiting) => Waiting) => void;
  setErr: (m: string) => void;
}) {
  if (waiting.length === 0) return null;
  return (
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
  );
}
