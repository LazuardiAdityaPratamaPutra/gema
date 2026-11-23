'use client';
import Link from 'next/link';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { useSearchParams } from 'next/navigation';
import { useReporter } from '@/components/useReporter';
import { removeKodePaksa, setKodePaksa } from '@/lib/vault-client';
import { clearRecovery, recoveryStatus, setupRecovery } from '@/lib/recovery';
import { triggerDownload } from '@/lib/proof';
import { passkeyStatus, passkeySupported, removePasskey, setupPasskey } from '@/lib/passkey';
import { generatePassphrase } from '@gema/passphrase';
import { Term } from '@/components/Term';

export default function Pengaturan() {
  const { session } = useReporter();
  const [pass, setPass] = useState('');
  const [judul, setJudul] = useState('Catatan belanja');
  const [isi, setIsi] = useState('Beras 5 kg\nTelur\nSabun cuci\nSayur');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [rec, setRec] = useState<{ set: boolean; setAt: number | null } | null>(null);
  const [shares, setShares] = useState<string[] | null>(null);
  const [pkSet, setPkSet] = useState<boolean | null>(null);
  const pkOk = useSyncExternalStore(
    () => () => undefined,
    passkeySupported,
    () => false,
  );
  const justRecovered = useSearchParams().get('pulih') === '1';
  const token = session?.token;
  useEffect(() => {
    if (!session) return;
    recoveryStatus(session)
      .then(setRec)
      .catch(() => undefined);
    passkeyStatus(session)
      .then((r) => setPkSet(r.set))
      .catch(() => undefined);
    // hanya bergantung pada token: objek sesi berganti identitas tiap render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);
  if (!session)
    return (
      <div className="narrow">
        <p role="status">Memeriksa sesi…</p>
      </div>
    );

  async function run(fn: () => Promise<void>, ok: string) {
    setBusy(true);
    setMsg('');
    try {
      await fn();
      setMsg(ok);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Gagal.');
    }
    setBusy(false);
  }

  return (
    <div className="narrow">
      <header className="ph">
        <Link href="/brankas" className="back">
          Kembali ke Brankasmu
        </Link>
        <h1>Pengaturan keamanan</h1>
        <p className="lede">
          <Term k="kodePaksa">Kode Paksa</Term> dan pemulihan. Bila dipaksa membuka brankas,
          masukkan kata sandi kedua. Brankas akan menampilkan isi tiruan yang kamu tentukan. Dari
          luar, tidak ada tanda bahwa ada brankas lain.
        </p>
      </header>
      {justRecovered && (
        <p className="card tint" role="status">
          Brankasmu pulih dan kata sandi barumu aktif. Bagian pemulihan yang lama sudah tidak
          berlaku; pasang yang baru di bawah.
        </p>
      )}
      <h2 className="title-md">Kode Paksa</h2>
      {session.vault.t === 'decoy' && (
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
          disabled={
            busy || session.vault.t === 'decoy' || pass.split(/\s+/).filter(Boolean).length < 4
          }
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
          disabled={busy || session.vault.t === 'decoy'}
          aria-busy={busy}
          onClick={() => run(() => removeKodePaksa(session), 'Kode Paksa dilepas.')}
        >
          Lepas
        </button>
      </div>

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
        {session.vault.t === 'decoy' ? (
          <p className="small muted">Dinonaktifkan di brankas tiruan.</p>
        ) : !pkOk ? (
          <p className="small muted">Peramban ini belum mendukung passkey.</p>
        ) : pkSet ? (
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
                  setPkSet(false);
                }, 'Passkey dicabut dari brankas ini.')
              }
            >
              Cabut passkey
            </button>
          </>
        ) : (
          <button
            className="btn teal"
            disabled={busy}
            aria-busy={busy}
            onClick={() =>
              run(async () => {
                await setupPasskey(session);
                setPkSet(true);
              }, 'Passkey terpasang. Kata sandi enam katamu tetap berlaku.')
            }
          >
            Pasang passkey
          </button>
        )}
      </section>
      <section className="card my-xl" aria-labelledby="pulih">
        <h2 className="title-md" id="pulih">
          Pemulihan lewat orang tepercaya
        </h2>
        <p>
          Lupa kata sandi biasanya berarti brankas hilang selamanya. Dengan pemulihan, kuncimu
          dipecah jadi tiga bagian untuk tiga orang yang kamu percaya. Dua dari mereka, bersama Kode
          Kasusmu, dapat memulihkan brankas. Satu orang saja tidak bisa, dan mereka tidak bisa
          membaca laporanmu.
        </p>
        {session.vault.t === 'decoy' ? (
          <p className="small muted">Dinonaktifkan di brankas tiruan.</p>
        ) : shares ? (
          <>
            <p className="card warn small">
              <strong>Simpan sekarang.</strong> Bagian ini tidak akan ditampilkan lagi. Berikan satu
              bagian ke satu orang, lewat cara berbeda (tulis tangan, pesan pribadi). Jangan kirim
              dua bagian ke orang yang sama, dan jangan kirim Kode Kasusmu bersamanya.
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
                    onClick={() =>
                      triggerDownload(`bagian-pemulihan-${i + 1}.txt`, x, 'text/plain')
                    }
                  >
                    Unduh
                  </button>
                </li>
              ))}
            </ol>
            <button className="btn teal" onClick={() => setShares(null)}>
              Sudah kubagikan, tutup
            </button>
          </>
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
      <p className="small muted mt-lg">
        Batas jujur: ini melindungi dari pemaksaan sederhana. Penyerang yang menguasai server dan
        dapat membandingkan banyak akun dapat memperkirakan keberadaan slot kedua dari ukuran yang
        seragam, bukan dari isinya. Pemulihan: dua orang tepercaya yang berkolusi dan tahu Kode
        Kasusmu dapat mengambil alih brankas, jadi pilih orang yang tidak saling berhubungan.
      </p>
    </div>
  );
}
