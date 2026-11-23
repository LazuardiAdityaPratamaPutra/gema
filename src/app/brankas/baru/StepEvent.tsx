import type { RefObject } from 'react';
import { ChatSignals } from '@/components/ChatSignals';
import { Dictate } from '@/components/Dictate';
import { Nudges } from '@/components/Nudges';
import type { Draft } from '@/lib/drafts';
import { fmtBytes } from '@/lib/format';
import type { FileInput } from '@/lib/report-build';
import { MAX_FILE, MAX_FILES } from '@/lib/report-format';
import type { SetField } from './draft-form';
import { MissingFiles } from './parts';

type Props = {
  d: Draft;
  set: SetField;
  files: FileInput[];
  fileErr: string;
  lostFiles: { nama: string; size: number }[];
  filled: { kapan: string; dimana: string; saksi: string; dampak: string };
  moreOpen: boolean;
  setMoreOpen: (v: boolean) => void;
  fileInput: RefObject<HTMLInputElement | null>;
  headRef: RefObject<HTMLHeadingElement | null>;
  onAddFiles: (list: FileList | null) => void;
  onRemoveFile: (i: number) => void;
  onSkipLost: (nama: string) => void;
};

/** Langkah 2: kejadian, bukti, dan detail tambahan. */
export function StepEvent(p: Props) {
  const { d, set, files, fileErr, lostFiles, filled, moreOpen, setMoreOpen, fileInput, headRef } =
    p;
  return (
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
        <textarea id="apa" rows={7} value={d.apa} onChange={(e) => set('apa', e.target.value)} />
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
            Maks. {MAX_FILES} berkas, {fmtBytes(MAX_FILE)} per berkas. Ekspor chat WhatsApp (.txt)
            terbaca per pesan.
          </small>
        </span>
        <input
          id="berkas"
          ref={fileInput}
          type="file"
          multiple
          onChange={(e) => {
            p.onAddFiles(e.target.files);
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
        onSkip={p.onSkipLost}
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
            <button className="btn ghost sm" type="button" onClick={() => p.onRemoveFile(i)}>
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
      <details className="more" open={moreOpen} onToggle={(e) => setMoreOpen(e.currentTarget.open)}>
        <summary>Detail tambahan (opsional)</summary>
        <div className="field">
          <label htmlFor="saksi">Saksi atau orang yang tahu</label>
          <textarea id="saksi" value={d.saksi} onChange={(e) => set('saksi', e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="dampak">Dampak</label>
          <textarea id="dampak" value={d.dampak} onChange={(e) => set('dampak', e.target.value)} />
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
            <select id="lokasi" value={d.lokasi} onChange={(e) => set('lokasi', e.target.value)}>
              <option value="kampus">Di kampus</option>
              <option value="daring">Daring</option>
              <option value="luar-kampus">Di luar kampus</option>
            </select>
          </div>
        </div>
        <div className="field">
          <label htmlFor="buktiTeks">Catatan tentang bukti</label>
          <textarea id="buktiTeks" value={d.bukti} onChange={(e) => set('bukti', e.target.value)} />
        </div>
      </details>
    </section>
  );
}
