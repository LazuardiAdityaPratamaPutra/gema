'use client';
import { useDictation } from './useDictation';

/** Tombol "Bicara saja": merekam, lalu mengubah suara menjadi teks di perangkat. Teks ditambahkan ke kolom, bisa disunting. */
export function Dictate({
  onText,
  label = 'Bicara saja',
}: {
  onText: (t: string) => void;
  label?: string;
}) {
  const { ok, st, msg, secs, busy, start, stop } = useDictation(onText);
  if (!ok) return null;
  return (
    <div className="dictate">
      {st !== 'rec' ? (
        <button
          type="button"
          className="btn ghost sm mic"
          onClick={start}
          disabled={busy}
          aria-busy={busy}
        >
          <span className="mic-dot" aria-hidden="true" />
          {busy ? 'Memproses…' : label}
        </button>
      ) : (
        <button type="button" className="btn sm mic rec" onClick={stop}>
          <span className="mic-dot" aria-hidden="true" />
          Selesai bicara ({Math.floor(secs / 60)}:{String(secs % 60).padStart(2, '0')})
        </button>
      )}
      <p className="small muted m-0" role="status" aria-live="polite">
        {msg ||
          'Suaramu diubah jadi teks di perangkat ini dan tidak dikirim ke mana pun. Pertama kali, model pengenal suara diunduh sekali dan butuh koneksi.'}
      </p>
    </div>
  );
}
