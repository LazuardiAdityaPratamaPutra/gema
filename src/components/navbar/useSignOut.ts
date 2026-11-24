'use client';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { reporterStore, satgasStore, type ReporterSession, type SatgasSession } from '@/lib/store';
import type { NavKind } from './model';

/** Aksi "Keluar sesi" untuk jenis tampilan yang aktif; `null` bila tidak ada sesi untuk ditutup. */
export function useSignOut(
  kind: NavKind,
  satgas: SatgasSession | null,
  reporter: ReporterSession | null,
): (() => void) | null {
  const router = useRouter();
  const revoke = (token: string) =>
    void api('auth/logout', { method: 'POST', token }).catch(() => undefined);

  if (kind === 'staff' && satgas)
    return () => {
      revoke(satgas.token);
      satgasStore.clear();
      router.push('/satgas/masuk');
    };
  if (kind === 'reporter' && reporter)
    return () => {
      revoke(reporter.token);
      reporterStore.clear();
      router.push('/');
    };
  return null;
}
