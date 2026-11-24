import { useState } from 'react';
import { removeKodePaksa, setKodePaksa } from '@/lib/vault/vault-client';
import type { ReporterSession } from '@/lib/store';
import { generatePassphrase } from '@gema/passphrase';
import type { Run } from './useRun';

/** Kata sandi kedua yang membuka brankas tiruan saat pelapor dipaksa membuka brankasnya. */
export function KodePaksa({
  session,
  busy,
  msg,
  run,
}: {
  session: ReporterSession;
  busy: boolean;
  msg: string;
  run: Run;
}) {
  const [pass, setPass] = useState('');
  const [judul, setJudul] = useState('Catatan belanja');
  const [isi, setIsi] = useState('Beras 5 kg\nTelur\nSabun cuci\nSayur');
  const decoy = session.vault.t === 'decoy';
  const enough = pass.split(/\s+/).filter(Boolean).length >= 4;
  return (
    <>
      <h2 className="title-md">Kode Paksa</h2>
      {decoy && (
        <p className="card warn">
          Kamu sedang berada di brankas tiruan, jadi pengaturan ini dinonaktifkan.
        </p>
      )}
      <div className="field">
        <label htmlFor="dp">Kata sandi kedua</label>
        <input id="dp" value={pass} onChange={(e) => setPass(e.target.value)} autoComplete="off" />
        <button
          className="btn ghost sm"
          type="button"
          style={{ marginTop: '.5rem' }}
          onClick={() => setPass(generatePassphrase())}
        >
          Buatkan 6 kata
        </button>
        <p className="hint">
          Harus berbeda dari kata sandi aslimu. Hafalkan, jangan ditulis berdekatan dengan yang
          asli.
        </p>
      </div>
      <div className="field">
        <label htmlFor="dj">Judul isi tiruan</label>
        <input id="dj" value={judul} onChange={(e) => setJudul(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="di">Isi tiruan</label>
        <textarea id="di" value={isi} onChange={(e) => setIsi(e.target.value)} />
      </div>
      {msg && (
        <p role="status" className="card tint small">
          {msg}
        </p>
      )}
      <div className="row">
        <button
          className="btn teal"
          disabled={busy || decoy || !enough}
          aria-busy={busy}
          onClick={() =>
            run(
              () => setKodePaksa(session, pass.trim().toLowerCase(), judul, isi),
              'Kode Paksa dipasang.',
            )
          }
        >
          Pasang Kode Paksa
        </button>
        <button
          className="btn ghost"
          disabled={busy || decoy}
          aria-busy={busy}
          onClick={() => run(() => removeKodePaksa(session), 'Kode Paksa dilepas.')}
        >
          Lepas
        </button>
      </div>
    </>
  );
}
