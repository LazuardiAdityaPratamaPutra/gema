import type { IslandState } from '@/lib/ui/island-bus';
import { ICheck } from '../Icons';

/** Kabar kemajuan kerja panjang (mengunci laporan, mengunggah bukti) yang tampil di bawah bilah. */
export function StatusPill({ bus }: { bus: IslandState }) {
  if (bus.mode === 'idle') return null;
  const progress = bus.mode === 'progress';
  return (
    <div className="nb-status" role="status" aria-live="polite" data-mode={bus.mode}>
      {progress ? (
        <span className="wave" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
        </span>
      ) : (
        <ICheck />
      )}
      <b>{bus.label}</b>
      {progress && (
        <small>{bus.total ? `${bus.value ?? 0} dari ${bus.total}` : 'Jangan tutup halaman'}</small>
      )}
    </div>
  );
}
