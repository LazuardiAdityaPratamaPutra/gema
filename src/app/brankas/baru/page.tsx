'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
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

export default function Baru() {
  const { session } = useReporter();
  const router = useRouter();
  const [insts, setInsts] = useState<InstitutionInfo[]>([]);
  const [d, setD] = useState<Draft>(EMPTY);
  const [files, setFiles] = useState<FileInput[]>([]);
  const [restored, setRestored] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fileErr, setFileErr] = useState('');
  const headRef = useRef<HTMLHeadingElement>(null);
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
        setRestored(true);
      } else if (carried) {
        dirty.current = true;
        setD((p) => ({ ...p, apa: carried }));
      }
    });
  }, [session]);
  useEffect(() => {
    if (!session) return;
    const t = setInterval(() => {
      if (dirty.current) {
        dirty.current = false;
        void saveDraft(session.kek, session.caseCode, scope, { ...d, savedAt: Date.now() });
        island.toast('Draf tersimpan, terenkripsi');
      }
    }, 10_000);
    return () => clearInterval(t);
  }, [session, d]);
  useEffect(() => {
    headRef.current?.focus();
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
      island.toast('Tersimpan dan terkunci');
      router.push(`/brankas/${id}?baru=1`);
    } catch (e) {
      island.clear();
      setBusy(false);
      setError(e instanceof Error ? e.message : 'Gagal menyimpan laporan.');
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
      {restored && step === 0 && (
        <p className="card tint small" role="status">
          Draf terenkripsi dipulihkan. Berkas bukti perlu dipilih ulang.
        </p>
      )}

      {step === 0 && (
        <section>
          <h1 ref={headRef} tabIndex={-1}>
            Siapa dan di mana?
          </h1>
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
            <label htmlFor="nama">Nama terlapor</label>
            <input
              id="nama"
              value={d.nama}
              onChange={(e) => set('nama', e.target.value)}
              autoComplete="off"
            />
            <p className="hint">
              Disamarkan di perangkatmu sebelum dipakai mencocokkan. Server tidak menerima nama
              asli.
            </p>
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
              Bila ya, saat eskalasi kamu bisa meminta Satgas memprioritaskan kasusmu dan
              mempertimbangkan pelindungan, misalnya pengalihan pembimbing.
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
              Kampus ini memakai mode cadangan (HMAC): perlindungan pencocokan lebih lemah daripada
              Jembatan Buta penuh.
            </p>
          )}
        </section>
      )}

      {step === 1 && (
        <section>
          <h1 ref={headRef} tabIndex={-1}>
            Apa yang terjadi?
          </h1>
          <p className="muted">Tulis sebanyak yang kamu mampu. Kamu bisa kembali melengkapi.</p>
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
                <button
                  className="btn ghost sm"
                  type="button"
                  onClick={() => setFiles(files.filter((_, j) => j !== i))}
                >
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
          <details className="more">
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
          <div className="card" style={{ marginBottom: '1rem' }}>
            <p className="m-0">
              <strong>{inst?.nama}</strong>, {unit?.nama}
            </p>
            <p className="muted small" style={{ margin: '.3rem 0 0' }}>
              Terlapor: {d.nama}, {files.length} berkas
              {files.some((f) => f.messages) ? ', chat dibaca per pesan' : ''}
              {d.relasi ? `, ${RELASI_LABEL[d.relasi as Relasi]}` : ''}
            </p>
          </div>
          <div className="field">
            <label htmlFor="k">Kapan kamu mau diberi tahu ada pola?</label>
            <select id="k" value={d.k} onChange={(e) => set('k', Number(e.target.value))}>
              <option value={2}>Bila 2 laporan cocok (paling cepat)</option>
              <option value={3}>Bila 3 laporan cocok</option>
              <option value={4}>Bila 4 laporan cocok (paling berhati-hati)</option>
            </select>
          </div>
          <p className="small muted">
            Menyimpan tidak berarti melapor. Tidak ada yang dikirim ke Satgas sampai kamu memilih
            eskalasi.
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
          onClick={() => set('step', step - 1)}
        >
          Kembali
        </button>
        {!last ? (
          <button
            className="btn teal"
            type="button"
            disabled={!ok[step]}
            onClick={() => set('step', step + 1)}
          >
            Lanjut
          </button>
        ) : (
          <button className="btn teal" type="button" disabled={busy} onClick={send}>
            {busy ? 'Mengunci…' : 'Kunci dan simpan'}
          </button>
        )}
      </div>
    </div>
  );
}
