'use client';
import Link from 'next/link';
import type { ComponentProps } from 'react';
import { useDemoAktif } from '@/lib/ui/useDemoAktif';

/** Tautan ke halaman demo; tidak dirender sama sekali bila Mode Demo mati. */
export function DemoLink(props: Omit<ComponentProps<typeof Link>, 'href'>) {
  const aktif = useDemoAktif();
  return aktif ? <Link href="/demo" {...props} /> : null;
}
