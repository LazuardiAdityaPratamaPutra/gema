import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/api';
import { satgasStore, type SatgasSession } from '@/lib/store';
import { clearLockNote } from '@/lib/vault/lock-note';

/** Auditor langsung ke jejak audit; peran lain ke daftar kasus. */
const landingOf = (role: string) => (role === 'Auditor' ? '/satgas/audit' : '/satgas');

export function useSatgasLogin() {
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
      clearLockNote();
      router.push(landingOf(r.member.role));
    } catch (x) {
      setErr(x instanceof Error ? x.message : 'Gagal masuk.');
      setBusy(false);
    }
  }

  return { email, setEmail, pw, setPw, err, busy, show, toggleShow: () => setShow((v) => !v), go };
}

export type SatgasLoginState = ReturnType<typeof useSatgasLogin>;
