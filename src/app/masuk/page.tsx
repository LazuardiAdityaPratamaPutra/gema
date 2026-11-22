'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useSyncExternalStore } from 'react';
import { loginWithPasskey, passkeySupported } from '@/lib/passkey';
import { login } from '@/lib/vault-client';
import { normalizeCaseCode } from '@gema/crypto';

export default function Masuk() {
  const router = useRouter();
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
            <button
              type="button"
              className="pw-toggle"
              aria-pressed={show}
              onClick={() => setShow((v) => !v)}
            >
              {show ? 'Sembunyikan' : 'Tampilkan'}
            </button>
          </div>
          <p className="hint">Pisahkan dengan spasi.</p>
        </div>
        {error && (
          <p className="err" role="alert">
            {error}
          </p>
        )}
        <button className="btn teal" disabled={busy || !code || !pass}>
          {busy ? 'Membuka…' : 'Masuk'}
        </button>
        {pkOk && (
          <button
            type="button"
            className="btn ghost mt-sm"
            disabled={busy || !code}
            onClick={() => void withPasskey()}
          >
            Masuk dengan passkey
          </button>
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
          Buat brankas anonim
        </Link>
        <Link href="/demo" className="btn ghost sm">
          Coba demo
        </Link>
      </div>
    </div>
  );
}
