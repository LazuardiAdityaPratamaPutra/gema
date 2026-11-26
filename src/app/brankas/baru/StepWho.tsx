import type { RefObject } from 'react';
import { RELASI_LABEL, isDependent, type Relasi } from '@gema/pendamping';
import { Term } from '@/components/Term';
import type { Draft } from '@/lib/laporan/drafts';
import type { InstitutionInfo } from '@/lib/vault/vault-client';
import type { SetField } from './draft-form';

type Props = {
  d: Draft;
  set: SetField;
  insts: InstitutionInfo[];
  inst: InstitutionInfo | undefined;
  normName: string;
  lebar: boolean;
  headRef: RefObject<HTMLHeadingElement | null>;
};

type Fields = { d: Draft; set: SetField };

/** Penjelasan apa yang diminta, siapa yang melihat, dan apa yang dipakai untuk mencocokkan. */
function PrivacyContext({ open }: { open: boolean }) {
  return (
    <details className="card ctx" open={open}>
      <summary>
        <h2 id="ctx-judul" className="title-sm">
          Apa yang diminta, dan siapa yang bisa melihatnya
        </h2>
      </summary>
      <dl className="ctx-list">
        <div>
          <dt>Yang kami minta</dt>
          <dd>
            Kampus dan unit, nama orang yang kamu laporkan dan perannya, apakah ia punya kuasa atas
            studi atau pekerjaanmu, lalu kejadian dan bukti. Namamu, email, dan nomor teleponmu
            tidak diminta.
          </dd>
        </div>
        <div>
          <dt>Siapa yang bisa membaca</dt>
          <dd>
            Sebelum kamu menekan Kirim ke Satgas (istilah resminya{' '}
            <Term k="eskalasi">eskalasi</Term>), hanya kamu yang bisa membaca isinya. Sesudahnya,
            Satgas kampus bisa membaca seluruh isi laporan dan bukti dengan nama samaran kasus. Gema
            tidak pernah meminta identitasmu, tetapi cerita dan buktimu bisa memuat petunjuk tentang
            siapa kamu.
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
              menilai apakah kasusmu perlu diprioritaskan. Kejadian dan bukti adalah isi laporanmu.
            </dd>
          </div>
          <div>
            <dt>Yang dipakai untuk mencocokkan</dt>
            <dd>
              Hanya nama terlapor (dalam beberapa ejaan), unit, peran, periode, dan lokasi umum.
              Semuanya diolah di perangkatmu menjadi kode, lalu server mencocokkan kode itu dengan
              laporan lain. Server tidak menerima nama aslinya. Kejadian dan bukti tidak ikut
              dicocokkan.
            </dd>
          </div>
        </dl>
      </details>
    </details>
  );
}

/** Pilihan kampus, peringatan kampus demo, dan pilihan unit terlapor. */
function CampusFields({
  d,
  set,
  insts,
  inst,
}: Fields & { insts: InstitutionInfo[]; inst: InstitutionInfo | undefined }) {
  return (
    <>
      {insts.length === 0 ? (
        <p className="small" aria-busy="true">
          Perguruan tinggi: <strong>Memuat…</strong>
        </p>
      ) : insts.length === 1 ? (
        <p className="small">
          Perguruan tinggi: <strong>{insts[0].nama}</strong>
          {insts[0].demo ? ' (demo)' : ''}
        </p>
      ) : (
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
      )}
      {inst?.demo && (
        <p className="card warn small" role="note">
          Ini mode demo. Datanya dipakai bersama dan bukan untuk kasus nyata, jadi jangan masukkan
          cerita atau bukti sungguhan.
        </p>
      )}
      {(inst || insts.length === 0) && (
        <div className="field">
          <label htmlFor="unit">Fakultas atau unit terlapor</label>
          <p className="hint m-0" id="unit-bantu">
            Pilih yang paling dekat. Kalau tidak tahu, pilih &ldquo;Tidak tahu atau belum
            yakin&rdquo;.
          </p>
          <select
            id="unit"
            aria-describedby="unit-bantu"
            disabled={!inst}
            value={d.unitId}
            onChange={(e) => set('unitId', e.target.value)}
          >
            <option value="">Pilih…</option>
            {(inst?.units ?? []).map((u) => (
              <option key={u.id} value={u.id}>
                {u.nama}
              </option>
            ))}
          </select>
        </div>
      )}
    </>
  );
}

/** Nama terlapor, dengan petunjuk dan tampilan nama yang dibaca sistem, serta perannya. */
function TerlaporFields({ d, set, normName }: Fields & { normName: string }) {
  return (
    <>
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
    </>
  );
}

/** Pertanyaan relasi kuasa; jawaban bergantung memicu catatan prioritas. */
function RelasiFields({ d, set }: Fields) {
  return (
    <fieldset className="field relasi">
      <legend className="label">Apakah terlapor punya kuasa atas studimu atau pekerjaanmu?</legend>
      <p className="hint">
        Bila ya, saat mengirim ke Satgas kamu bisa meminta Satgas memprioritaskan kasusmu dan
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
  );
}

/** Langkah 1: kampus, unit, dan data terlapor. */
export function StepWho({ d, set, insts, inst, normName, lebar, headRef }: Props) {
  return (
    <section>
      <h1 ref={headRef} tabIndex={-1}>
        Siapa dan di mana?
      </h1>
      <PrivacyContext open={lebar} />
      <CampusFields d={d} set={set} insts={insts} inst={inst} />
      <TerlaporFields d={d} set={set} normName={normName} />
      <RelasiFields d={d} set={set} />
      {inst?.fpMode === 'hmac' && (
        <p className="card warn small">
          Kampus ini memakai <Term k="hmac">mode cadangan</Term>: perlindungan pencocokan lebih
          lemah daripada <Term k="jembatanButa">Jembatan Buta</Term> penuh.
        </p>
      )}
    </section>
  );
}
