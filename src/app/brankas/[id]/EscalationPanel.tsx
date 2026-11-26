import { useState } from 'react';
import { isDependent } from '@gema/pendamping';
import { OwnerProofReporter } from '@/components/OwnerProofReporter';
import { api } from '@/lib/api';
import { fmtDate, fmtDateTime } from '@/lib/ui/format';
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
        <span className="pill amber">Dieskalasi</span> sebagai <strong>{e.alias}</strong> pada{' '}
        {fmtDateTime(e.escalatedAt)}.
      </p>
      <p>
        Tenggat Satgas: <strong>{fmtDate(e.sla.due)}</strong>
        {e.sla.terlambat
          ? `, terlambat ${e.sla.hariTerlambat} hari kerja, tingkat ${e.sla.tingkat}`
          : e.sla.hariSisa != null
            ? `, sisa ${e.sla.hariSisa} hari kerja`
            : ''}
      </p>
      <ul className="timeline">
        {e.events.map((e, i) => (
          <li key={i}>
            <strong>{e.label}</strong>{' '}
            <span className="muted small">
              {fmtDateTime(e.at)}, {e.actor}
            </span>
          </li>
        ))}
      </ul>
      {e.opened ? (
        <p className="small muted" role="status">
          Satgas sudah membuka kasus ini, jadi persetujuan tidak dapat ditarik.
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
              'Eskalasi ditarik. Satgas tidak lagi dapat membuka isi.',
            )
          }
        >
          Tarik eskalasi
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
        <label htmlFor="cond-min">Eskalasi bila jumlah pelapor (termasuk aku) mencapai</label>
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
            if (res.fired) setMsg('Syarat sudah terpenuhi, laporan dieskalasi.', true);
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
      <h3 className="title-sm">Atau: eskalasi otomatis bila ada yang cocok</h3>
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
      <h3 className="title-sm">Sebelum kamu mengeskalasi</h3>
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
          <strong>Penarikan.</strong> Kamu bisa menarik eskalasi selama Satgas belum membuka
          kasusnya; setelah dibuka, tidak bisa ditarik.
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
              'Laporan dieskalasi. Tenggat berjalan.',
              onCancel,
            )
          }
        >
          Ya, eskalasikan
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
        Eskalasi ke Satgas
      </h2>
      {r.escalation ? (
        <EscalatedStatus session={session} r={r} e={r.escalation} dek={dek} busy={busy} act={act} />
      ) : (
        <>
          <p>
            Eskalasi mengirim kunci laporan ke Satgas, terenkripsi untuk mereka saja. Setelah itu
            tenggat berjalan dan kamu dapat memantaunya di sini. Penarikan hanya dapat dilakukan
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
                  Eskalasi laporan ini
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
