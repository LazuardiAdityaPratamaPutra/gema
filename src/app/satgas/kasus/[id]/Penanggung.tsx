import { api } from '@/lib/api';
import type { SatgasSession } from '@/lib/store';
import type { Detail } from './dosir';

type Props = {
  session: SatgasSession;
  d: Detail;
  caseId: string;
  team: { id: string; nama: string; role: string }[];
  setMsg: (m: string) => void;
  reload: () => Promise<void>;
};

/** Penanggung jawab kasus; hanya Ketua yang bisa menetapkan. */
export function Penanggung({ session, d, caseId: id, team, setMsg, reload }: Props) {
  return (
    <section className="my-lg" aria-labelledby="pj-judul">
      <h2 id="pj-judul" className="title-md">
        Penanggung jawab
      </h2>
      <p>
        {d.escalation.penanggungJawab ? (
          <>
            Kasus ini ditangani oleh <strong>{d.escalation.penanggungJawab}</strong>.
          </>
        ) : (
          'Belum ada penanggung jawab. Kasus tanpa penanggung jawab mudah terlewat.'
        )}
      </p>
      {session?.member.role === 'Ketua' && d.escalation.status !== 'Selesai' && (
        <div className="row" style={{ gap: '0.6rem', flexWrap: 'wrap', alignItems: 'end' }}>
          <div className="field" style={{ margin: 0, minWidth: '14rem' }}>
            <label htmlFor="pj">Tetapkan kepada</label>
            <select
              id="pj"
              value={d.escalation.penanggungJawabId ?? ''}
              onChange={async (ev) => {
                const memberId = ev.target.value || null;
                try {
                  await api(`satgas/cases/${id}/assign`, {
                    method: 'POST',
                    token: session.token,
                    body: { memberId },
                  });
                  setMsg(memberId ? 'Penanggung jawab ditetapkan.' : 'Penugasan dicabut.');
                  await reload();
                } catch (e) {
                  setMsg(e instanceof Error ? e.message : 'Gagal menetapkan.');
                }
              }}
            >
              <option value="">Belum ditugaskan</option>
              {team.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nama} ({m.role})
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </section>
  );
}
