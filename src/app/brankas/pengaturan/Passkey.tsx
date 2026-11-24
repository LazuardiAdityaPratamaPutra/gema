import { useEffect, useState, useSyncExternalStore } from 'react';
import { Term } from '@/components/Term';
import type { ReporterSession } from '@/lib/store';
import { passkeyStatus, passkeySupported, removePasskey, setupPasskey } from '@/lib/vault/passkey';
import type { Run } from './useRun';

/** Isi bagian passkey sesuai keadaan: brankas tiruan, tak didukung, aktif, atau belum dipasang. */
function PasskeyAction({
  session,
  supported,
  isSet,
  busy,
  run,
  setIsSet,
}: {
  session: ReporterSession;
  supported: boolean;
  isSet: boolean | null;
  busy: boolean;
  run: Run;
  setIsSet: (v: boolean) => void;
}) {
  if (session.vault.t === 'decoy')
    return <p className="small muted">Dinonaktifkan di brankas tiruan.</p>;
  if (!supported) return <p className="small muted">Peramban ini belum mendukung passkey.</p>;
  if (isSet)
    return (
      <>
        <p>
          <span className="pill amber">Aktif</span> Di halaman Masuk, pilih &quot;Masuk dengan
          passkey&quot;.
        </p>
        <button
          className="btn ghost sm"
          disabled={busy}
          aria-busy={busy}
          onClick={() =>
            run(async () => {
              await removePasskey(session);
              setIsSet(false);
            }, 'Passkey dicabut dari brankas ini.')
          }
        >
          Cabut passkey
        </button>
      </>
    );
  return (
    <button
      className="btn teal"
      disabled={busy}
      aria-busy={busy}
      onClick={() =>
        run(async () => {
          await setupPasskey(session);
          setIsSet(true);
        }, 'Passkey terpasang. Kata sandi enam katamu tetap berlaku.')
      }
    >
      Pasang passkey
    </button>
  );
}

/** Masuk tanpa mengetik enam kata, lewat kunci yang dibuat dan disimpan perangkat. */
export function Passkey({
  session,
  busy,
  run,
}: {
  session: ReporterSession;
  busy: boolean;
  run: Run;
}) {
  const [isSet, setIsSet] = useState<boolean | null>(null);
  const supported = useSyncExternalStore(
    () => () => undefined,
    passkeySupported,
    () => false,
  );
  const token = session.token;
  useEffect(() => {
    passkeyStatus(session)
      .then((r) => setIsSet(r.set))
      .catch(() => undefined);
    // hanya bergantung pada token: objek sesi berganti identitas tiap render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);
  return (
    <section className="card my-xl" aria-labelledby="passkey">
      <h2 className="title-md" id="passkey">
        Masuk dengan passkey
      </h2>
      <p>
        Buka brankas dengan sidik jari, wajah, PIN perangkat, atau kunci keamanan, tanpa mengetik
        enam kata. Rahasianya dibuat oleh perangkatmu dan tidak pernah dikirim ke server.
      </p>
      <p className="card warn small">
        <Term k="passkey">Passkey</Term> membuka brankas <strong>asli</strong> langsung dan tidak
        lewat Kode Paksa. Jangan pasang bila kamu mengandalkan Kode Paksa untuk situasi dipaksa.
      </p>
      <PasskeyAction
        session={session}
        supported={supported}
        isSet={isSet}
        busy={busy}
        run={run}
        setIsSet={setIsSet}
      />
    </section>
  );
}
