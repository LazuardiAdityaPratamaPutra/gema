'use client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { satgasStore, useHydrated, type SatgasSession } from '@/lib/store';

export function useSatgas(): { session: SatgasSession | null; ready: boolean } {
  const router = useRouter();
  const session = satgasStore.use();
  const ready = useHydrated();
  useEffect(() => {
    if (ready && !satgasStore.get()) router.replace('/satgas/masuk');
  }, [ready, session, router]);
  return { session, ready };
}
