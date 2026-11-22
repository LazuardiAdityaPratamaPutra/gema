'use client';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { useReporter } from '@/components/useReporter';
import type { ReporterSession } from '@/lib/store';
import { api } from '@/lib/api';
import {
  downloadEvidence,
  clearConditionalEscalation,
  escalateReport,
  setConditionalEscalation,
  listReports,
  openReport,
  type InstitutionInfo,
  type ReportView,
} from '@/lib/vault-client';
import type { BuktiMeta, Narasi } from '@/lib/report-format';
import { isDependent } from '@gema/pendamping';
import { ChatSignals } from '@/components/ChatSignals';
import { OwnerProofReporter } from '@/components/OwnerProofReporter';
import { Rujukan } from '@/components/Rujukan';
import {
  buildCertificatePdf,
  buildProofPackage,
  fetchCertificate,
  triggerDownload,
} from '@/lib/proof';
import { fmtBytes, fmtDate, fmtDateTime, shortHash } from '@/lib/format';

type Plain = { dek: Uint8Array; narasi: Narasi; meta: BuktiMeta };
type Loaded = 'hilang' | { report: ReportView; plain: Plain; inst: InstitutionInfo | null };

/** Mengambil laporan lalu membukanya dengan kunci di perangkat ini. Tanpa efek samping pada state. */
async function fetchReport(session: ReporterSession, id: string): Promise<Loaded> {
  const report = (await listReports(session)).find((x) => x.id === id);
  if (!report) return 'hilang';
  const plain = await openReport(session, report);
  const institutions = await api<InstitutionInfo[]>('public/institutions');
  return { report, plain, inst: institutions.find((i) => i.id === report.institutionId) ?? null };
}

