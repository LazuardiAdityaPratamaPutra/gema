'use client';
import Link from 'next/link';
import { generatePassphrase } from '@gema/passphrase';
import { usePulihkan } from './usePulihkan';

function ShareField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
        spellCheck={false}
        rows={2}
        className="mono"
        placeholder="GEMA-PULIH-v1.…"
      />
    </div>
  );
}

export default function Pulihkan() {
  const p = usePulihkan();
  return (
    <div className="narrow">
      <header className="ph" data-tab="Brankas">
        <h1>Pulihkan brankas</h1>
        <p className="lede">
          Lupa kata sandi? Kumpulkan dua bagian pemulihan dari dua orang tepercaya, lalu buat kata
          sandi baru. Ini hanya bekerja bila kamu sudah menyiapkan pemulihan sebelumnya.
        </p>
      </header>
      <form onSubmit={p.submit} noValidate>
        <div className="field">
          <label htmlFor="kode">Kode Kasus</label>
          <input
            id="kode"
            value={p.code}
            onChange={(e) => p.setCode(e.target.value)}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            className="mono"
            required
          />
        </div>
        <ShareField
          id="bagian-a"
          label="Bagian pemulihan dari orang pertama"
          value={p.a}
          onChange={p.setA}
        />
        <ShareField
          id="bagian-b"
          label="Bagian pemulihan dari orang kedua"
          value={p.b}
          onChange={p.setB}
        />
        <div className="field">
          <label htmlFor="baru">Kata sandi baru (6 kata)</label>
          <input
            id="baru"
            value={p.pass}
            onChange={(e) => p.setPass(e.target.value)}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            required
          />
          <button
            className="btn ghost sm mt-sm"
            type="button"
            onClick={() => p.setPass(generatePassphrase())}
          >
            Buatkan 6 kata
          </button>
          <p className="hint">Catat di tempat aman. Kata sandi lama tidak berlaku lagi.</p>
        </div>
        {p.error && (
          <p className="err" role="alert">
            {p.error}
          </p>
        )}
        <button className="btn teal" disabled={p.busy || !p.ready} aria-busy={p.busy}>
          {p.busy ? 'Memulihkan…' : 'Pulihkan brankas'}
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
