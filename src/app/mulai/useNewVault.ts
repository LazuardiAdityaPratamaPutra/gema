'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { login, newCredentials, registerAccount } from '@/lib/vault/vault-client';
import type { Cred } from './CredentialParts';

/** Kredensial baru dibuat di perangkat ini; `go` mendaftarkan akun, masuk, lalu ke penulisan laporan. */
export function useNewVault() {
  const router = useRouter();
  const [cred, setCred] = useState<Cred | null>(null);
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
  return { cred, busy, error, go };
}
