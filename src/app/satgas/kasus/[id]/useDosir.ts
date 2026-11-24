'use client';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { BuktiMeta, Narasi } from '@/lib/laporan/report-format';
import type { SatgasSession } from '@/lib/store';
import type { InstitutionInfo } from '@/lib/vault/vault-client';
import { fetchDosir, type Detail, type Loaded } from './dosir';

export type TeamMember = { id: string; nama: string; role: string };

/** Memuat dosir kasus dan isinya yang terdekripsi, serta menjalankan aksi lalu memuat ulang. */
export function useDosir(session: SatgasSession | null, id: string) {
  const [d, setD] = useState<Detail | null>(null);
  const [dek, setDek] = useState<Uint8Array | null>(null);
  const [narasi, setNarasi] = useState<Narasi | null>(null);
  const [meta, setMeta] = useState<BuktiMeta | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState('');
  const [noKey, setNoKey] = useState(false);
  const [locked, setLocked] = useState(false);

  const apply = useCallback((l: Loaded) => {
    setLocked(l === 'butuh-persetujuan');
    if (l === 'butuh-persetujuan') return;
    setD(l.d);
    setNoKey(!l.decrypted);
    if (!l.decrypted) return;
    setDek(l.decrypted.dek);
    setNarasi(l.decrypted.narasi);
    setMeta(l.decrypted.meta);
    setNotes(l.decrypted.notes);
  }, []);
  const load = useCallback(async () => {
    if (session) apply(await fetchDosir(session, id));
  }, [session, id, apply]);
  useEffect(() => {
    if (!session) return;
    fetchDosir(session, id)
      .then(apply)
      .catch((e) => setMsg(e.message));
  }, [session, id, apply]);

  const act = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      await load();
      setMsg('Tersimpan.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Gagal.');
    }
  };

  return { d, dek, narasi, meta, notes, msg, setMsg, noKey, locked, load, act };
}

/** Anggota tim untuk penugasan; hanya Ketua yang boleh melihat daftarnya. */
export function useTeam(session: SatgasSession | null): TeamMember[] {
  const [team, setTeam] = useState<TeamMember[]>([]);
  useEffect(() => {
    if (session?.member.role === 'Ketua')
      api<{ members: TeamMember[] }>('satgas/team', { token: session.token })
        .then((r) => setTeam(r.members))
        .catch(() => undefined);
  }, [session]);
  return team;
}

/** Data kampus milik sesi ini (untuk rujukan layanan). */
export function useKampus(session: SatgasSession | null): InstitutionInfo | null {
  const [inst, setInst] = useState<InstitutionInfo | null>(null);
  useEffect(() => {
    api<InstitutionInfo[]>('public/institutions')
      .then((l) => setInst(l.find((i) => i.id === session?.institution.id) ?? null))
      .catch(() => undefined);
  }, [session]);
  return inst;
}
