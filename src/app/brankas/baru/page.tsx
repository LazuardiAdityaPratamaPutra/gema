'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useReporter } from '@/components/useReporter';
import { api } from '@/lib/api';
import { submitReport, type InstitutionInfo } from '@/lib/vault-client';
import { MAX_FILE, MAX_FILES } from '@/lib/report-format';
import { clearDraft, loadDraft, saveDraft, type Draft } from '@/lib/drafts';
import { fmtBytes } from '@/lib/format';
import { island } from '@/lib/island-bus';
import type { FileInput } from '@/lib/report-build';
import { normalizeName, type LocationKind, type Role } from '@gema/matching';
import { RELASI_LABEL, isDependent, type Relasi } from '@gema/pendamping';
import { Dictate } from '@/components/Dictate';
import { Nudges } from '@/components/Nudges';
import { ChatSignals } from '@/components/ChatSignals';
import { takeCarried } from '@/lib/carry';
import { Rujukan } from '@/components/Rujukan';
import { Term } from '@/components/Term';
import { VeilBar } from '@/components/Veil';

/** Penjelasan "sebelum mengisi" terbuka di layar lebar dan terlipat di layar sempit agar kolom pertama tidak terdorong ke bawah lipatan. */
const LEBAR = '(min-width: 48em)';
const subscribeLebar = (cb: () => void) => {
  const m = window.matchMedia(LEBAR);
  m.addEventListener('change', cb);
  return () => m.removeEventListener('change', cb);
};
const kLebar = () => window.matchMedia(LEBAR).matches;
const sLebar = () => true;

const EMPTY: Draft = {
  kapan: '',
  dimana: '',
  apa: '',
  saksi: '',
  bukti: '',
  dampak: '',
  nama: '',
  alias: '',
  unitId: '',
  peran: 'dosen',
  periode: '',
  lokasi: 'kampus',
  k: 2,
  institutionId: '',
  step: 0,
  savedAt: 0,
  relasi: '',
};
const STEPS = ['Siapa dan di mana', 'Kejadian dan bukti', 'Tinjau dan kunci'];
const PERAN_LABEL: Record<string, string> = {
  dosen: 'Dosen',
  tendik: 'Tenaga kependidikan',
  mahasiswa: 'Mahasiswa',
  lainnya: 'Lainnya',
};
const hasExtras = (d: Draft) => !!(d.saksi || d.dampak || d.alias || d.periode);
const fmtClock = (ms: number) =>
  new Date(ms).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

/** Lampiran dari draf yang belum dipasang lagi. Isinya tidak ikut tersimpan, jadi harus dipilih ulang atau dilewati dengan sadar. */
function MissingFiles({
  items,
  onPick,
  onSkip,
  tone,
}: {
  items: { nama: string; size: number }[];
  onPick: () => void;
  onSkip: (nama: string) => void;
  tone: 'warn' | 'alert';
}) {
  if (items.length === 0) return null;
  return (
    <section className={`card ${tone} small`} aria-labelledby="belum-terlampir">
      <h2 id="belum-terlampir" className="title-sm m-0">
        {items.length} berkas dari draf belum terlampir
      </h2>
      <p className="m-0">
        Isi berkas tidak ikut tersimpan di draf. Kalau kamu mengunci sekarang, berkas ini tidak akan
        ada di laporanmu.
      </p>
      <ul className="plain-list">
        {items.map((m) => (
          <li key={m.nama} className="row row-between">
            <span>
              <strong>{m.nama}</strong>{' '}
              <span className="muted">{fmtBytes(m.size)}, belum terlampir</span>
            </span>
            <button
              type="button"
              className="btn ghost sm"
              aria-label={`Lewati ${m.nama}, kunci tanpa berkas ini`}
              onClick={() => onSkip(m.nama)}
            >
              Lewati
            </button>
          </li>
        ))}
      </ul>
      <button type="button" className="btn teal sm" onClick={onPick}>
        Pilih ulang berkas
      </button>
    </section>
  );
}

