'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useReporter } from '@/components/useReporter';
import { api } from '@/lib/api';
import { submitReport, type InstitutionInfo } from '@/lib/vault-client';
import { clearDraft, loadDraft, saveDraft, type Draft } from '@/lib/drafts';
import { island } from '@/lib/island-bus';
import type { FileInput } from '@/lib/report-build';
import { normalizeName, type LocationKind, type Role } from '@gema/matching';
import type { Relasi } from '@gema/pendamping';
import { takeCarried } from '@/lib/carry';
import { Rujukan } from '@/components/Rujukan';
import { EMPTY, STEPS, fmtClock, hasExtras } from './draft-form';
import { readEvidenceFiles } from './berkas';
import { StepEvent } from './StepEvent';
import { StepReview } from './StepReview';
import { StepWho } from './StepWho';

/** Penjelasan "sebelum mengisi" terbuka di layar lebar dan terlipat di layar sempit agar kolom pertama tidak terdorong ke bawah lipatan. */
const LEBAR = '(min-width: 48em)';
const subscribeLebar = (cb: () => void) => {
  const m = window.matchMedia(LEBAR);
  m.addEventListener('change', cb);
  return () => m.removeEventListener('change', cb);
};
const kLebar = () => window.matchMedia(LEBAR).matches;
const sLebar = () => true;

