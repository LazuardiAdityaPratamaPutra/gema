'use client';
import { useEffect, useRef, useState } from 'react';
import { clearDraft, loadDraft, saveDraft, type Draft } from '@/lib/laporan/drafts';
import type { FileInput } from '@/lib/laporan/report-build';
import type { ReporterSession } from '@/lib/store';
import { takeCarried } from '@/lib/ui/carry';
import { readEvidenceFiles } from './berkas';
import { EMPTY, STEPS, hasExtras, type SetField } from './draft-form';

export type LostFile = { nama: string; size: number };
export type SaveState = 'idle' | 'saving' | 'saved' | 'error';

const SCOPE = 'baru';

/** Isian draf dan berkas bukti di layar. Setiap perubahan menandai draf perlu disimpan. */
export function useDraftFields() {
  const [d, setD] = useState<Draft>(EMPTY);
  const [files, setFiles] = useState<FileInput[]>([]);
  const [lostFiles, setLostFiles] = useState<LostFile[]>([]);
  const [fileErr, setFileErr] = useState('');
  const [moreOpen, setMoreOpen] = useState(false);
  const dirtyRef = useRef(false);

  const set: SetField = (k, v) => {
    dirtyRef.current = true;
    setD((p) => ({ ...p, [k]: v }));
  };
  const removeFile = (i: number) => {
    dirtyRef.current = true;
    setFiles(files.filter((_, j) => j !== i));
  };
  const skipLost = (nama: string) => {
    dirtyRef.current = true;
    setLostFiles((m) => m.filter((x) => x.nama !== nama));
  };
  async function addFiles(list: FileList | null) {
    if (!list) return;
    setFileErr('');
    const { files: next, error: err } = await readEvidenceFiles(list, files);
    if (err) setFileErr(err);
    dirtyRef.current = true;
    setLostFiles((m) => m.filter((x) => !next.some((f) => f.nama === x.nama)));
    setFiles(next);
  }
  const reset = () => {
    dirtyRef.current = false;
    setD(EMPTY);
    setFiles([]);
    setLostFiles([]);
    setMoreOpen(false);
  };

  return {
    d,
    setD,
    set,
    files,
    lostFiles,
    setLostFiles,
    fileErr,
    moreOpen,
    setMoreOpen,
    dirtyRef,
    addFiles,
    removeFile,
    skipLost,
    reset,
  };
}
export type DraftFields = ReturnType<typeof useDraftFields>;

/** Memulihkan, menyimpan otomatis (terenkripsi di perangkat), dan menghapus draf. */
export function useDraftStorage(session: ReporterSession | null, f: DraftFields) {
  const { d, files, lostFiles, dirtyRef, setD, setLostFiles, setMoreOpen } = f;
  const [restoredAt, setRestoredAt] = useState<number | null>(null);
  const [lastSaved, setLastSaved] = useState(0);
  const [saveState, setSaveState] = useState<SaveState>('idle');

  async function persist(): Promise<boolean> {
    if (!session) return false;
    const snap: Draft = {
      ...d,
      savedAt: Date.now(),
      fileMeta: [...files.map((x) => ({ nama: x.nama, size: x.bytes.length })), ...lostFiles],
    };
    setSaveState('saving');
    try {
      await saveDraft(session.kek, session.caseCode, SCOPE, snap);
      dirtyRef.current = false;
      setLastSaved(snap.savedAt);
      setSaveState('saved');
      return true;
    } catch {
      setSaveState('error');
      return false;
    }
  }

  useEffect(() => {
    if (!session) return;
    const carried = takeCarried();
    void loadDraft(session.kek, session.caseCode, SCOPE).then((x) => {
      if (x) {
        setD(carried && !x.apa ? { ...x, apa: carried } : x);
        setLastSaved(x.savedAt);
        setSaveState('saved');
        setLostFiles(x.fileMeta ?? []);
        setMoreOpen(hasExtras(x));
        setRestoredAt(Math.min(x.step, STEPS.length - 1));
      } else if (carried) {
        dirtyRef.current = true;
        setD((p) => ({ ...p, apa: carried }));
      }
    });
  }, [session, setD, setLostFiles, setMoreOpen, dirtyRef]);

  const persistRef = useRef<() => Promise<boolean>>(async () => false);
  useEffect(() => {
    persistRef.current = persist;
  });
  useEffect(() => {
    if (!session) return;
    const t = setInterval(() => {
      if (dirtyRef.current) void persistRef.current();
    }, 10_000);
    // Penguncian otomatis (tidak aktif) meminta draf disimpan dulu agar pekerjaan tidak hilang.
    const onLock = (e: Event) => {
      (e as CustomEvent<{ tasks: Promise<unknown>[] }>).detail.tasks.push(
        dirtyRef.current ? persistRef.current() : Promise.resolve(),
      );
    };
    window.addEventListener('gema:before-lock', onLock);
    return () => {
      clearInterval(t);
      window.removeEventListener('gema:before-lock', onLock);
    };
  }, [session, dirtyRef]);

  async function discard() {
    if (!session) return;
    await clearDraft(session.caseCode, SCOPE);
    f.reset();
    setLastSaved(0);
    setSaveState('idle');
  }

  return { restoredAt, lastSaved, saveState, persist, discard };
}
