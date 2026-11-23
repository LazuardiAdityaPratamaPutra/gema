'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { recoverAccount } from '@/lib/recovery';
import { login } from '@/lib/vault-client';
import { normalizeCaseCode } from '@gema/crypto';
import { generatePassphrase } from '@gema/passphrase';

export default function Pulihkan() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [pass, setPass] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const sandi = pass.trim().toLowerCase();
      await recoverAccount(code, [a, b], sandi);
      await login(normalizeCaseCode(code), sandi);
      router.push('/brankas/pengaturan?pulih=1');
    } catch (x) {
      setError(x instanceof Error ? x.message : 'Pemulihan gagal. Periksa lagi, lalu coba lagi.');
      setBusy(false);
    }
  }

  const ready = code && a.trim() && b.trim() && pass.trim().split(/\s+/).length >= 4;
  return (
    <div className="narrow">
      <header className="ph" data-tab="Brankas">
        <h1>Pulihkan brankas</h1>
        <p className="lede">
          Lupa kata sandi? Kumpulkan dua bagian pemulihan dari dua orang tepercaya, lalu buat kata
          sandi baru. Ini hanya bekerja bila kamu sudah menyiapkan pemulihan sebelumnya.
        </p>
      </header>
      <form onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor="kode">Kode Kasus</label>
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
          <label htmlFor="bagian-a">Bagian pemulihan dari orang pertama</label>
          <textarea
            id="bagian-a"
            value={a}
            onChange={(e) => setA(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            rows={2}
            className="mono"
            placeholder="GEMA-PULIH-v1.…"
          />
        </div>
        <div className="field">
          <label htmlFor="bagian-b">Bagian pemulihan dari orang kedua</label>
          <textarea
            id="bagian-b"
            value={b}
            onChange={(e) => setB(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            rows={2}
            className="mono"
            placeholder="GEMA-PULIH-v1.…"
          />
        </div>
        <div className="field">
          <label htmlFor="baru">Kata sandi baru (6 kata)</label>
          <input
            id="baru"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            required
          />
          <button
            className="btn ghost sm mt-sm"
            type="button"
            onClick={() => setPass(generatePassphrase())}
          >
            Buatkan 6 kata
          </button>
          <p className="hint">Catat di tempat aman. Kata sandi lama tidak berlaku lagi.</p>
        </div>
        {error && (
          <p className="err" role="alert">
            {error}
          </p>
        )}
        <button className="btn teal" disabled={busy || !ready} aria-busy={busy}>
          {busy ? 'Memulihkan…' : 'Pulihkan brankas'}
        </button>
      </form>
      <div className="alt-line">
        <span className="muted">Ingat kata sandimu?</span>
        <Link href="/masuk" className="btn ghost sm">
          Masuk biasa
        </Link>
      </div>
    </div>
  );
}
