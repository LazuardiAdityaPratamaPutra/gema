'use client';
import { useMemo, useSyncExternalStore } from 'react';
import { useReporter } from '@/components/useReporter';
import { SkeletonPage } from '@/components/Skeleton';
import { normalizeName } from '@gema/matching';
import { missingHint, stepReady } from './draft-form';
import { PausePanel } from './PausePanel';
import { SaveBanner } from './SaveBanner';
import { StepEvent } from './StepEvent';
import { StepNav } from './StepNav';
import { StepReview } from './StepReview';
import { StepWho } from './StepWho';
import { useDraftFields, useDraftStorage } from './useDraft';
import { useInstitutions } from './useInstitutions';
import { useWizard } from './useWizard';

/** Penjelasan "sebelum mengisi" terbuka di layar lebar dan terlipat di layar sempit agar kolom pertama tidak terdorong ke bawah lipatan. */
const LEBAR = '(min-width: 48em)';
const subscribeLebar = (cb: () => void) => {
  const m = window.matchMedia(LEBAR);
  m.addEventListener('change', cb);
  return () => m.removeEventListener('change', cb);
};
const kLebar = () => window.matchMedia(LEBAR).matches;
const sLebar = () => true;

/** Semua keadaan wizard: isian, penyimpanan, langkah, dan daftar kampus. */
function useBaru() {
  const lebar = useSyncExternalStore(subscribeLebar, kLebar, sLebar);
  const { session } = useReporter();
  const f = useDraftFields();
  const { d } = f;
  const store = useDraftStorage(session, f);
  const w = useWizard(session, f, store);

  const insts = useInstitutions(
    (id) => f.setD((p) => (p.institutionId ? p : { ...p, institutionId: id })),
    w.setError,
  );
  const inst = insts.find((i) => i.id === d.institutionId);
  const unit = inst?.units.find((u) => u.id === d.unitId);
  const filled = useMemo(
    () => ({ kapan: d.kapan, dimana: d.dimana, saksi: d.saksi, dampak: d.dampak }),
    [d.kapan, d.dimana, d.saksi, d.dampak],
  );
  const normName = useMemo(() => normalizeName(d.nama), [d.nama]);
  return { session, f, store, w, insts, inst, unit, filled, normName, lebar };
}

type Baru = ReturnType<typeof useBaru>;

/** Langkah yang sedang tampil: siapa, apa yang terjadi, lalu tinjau. */
function Langkah({ b }: { b: Baru }) {
  const { f, w, insts, inst, unit, filled, normName, lebar } = b;
  const { d, set, files, lostFiles } = f;
  const { step, last, headRef } = w;
  return (
    <>
      {step === 0 && (
        <StepWho
          d={d}
          set={set}
          insts={insts}
          inst={inst}
          normName={normName}
          lebar={lebar}
          headRef={headRef}
        />
      )}
      {step === 1 && (
        <StepEvent
          d={d}
          set={set}
          files={files}
          fileErr={f.fileErr}
          lostFiles={lostFiles}
          filled={filled}
          moreOpen={f.moreOpen}
          setMoreOpen={f.setMoreOpen}
          fileInput={w.fileInputRef}
          headRef={headRef}
          onAddFiles={(l) => void f.addFiles(l)}
          onRemoveFile={f.removeFile}
          onSkipLost={f.skipLost}
        />
      )}
      {last && (
        <StepReview
          d={d}
          set={set}
          inst={inst}
          unit={unit}
          files={files}
          lostFiles={lostFiles}
          error={w.error}
          headRef={headRef}
          editFrom={w.editFrom}
          onRemoveFile={f.removeFile}
          onSkipLost={f.skipLost}
        />
      )}
    </>
  );
}

export default function Baru() {
  const b = useBaru();
  const { session, f, store, w, inst, unit } = b;
  const { d, set, lostFiles } = f;
  if (!session)
    return (
      <div className="narrow">
        <SkeletonPage label="Memeriksa sesi" />
      </div>
    );

  return (
    <div className="narrow">
      <SaveBanner
        step={w.step}
        saveState={store.saveState}
        lastSaved={store.lastSaved}
        restoredAt={store.restoredAt}
        lostFiles={lostFiles}
        onRetry={() => void store.persist()}
      />
      <Langkah b={b} />
      <StepNav
        step={w.step}
        last={w.last}
        busy={w.busy}
        canNext={stepReady(d)[w.step]}
        fromReview={w.fromReview}
        hasLost={lostFiles.length > 0}
        blocked={!stepReady(d).every(Boolean)}
        hint={missingHint(d, w.step)}
        onBack={() => set('step', w.step - 1)}
        onNext={w.next}
        onSend={() => void w.send(inst, unit)}
      />
      <PausePanel
        busy={w.busy}
        inst={inst}
        onSaveLater={() => void w.saveForLater()}
        onDiscard={w.discard}
      />
    </div>
  );
}
