import { useEffect, useState } from 'react';
import type { ReporterSession } from '@/lib/store';
import { clearRecovery, recoveryStatus, setupRecovery } from '@/lib/vault/recovery';
import { triggerDownload } from '@/lib/vault/proof';
import type { Run } from './useRun';

type Rec = { set: boolean; setAt: number | null };

/** Tiga bagian kunci yang baru dibuat; tampil sekali, harus segera dibagikan. */
function ShareList({ shares, onClose }: { shares: string[]; onClose: () => void }) {
  return (
    <>
      <p className="card warn small">
        <strong>Simpan sekarang.</strong> Bagian ini tidak akan ditampilkan lagi. Berikan satu
        bagian ke satu orang, lewat cara berbeda (tulis tangan, pesan pribadi). Jangan kirim dua
        bagian ke orang yang sama, dan jangan kirim Kode Kasusmu bersamanya.
      </p>
      <ol className="plain-list">
        {shares.map((x, i) => (
          <li key={i} className="row row-between">
            <span>
              <strong>Bagian {i + 1}</strong>
              <code className="share">{x}</code>
            </span>
            <button
              className="btn ghost sm"
              onClick={() => triggerDownload(`bagian-pemulihan-${i + 1}.txt`, x, 'text/plain')}
            >
              Unduh
            </button>
          </li>
        ))}
      </ol>
      <button className="btn teal" onClick={onClose}>
        Sudah kubagikan, tutup
      </button>
    </>
  );
}

/** Pemulihan lewat orang tepercaya: kunci dipecah tiga, dua bagian cukup untuk memulihkan. */
export function Pemulihan({
  session,
  busy,
  run,
}: {
  session: ReporterSession;
  busy: boolean;
  run: Run;
}) {
  const [rec, setRec] = useState<Rec | null>(null);
  const [shares, setShares] = useState<string[] | null>(null);
  const token = session.token;
  useEffect(() => {
    recoveryStatus(session)
      .then(setRec)
      .catch(() => undefined);
    // hanya bergantung pada token: objek sesi berganti identitas tiap render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <section className="card my-xl" aria-labelledby="pulih">
      <h2 className="title-md" id="pulih">
        Pemulihan lewat orang tepercaya
      </h2>
      <p>
        Lupa kata sandi biasanya berarti brankas hilang selamanya. Dengan pemulihan, kuncimu dipecah
        jadi tiga bagian untuk tiga orang yang kamu percaya. Dua dari mereka, bersama Kode Kasusmu,
        dapat memulihkan brankas. Satu orang saja tidak bisa, dan mereka tidak bisa membaca
        laporanmu.
      </p>
      {session.vault.t === 'decoy' ? (
        <p className="small muted">Dinonaktifkan di brankas tiruan.</p>
      ) : shares ? (
        <ShareList shares={shares} onClose={() => setShares(null)} />
      ) : rec?.set ? (
        <>
          <p>
            <span className="pill amber">Aktif</span> Pemulihan terpasang
            {rec.setAt ? ` sejak ${new Date(rec.setAt).toLocaleDateString('id-ID')}` : ''}. Mau
            mengganti orang tepercaya? Cabut dulu, lalu pasang lagi: bagian lama jadi tak berlaku.
          </p>
          <button
            className="btn ghost sm"
            disabled={busy}
            aria-busy={busy}
            onClick={() =>
              run(async () => {
                await clearRecovery(session);
                setRec({ set: false, setAt: null });
              }, 'Pemulihan dicabut. Bagian lama tidak berlaku lagi.')
            }
          >
            Cabut pemulihan
          </button>
        </>
      ) : (
        <button
          className="btn teal"
          disabled={busy}
          aria-busy={busy}
          onClick={() =>
            run(async () => {
              setShares(await setupRecovery(session));
              setRec({ set: true, setAt: Date.now() });
            }, '')
          }
        >
          Siapkan pemulihan
        </button>
      )}
    </section>
  );
}
