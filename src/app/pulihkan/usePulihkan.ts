import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { recoverAccount } from '@/lib/vault/recovery';
import { login } from '@/lib/vault/vault-client';
import { normalizeCaseCode } from '@gema/crypto';

export function usePulihkan() {
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

  const ready = !!(code && a.trim() && b.trim() && pass.trim().split(/\s+/).length >= 4);
  return { code, setCode, a, setA, b, setB, pass, setPass, busy, error, ready, submit };
}
