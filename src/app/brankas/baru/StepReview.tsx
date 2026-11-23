import type { RefObject } from 'react';
import { RELASI_LABEL, type Relasi } from '@gema/pendamping';
import { Term } from '@/components/Term';
import { VeilBar } from '@/components/Veil';
import type { Draft } from '@/lib/drafts';
import { fmtBytes } from '@/lib/format';
import type { FileInput } from '@/lib/report-build';
import type { InstitutionInfo } from '@/lib/vault-client';
import { PERAN_LABEL, hasExtras, type SetField } from './draft-form';
import { MissingFiles, ReviewPart } from './parts';

type Props = {
  d: Draft;
  set: SetField;
  inst: InstitutionInfo | undefined;
  unit: { nama: string } | undefined;
  files: FileInput[];
  lostFiles: { nama: string; size: number }[];
  error: string;
  headRef: RefObject<HTMLHeadingElement | null>;
  editFrom: (toStep: number, fieldId: string, extra?: boolean) => void;
  onRemoveFile: (i: number) => void;
  onSkipLost: (nama: string) => void;
};

/** Langkah 3: tinjauan akhir sebelum dikunci. */
export function StepReview(p: Props) {
  const { d, set, inst, unit, files, lostFiles, error, headRef, editFrom } = p;
  return (
    <section>
      <h1 ref={headRef} tabIndex={-1}>
        Tinjau, lalu kunci.
      </h1>
      <VeilBar defaultOn={false} what="Tinjauan laporan" />
      <p className="muted">
        Periksa tiap bagian. Tekan Ubah untuk memperbaikinya, lalu kamu kembali ke sini.
      </p>
      <p className="card tint small" role="note">
        Cerita, dokumen, tangkapan layar, tanggal, tempat, dan detail lain bisa menunjukkan siapa
        pelapor atau orang lain. Gema tidak meminta identitasmu, tetapi kamu yang menentukan apa
        yang ditulis dan diunggah. Periksa sekali lagi, dan ubah bagian yang tidak perlu.
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
                  onClick={() => p.onRemoveFile(i)}
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
        onSkip={p.onSkipLost}
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
  );
}
