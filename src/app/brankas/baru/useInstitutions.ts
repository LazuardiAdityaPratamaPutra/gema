'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { InstitutionInfo } from '@/lib/vault/vault-types';

/** Daftar kampus. Bila hanya ada satu, `onlyOne` dipanggil agar langsung terpilih. */
export function useInstitutions(onlyOne: (id: string) => void, onError: (msg: string) => void) {
  const [insts, setInsts] = useState<InstitutionInfo[]>([]);
  useEffect(() => {
    api<InstitutionInfo[]>('public/institutions')
      .then((l) => {
        setInsts(l);
        if (l.length === 1) onlyOne(l[0].id);
      })
      .catch((e) => onError(e.message));
    // Dimuat sekali saat halaman dibuka.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return insts;
}
