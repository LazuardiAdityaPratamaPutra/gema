import { STEPS, fmtClock } from './draft-form';
import type { LostFile, SaveState } from './useDraft';

const STATE_TEXT: Record<Exclude<SaveState, 'saved'>, string> = {
  saving: 'Menyimpan…',
  error: 'Belum tersimpan',
  idle: 'Draf disimpan otomatis di perangkat ini',
};

/** Indikator langkah, status simpan, galat simpan, dan kabar draf yang dipulihkan. */
export function SaveBanner({
  step,
  saveState,
  lastSaved,
  restoredAt,
  lostFiles,
  onRetry,
}: {
  step: number;
  saveState: SaveState;
  lastSaved: number;
  restoredAt: number | null;
  lostFiles: LostFile[];
  onRetry: () => void;
}) {
  const text =
    saveState === 'saved'
      ? `Tersimpan pukul ${fmtClock(lastSaved)}, terenkripsi di perangkat ini`
      : STATE_TEXT[saveState];
  return (
    <>
      <ol className="wsteps" aria-label={`Langkah ${step + 1} dari ${STEPS.length}`}>
        {STEPS.map((s, i) => (
          <li key={s} data-on={i <= step} aria-current={i === step ? 'step' : undefined}>
            <span>{i + 1}</span>
            {s}
          </li>
        ))}
      </ol>
      <p className="savestate" data-state={saveState}>
        {text}
      </p>
      {saveState === 'error' && (
        <p className="err" role="alert">
          Draf belum bisa disimpan di perangkat ini, mungkin karena penyimpanan peramban penuh atau
          dinonaktifkan. Tulisanmu masih ada di layar.{' '}
          <button type="button" className="btn ghost sm" onClick={onRetry}>
            Coba simpan lagi
          </button>
        </p>
      )}
      {restoredAt === step && (
        <p className="card tint small" role="status">
          Draf terenkripsi dipulihkan. Tulisanmu kembali, tetapi isi berkas bukti tidak ikut
          tersimpan
          {lostFiles.length > 0
            ? `. Ada ${lostFiles.length} berkas yang perlu dipilih ulang di langkah Kejadian dan bukti.`
            : '.'}
        </p>
      )}
    </>
  );
}
