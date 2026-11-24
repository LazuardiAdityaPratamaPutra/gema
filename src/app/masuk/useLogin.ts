import { useRouter } from 'next/navigation';
import { useState, useSyncExternalStore } from 'react';
import { loginWithPasskey, passkeySupported } from '@/lib/vault/passkey';
import { clearLockNote } from '@/lib/vault/lock-note';
import { login } from '@/lib/vault/vault-client';
import { normalizeCaseCode } from '@gema/crypto';

/** Pesan seragam: tidak membedakan kode salah, kata sandi salah, atau akun terkunci. */
const LOGIN_FAILED =
  'Kode atau kata sandi tidak cocok. Periksa ejaan, lalu coba lagi. Setelah beberapa kali gagal, masuk ditunda sementara.';

export function useLogin() {
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
      clearLockNote();
      router.push('/brankas');
    } catch {
      setError(LOGIN_FAILED);
      setBusy(false);
    }
  }

  return {
    code,
    setCode,
    pass,
    setPass,
    busy,
    show,
    toggleShow: () => setShow((v) => !v),
    error,
    pkOk,
    withPasskey,
    submit,
  };
}

export type LoginState = ReturnType<typeof useLogin>;
