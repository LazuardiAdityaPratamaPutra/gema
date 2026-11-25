'use client';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { island } from '@/lib/ui/island-bus';
import { api } from '@/lib/api';
import type { BuktiMeta, Narasi } from '@/lib/laporan/report-format';
import type { ReporterSession } from '@/lib/store';
import {
  listReports,
  openReport,
  type InstitutionInfo,
  type ReportView,
} from '@/lib/vault/vault-client';

export type Plain = { dek: Uint8Array; narasi: Narasi; meta: BuktiMeta };
type Loaded = 'hilang' | { report: ReportView; plain: Plain; inst: InstitutionInfo | null };

/** Mengambil laporan lalu membukanya dengan kunci di perangkat ini. Tanpa efek samping pada state. */
async function fetchReport(session: ReporterSession, id: string): Promise<Loaded> {
  const report = (await listReports(session)).find((x) => x.id === id);
  if (!report) return 'hilang';
  const plain = await openReport(session, report);
  const institutions = await api<InstitutionInfo[]>('public/institutions');
  return { report, plain, inst: institutions.find((i) => i.id === report.institutionId) ?? null };
}

/** Memuat satu laporan beserta isinya yang terbuka, dan menjalankan aksi lalu memuat ulang. */
export function useReportDetail(session: ReporterSession | null, id: string) {
  const router = useRouter();
  const [r, setR] = useState<ReportView | null>(null);
  const [plain, setPlain] = useState<Plain | null>(null);
  const [inst, setInst] = useState<InstitutionInfo | null>(null);
  const [msg, setMsgRaw] = useState('');
  const [tone, setTone] = useState<'ok' | 'err'>('err');
  const okRef = useRef('');
  // Pesan sama dengan teks sukses aksi yang sedang berjalan (atau ditandai ok) bernada berhasil.
  const setMsg = useCallback((m: string, ok = false) => {
    const good = ok || (m !== '' && m === okRef.current);
    setTone(good ? 'ok' : 'err');
    setMsgRaw(m);
    if (good) island.toast(m.length > 70 ? `${m.slice(0, 67)}…` : m);
  }, []);
  const [busy, setBusy] = useState(false);

  const apply = useCallback(
    (l: Loaded) => {
      if (l === 'hilang') {
        router.replace('/brankas');
        return;
      }
      setR(l.report);
      setPlain(l.plain);
      setInst(l.inst);
    },
    [router],
  );
  const load = useCallback(async () => {
    if (session) apply(await fetchReport(session, id));
  }, [session, id, apply]);
  const first = useCallback(() => {
    if (!session) return;
    fetchReport(session, id)
      .then(apply)
      .catch((e) => setMsg(e.message));
  }, [session, id, apply, setMsg]);
  useEffect(first, [first]);

  const act = async (fn: () => Promise<unknown>, ok: string, onDone?: () => void) => {
    setBusy(true);
    okRef.current = ok;
    setMsg('');
    try {
      await fn();
      await load();
      setMsg(ok);
      onDone?.();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Gagal.');
    }
    setBusy(false);
  };
  const retry = () => {
    setMsg('');
    first();
  };

  return { r, plain, inst, msg, tone, setMsg, busy, act, retry };
}
