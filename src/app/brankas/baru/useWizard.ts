import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import type { ReporterSession } from '@/lib/store';
import { island } from '@/lib/ui/island-bus';
import type { InstitutionInfo } from '@/lib/vault/vault-client';
import { STEPS } from './draft-form';
import { sendFailMessage, sendReport, type UnitInfo } from './kirim';
import type { DraftFields, useDraftStorage } from './useDraft';

type Store = ReturnType<typeof useDraftStorage>;

/** Alur wizard: langkah aktif, pindah dari tinjauan, simpan/hapus draf, dan kirim. */
export function useWizard(session: ReporterSession | null, f: DraftFields, store: Store) {
  const router = useRouter();
  const { d, set } = f;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fromReview, setFromReview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const headRef = useRef<HTMLHeadingElement>(null);
  const focusRef = useRef('');
  const step = Math.min(d.step, STEPS.length - 1);

  useEffect(() => {
    const id = focusRef.current;
    focusRef.current = '';
    const target = (id ? document.getElementById(id) : null) ?? headRef.current;
    target?.focus();
  }, [step]);

  /** Pindah ke bagian tertentu dari tinjauan; tombol "Lanjut" lalu membawa kembali ke tinjauan. */
  function editFrom(toStep: number, fieldId: string, extra = false) {
    focusRef.current = fieldId;
    if (extra) f.setMoreOpen(true);
    setFromReview(true);
    set('step', toStep);
  }

  function next() {
    if (!fromReview) return set('step', step + 1);
    setFromReview(false);
    set('step', STEPS.length - 1);
  }

  async function saveForLater() {
    if (!(await store.persist())) return;
    island.toast('Draf tersimpan. Kamu bisa lanjut kapan saja.');
    router.push('/brankas');
  }

  async function discard() {
    await store.discard();
    setFromReview(false);
    focusRef.current = '';
    island.toast('Draf dihapus dari perangkat ini.');
  }

  async function send(inst: InstitutionInfo | undefined, unit: UnitInfo | undefined) {
    if (!session || !inst || !unit) return;
    setError('');
    setBusy(true);
    try {
      router.push(`/brankas/${await sendReport(session, inst, unit, d, f.files)}?baru=1`);
    } catch (e) {
      island.clear();
      setBusy(false);
      setError(sendFailMessage(e));
    }
  }

  return {
    step,
    last: step === STEPS.length - 1,
    busy,
    error,
    setError,
    fromReview,
    fileInputRef,
    headRef,
    editFrom,
    next,
    saveForLater,
    discard,
    send,
  };
}
