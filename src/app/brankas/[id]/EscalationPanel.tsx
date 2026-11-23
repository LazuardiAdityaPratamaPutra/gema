import { useState } from 'react';
import { isDependent } from '@gema/pendamping';
import { OwnerProofReporter } from '@/components/OwnerProofReporter';
import { api } from '@/lib/api';
import { fmtDate, fmtDateTime } from '@/lib/format';
import type { ReporterSession } from '@/lib/store';
import {
  clearConditionalEscalation,
  escalateReport,
  setConditionalEscalation,
  type InstitutionInfo,
  type ReportView,
} from '@/lib/vault-client';
import type { Narasi } from '@/lib/report-format';

type Props = {
  session: ReporterSession;
  r: ReportView;
  dek: Uint8Array;
  narasi: Narasi;
  inst: InstitutionInfo | null;
  busy: boolean;
  setMsg: (m: string) => void;
  act: (fn: () => Promise<unknown>, ok: string, onDone?: () => void) => Promise<void>;
};

/** Eskalasi ke Satgas: status bila sudah dieskalasi, selain itu pilihan eskalasi langsung atau bersyarat. */
export function EscalationPanel({ session, r, dek, narasi, inst, busy, setMsg, act }: Props) {
  const [mode, setMode] = useState<'tunggal' | 'bersama'>('tunggal');
  const [confirmEsc, setConfirmEsc] = useState(false);
  const [prio, setPrio] = useState<boolean | null>(null);
  const [condMin, setCondMin] = useState(2);
  const dependent = isDependent(narasi.terlapor.relasi);
  const prioritas = prio ?? dependent;
  return (
    <section aria-labelledby="esk" className="card my-xl">
      <h2 className="title-md" id="esk">
        Eskalasi ke Satgas
      </h2>
      {r.escalation ? (
        <>
          <p>
            <span className="pill amber">Dieskalasi</span> sebagai{' '}
            <strong>{r.escalation.alias}</strong> pada {fmtDateTime(r.escalation.escalatedAt)}.
          </p>
          <p>
            Tenggat Satgas: <strong>{fmtDate(r.escalation.sla.due)}</strong>
            {r.escalation.sla.terlambat
              ? `, terlambat ${r.escalation.sla.hariTerlambat} hari kerja, tingkat ${r.escalation.sla.tingkat}`
              : r.escalation.sla.hariSisa != null
                ? `, sisa ${r.escalation.sla.hariSisa} hari kerja`
                : ''}
          </p>
          <ul className="timeline">
            {r.escalation.events.map((e, i) => (
              <li key={i}>
                <strong>{e.label}</strong>{' '}
                <span className="muted small">
                  {fmtDateTime(e.at)}, {e.actor}
                </span>
              </li>
            ))}
          </ul>
          {r.escalation.opened ? (
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
          <OwnerProofReporter session={session} report={r} dek={dek} alias={r.escalation.alias} />
        </>
      ) : (
        <>
          <p>
            Eskalasi mengirim kunci laporan ke Satgas, terenkripsi untuk mereka saja. Setelah itu
            tenggat berjalan dan kamu dapat memantaunya di sini. Penarikan hanya dapat dilakukan
            sebelum Satgas membuka kasus.
          </p>
          {r.match.notify && r.match.size && r.match.size > 1 && (
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
          )}
          <label className="check prio">
            <input
              type="checkbox"
              checked={prioritas}
              onChange={(e) => setPrio(e.target.checked)}
            />
            <span>
              <b>Minta diprioritaskan</b>: terlapor punya kuasa atas studi atau pekerjaanku.
              {dependent ? ' (Kamu menandai ini saat menulis laporan.)' : ''} Satgas hanya melihat
              tanda ini di daftar kasus, bukan isinya.
            </span>
          </label>
          {!confirmEsc ? (
            <button className="btn teal" disabled={busy} onClick={() => setConfirmEsc(true)}>
              Eskalasi laporan ini
            </button>
          ) : (
            <div className="card warn">
              <h3 className="title-sm">Sebelum kamu mengeskalasi</h3>
              <ul className="konfirmasi">
                <li>
                  <strong>Siapa yang bisa membaca.</strong> Satgas akan dapat membaca isi laporan
                  dan buktimu.
                </li>
                <li>
                  <strong>Yang perlu kamu periksa.</strong> Gema tidak pernah meminta nama, email,
                  atau nomor teleponmu, tetapi ceritamu dan buktimu bisa memuat petunjuk tentang
                  siapa kamu. Periksa dulu isinya.
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
                      () => setConfirmEsc(false),
                    )
                  }
                >
                  Ya, eskalasikan
                </button>
                <button className="btn ghost" onClick={() => setConfirmEsc(false)}>
                  Batal
                </button>
              </div>
            </div>
          )}
          <div className="cond">
            <h3 className="title-sm">Atau: eskalasi otomatis bila ada yang cocok</h3>
            {r.conditional ? (
              <>
                <p>
                  <span className="pill amber">Terpasang</span> Laporanmu akan dieskalasi sendiri
                  begitu <strong>{r.conditional.minSize} pelapor berbeda</strong> melaporkan
                  terlapor yang sama. Sampai saat itu Satgas tidak tahu laporanmu ada.
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
            ) : (
              <>
                <p>
                  Kamu belum siap melapor sendirian? Pasang syarat: laporanmu hanya sampai ke Satgas
                  jika orang lain juga melaporkan terlapor yang sama. Kamu bisa mencabutnya sebelum
                  syarat terpenuhi.
                </p>
                <div className="field">
                  <label htmlFor="cond-min">
                    Eskalasi bila jumlah pelapor (termasuk aku) mencapai
                  </label>
                  <select
                    id="cond-min"
                    value={condMin}
                    onChange={(e) => setCondMin(Number(e.target.value))}
                  >
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
                      const res = await setConditionalEscalation(
                        session,
                        r,
                        dek,
                        inst!,
                        condMin,
                        prioritas,
                      );
                      if (res.fired) setMsg('Syarat sudah terpenuhi, laporan dieskalasi.');
                    }, 'Syarat terpasang. Kamu akan melihat statusnya di sini.')
                  }
                >
                  Pasang syarat
                </button>
              </>
            )}
          </div>
        </>
      )}
    </section>
  );
}
