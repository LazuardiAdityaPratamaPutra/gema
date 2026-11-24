import { useState } from 'react';
import { Rujukan } from '@/components/Rujukan';
import type { InstitutionInfo } from '@/lib/vault/vault-types';

/** Penegasan "tidak harus selesai sekarang": simpan untuk nanti, hapus draf, dan kontak bantuan. */
export function PausePanel({
  busy,
  inst,
  onSaveLater,
  onDiscard,
}: {
  busy: boolean;
  inst: InstitutionInfo | undefined;
  onSaveLater: () => void;
  onDiscard: () => Promise<void>;
}) {
  const [confirming, setConfirming] = useState(false);
  return (
    <aside className="pause" aria-labelledby="jeda">
      <h2 id="jeda" className="title-sm">
        Kamu tidak harus selesai sekarang
      </h2>
      <p className="small m-0">
        Berhenti kapan saja. Ceritamu tersimpan terenkripsi di perangkat ini. Untuk melanjutkan,
        masuk lagi dengan Kode dan kata sandimu. Berkas bukti perlu dipilih ulang karena isinya
        tidak ikut tersimpan.
      </p>
      <div className="row mt-sm">
        <button
          className="btn ghost sm"
          type="button"
          disabled={busy}
          aria-busy={busy}
          onClick={onSaveLater}
        >
          Simpan dan lanjutkan nanti
        </button>
        {confirming ? (
          <span className="row" role="group" aria-label="Konfirmasi hapus draf">
            <button
              className="btn danger sm"
              type="button"
              onClick={() => void onDiscard().then(() => setConfirming(false))}
            >
              Ya, hapus draf
            </button>
            <button className="btn ghost sm" type="button" onClick={() => setConfirming(false)}>
              Batal
            </button>
          </span>
        ) : (
          <button
            className="btn ghost sm"
            type="button"
            disabled={busy}
            aria-busy={busy}
            onClick={() => setConfirming(true)}
          >
            Hapus draf ini
          </button>
        )}
      </div>
      <details className="more">
        <summary>Butuh bicara dengan seseorang?</summary>
        <Rujukan kampus={inst?.rujukan} namaKampus={inst?.nama} compact />
      </details>
    </aside>
  );
}