function Detail() {
  const { id } = useParams<{ id: string }>();
  const isNew = useSearchParams().get('baru') === '1';
  const router = useRouter();
  const { session } = useReporter();
  const [r, setR] = useState<ReportView | null>(null);
  const [plain, setPlain] = useState<Plain | null>(null);
  const [inst, setInst] = useState<InstitutionInfo | null>(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<'tunggal' | 'bersama'>('tunggal');
  const [confirmEsc, setConfirmEsc] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [prio, setPrio] = useState<boolean | null>(null);
  const [condMin, setCondMin] = useState(2);

  const apply = useCallback(
    (l: Loaded) => {
      if (l === 'hilang') {
        router.replace('/brankas');
        return;
      }
      setR(l.report);
      setPlain(l.plain);
      setInst(l.inst);
    },
    [router],
  );
  const load = useCallback(async () => {
    if (session) apply(await fetchReport(session, id));
  }, [session, id, apply]);
  useEffect(() => {
    if (!session) return;
    fetchReport(session, id)
      .then(apply)
      .catch((e) => setMsg(e.message));
  }, [session, id, apply]);

  if (!session || !r || !plain)
    return (
      <div className="narrow">
        <p role="status">{msg || 'Membuka laporan…'}</p>
      </div>
    );
  const act = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    setMsg('');
    try {
      await fn();
      await load();
      setMsg(ok);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Gagal.');
    }
    setBusy(false);
  };
  const metaFor = (sha: string) => plain.meta.items.find((m) => m.sha256 === sha);

  async function cert(ev: ReportView['evidence'][number], kind: 'pdf' | 'html') {
    const m = metaFor(ev.sha256);
    const c = await fetchCertificate(ev.id);
    if (kind === 'pdf')
      triggerDownload(
        `sertifikat-${ev.id}.pdf`,
        await buildCertificatePdf(c, {
          namaBerkas: m?.nama ?? 'berkas',
          ukuran: fmtBytes(ev.ukuran),
          origin: location.origin,
        }),
        'application/pdf',
      );
    else triggerDownload(`paket-bukti-${ev.id}.html`, await buildProofPackage(c), 'text/html');
  }
  async function download(ev: ReportView['evidence'][number]) {
    const bytes = await downloadEvidence(session!, ev.id, plain!.dek);
    triggerDownload(metaFor(ev.sha256)?.nama ?? 'bukti', bytes);
  }

  const n = plain.narasi;
  const dependent = isDependent(n.terlapor.relasi);
  const prioritas = prio ?? dependent;
  return (
    <div className="wrap" style={{ maxWidth: 860 }}>
      {isNew && (
        <div className="card tint" role="status" style={{ marginBottom: '1.5rem' }}>
          <strong>Tersimpan dan terkunci.</strong> Hanya kamu yang bisa membacanya. Tidak ada yang
          dikirim ke Satgas.
        </div>
      )}
      <header className="ph">
        <Link href="/brankas" className="back">
          Kembali ke Brankasmu
        </Link>
        <h1>{r.institutionNama}</h1>
        <p className="muted">
          {r.unitNama}, dibuat {fmtDate(r.createdAt)}, terlapor:{' '}
          <strong style={{ color: 'inherit' }}>{n.terlapor.nama}</strong>
        </p>
      </header>
      {msg && (
        <p className="card warn small" role="status">
          {msg}
        </p>
      )}

      {r.match.notify && (
        <section className="card tint my-lg" aria-labelledby="pola">
          <h2 className="title-md" id="pola">
            Ada pola yang cocok
          </h2>
          <p>
            Terlapor ini tampaknya juga muncul dalam laporan lain di kampus yang sama (kelompok{' '}
            {r.match.size} laporan, keyakinan <strong>{r.match.confidence}</strong>
            {r.match.weak ? `, ${r.match.weak} kecocokan lemah` : ''}). Kamu tidak melihat siapa
            mereka, dan mereka tidak melihatmu.
          </p>
          {r.match.flagFast && (
            <p className="small">
              Jarak antar laporan ini pendek, sehingga ditandai untuk perhatian lebih cepat bila
              dieskalasi.
            </p>
          )}
        </section>
      )}

      <section aria-labelledby="isi" className="card my-lg">
        <h2 className="title-md" id="isi">
          Isi laporan
        </h2>
        <dl style={{ margin: 0, display: 'grid', gap: '.9rem' }}>
          {(
            [
              ['Kejadian', n.apa],
              ['Kapan', n.kapan],
              ['Di mana', n.dimana],
              ['Saksi', n.saksi],
              ['Dampak', n.dampak],
              ['Catatan bukti', n.bukti],
            ] as const
          )
            .filter(([, v]) => v)
            .map(([k, v]) => (
              <div key={k}>
                <dt className="label mb-0">{k}</dt>
                <dd style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{v}</dd>
              </div>
            ))}
        </dl>
      </section>

      <section className="my-xl" aria-labelledby="bukti">
        <h2 className="title-md" id="bukti">
          Bukti dan sertifikat
        </h2>
        {r.evidence.length === 0 && <p className="muted">Belum ada berkas.</p>}
        {r.evidence.map((ev) => {
          const m = metaFor(ev.sha256);
          return (
            <article key={ev.id} className="card" style={{ marginBottom: '1rem' }}>
              <div className="row row-between">
                <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{m?.nama ?? 'Berkas'}</h3>
                <span className={`pill ${ev.anchored ? 'teal' : 'amber'}`}>
                  {ev.anchored ? 'Akar harian terbit' : 'Menunggu akar harian'}
                </span>
              </div>
              <p className="small muted" style={{ margin: '.3rem 0 .6rem' }}>
                {fmtBytes(ev.ukuran)}, diunggah {fmtDateTime(ev.uploadedAt)}
                {ev.messageCount ? `, ${ev.messageCount} pesan tercatat` : ''}
              </p>
              <code className="hash" title={ev.sha256}>
                {shortHash(ev.sha256, 16)}
              </code>
              {m?.messages?.length ? <ChatSignals messages={m.messages} /> : null}
              <div className="row" style={{ marginTop: '.8rem' }}>
                <button className="btn ghost sm" onClick={() => void cert(ev, 'pdf')}>
                  Sertifikat (PDF)
                </button>
                <button className="btn ghost sm" onClick={() => void cert(ev, 'html')}>
                  Paket Bukti (HTML offline)
                </button>
                <button className="btn ghost sm" onClick={() => void download(ev)}>
                  Unduh berkas asli
                </button>
              </div>
            </article>
          );
        })}
        <p className="small muted">
          Sertifikat membuktikan berkas tidak berubah sejak waktu pengunggahan. Ia tidak membuktikan
          bahwa isi berkas benar.
        </p>
      </section>

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
            <button
              className="btn danger sm"
              disabled={busy}
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
            <OwnerProofReporter
              session={session}
              report={r}
              dek={plain.dek}
              alias={r.escalation.alias}
            />
          </>
        ) : (
          <>
            <p>
              Eskalasi mengirim kunci laporan ke Satgas, terenkripsi untuk mereka saja. Setelah itu
              tenggat berjalan dan kamu dapat memantaunya di sini. Kamu bisa menariknya kapan saja.
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
              <button className="btn teal" onClick={() => setConfirmEsc(true)}>
                Eskalasi laporan ini
              </button>
            ) : (
              <div className="card warn">
                <p>
                  <strong>Pastikan.</strong> Satgas akan dapat membaca isi laporan dan buktimu.
                  Identitas tetap anonim.
                </p>
                <div className="row">
                  <button
                    className="btn teal"
                    disabled={busy || !inst}
                    onClick={() =>
                      act(
                        () => escalateReport(session, r, plain.dek, inst!, mode, prioritas),
                        'Laporan dieskalasi. Tenggat berjalan.',
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
                    Kamu belum siap melapor sendirian? Pasang syarat: laporanmu hanya sampai ke
                    Satgas jika orang lain juga melaporkan terlapor yang sama. Kamu bisa mencabutnya
                    sebelum syarat terpenuhi.
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
                    onClick={() =>
                      act(async () => {
                        const res = await setConditionalEscalation(
                          session,
                          r,
                          plain.dek,
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

      <details className="help-fold" aria-label="Bantuan yang bisa kamu hubungi">
        <summary>
          <span>
            <b>Butuh bicara dengan seseorang?</b>
            <small>Psikolog, bantuan hukum, SAPA 129. Tidak perlu menunggu Satgas.</small>
          </span>
        </summary>
        <Rujukan kampus={inst?.rujukan} namaKampus={inst?.nama} />
      </details>

      <section className="my-xl" aria-labelledby="atur">
        <h2 className="title-md" id="atur">
          Pengaturan laporan
        </h2>
        <label className="check">
          <input
            type="checkbox"
            checked={r.includeWeak}
            onChange={(e) =>
              act(
                () =>
                  api(`reports/${r.id}/settings`, {
                    token: session.token,
                    body: { includeWeak: e.target.checked },
                  }),
                'Pengaturan disimpan.',
              )
            }
          />
          <span>Sertakan kecocokan lemah dalam pemberitahuan</span>
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={r.optIn}
            onChange={(e) =>
              act(
                () =>
                  api(`reports/${r.id}/settings`, {
                    token: session.token,
                    body: { optIn: e.target.checked },
                  }),
                'Pengaturan disimpan.',
              )
            }
          />
          <span>Bersedia dihubungi lewat Satgas bila ada laporan cocok</span>
        </label>
        <hr />
        {!confirmDel ? (
          <button className="btn danger sm" disabled={busy} onClick={() => setConfirmDel(true)}>
            Hapus laporan selamanya
          </button>
        ) : (
          <div className="card alert">
            <p>
              <strong>Hapus selamanya?</strong> Kunci laporan dimusnahkan dan tidak dapat dipulihkan
              oleh siapa pun.
            </p>
            <div className="row">
              <button
                className="btn danger"
                disabled={busy}
                onClick={() =>
                  void act(async () => {
                    await api(`reports/${r.id}`, { method: 'DELETE', token: session.token });
                    router.push('/brankas');
                  }, '')
                }
              >
                Ya, hapus
              </button>
              <button className="btn ghost" onClick={() => setConfirmDel(false)}>
                Batal
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="narrow">
          <p role="status">Membuka…</p>
        </div>
      }
    >
      <Detail />
    </Suspense>
  );
}