export default function Baru() {
  const lebar = useSyncExternalStore(subscribeLebar, kLebar, sLebar);
  const { session } = useReporter();
  const router = useRouter();
  const [insts, setInsts] = useState<InstitutionInfo[]>([]);
  const [d, setD] = useState<Draft>(EMPTY);
  const [files, setFiles] = useState<FileInput[]>([]);
  const [restoredAt, setRestoredAt] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fileErr, setFileErr] = useState('');
  const [lastSaved, setLastSaved] = useState(0);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [lostFiles, setLostFiles] = useState<{ nama: string; size: number }[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [fromReview, setFromReview] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const headRef = useRef<HTMLHeadingElement>(null);
  const focusRef = useRef('');
  const dirty = useRef(false);
  const scope = 'baru';

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => {
    dirty.current = true;
    setD((p) => ({ ...p, [k]: v }));
  };
  const inst = insts.find((i) => i.id === d.institutionId);
  const unit = inst?.units.find((u) => u.id === d.unitId);
  const step = Math.min(d.step, STEPS.length - 1);

  useEffect(() => {
    api<InstitutionInfo[]>('public/institutions')
      .then((l) => {
        setInsts(l);
        if (l.length === 1) setD((p) => (p.institutionId ? p : { ...p, institutionId: l[0].id }));
      })
      .catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    if (!session) return;
    const carried = takeCarried();
    void loadDraft(session.kek, session.caseCode, scope).then((x) => {
      if (x) {
        setD(carried && !x.apa ? { ...x, apa: carried } : x);
        setLastSaved(x.savedAt);
        setSaveState('saved');
        setLostFiles(x.fileMeta ?? []);
        setMoreOpen(hasExtras(x));
        setRestoredAt(Math.min(x.step, STEPS.length - 1));
      } else if (carried) {
        dirty.current = true;
        setD((p) => ({ ...p, apa: carried }));
      }
    });
  }, [session]);
  const persistRef = useRef<() => Promise<boolean>>(async () => false);
  useEffect(() => {
    persistRef.current = persistDraft;
  });
  useEffect(() => {
    if (!session) return;
    const t = setInterval(() => {
      if (dirty.current) void persistRef.current();
    }, 10_000);
    // Penguncian otomatis (tidak aktif) meminta draf disimpan dulu agar pekerjaan tidak hilang.
    const onLock = (e: Event) => {
      (e as CustomEvent<{ tasks: Promise<unknown>[] }>).detail.tasks.push(
        dirty.current ? persistRef.current() : Promise.resolve(),
      );
    };
    window.addEventListener('gema:before-lock', onLock);
    return () => {
      clearInterval(t);
      window.removeEventListener('gema:before-lock', onLock);
    };
  }, [session]);
  useEffect(() => {
    const id = focusRef.current;
    focusRef.current = '';
    const target = (id ? document.getElementById(id) : null) ?? headRef.current;
    target?.focus();
  }, [step]);

  const ok = useMemo(
    () => [
      !!d.institutionId && !!d.unitId && d.nama.trim().length >= 3,
      d.apa.trim().length >= 10,
      true,
    ],
    [d],
  );
  const filled = useMemo(
    () => ({ kapan: d.kapan, dimana: d.dimana, saksi: d.saksi, dampak: d.dampak }),
    [d.kapan, d.dimana, d.saksi, d.dampak],
  );
  const missing =
    step === 0
      ? !d.institutionId
        ? 'Pilih kampus dulu.'
        : !d.unitId
          ? 'Pilih unit terlapor dulu.'
          : d.nama.trim().length < 3
            ? 'Tulis nama terlapor, minimal 3 huruf.'
            : ''
      : step === 1 && d.apa.trim().length < 10
        ? 'Ceritakan apa yang terjadi, minimal 10 huruf. Boleh singkat.'
        : '';
  const normName = useMemo(() => normalizeName(d.nama), [d.nama]);

  const draftNow = (): Draft => ({
    ...d,
    savedAt: Date.now(),
    fileMeta: [...files.map((f) => ({ nama: f.nama, size: f.bytes.length })), ...lostFiles],
  });

  async function persistDraft(): Promise<boolean> {
    if (!session) return false;
    const snap = draftNow();
    setSaveState('saving');
    try {
      await saveDraft(session.kek, session.caseCode, scope, snap);
      dirty.current = false;
      setLastSaved(snap.savedAt);
      setSaveState('saved');
      return true;
    } catch {
      setSaveState('error');
      return false;
    }
  }

  /** Pindah ke bagian tertentu dari tinjauan; tombol "Lanjut" lalu membawa kembali ke tinjauan. */
  function editFrom(toStep: number, fieldId: string, extra = false) {
    focusRef.current = fieldId;
    if (extra) setMoreOpen(true);
    setFromReview(true);
    set('step', toStep);
  }

  async function saveForLater() {
    if (!(await persistDraft())) return;
    island.toast('Draf tersimpan. Kamu bisa lanjut kapan saja.');
    router.push('/brankas');
  }

  async function discardDraft() {
    if (!session) return;
    await clearDraft(session.caseCode, scope);
    dirty.current = false;
    setD(EMPTY);
    setFiles([]);
    setLastSaved(0);
    setSaveState('idle');
    setLostFiles([]);
    setMoreOpen(false);
    setFromReview(false);
    setConfirmDiscard(false);
    focusRef.current = '';
    island.toast('Draf dihapus dari perangkat ini.');
  }

  function removeFile(i: number) {
    dirty.current = true;
    setFiles(files.filter((_, j) => j !== i));
  }

  async function addFiles(list: FileList | null) {
    if (!list) return;
    setFileErr('');
    const { files: next, error: err } = await readEvidenceFiles(list, files);
    if (err) setFileErr(err);
    dirty.current = true;
    setLostFiles((m) => m.filter((x) => !next.some((f) => f.nama === x.nama)));
    setFiles(next);
  }

  function skipLost(nama: string) {
    dirty.current = true;
    setLostFiles((m) => m.filter((x) => x.nama !== nama));
  }

  async function send() {
    if (!session || !inst || !unit) return;
    setError('');
    setBusy(true);
    const attrs = {
      role: d.peran as Role,
      location: d.lokasi as LocationKind,
      periods: d.periode
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean),
    };
    try {
      const id = await submitReport(
        session,
        {
          inst,
          k: d.k,
          files,
          attrs,
          narasi: {
            kapan: d.kapan,
            dimana: d.dimana,
            apa: d.apa,
            saksi: d.saksi,
            bukti: d.bukti,
            dampak: d.dampak,
            terlapor: {
              nama: d.nama.trim(),
              alias: d.alias.trim() || undefined,
              unitId: unit.id,
              unitNama: unit.nama,
              peran: d.peran as Role,
              relasi: (d.relasi || undefined) as Relasi | undefined,
            },
            atribut: attrs,
          },
        },
        (label, done, total) => island.progress(label, done, total),
      );
      await clearDraft(session.caseCode, scope);
      router.push(`/brankas/${id}?baru=1`);
    } catch (e) {
      island.clear();
      setBusy(false);
      setError(
        `${e instanceof Error ? e.message : 'Gagal mengunci laporan.'} Laporanmu belum terkunci, tetapi isianmu masih ada di layar dan draf tidak hilang. Coba lagi sebentar lagi.`,
      );
    }
  }

  if (!session)
    return (
      <div className="narrow">
        <p role="status">Memeriksa sesi…</p>
      </div>
    );
  const last = step === STEPS.length - 1;

  return (
    <div className="narrow">
      <ol className="wsteps" aria-label={`Langkah ${step + 1} dari ${STEPS.length}`}>
        {STEPS.map((s, i) => (
          <li key={s} data-on={i <= step} aria-current={i === step ? 'step' : undefined}>
            <span>{i + 1}</span>
            {s}
          </li>
        ))}
      </ol>
      <p className="savestate" data-state={saveState}>
        {saveState === 'saving'
          ? 'Menyimpan…'
          : saveState === 'saved'
            ? `Tersimpan pukul ${fmtClock(lastSaved)}, terenkripsi di perangkat ini`
            : saveState === 'error'
              ? 'Belum tersimpan'
              : 'Draf disimpan otomatis di perangkat ini'}
      </p>
      {saveState === 'error' && (
        <p className="err" role="alert">
          Draf belum bisa disimpan di perangkat ini, mungkin karena penyimpanan peramban penuh atau
          dinonaktifkan. Tulisanmu masih ada di layar.{' '}
          <button type="button" className="btn ghost sm" onClick={() => void persistDraft()}>
            Coba simpan lagi
          </button>
        </p>
      )}
      {restoredAt === step && (
        <p className="card tint small" role="status">
          Draf terenkripsi dipulihkan. Tulisanmu kembali, tetapi isi berkas bukti tidak ikut
          tersimpan
          {lostFiles.length > 0
            ? `. Ada ${lostFiles.length} berkas yang perlu dipilih ulang di langkah Kejadian dan bukti.`
            : '.'}
        </p>
      )}

      {step === 0 && (
        <StepWho
          d={d}
          set={set}
          insts={insts}
          inst={inst}
          normName={normName}
          lebar={lebar}
          headRef={headRef}
        />
      )}
      {step === 1 && (
        <StepEvent
          d={d}
          set={set}
          files={files}
          fileErr={fileErr}
          lostFiles={lostFiles}
          filled={filled}
          moreOpen={moreOpen}
          setMoreOpen={setMoreOpen}
          fileInput={fileInput}
          headRef={headRef}
          onAddFiles={(l) => void addFiles(l)}
          onRemoveFile={removeFile}
          onSkipLost={skipLost}
        />
      )}
      {last && (
        <StepReview
          d={d}
          set={set}
          inst={inst}
          unit={unit}
          files={files}
          lostFiles={lostFiles}
          error={error}
          headRef={headRef}
          editFrom={editFrom}
          onRemoveFile={removeFile}
          onSkipLost={skipLost}
        />
      )}

      {missing && !last && (
        <p
          className="small muted why"
          role="status"
          style={{ marginTop: '1.4rem', marginBottom: 0 }}
        >
          {missing}
        </p>
      )}
      <div className="row" style={{ marginTop: '1rem', justifyContent: 'space-between' }}>
        <button
          className="btn ghost"
          type="button"
          disabled={step === 0 || busy}
          aria-busy={busy}
          onClick={() => set('step', step - 1)}
        >
          Kembali
        </button>
        {!last ? (
          <button
            className="btn teal"
            type="button"
            disabled={!ok[step]}
            onClick={() => {
              if (fromReview) {
                setFromReview(false);
                set('step', STEPS.length - 1);
              } else set('step', step + 1);
            }}
          >
            {fromReview ? 'Kembali ke tinjauan' : 'Lanjut'}
          </button>
        ) : (
          <button
            className="btn teal"
            type="button"
            disabled={busy || lostFiles.length > 0}
            aria-busy={busy}
            aria-describedby={lostFiles.length > 0 ? 'belum-terlampir' : undefined}
            onClick={send}
          >
            {busy ? 'Mengunci…' : 'Kunci dan simpan'}
          </button>
        )}
      </div>

      <aside className="pause" aria-labelledby="jeda">
        <h2 id="jeda" className="title-sm">
          Kamu tidak harus selesai sekarang
        </h2>
        <p className="small m-0">
          Berhenti kapan saja. Ceritamu tersimpan terenkripsi di perangkat ini. Untuk melanjutkan,
          masuk lagi dengan Kode dan kata sandimu. Berkas bukti perlu dipilih ulang karena isinya
          tidak ikut tersimpan.
        </p>
        <div className="row mt-sm">
          <button
            className="btn ghost sm"
            type="button"
            disabled={busy}
            aria-busy={busy}
            onClick={saveForLater}
          >
            Simpan dan lanjutkan nanti
          </button>
          {!confirmDiscard ? (
            <button
              className="btn ghost sm"
              type="button"
              disabled={busy}
              aria-busy={busy}
              onClick={() => setConfirmDiscard(true)}
            >
              Hapus draf ini
            </button>
          ) : (
            <span className="row" role="group" aria-label="Konfirmasi hapus draf">
              <button className="btn danger sm" type="button" onClick={discardDraft}>
                Ya, hapus draf
              </button>
              <button
                className="btn ghost sm"
                type="button"
                onClick={() => setConfirmDiscard(false)}
              >
                Batal
              </button>
            </span>
          )}
        </div>
        <details className="more">
          <summary>Butuh bicara dengan seseorang?</summary>
          <Rujukan kampus={inst?.rujukan} namaKampus={inst?.nama} compact />
        </details>
      </aside>
    </div>
  );
}
