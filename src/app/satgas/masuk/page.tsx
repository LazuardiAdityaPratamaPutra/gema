'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/api';
import { satgasStore, type SatgasSession } from '@/lib/store';

export default function SatgasMasuk() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);
  async function go(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      const r = await api<SatgasSession>('satgas/login', { body: { email, password: pw } });
      satgasStore.set(r);
      router.push(
        r.member.role === 'Auditor'
          ? '/satgas/audit'
          : r.member.role === 'Pengawas'
            ? '/satgas'
            : '/satgas',
      );
    } catch (x) {
      setErr(x instanceof Error ? x.message : 'Gagal masuk.');
      setBusy(false);
    }
  }
  return (
    <div className="narrow">
      <header className="ph" data-tab="Untuk Satgas PPKPT">
        <h1>Masuk Satgas</h1>
        <p className="lede">Dosir hanya terbuka setelah penyintas memilih eskalasi.</p>
      </header>
      <form onSubmit={go}>
        <div className="field">
          <label htmlFor="e">Email</label>
          <input
            id="e"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
          />
        </div>
        <div className="field">
          <label htmlFor="p">Kata sandi</label>
          <div className="pw-row">
            <input
              id="p"
              type={show ? 'text' : 'password'}
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              autoComplete="current-password"
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
        </div>
        {err && (
          <p className="err" role="alert">
            {err}
          </p>
        )}
        <button className="btn teal" disabled={busy || !email || !pw}>
          {busy ? 'Masuk…' : 'Masuk'}
        </button>
      </form>
      <div className="alt-line">
        <span className="muted">Ingin mencoba tanpa akun?</span>
        <Link href="/demo" className="btn ghost sm">
          Masuk lewat halaman Demo
        </Link>
      </div>
    </div>
  );
}
