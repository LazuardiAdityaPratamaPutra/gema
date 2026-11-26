'use client';
import { useParams } from 'next/navigation';
import { useMemo } from 'react';
import { useSatgas } from '@/components/useSatgas';
import { LoadError } from '@/components/LoadError';
import { SkeletonPage } from '@/components/Skeleton';
import { ClusterNote, DosirHeader, LaporanCard, LockedDosir } from './DosirParts';
import { IsiTerbaca } from './IsiTerbaca';
import { MundurKasus } from './MundurKasus';
import { Penanggung } from './Penanggung';
import { StatusPimpinan } from './StatusPimpinan';
import { Perkembangan } from './Perkembangan';
import { assistInputOf } from './dosir';
import { useDosir, useKampus, useTeam } from './useDosir';

function DosirStaf({ id }: { id: string }) {
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
        {msg ? (
          <>
            <h1 className="title-md">Dosir kasus</h1>
            <LoadError what="dosir kasus ini" message={msg} />
          </>
        ) : (
          <SkeletonPage label="Membuka dosir" />
        )}
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
      {d.escalation.status !== 'Selesai' && <MundurKasus session={session} caseId={id} />}
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

export default function Dosir() {
  const { id } = useParams<{ id: string }>();
  const { session } = useSatgas();
  if (session?.member.role === 'Pimpinan') return <StatusPimpinan session={session} id={id} />;
  return <DosirStaf id={id} />;
}
