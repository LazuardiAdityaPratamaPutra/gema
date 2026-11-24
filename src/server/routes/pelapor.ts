import { MAX_FILE } from '@/lib/laporan/report-format';
import { blobRead, blobWrite, persist } from '../db';
import {
  audit,
  clearConditional,
  createReport,
  deleteReport,
  escalate,
  hmacFingerprints,
  oprfEvaluate,
  readSession,
  setConditional,
  withdrawEscalation,
} from '../logic';
import { hasApproval, registerOwnerKey } from '../logic-satgas';
import { HttpError } from '../util';
import {
  bodyOf,
  clientIp,
  json,
  memberOf,
  reporterSession,
  type Ctx,
  type Handler,
  type ReporterSession,
} from './context';
import type { DB, Report, Session } from '../types';
import {
  conditionalBody,
  createReportBody,
  escalateBody,
  hmacBody,
  oprfBody,
  ownerBody,
  settingsBody,
} from './schemas';
import { reportView } from './views';

const SIZE_SLACK = 1024;
const MIN_ENCRYPTED = 28;

type Route = (ctx: Ctx) => Promise<Response> | Response;

/** Rute bernama `"METODE segmen[/segmen]"`; sesi diperiksa sebelum isi dibaca. */
const ROUTES: Record<string, Route> = {
  'GET me/reports': ({ req, db }) => {
    const s = reporterSession(req);
    return json({
      reports: Object.values(db.reports)
        .filter((r) => r.scope_id === s.scope_id)
        .sort((x, y) => y.created_at - x.created_at)
        .map((r) => reportView(db, r.id)),
    });
  },
  'POST oprf/evaluate': async ({ req, db }) =>
    json(oprfEvaluate(db, reporterSession(req), await bodyOf(oprfBody, req), clientIp(req))),
  'POST fp/hmac': async ({ req, db }) =>
    json(hmacFingerprints(db, reporterSession(req), await bodyOf(hmacBody, req), clientIp(req))),
  'POST reports': async ({ req, db }) =>
    json(createReport(db, reporterSession(req), await bodyOf(createReportBody, req)), 201),
};

/** Rute milik pelapor: daftar laporan, OPRF/sidik, buat laporan, dan berkas bukti. */
export const pelapor: Handler = (ctx) => {
  const [a, b, c] = ctx.seg;
  if (a === 'reports' && b) return reportActions(ctx, b);
  if (a === 'evidence' && b && c === 'blob') {
    if (ctx.method === 'PUT') return uploadBlob(ctx, b);
    if (ctx.method === 'GET') return downloadBlob(ctx, b);
  }
  return ROUTES[`${ctx.method} ${[a, b].filter(Boolean).join('/')}`]?.(ctx);
};

async function uploadBlob({ req, db }: Ctx, evidenceId: string) {
  const s = reporterSession(req);
  const ev = db.evidence[evidenceId];
  const rep = ev && db.reports[ev.report_id];
  if (!ev || !rep || rep.scope_id !== s.scope_id) throw new HttpError(404, 'Bukti tidak ditemukan');
  // tolak lewat Content-Length sebelum membaca badan ke memori
  const declared = Number(req.headers.get('content-length') ?? 0);
  if (declared > MAX_FILE + SIZE_SLACK) throw new HttpError(413, 'Berkas melebihi 20 MB');
  const buf = new Uint8Array(await req.arrayBuffer());
  if (buf.length > MAX_FILE + SIZE_SLACK) throw new HttpError(413, 'Berkas melebihi 20 MB');
  if (buf.length < MIN_ENCRYPTED) throw new HttpError(400, 'Berkas terenkripsi tidak valid');
  await blobWrite(ev.id, buf);
  ev.ukuran = buf.length;
  ev.blob_ready = true;
  persist(db);
  return json({ ok: true });
}

type SatgasSess = Extract<Session, { kind: 'satgas' }>;