/** Satu bagian tinjauan dengan tombol Ubah yang menyebut bagiannya untuk pembaca layar. */
function ReviewPart({
  title,
  onEdit,
  editLabel,
  children,
}: {
  title: string;
  onEdit: () => void;
  editLabel: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card review-part sensitive">
      <div className="row row-between">
        <h2 className="title-sm m-0">{title}</h2>
        <button type="button" className="btn ghost sm" aria-label={editLabel} onClick={onEdit}>
          Ubah
        </button>
      </div>
      {children}
    </section>
  );
}

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
    const next = [...files];
    for (const f of Array.from(list)) {
      if (next.length >= MAX_FILES) {
        setFileErr(`Maksimum ${MAX_FILES} berkas.`);
        break;
      }
      if (f.size > MAX_FILE) {
        setFileErr(`${f.name} melebihi ${fmtBytes(MAX_FILE)}.`);
        continue;
      }
      const bytes = new Uint8Array(await f.arrayBuffer());
      const item: FileInput = { nama: f.name, tipe: f.type || 'application/octet-stream', bytes };
      if (/\.txt$/i.test(f.name)) {
        const text = new TextDecoder().decode(bytes);
        const { looksLikeWhatsApp, parseWhatsApp } = await import('@gema/chat-parser');
        if (looksLikeWhatsApp(text))
          item.messages = parseWhatsApp(text)
            .messages.filter((m) => !m.system)
            .map(({ ts, sender, text: t, attachment }) => ({ ts, sender, text: t, attachment }));
      }
      next.push(item);
    }
    dirty.current = true;
    setLostFiles((m) => m.filter((x) => !next.some((f) => f.nama === x.nama)));
    setFiles(next);
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
        <section>
          <h1 ref={headRef} tabIndex={-1}>
            Siapa dan di mana?
          </h1>
          <details className="card ctx" open={lebar}>
            <summary>
              <h2 id="ctx-judul" className="title-sm">
                Sebelum mengisi: ini yang terjadi pada isianmu
              </h2>
            </summary>
            <dl className="ctx-list">
              <div>
                <dt>Yang kami minta</dt>
                <dd>
                  Kampus dan unit, nama orang yang kamu laporkan dan perannya, apakah ia punya kuasa
                  atas studi atau pekerjaanmu, lalu kejadian dan bukti. Namamu, email, dan nomor
                  teleponmu tidak diminta.
                </dd>
              </div>
              <div>
                <dt>Yang terlihat saat eskalasi</dt>
                <dd>
                  Sebelum kamu memilih <Term k="eskalasi">eskalasi</Term>, hanya kamu yang bisa
                  membaca isinya. Sesudahnya, Satgas kampus bisa membaca seluruh isi laporan dan
                  bukti dengan nama samaran kasus. Gema tidak pernah meminta identitasmu, tetapi
                  cerita dan buktimu bisa memuat petunjuk tentang siapa kamu.
                </dd>
              </div>
            </dl>
            <details className="more">
              <summary>Mengapa diminta, dan apa yang dipakai untuk mencocokkan</summary>
              <dl className="ctx-list">
                <div>
                  <dt>Mengapa diminta</dt>
                  <dd>
                    Kampus dan unit menentukan Satgas mana yang menangani. Peran dan kuasa membantu
                    menilai apakah kasusmu perlu diprioritaskan. Kejadian dan bukti adalah isi
                    laporanmu.
                  </dd>
                </div>
                <div>
                  <dt>Yang dipakai untuk mencocokkan</dt>
                  <dd>
                    Hanya nama terlapor (dalam beberapa ejaan), unit, peran, periode, dan lokasi
                    umum. Semuanya diolah di perangkatmu menjadi kode, lalu server mencocokkan kode
                    itu dengan laporan lain. Server tidak menerima nama aslinya. Kejadian dan bukti
                    tidak ikut dicocokkan.
                  </dd>
                </div>
              </dl>
            </details>
          </details>
          <div className="field">
            <label htmlFor="inst">Perguruan tinggi</label>
            <select
              id="inst"
              value={d.institutionId}
              onChange={(e) => {
                set('institutionId', e.target.value);
                set('unitId', '');
              }}
            >
              <option value="">Pilih…</option>
              {insts.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.nama}
                  {i.demo ? ' (demo)' : ''}
                </option>
              ))}
            </select>
          </div>
          {inst?.demo && (
            <p className="card warn small" role="note">
              Ini kampus demo. Semua datanya fiktif, jadi jangan masukkan cerita atau bukti
              sungguhan.
            </p>
          )}
          {inst && (
            <div className="field">
              <label htmlFor="unit">Fakultas atau unit terlapor</label>
              <select id="unit" value={d.unitId} onChange={(e) => set('unitId', e.target.value)}>
                <option value="">Pilih…</option>
                {inst.units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nama}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="field">
            <label htmlFor="nama">Nama orang yang kamu laporkan</label>
            <input
              id="nama"
              value={d.nama}
              onChange={(e) => set('nama', e.target.value)}
              autoComplete="off"
              aria-describedby="nama-info"
            />
            <div id="nama-info">
              <p className="hint">
                Ini nama pihak yang dilaporkan (terlapor), bukan namamu. Gema tidak pernah meminta
                identitasmu. Nama disamarkan di perangkatmu sebelum dipakai mencocokkan, jadi server
                tidak menerima nama aslinya.
              </p>
              <details className="more">
                <summary>Tidak tahu nama lengkapnya?</summary>
                <p>
                  Tulis sebisamu, misalnya nama depan atau nama yang biasa dipakai, tanpa gelar pun
                  boleh (minimal 3 huruf). Gelar dan ejaan yang mirip dibaca sama.
                </p>
                <p>
                  Pencocokan dengan laporan lain paling akurat bila namanya selengkap yang ditulis
                  pelapor lain. Bila kamu hanya tahu julukan atau jabatan, laporanmu tetap tersimpan
                  utuh sebagai bukti, tetapi mungkin tidak otomatis terhubung dengan laporan lain
                  tentang orang yang sama. Nama ini bisa kamu ubah lagi sebelum mengunci.
                </p>
              </details>
            </div>
            {normName && normName !== d.nama.trim().toLowerCase() && (
              <p className="normname">
                Dibaca sebagai <b>{normName}</b>: gelar dan sapaan dibuang agar ejaan berbeda tetap
                cocok.
              </p>
            )}
          </div>
          <div className="field">
            <label htmlFor="peran">Peran terlapor</label>
            <select id="peran" value={d.peran} onChange={(e) => set('peran', e.target.value)}>
              <option value="dosen">Dosen</option>
              <option value="tendik">Tenaga kependidikan</option>
              <option value="mahasiswa">Mahasiswa</option>
              <option value="lainnya">Lainnya</option>
            </select>
          </div>
          <fieldset className="field relasi">
            <legend className="label">
              Apakah terlapor punya kuasa atas studimu atau pekerjaanmu?
            </legend>
            <p className="hint">
              Bila ya, saat <Term k="eskalasi">eskalasi</Term> kamu bisa meminta Satgas
              memprioritaskan kasusmu dan mempertimbangkan pelindungan, misalnya pengalihan
              pembimbing.
            </p>
            <div className="choices">
              {(Object.keys(RELASI_LABEL) as Relasi[]).map((k) => (
                <label key={k} className="choice">
                  <input
                    type="radio"
                    name="relasi"
                    checked={d.relasi === k}
                    onChange={() => set('relasi', k)}
                  />
                  <span>{RELASI_LABEL[k]}</span>
                </label>
              ))}
            </div>
            {isDependent(d.relasi as Relasi) && (
              <p className="card tint small mt-sm">
                Dicatat. Ini akan ditawarkan sebagai tanda prioritas saat kamu memilih eskalasi.
              </p>
            )}
          </fieldset>
          {inst?.fpMode === 'hmac' && (
            <p className="card warn small">
              Kampus ini memakai <Term k="hmac">mode cadangan</Term>: perlindungan pencocokan lebih
              lemah daripada <Term k="jembatanButa">Jembatan Buta</Term> penuh.
            </p>
          )}
        </section>
      )}

      {step === 1 && (
        <section>
          <h1 ref={headRef} tabIndex={-1}>
            Apa yang terjadi?
          </h1>
          <p className="muted">
            Tulis sebanyak yang kamu mampu. Bagian yang terlalu berat boleh dikosongkan atau ditulis
            nanti. Kamu bisa kembali melengkapi.
          </p>
          <div className="field">
            <label htmlFor="apa">Kejadian</label>
            <textarea
              id="apa"
              rows={7}
              value={d.apa}
              onChange={(e) => set('apa', e.target.value)}
            />
            <Dictate onText={(t) => set('apa', d.apa ? `${d.apa} ${t}` : t)} />
            <Nudges text={d.apa} filled={filled} />
          </div>
          <div className="grid g2" style={{ gap: '1rem' }}>
            <div className="field">
              <label htmlFor="kapan">Kapan</label>
              <input id="kapan" value={d.kapan} onChange={(e) => set('kapan', e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="dimana">Di mana</label>
              <input id="dimana" value={d.dimana} onChange={(e) => set('dimana', e.target.value)} />
            </div>
          </div>
          <label className="drop light" htmlFor="berkas">
            <span>
              Tambah bukti
              <small>
                Maks. {MAX_FILES} berkas, {fmtBytes(MAX_FILE)} per berkas. Ekspor chat WhatsApp
                (.txt) terbaca per pesan.
              </small>
            </span>
            <input
              id="berkas"
              ref={fileInput}
              type="file"
              multiple
              onChange={(e) => {
                void addFiles(e.target.files);
                e.target.value = '';
              }}
            />
          </label>
          {fileErr && (
            <p className="err" role="alert">
              {fileErr}
            </p>
          )}
          <MissingFiles
            items={lostFiles}
            tone="warn"
            onPick={() => fileInput.current?.click()}
            onSkip={(n) => {
              dirty.current = true;
              setLostFiles(lostFiles.filter((x) => x.nama !== n));
            }}
          />
          <ul style={{ padding: 0, listStyle: 'none' }}>
            {files.map((f, i) => (
              <li
                key={i}
                className="card row"
                style={{
                  justifyContent: 'space-between',
                  marginBottom: '.5rem',
                  padding: '.7rem 1rem',
                }}
              >
                <span>
                  <strong>{f.nama}</strong>{' '}
                  <span className="muted small">
                    {fmtBytes(f.bytes.length)}
                    {f.messages ? `, ${f.messages.length} pesan` : ''}
                  </span>
                </span>
                <button className="btn ghost sm" type="button" onClick={() => removeFile(i)}>
                  Hapus
                </button>
              </li>
            ))}
          </ul>
          {files
            .filter((f) => f.messages?.length)
            .map((f, i) => (
              <ChatSignals key={i} messages={f.messages!} title={`Pesan penting di ${f.nama}`} />
            ))}
          <details
            className="more"
            open={moreOpen}
            onToggle={(e) => setMoreOpen(e.currentTarget.open)}
          >
            <summary>Detail tambahan (opsional)</summary>
            <div className="field">
              <label htmlFor="saksi">Saksi atau orang yang tahu</label>
              <textarea id="saksi" value={d.saksi} onChange={(e) => set('saksi', e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="dampak">Dampak</label>
              <textarea
                id="dampak"
                value={d.dampak}
                onChange={(e) => set('dampak', e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="alias">Nama panggilan terlapor</label>
              <input id="alias" value={d.alias} onChange={(e) => set('alias', e.target.value)} />
            </div>
            <div className="grid g2" style={{ gap: '1rem' }}>
              <div className="field">
                <label htmlFor="periode">Periode</label>
                <input
                  id="periode"
                  value={d.periode}
                  onChange={(e) => set('periode', e.target.value)}
                  placeholder="2025-1, 2025-2"
                />
              </div>
              <div className="field">
                <label htmlFor="lokasi">Lokasi umum</label>
                <select
                  id="lokasi"
                  value={d.lokasi}
                  onChange={(e) => set('lokasi', e.target.value)}
                >
                  <option value="kampus">Di kampus</option>
                  <option value="daring">Daring</option>
                  <option value="luar-kampus">Di luar kampus</option>
                </select>
              </div>
            </div>
            <div className="field">
              <label htmlFor="buktiTeks">Catatan tentang bukti</label>
              <textarea
                id="buktiTeks"
                value={d.bukti}
                onChange={(e) => set('bukti', e.target.value)}
              />
            </div>
          </details>
        </section>
      )}

      {last && (
        <section>
          <h1 ref={headRef} tabIndex={-1}>
            Tinjau, lalu kunci.
          </h1>
          <VeilBar defaultOn={false} what="Tinjauan laporan" />
          <p className="muted">
            Periksa tiap bagian. Tekan Ubah untuk memperbaikinya, lalu kamu kembali ke sini.
          </p>
          <p className="card tint small" role="note">
            Cerita, dokumen, tangkapan layar, tanggal, tempat, dan detail lain bisa menunjukkan
            siapa pelapor atau orang lain. Gema tidak meminta identitasmu, tetapi kamu yang
            menentukan apa yang ditulis dan diunggah. Periksa sekali lagi, dan ubah bagian yang
            tidak perlu.
          </p>
          <ReviewPart
            title="Kampus dan unit"
            onEdit={() => editFrom(0, 'inst')}
            editLabel="Ubah kampus dan unit"
          >
            <p className="m-0">
              <strong>{inst?.nama}</strong>, {unit?.nama}
            </p>
          </ReviewPart>
          <ReviewPart
            title="Terlapor"
            onEdit={() => editFrom(0, 'nama')}
            editLabel="Ubah data terlapor"
          >
            <p className="m-0">
              <strong>{d.nama}</strong>, {PERAN_LABEL[d.peran] ?? d.peran}
            </p>
            <p className="muted small m-0">
              {d.relasi
                ? RELASI_LABEL[d.relasi as Relasi]
                : 'Kuasa atas studi atau pekerjaanmu: tidak dijawab'}
            </p>
          </ReviewPart>
          <ReviewPart
            title="Kejadian"
            onEdit={() => editFrom(1, 'apa')}
            editLabel="Ubah cerita kejadian"
          >
            <p className="review-text">{d.apa}</p>
            <p className="muted small m-0">
              Kapan: {d.kapan || 'belum diisi'}. Di mana: {d.dimana || 'belum diisi'}.
            </p>
          </ReviewPart>
          <ReviewPart
            title={`Bukti (${files.length} berkas)`}
            onEdit={() => editFrom(1, 'berkas')}
            editLabel="Ubah bukti"
          >
            {files.length === 0 ? (
              <p className="muted small m-0">
                Belum ada berkas. Kamu tetap bisa menyimpan dan menambah bukti nanti.
              </p>
            ) : (
              <ul className="plain-list">
                {files.map((f, i) => (
                  <li key={i} className="row row-between">
                    <span>
                      {f.nama}{' '}
                      <span className="muted small">
                        {fmtBytes(f.bytes.length)}
                        {f.messages ? `, ${f.messages.length} pesan dibaca` : ''}
                      </span>
                    </span>
                    <button
                      className="btn ghost sm"
                      type="button"
                      aria-label={`Hapus ${f.nama}`}
                      onClick={() => removeFile(i)}
                    >
                      Hapus
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {d.bukti && <p className="muted small m-0">Catatan: {d.bukti}</p>}
          </ReviewPart>
          <ReviewPart
            title="Detail tambahan"
            onEdit={() => editFrom(1, 'saksi', true)}
            editLabel="Ubah detail tambahan"
          >
            {hasExtras(d) ? (
              <ul className="plain-list small">
                {d.saksi && <li>Saksi: {d.saksi}</li>}
                {d.dampak && <li>Dampak: {d.dampak}</li>}
                {d.alias && <li>Nama panggilan terlapor: {d.alias}</li>}
                {d.periode && <li>Periode: {d.periode}</li>}
              </ul>
            ) : (
              <p className="muted small m-0">Tidak ada. Ini opsional.</p>
            )}
          </ReviewPart>
          <MissingFiles
            items={lostFiles}
            tone="alert"
            onPick={() => editFrom(1, 'berkas')}
            onSkip={(n) => {
              dirty.current = true;
              setLostFiles(lostFiles.filter((x) => x.nama !== n));
            }}
          />
          <div className="field mt-md">
            <label htmlFor="k">Kapan kamu mau diberi tahu ada pola?</label>
            <select id="k" value={d.k} onChange={(e) => set('k', Number(e.target.value))}>
              <option value={2}>Bila 2 laporan cocok (paling cepat)</option>
              <option value={3}>Bila 3 laporan cocok</option>
              <option value={4}>Bila 4 laporan cocok (paling berhati-hati)</option>
            </select>
          </div>
          <p className="small muted">
            Menyimpan tidak berarti melapor. Tidak ada yang dikirim ke Satgas sampai kamu memilih{' '}
            <Term k="eskalasi">eskalasi</Term>.
          </p>
          {error && (
            <p className="err" role="alert">
              {error}
            </p>
          )}
        </section>
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
