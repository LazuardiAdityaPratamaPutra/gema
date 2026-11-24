import { Closer, Hero, Limits, ProofBand } from '@/components/home/HomeSections';
import { RoleChooser } from '@/components/home/RoleChooser';
import { EvidenceCheck } from '@/components/home/EvidenceCheck';
import { DeadlineClock } from '@/components/home/DeadlineClock';

export default function Home() {
  return (
    <>
      <Hero />
      <section className="wrap pick" aria-label="Pilih posisimu">
        <RoleChooser />
      </section>
      <ProofBand />
      <EvidenceCheck />
      <DeadlineClock />
      <Limits />
      <Closer />
    </>
  );
}
