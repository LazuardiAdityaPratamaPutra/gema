/** Tombol Kembali, Lanjut, dan Kunci di bawah tiap langkah. */
export function StepNav({
  step,
  last,
  busy,
  canNext,
  fromReview,
  hasLost,
  blocked,
  hint,
  onBack,
  onNext,
  onSend,
}: {
  step: number;
  last: boolean;
  busy: boolean;
  canNext: boolean;
  fromReview: boolean;
  hasLost: boolean;
  blocked: boolean;
  hint: string;
  onBack: () => void;
  onNext: () => void;
  onSend: () => void;
}) {
  return (
    <>
      {hint && !last && (
        <p
          className="small muted why"
          role="status"
          style={{ marginTop: '1.4rem', marginBottom: 0 }}
        >
          {hint}
        </p>
      )}
      <div className="row" style={{ marginTop: '1rem', justifyContent: 'space-between' }}>
        <button
          className="btn ghost"
          type="button"
          disabled={step === 0 || busy}
          aria-busy={busy}
          onClick={onBack}
        >
          Kembali
        </button>
        {last ? (
          <button
            className="btn teal"
            type="button"
            disabled={busy || hasLost || blocked}
            aria-busy={busy}
            aria-describedby={blocked ? 'belum-lengkap' : hasLost ? 'belum-terlampir' : undefined}
            onClick={onSend}
          >
            {busy ? 'Mengunci…' : 'Kunci dan simpan'}
          </button>
        ) : (
          <button className="btn teal" type="button" disabled={!canNext} onClick={onNext}>
            {fromReview ? 'Kembali ke tinjauan' : 'Lanjut'}
          </button>
        )}
      </div>
    </>
  );
}
