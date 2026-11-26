import { useState } from 'react';
import { isDependent } from '@gema/pendamping';
import { OwnerProofReporter } from '@/components/OwnerProofReporter';
import { api } from '@/lib/api';
import { buildCatatanPenanganan } from '@/lib/laporan/catatan-penanganan';
import { fmtDate, fmtDateTime } from '@/lib/ui/format';
import { triggerDownload } from '@/lib/vault/proof';
import type { ReporterSession } from '@/lib/store';
import {
  clearConditionalEscalation,
  escalateReport,
  setConditionalEscalation,
  type InstitutionInfo,
  type ReportView,
} from '@/lib/vault/vault-client';
import type { Narasi } from '@/lib/laporan/report-format';

type Props = {
  session: ReporterSession;
  r: ReportView;
  dek: Uint8Array;
  narasi: Narasi;
  inst: InstitutionInfo | null;
  busy: boolean;
  setMsg: (m: string, ok?: boolean) => void;
  act: (fn: () => Promise<unknown>, ok: string, onDone?: () => void) => Promise<void>;
};

type Esc = NonNullable<ReportView['escalation']>;

/** Tenggat tindak lanjut Satgas beserta sisa atau keterlambatannya. */
function TenggatSatgas({ sla }: { sla: Esc['sla'] }) {
  return (
    <p>
      Tenggat Satgas: <strong>{fmtDate(sla.due)}</strong>
      {sla.terlambat
        ? `, terlambat ${sla.hariTerlambat} hari kerja, tingkat ${sla.tingkat}`
        : sla.hariSisa != null
          ? `, sisa ${sla.hariSisa} hari kerja`
          : ''}
    </p>
  );
}

/** Penjelasan singkat tangga eskalasi untuk pelapor. */
function LangkahBerikut() {
  return (
    <details className="more" open>
      <summary>Apa yang terjadi selanjutnya</summary>
      <ol>
        <li>Satgas punya waktu sampai tenggat di atas untuk menindaklanjuti laporanmu.</li>
        <li>
          Bila terlambat, peringatan naik ke Ketua Satgas, lalu Pimpinan, lalu pengawas kementerian
          yang hanya melihat angka.
        </li>
        <li>Statusnya kamu pantau di halaman ini. Tidak ada kabar lewat email atau telepon.</li>
      </ol>
    </details>
  );
}

