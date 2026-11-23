import { MAX_FILE } from '@/lib/report-format';
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
import { body, clientIp, json, memberOf, reporterSession, type Ctx, type Handler } from './context';
import { reportView } from './views';

const SIZE_SLACK = 1024;
const MIN_ENCRYPTED = 28;

/** Rute milik pelapor: daftar laporan, OPRF/sidik, buat laporan, dan berkas bukti. */
export const pelapor: Handler = async (ctx) => {
  const {
    method,
    seg: [a, b, c],
    req,
    db,
  } = ctx;

  if (a === 'me' && b === 'reports' && method === 'GET') {
    const s = reporterSession(req);
    return json({
      reports: Object.values(db.reports)
        .filter((r) => r.scope_id === s.scope_id)
        .sort((x, y) => y.created_at - x.created_at)
        .map((r) => reportView(db, r.id)),
    });
  }

  if (a === 'oprf' && b === 'evaluate' && method === 'POST')
    return json(oprfEvaluate(db, reporterSession(req), (await body(req)) as never, clientIp(req)));

  if (a === 'fp' && b === 'hmac' && method === 'POST')
    return json(
      hmacFingerprints(db, reporterSession(req), (await body(req)) as never, clientIp(req)),
    );

  if (a === 'reports' && !b && method === 'POST')
    return json(createReport(db, reporterSession(req), (await body(req)) as never), 201);

  if (a === 'evidence' && b && c === 'blob') {
    if (method === 'PUT') return uploadBlob(ctx, b);
    if (method === 'GET') return downloadBlob(ctx, b);
  }

  if (a === 'reports' && b) return reportActions(ctx, b);
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

async function downloadBlob({ req, db }: Ctx, evidenceId: string) {
  const ev = db.evidence[evidenceId];
  if (!ev) throw new HttpError(404, 'Bukti tidak ditemukan');
  const rep = db.reports[ev.report_id];
  const sess = readSession(req.headers.get('authorization'));
  let allowed = false;
  if (sess?.kind === 'reporter' && rep.scope_id === sess.scope_id) allowed = true;
  if (
    sess?.kind === 'satgas' &&
    ['Ketua', 'Anggota'].includes(sess.role) &&
    rep.institution_id === sess.institution_id &&
    rep.status === 'tereskalasi' &&
    hasApproval(
      db,
      sess,
      Object.values(db.escalations).find((x) => x.report_id === rep.id)?.id ?? '',
    )
  ) {
    allowed = true;
    audit(db, `${sess.role}:${memberOf(db, sess).nama}`, 'unduh-bukti', ev.id.slice(0, 6));
    persist(db);
  }
  if (!allowed) throw new HttpError(403, 'Tidak ada akses');
  const data = await blobRead(ev.id);
  if (!data) throw new HttpError(404, 'Berkas belum diunggah');
  return new Response(data as unknown as BodyInit, {
    headers: { 'content-type': 'application/octet-stream', 'cache-control': 'no-store' },
  });
}

/** Aksi atas satu laporan milik pelapor: `/api/reports/:id[/aksi]`. */
async function reportActions({ method, seg: [, , c], req, db }: Ctx, reportId: string) {
  const s = reporterSession(req);
  const r = db.reports[reportId];
  if (!r || r.scope_id !== s.scope_id) throw new HttpError(404, 'Laporan tidak ditemukan');

  if (c === 'settings' && method === 'POST') {
    const x = await body<{ k?: number; includeWeak?: boolean; optIn?: boolean }>(req);
    if (typeof x.k === 'number') r.k_threshold = Math.min(4, Math.max(2, Math.round(x.k)));
    if (typeof x.includeWeak === 'boolean') r.include_weak = x.includeWeak;
    if (typeof x.optIn === 'boolean') r.opt_in = x.optIn;
    persist(db);
    return json(reportView(db, r.id));
  }
  if (c === 'escalate' && method === 'POST') {
    const esc = escalate(db, s, reportId, (await body(req)) as never);
    return json({ ok: true, alias: esc.alias, due: esc.sla_due_at }, 201);
  }
  if (c === 'owner' && method === 'POST') {
    registerOwnerKey(
      db,
      s,
      reportId,
      String((await body<{ ownerPub?: string }>(req)).ownerPub ?? ''),
    );
    return json({ ok: true }, 201);
  }
  if (c === 'bersyarat' && method === 'POST')
    return json(setConditional(db, s, reportId, (await body(req)) as never), 201);
  if (c === 'bersyarat' && method === 'DELETE') {
    clearConditional(db, s, reportId);
    return json({ ok: true });
  }
  if (c === 'withdraw' && method === 'POST') {
    withdrawEscalation(db, s, reportId);
    return json({ ok: true });
  }
  if (!c && method === 'DELETE') {
    await deleteReport(db, reportId);
    audit(db, 'pelapor-anonim', 'hapus-laporan', 'crypto-shredding');
    return json({ ok: true });
  }
}