/** Ketua/Anggota boleh mengunduh bukti hanya dari kasus tereskalasi di kampusnya yang sudah disetujui. */
function staffMayRead(db: DB, sess: SatgasSess, rep: Report): boolean {
  if (!['Ketua', 'Anggota'].includes(sess.role)) return false;
  if (rep.institution_id !== sess.institution_id || rep.status !== 'tereskalasi') return false;
  const esc = Object.values(db.escalations).find((x) => x.report_id === rep.id);
  return hasApproval(db, sess, esc?.id ?? '');
}

async function downloadBlob({ req, db }: Ctx, evidenceId: string) {
  const ev = db.evidence[evidenceId];
  if (!ev) throw new HttpError(404, 'Bukti tidak ditemukan');
  const rep = db.reports[ev.report_id];
  const sess = readSession(req.headers.get('authorization'));
  const owner = sess?.kind === 'reporter' && rep.scope_id === sess.scope_id;
  const staff = sess?.kind === 'satgas' && staffMayRead(db, sess, rep) ? sess : null;
  if (!owner && !staff) throw new HttpError(403, 'Tidak ada akses');
  if (staff) {
    audit(db, `${staff.role}:${memberOf(db, staff).nama}`, 'unduh-bukti', ev.id.slice(0, 6));
    persist(db);
  }
  const data = await blobRead(ev.id);
  if (!data) throw new HttpError(404, 'Berkas belum diunggah');
  return new Response(data as unknown as BodyInit, {
    headers: { 'content-type': 'application/octet-stream', 'cache-control': 'no-store' },
  });
}

type ReportAct = (ctx: Ctx, s: ReporterSession, r: Report) => Promise<Response> | Response;

/** Aksi atas satu laporan, dikunci dengan "METODE aksi" (aksi kosong = laporan itu sendiri). */
const REPORT_ACTIONS: Record<string, ReportAct> = {
  'POST settings': async ({ req, db }, _s, r) => {
    const x = await bodyOf(settingsBody, req);
    if (typeof x.k === 'number') r.k_threshold = Math.min(4, Math.max(2, Math.round(x.k)));
    if (typeof x.includeWeak === 'boolean') r.include_weak = x.includeWeak;
    if (typeof x.optIn === 'boolean') r.opt_in = x.optIn;
    persist(db);
    return json(reportView(db, r.id));
  },
  'POST escalate': async ({ req, db }, s, r) => {
    const esc = escalate(db, s, r.id, await bodyOf(escalateBody, req));
    return json({ ok: true, alias: esc.alias, due: esc.sla_due_at }, 201);
  },
  'POST owner': async ({ req, db }, s, r) => {
    registerOwnerKey(db, s, r.id, String((await bodyOf(ownerBody, req)).ownerPub ?? ''));
    return json({ ok: true }, 201);
  },
  'POST bersyarat': async ({ req, db }, s, r) =>
    json(setConditional(db, s, r.id, await bodyOf(conditionalBody, req)), 201),
  'DELETE bersyarat': ({ db }, s, r) => {
    clearConditional(db, s, r.id);
    return json({ ok: true });
  },
  'POST withdraw': ({ db }, s, r) => {
    withdrawEscalation(db, s, r.id);
    return json({ ok: true });
  },
  'DELETE ': async ({ db }, _s, r) => {
    await deleteReport(db, r.id);
    audit(db, 'pelapor-anonim', 'hapus-laporan', 'crypto-shredding');
    return json({ ok: true });
  },
};

/** Aksi atas satu laporan milik pelapor: `/api/reports/:id[/aksi]`. */
function reportActions(ctx: Ctx, reportId: string) {
  const s = reporterSession(ctx.req);
  const r = ctx.db.reports[reportId];
  if (!r || r.scope_id !== s.scope_id) throw new HttpError(404, 'Laporan tidak ditemukan');
  return REPORT_ACTIONS[`${ctx.method} ${ctx.seg[2] ?? ''}`]?.(ctx, s, r);
}
