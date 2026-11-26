'use client';
import { HeaderPhoto } from '@/components/HeaderPhoto';
import { SatgasBar } from '@/components/SatgasBar';
import { useSatgas } from '@/components/useSatgas';
import { LoadError } from '@/components/LoadError';
import { SkeletonPage, SkeletonTable } from '@/components/Skeleton';
import { KunciBelumSiap } from './KunciBelumSiap';
import { PeringatanSistem } from './PeringatanSistem';
import { AggregateCard, CaseTable, LadderPanel, UrgentCase } from './KasusParts';
import { WaitingPanel } from './WaitingPanel';
import { CASE_ROLES, useKasusData, useWaiting, type Case } from './useKasus';
import type { SatgasSession } from '@/lib/store';

type Daftar = {
  session: SatgasSession;
  cases: Case[] | null;
  err: string;
};

/** Kasus paling mendesak, lalu tabel semua kasus; kerangka muat selama daftar belum datang. */
function DaftarKasus({ session, cases, err }: Daftar) {
  const peran = session.member.role;
  const urgent = cases?.find((c) => !c.mundur);
  return (
    <>
      {urgent && ['Ketua', 'Anggota'].includes(peran) && <UrgentCase c={urgent} />}
      {!cases && !err && CASE_ROLES.includes(peran) && (
        <SkeletonTable label="Memuat daftar kasus" />
      )}
      {cases && <CaseTable cases={cases} role={peran} />}
    </>
  );
}

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
      <KunciBelumSiap session={session} />
      <PeringatanSistem session={session} />
      {err && <LoadError what="daftar kasus" message={err} />}
      <WaitingPanel session={session} waiting={waiting} setWaiting={setWaiting} setErr={setErr} />
      {agregat !== null && <AggregateCard agregat={agregat} />}
      {ladder.length > 0 && <LadderPanel ladder={ladder} />}
      <DaftarKasus session={session} cases={cases} err={err} />
    </div>
  );
}
