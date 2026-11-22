'use client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { reporterStore, useHydrated, type ReporterSession } from '@/lib/store';

/** Mengembalikan sesi pelapor; mengalihkan ke /masuk bila tidak ada. `ready` false sampai klien terhidrasi. */
export function useReporter(): { session: ReporterSession | null; ready: boolean } {
  const router = useRouter();
  const session = reporterStore.use();
  const ready = useHydrated();
  useEffect(() => {
    if (ready && !reporterStore.get()) router.replace('/masuk');
  }, [ready, session, router]);
  return { session, ready };
}
