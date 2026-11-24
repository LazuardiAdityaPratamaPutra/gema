import Link from 'next/link';
import { DosirAssist } from '@/components/DosirAssist';
import { OwnerProofSatgas } from '@/components/OwnerProofSatgas';
import type { BuktiMeta } from '@/lib/laporan/report-format';
import type { SatgasSession } from '@/lib/store';
import type { InstitutionInfo } from '@/lib/vault/vault-client';
import { BuktiKasus } from './BuktiKasus';
import { CatatanInternal } from './CatatanInternal';
import { RujukanCard } from './DosirParts';
import type { Detail } from './dosir';

type Props = {
  session: SatgasSession;
  d: Detail;
  caseId: string;
  meta: BuktiMeta | null;
  dek: Uint8Array | null;
  noKey: boolean;
  inst: InstitutionInfo | null;
  assistInput: React.ComponentProps<typeof DosirAssist>['input'] | null;
  act: (fn: () => Promise<unknown>) => Promise<void>;
};

/** Bagian dosir yang hanya dibuka Ketua dan Anggota: bantuan menyusun, bukti, rujukan, catatan. */
export function IsiTerbaca({
  session,
  d,
  caseId,
  meta,
  dek,
  noKey,
  inst,
  assistInput,
  act,
}: Props) {
  return (
    <>
      {assistInput && <DosirAssist alias={d.escalation.alias} input={assistInput} />}
      {noKey && (
        <p className="card warn">
          Isi terkunci. Muat kunci rahasia Satgas di halaman <Link href="/satgas/kunci">Kunci</Link>
          , lalu kembali ke sini.
        </p>
      )}
      <BuktiKasus session={session} d={d} meta={meta} dek={dek} act={act} />
      <OwnerProofSatgas session={session} caseId={caseId} />
      <RujukanCard inst={inst} />
      {dek && <CatatanInternal session={session} caseId={caseId} dek={dek} act={act} />}
    </>
  );
}
