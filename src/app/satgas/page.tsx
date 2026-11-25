'use client';
import { HeaderPhoto } from '@/components/HeaderPhoto';
import { SatgasBar } from '@/components/SatgasBar';
import { useSatgas } from '@/components/useSatgas';
import { LoadError } from '@/components/LoadError';
import { SkeletonPage, SkeletonTable } from '@/components/Skeleton';
import { AggregateCard, CaseTable, LadderPanel, UrgentCase } from './KasusParts';
import { WaitingPanel } from './WaitingPanel';
import { CASE_ROLES, useKasusData, useWaiting } from './useKasus';

export default function Kasus() {
  const { session } = useSatgas();
  const { cases, ladder, agregat, err, setErr } = useKasusData(session);
  const [waiting, setWaiting] = useWaiting(session);
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
        <h1>{session.member.role === 'Pengawas' ? 'Pengawasan' : 'Kasus tereskalasi'}</h1>
      </header>
      {err && <LoadError what="daftar kasus" message={err} />}
      <WaitingPanel session={session} waiting={waiting} setWaiting={setWaiting} setErr={setErr} />
      {agregat !== null && <AggregateCard agregat={agregat} />}
      {ladder.length > 0 && <LadderPanel ladder={ladder} />}
      {cases && cases.length > 0 && ['Ketua', 'Anggota'].includes(session.member.role) && (
        <UrgentCase c={cases[0]} />
      )}
      {!cases && !err && CASE_ROLES.includes(session.member.role) && (
        <SkeletonTable label="Memuat daftar kasus" />
      )}
      {cases && <CaseTable cases={cases} role={session.member.role} />}
    </div>
  );
}
