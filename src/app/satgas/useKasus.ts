'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { SatgasSession } from '@/lib/store';
import type { SlaView } from '@/lib/vault/vault-client';

export type Case = {
  id: string;
  alias: string;
  sla: SlaView;
  status: string;
  escalatedAt: number;
  prioritas?: boolean;
  penanggungJawab?: string | null;
  sumber?: string;
  unit?: string;
  cluster?: { total: number; tereskalasi: number; tersegel: number };
  opened?: boolean;
};
export type Waiting = {
  id: string;
  alias: string;
  requester: string | null;
  requestedAt: number;
}[];
export type Ladder = {
  alias: string;
  tingkat: number;
  hariTerlambat: number;
  at: number;
  ke: string;
}[];

const CASE_ROLES = ['Ketua', 'Anggota', 'Pimpinan'];
const LADDER_ROLES = ['Ketua', 'Pimpinan', 'Pengawas'];

/** Permintaan Empat Mata yang menunggu persetujuan sesi ini, disegarkan tiap 5 detik. */
export function useWaiting(session: SatgasSession | null) {
  const [waiting, setWaiting] = useState<Waiting>([]);
  useEffect(() => {
    if (!session || !CASE_ROLES.includes(session.member.role)) return;
    const poll = () =>
      api<{ menungguKamu: Waiting }>('satgas/approvals', { token: session.token })
        .then((r) => setWaiting(r.menungguKamu))
        .catch(() => undefined);
    void poll();
    const t = setInterval(poll, 5000);
    return () => clearInterval(t);
  }, [session]);
  return [waiting, setWaiting] as const;
}

/** Daftar kasus, tangga eskalasi, dan angka agregat; tiap bagian dimuat sesuai peran. */
export function useKasusData(session: SatgasSession | null) {
  const [cases, setCases] = useState<Case[] | null>(null);
  const [ladder, setLadder] = useState<Ladder>([]);
  const [agregat, setAgregat] = useState<number | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    if (!session) return;
    const token = session.token;
    const role = session.member.role;
    if (CASE_ROLES.includes(role))
      api<{ cases: Case[] }>('satgas/cases', { token })
        .then((r) => setCases(r.cases))
        .catch((e) => setErr(e.message));
    if (LADDER_ROLES.includes(role))
      api<{ events?: Ladder; agregat?: { kasusTerlambatT3: number } }>('satgas/ladder', { token })
        .then((r) => {
          setLadder(r.events ?? []);
          setAgregat(r.agregat?.kasusTerlambatT3 ?? null);
        })
        .catch(() => undefined);
  }, [session]);
  return { cases, ladder, agregat, err, setErr };
}
