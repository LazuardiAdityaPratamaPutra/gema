'use client';
import { useParams } from 'next/navigation';
import { useMemo } from 'react';
import { useSatgas } from '@/components/useSatgas';
import { ClusterNote, DosirHeader, LaporanCard, LockedDosir } from './DosirParts';
import { IsiTerbaca } from './IsiTerbaca';
import { Penanggung } from './Penanggung';
import { Perkembangan } from './Perkembangan';
import { assistInputOf } from './dosir';
import { useDosir, useKampus, useTeam } from './useDosir';

export default function Dosir() {
  const { id } = useParams<{ id: string }>();
  const { session } = useSatgas();
  const x = useDosir(session, id);
  const team = useTeam(session);
  const inst = useKampus(session);
  const { d, dek, narasi, meta, notes, msg, noKey, act } = x;
  const assistInput = useMemo(() => assistInputOf(narasi, meta), [narasi, meta]);

  if (session && x.locked)
    return <LockedDosir session={session} id={id} onApproved={() => void x.load()} />;
  if (!session || !d)
    return (
      <div className="narrow">
        <p role="status">{msg || 'Membuka dosir…'}</p>
      </div>
    );
  const canRead = session.member.role === 'Ketua' || session.member.role === 'Anggota';

  return (
    <div className="wrap" style={{ maxWidth: 900 }}>
      <DosirHeader session={session} d={d} />
      {msg && (
        <p className="card warn small" role="status">
          {msg}
        </p>
      )}
      <ClusterNote cluster={d.cluster} />
      {canRead && narasi && <LaporanCard narasi={narasi} />}
      <Penanggung
        session={session}
        d={d}
        caseId={id}
        team={team}
        setMsg={x.setMsg}
        reload={x.load}
      />
      <Perkembangan session={session} d={d} caseId={id} notes={notes} act={act} />
      {canRead && (
        <IsiTerbaca
          session={session}
          d={d}
          caseId={id}
          meta={meta}
          dek={dek}
          noKey={noKey}
          inst={inst}
          assistInput={assistInput}
          act={act}
        />
      )}
    </div>
  );
}
