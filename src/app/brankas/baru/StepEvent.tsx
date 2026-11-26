import { useState, type RefObject } from 'react';
import { ChatSignals } from '@/components/ChatSignals';
import { Dictate } from '@/components/Dictate';
import { Nudges } from '@/components/Nudges';
import type { Draft } from '@/lib/laporan/drafts';
import { bulanIni, hariIni, kapanMode } from '@/lib/laporan/kapan';
import { fmtBytes } from '@/lib/ui/format';
import type { FileInput } from '@/lib/laporan/report-build';
import { MAX_FILE, MAX_FILES } from '@/lib/laporan/report-format';
import { periodeDipilih, periodeLabel, periodeOpsi, type SetField } from './draft-form';
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

function EvidencePicker({ fileInput, onAddFiles }: Pick<Props, 'fileInput' | 'onAddFiles'>) {
  return (
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
          onAddFiles(e.target.files);
          e.target.value = '';
        }}
      />
    </label>
  );
}

function AttachedFiles({ files, onRemoveFile }: Pick<Props, 'files' | 'onRemoveFile'>) {
  return (
    <>
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
            <button className="btn ghost sm" type="button" onClick={() => onRemoveFile(i)}>
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
    </>
  );
}

function MoreDetails({
  d,
  set,
  moreOpen,
  setMoreOpen,
}: Pick<Props, 'd' | 'set' | 'moreOpen' | 'setMoreOpen'>) {
  return (
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
        <PeriodeField d={d} set={set} />
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
  );
}

/** Kapan kejadian dipilih dari kalender. Bila tanggal pastinya sudah lupa, cukup pilih bulan. */
function KapanField({ value, set }: { value: string; set: SetField }) {
  const mode = kapanMode(value);
  const [bulan, setBulan] = useState(mode === 'bulan');
  const lama = mode === 'lama';
  const cocok = bulan ? mode === 'bulan' : mode === 'tanggal';
  const ganti = (b: boolean) => {
    setBulan(b);
    if (b && mode === 'tanggal') set('kapan', value.slice(0, 7));
    else if (!b && mode === 'bulan') set('kapan', '');
  };
  return (
    <div className="field">
      <label htmlFor="kapan">Kapan (wajib)</label>
      <input
        id="kapan"
        type={bulan ? 'month' : 'date'}
        max={bulan ? bulanIni() : hariIni()}
        value={cocok ? value : ''}
        aria-required="true"
        aria-describedby={lama ? 'kapan-lama' : undefined}
        onChange={(e) => set('kapan', e.target.value)}
      />
      <label className="choice">
        <input type="checkbox" checked={bulan} onChange={(e) => ganti(e.target.checked)} />
        <span>Aku hanya ingat bulannya</span>
      </label>
      {lama && (
        <p className="small muted m-0" id="kapan-lama">
          Sebelumnya kamu menulis: “{value}”. Pilih tanggal untuk menggantinya.
        </p>
      )}
    </div>
  );
}

/** Periode kejadian sebagai pilihan semester (maksimal dua), bukan ketikan, agar nilainya baku dan bisa dicocokkan. */
function PeriodeField({ d, set }: Pick<Props, 'd' | 'set'>) {
  const dipilih = periodeDipilih(d.periode);
  const opsi = periodeOpsi();
  const semua = [
    ...opsi,
    ...dipilih
      .filter((v) => !opsi.some((o) => o.value === v))
      .map((v) => ({ value: v, label: periodeLabel(v) })),
  ];
  const penuh = dipilih.length >= 2;
  const ubah = (v: string, on: boolean) =>
    set('periode', (on ? [...dipilih, v] : dipilih.filter((x) => x !== v)).join(', '));
  return (
    <fieldset className="field relasi">
      <legend>Periode kejadian</legend>
      <p className="small muted m-0" id="periode-info">
        Pilih sampai dua semester. {penuh ? 'Sudah dua; lepas satu untuk mengganti.' : ''}
      </p>
      <div className="choices" aria-describedby="periode-info">
        {semua.map((o) => {
          const on = dipilih.includes(o.value);
          return (
            <label key={o.value} className="choice">
              <input
                type="checkbox"
                checked={on}
                disabled={!on && penuh}
                onChange={(e) => ubah(o.value, e.target.checked)}
              />
              <span>{o.label}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/** Langkah 2: kejadian, bukti, dan detail tambahan. */
export function StepEvent(p: Props) {
  const { d, set, files, fileErr, lostFiles, filled, fileInput, headRef } = p;
  return (
    <section>
      <h1 ref={headRef} tabIndex={-1}>
        Apa yang terjadi?
      </h1>
      <p className="muted">
        Tulis sebanyak yang kamu mampu. Kapan dan di mana perlu diisi, tetapi kira-kira saja sudah
        cukup; hanya ingat bulannya pun boleh. Bagian lain boleh dikosongkan atau ditulis nanti, dan
        kamu bisa kembali melengkapi.
      </p>
      <div className="field">
        <label htmlFor="apa">Kejadian</label>
        <textarea id="apa" rows={7} value={d.apa} onChange={(e) => set('apa', e.target.value)} />
        <Dictate onText={(t) => set('apa', d.apa ? `${d.apa} ${t}` : t)} />
        <Nudges text={d.apa} filled={filled} />
      </div>
      <div className="grid g2" style={{ gap: '1rem' }}>
        <KapanField value={d.kapan} set={set} />
        <div className="field">
          <label htmlFor="dimana">Di mana (wajib)</label>
          <input
            id="dimana"
            value={d.dimana}
            aria-required="true"
            placeholder="Misalnya ruang dosen, gedung, atau aplikasi chat"
            onChange={(e) => set('dimana', e.target.value)}
          />
        </div>
      </div>
      <EvidencePicker fileInput={fileInput} onAddFiles={p.onAddFiles} />
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
      <AttachedFiles files={files} onRemoveFile={p.onRemoveFile} />
      <MoreDetails d={d} set={set} moreOpen={p.moreOpen} setMoreOpen={p.setMoreOpen} />
    </section>
  );
}