/** Riwayat kejadian kasus, dari yang tertua. */
function RiwayatKasus({ events }: { events: Esc['events'] }) {
  return (
    <ul className="timeline">
      {events.map((e, i) => (
        <li key={i}>
          <strong>{e.label}</strong>{' '}
          <span className="muted small">
            {fmtDateTime(e.at)}, {e.actor}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Ajakan dan tombol unduh catatan penanganan untuk dibawa ke pihak luar. */
function BawaKePihakLain({ r, alias }: { r: ReportView; alias: string }) {
  return (
    <details className="more">
      <summary>Bawa kasus ini ke pihak lain</summary>
      <p>
        Bila Satgas tidak bergerak, kamu bisa menyerahkan catatan ini ke pihak yang kamu pilih,
        misalnya Kemendikbudristek, Komnas Perempuan, lembaga bantuan hukum, atau media. Isinya
        kronologi dan tenggat saja, tanpa namamu dan tanpa isi laporan.
      </p>
      <button
        className="btn ghost sm"
        onClick={() =>
          void buildCatatanPenanganan(r).then((html) =>
            triggerDownload(`catatan-penanganan-${alias}.html`, html, 'text/html'),
          )
        }
      >
        Unduh catatan penanganan
      </button>
    </details>
  );
}

/** Status eskalasi yang sudah berjalan: tenggat, riwayat, dan tombol tarik bila belum dibuka. */
function EscalatedStatus({
  session,
  r,
  e,
  dek,
  busy,
  act,
}: Pick<Props, 'session' | 'r' | 'dek' | 'busy' | 'act'> & { e: Esc }) {
  return (
    <>
      <p>
        <span className="pill amber">Terkirim ke Satgas</span> pada {fmtDateTime(e.escalatedAt)}. Di
        Satgas, kasusmu dikenal sebagai <strong>{e.alias}</strong>, bukan dengan namamu.
      </p>
      <TenggatSatgas sla={e.sla} />
      <LangkahBerikut />
      <RiwayatKasus events={e.events} />
      <BawaKePihakLain r={r} alias={e.alias} />
      {e.opened ? (
        <p className="small muted" role="status">
          Satgas membuka kasus ini pada{' '}
          {e.openedAt ? fmtDateTime(e.openedAt) : 'waktu yang tidak tercatat'}, jadi persetujuan
          tidak dapat ditarik.
        </p>
      ) : (
        <button
          className="btn danger sm"
          disabled={busy}
          aria-busy={busy}
          onClick={() =>
            act(
              () =>
                api(`reports/${r.id}/withdraw`, {
                  token: session.token,
                  method: 'POST',
                  body: {},
                }),
              'Laporan ditarik dari Satgas. Satgas tidak lagi dapat membuka isi.',
            )
          }
        >
          Tarik laporan dari Satgas
        </button>
      )}
      <OwnerProofReporter session={session} report={r} dek={dek} alias={e.alias} />
    </>
  );
}

type CondProps = Pick<Props, 'session' | 'r' | 'dek' | 'inst' | 'busy' | 'setMsg' | 'act'> & {
  prioritas: boolean;
};

function InstalledCondition({
  session,
  r,
  busy,
  act,
}: Pick<CondProps, 'session' | 'r' | 'busy' | 'act'>) {
  return (
    <>
      <p>
        <span className="pill amber">Terpasang</span> Laporanmu akan dieskalasi sendiri begitu{' '}
        <strong>{r.conditional?.minSize} pelapor berbeda</strong> melaporkan terlapor yang sama.
        Sampai saat itu Satgas tidak tahu laporanmu ada.
      </p>
      <button
        className="btn ghost sm"
        disabled={busy}
        aria-busy={busy}
        onClick={() =>
          act(
            () => clearConditionalEscalation(session, r),
            'Syarat dicabut. Laporanmu tetap tersimpan, tanpa eskalasi.',
          )
        }
      >
        Cabut syarat
      </button>
    </>
  );
}

function ConditionForm({ session, r, dek, inst, prioritas, busy, setMsg, act }: CondProps) {
  const [condMin, setCondMin] = useState(2);
  return (
    <>
      <p>
        Kamu belum siap melapor sendirian? Pasang syarat: laporanmu hanya sampai ke Satgas jika
        orang lain juga melaporkan terlapor yang sama. Kamu bisa mencabutnya sebelum syarat
        terpenuhi.
      </p>
      <div className="field">
        <label htmlFor="cond-min">Kirim bila jumlah pelapor (termasuk aku) mencapai</label>
        <select id="cond-min" value={condMin} onChange={(e) => setCondMin(Number(e.target.value))}>
          {[2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>
              {n} pelapor
            </option>
          ))}
        </select>
      </div>
      <button
        className="btn ghost"
        disabled={busy || !inst}
        aria-busy={busy}
        onClick={() =>
          act(async () => {
            const res = await setConditionalEscalation(session, r, dek, inst!, condMin, prioritas);
            if (res.fired) setMsg('Syarat sudah terpenuhi, laporan terkirim ke Satgas.', true);
          }, 'Syarat terpasang. Kamu akan melihat statusnya di sini.')
        }
      >
        Pasang syarat
      </button>
    </>
  );
}

/** Eskalasi otomatis: terpasang dengan tombol cabut, atau belum (pilih jumlah pelapor lalu pasang). */
function ConditionalBox(p: CondProps) {
  return (
    <div className="cond">
      <h3 className="title-sm">Atau: kirim otomatis bila ada pelapor lain yang cocok</h3>
      {p.r.conditional ? (
        <InstalledCondition session={p.session} r={p.r} busy={p.busy} act={p.act} />
      ) : (
        <ConditionForm {...p} />
      )}
    </div>
  );
}

function ModeChoice({
  mode,
  setMode,
}: {
  mode: 'tunggal' | 'bersama';
  setMode: (m: 'tunggal' | 'bersama') => void;
}) {
  return (
    <fieldset style={{ border: 0, padding: 0 }}>
      <legend className="label">Bagaimana laporanmu diperlakukan?</legend>
      <label className="check">
        <input
          type="radio"
          name="mode"
          checked={mode === 'tunggal'}
          onChange={() => setMode('tunggal')}
        />
        <span>Hanya laporanku</span>
      </label>
      <label className="check">
        <input
          type="radio"
          name="mode"
          checked={mode === 'bersama'}
          onChange={() => setMode('bersama')}
        />
        <span>Gabungkan dengan laporan cocok, tanpa membuka identitas</span>
      </label>
    </fieldset>
  );
}

function EscalateConfirm({
  session,
  r,
  dek,
  inst,
  busy,
  act,
  mode,
  prioritas,
  onCancel,
}: Pick<Props, 'session' | 'r' | 'dek' | 'inst' | 'busy' | 'act'> & {
  mode: 'tunggal' | 'bersama';
  prioritas: boolean;
  onCancel: () => void;
}) {
  return (
    <div className="card warn">
      <h3 className="title-sm">Sebelum kamu mengirim</h3>
      <ul className="konfirmasi">
        <li>
          <strong>Siapa yang bisa membaca.</strong> Satgas akan dapat membaca isi laporan dan
          buktimu.
        </li>
        <li>
          <strong>Yang perlu kamu periksa.</strong> Gema tidak pernah meminta nama, email, atau
          nomor teleponmu, tetapi ceritamu dan buktimu bisa memuat petunjuk tentang siapa kamu.
          Periksa dulu isinya.
        </li>
        <li>
          <strong>Penarikan.</strong> Kamu bisa menarik laporan yang sudah dikirim selama Satgas
          belum membuka kasusnya; setelah dibuka, tidak bisa ditarik.
        </li>
      </ul>
      <div className="row">
        <button
          className="btn teal"
          disabled={busy || !inst}
          aria-busy={busy}
          onClick={() =>
            act(
              () => escalateReport(session, r, dek, inst!, mode, prioritas),
              'Laporan terkirim ke Satgas. Tenggat berjalan.',
              onCancel,
            )
          }
        >
          Ya, kirim ke Satgas
        </button>
        <button className="btn ghost" onClick={onCancel}>
          Batal
        </button>
      </div>
    </div>
  );
}

/** Eskalasi ke Satgas: status bila sudah dieskalasi, selain itu pilihan eskalasi langsung atau bersyarat. */
export function EscalationPanel({ session, r, dek, narasi, inst, busy, setMsg, act }: Props) {
  const [mode, setMode] = useState<'tunggal' | 'bersama'>('tunggal');
  const [confirmEsc, setConfirmEsc] = useState(false);
  const [prio, setPrio] = useState<boolean | null>(null);
  const dependent = isDependent(narasi.terlapor.relasi);
  const prioritas = prio ?? dependent;
  return (
    <section aria-labelledby="esk" className="card my-xl">
      <h2 className="title-md" id="esk">
        Kirim ke Satgas
      </h2>
      {r.escalation ? (
        <EscalatedStatus session={session} r={r} e={r.escalation} dek={dek} busy={busy} act={act} />
      ) : (
        <>
          <p>
            Sampai kamu menekan tombol di bawah, tidak ada yang sampai ke Satgas. Setelah dikirim
            (istilah resminya eskalasi), laporanmu hanya terbuka untuk Satgas, tenggat penanganan
            mulai berjalan, dan kamu dapat memantaunya di sini. Penarikan hanya dapat dilakukan
            sebelum Satgas membuka kasus.
          </p>
          {inst?.kunciSiap === false ? (
            <p className="card warn small" role="status">
              Satgas {inst.nama} belum menyiapkan kunci, jadi eskalasi belum bisa dilakukan.
              Laporanmu tetap tersimpan dan terkunci di perangkatmu. Coba lagi nanti.
            </p>
          ) : (
            <>
              {r.match.notify && r.match.size && r.match.size > 1 && (
                <ModeChoice mode={mode} setMode={setMode} />
              )}
              <label className="check prio">
                <input
                  type="checkbox"
                  checked={prioritas}
                  onChange={(e) => setPrio(e.target.checked)}
                />
                <span>
                  <b>Minta diprioritaskan</b>: terlapor punya kuasa atas studi atau pekerjaanku.
                  {dependent ? ' (Kamu menandai ini saat menulis laporan.)' : ''} Satgas hanya
                  melihat tanda ini di daftar kasus, bukan isinya.
                </span>
              </label>
              {!confirmEsc ? (
                <button className="btn teal" disabled={busy} onClick={() => setConfirmEsc(true)}>
                  Kirim laporan ini ke Satgas
                </button>
              ) : (
                <EscalateConfirm
                  session={session}
                  r={r}
                  dek={dek}
                  inst={inst}
                  busy={busy}
                  act={act}
                  mode={mode}
                  prioritas={prioritas}
                  onCancel={() => setConfirmEsc(false)}
                />
              )}
              <ConditionalBox
                session={session}
                r={r}
                dek={dek}
                inst={inst}
                prioritas={prioritas}
                busy={busy}
                setMsg={setMsg}
                act={act}
              />
            </>
          )}
        </>
      )}
    </section>
  );
}
