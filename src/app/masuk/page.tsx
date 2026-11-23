'use client';
import { PasswordEye } from '@/components/PasswordEye';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useSyncExternalStore } from 'react';
import { loginWithPasskey, passkeySupported } from '@/lib/passkey';
import { login } from '@/lib/vault-client';
import { normalizeCaseCode } from '@gema/crypto';
import { Term } from '@/components/Term';
import { clearLockNote, useLockNote } from '@/lib/lock-note';

export default function Masuk() {
  const router = useRouter();
  const locked = useLockNote();
  const [code, setCode] = useState('');
  const [pass, setPass] = useState('');
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const pkOk = useSyncExternalStore(
    () => () => undefined,
    passkeySupported,
    () => false,
  );

  async function withPasskey() {
    setBusy(true);
    setError('');
    try {
      await loginWithPasskey(code);
      router.push('/brankas');
    } catch (x) {
      setError(x instanceof Error ? x.message : 'Masuk dengan passkey gagal.');
      setBusy(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(normalizeCaseCode(code), pass);
      clearLockNote();
      router.push('/brankas');
    } catch {
      // Pesan seragam: tidak membedakan kode salah, kata sandi salah, atau akun terkunci.
      setError(
        'Kode atau kata sandi tidak cocok. Periksa ejaan, lalu coba lagi. Setelah beberapa kali gagal, masuk ditunda sementara.',
      );
      setBusy(false);
    }
  }

  return (
    <div className="narrow">
      <header className="ph" data-tab="Brankas">
        <h1>Masuk ke brankas</h1>
        <p className="lede">Kode dan enam kata dari kartu catatanmu.</p>
      </header>
      {locked && (
        <p className="card tint small" role="status">
          Layar dikunci karena lama tidak aktif. Isianmu yang belum selesai sudah disimpan sebagai
          draf di perangkat ini. Masuk lagi untuk melanjutkan.
        </p>
      )}
      <form onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor="kode">Kode</label>
          <input
            id="kode"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            className="mono"
            required
          />
        </div>
        <div className="field">
          <label htmlFor="sandi">Kata sandi (6 kata)</label>
          <div className="pw-row">
            <input
              id="sandi"
              type={show ? 'text' : 'password'}
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              required
            />
            <PasswordEye show={show} onToggle={() => setShow((v) => !v)} />
          </div>
          <p className="hint">Pisahkan dengan spasi.</p>
        </div>
        {error && (
          <p className="err" role="alert">
            {error}
          </p>
        )}
        <button className="btn teal" disabled={busy || !code || !pass} aria-busy={busy}>
          {busy ? 'Membuka…' : 'Masuk'}
        </button>
        {pkOk && (
          <button
            type="button"
            className="btn ghost mt-sm"
            disabled={busy || !code}
            aria-busy={busy}
            onClick={() => void withPasskey()}
          >
            Masuk dengan passkey
          </button>
        )}
        {pkOk && (
          <p className="hint mt-sm">
            <Term k="passkey" question>
              Apa itu passkey?
            </Term>
          </p>
        )}
      </form>
      <div className="alt-line">
        <span className="muted">Lupa kata sandi?</span>
        <Link href="/pulihkan" className="btn ghost sm">
          Pulihkan lewat orang tepercaya
        </Link>
      </div>
      <div className="alt-line">
        <span className="muted">Belum punya brankas?</span>
        <Link href="/mulai" className="btn ghost sm">
          Buat brankas tanpa nama
        </Link>
        <Link href="/demo" className="btn ghost sm">
          Coba demo
        </Link>
      </div>
    </div>
  );
}
