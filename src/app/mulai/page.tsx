'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { formatCaseCode } from '@gema/crypto';
import { newCredentials, registerAccount, login } from '@/lib/vault-client';
import { buildRecoveryCard } from '@/lib/proof';
import { triggerDownload } from '@/lib/proof';
import { island } from '@/lib/island-bus';

export default function Mulai() {
  const router = useRouter();
  const [cred, setCred] = useState<{ caseCode: string; passphrase: string } | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    void newCredentials().then(setCred);
  }, []);

  async function go() {
    if (!cred) return;
    setBusy(true);
    setError('');
    try {
      await registerAccount(cred.caseCode, cred.passphrase);
      await login(cred.caseCode, cred.passphrase);
      router.push('/brankas/baru');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal membuat brankas.');
      setBusy(false);
    }
  }

  return (
    <div className="narrow">
      <header className="ph" data-tab="Brankas baru">
        <h1>Kode dan kata sandimu</h1>
        <p className="lede">
          Ini satu-satunya kunci brankasmu. Dibuat di perangkat ini, tidak dikirim ke mana pun dalam
          bentuk asli. Bila hilang, tidak ada yang bisa memulihkannya, termasuk kami.
        </p>
      </header>

      <div className="card" aria-live="polite">
        {!cred ? (
          <p className="m-0">Menyiapkan kunci…</p>
        ) : (
          <>
            <div className="field">
              <span className="label">Kode</span>
              <code className="hash title-md">{formatCaseCode(cred.caseCode)}</code>
            </div>
            <div className="field mb-0">
              <span className="label">Kata sandi (6 kata)</span>
              <ol
                style={{
                  margin: 0,
                  paddingLeft: '1.4rem',
                  columns: '2 160px',
                  fontFamily: 'var(--mono)',
                }}
              >
                {cred.passphrase.split(' ').map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ol>
            </div>
          </>
        )}
      </div>

      <div className="row my-md">
        <button
          className="btn ghost sm"
          type="button"
          disabled={!cred}
          onClick={async () =>
            cred &&
            triggerDownload(
              'kartu-catatan.pdf',
              await buildRecoveryCard(cred.caseCode, cred.passphrase, location.origin),
              'application/pdf',
            )
          }
        >
          Unduh kartu cetak (PDF)
        </button>
        <button
          className="btn ghost sm"
          type="button"
          disabled={!cred}
          onClick={() =>
            cred &&
            void navigator.clipboard
              ?.writeText(`${formatCaseCode(cred.caseCode)}\n${cred.passphrase}`)
              .then(
                () => island.toast('Kode dan kata sandi disalin'),
                () => island.toast('Gagal menyalin, catat manual'),
              )
          }
        >
          Salin
        </button>
      </div>
      <p className="small muted">
        Kartu cetak berjudul netral, &quot;Kartu catatan pribadi&quot;, agar tidak menarik perhatian
        bila ditemukan orang lain.
      </p>

      <label className="check mt-lg">
        <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} />
        <span>
          Saya sudah menyimpan kode dan kata sandi ini di tempat yang aman. Saya paham tidak ada
          pemulihan bila keduanya hilang.
        </span>
      </label>
      {error && (
        <p className="err" role="alert">
          {error}
        </p>
      )}
      <button className="btn teal" type="button" disabled={!saved || busy || !cred} onClick={go}>
        {busy ? 'Membuat brankas…' : 'Buat brankas'}
      </button>
      {busy && (
        <p className="small muted" role="status">
          Mengolah kunci. Ini sengaja dibuat lambat dan bisa memakan beberapa detik.
        </p>
      )}
    </div>
  );
}
