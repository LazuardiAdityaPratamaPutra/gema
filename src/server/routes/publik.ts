import { anchorProof, ipHash, limiters } from '../logic';
import { HttpError } from '../util';
import { clientIp, json, type Ctx, type Handler } from './context';

type Route = (ctx: Ctx) => Response | undefined;

const HEX64 = /^[0-9a-f]{64}$/;

const institutions: Route = ({ db }) =>
  json(
    Object.values(db.institutions)
      .filter((i) => db.units.some((u) => u.institution_id === i.id))
      .map((i) => ({
        id: i.id,
        nama: i.nama,
        kota: i.kota,
        demo: i.demo,
        fpMode: i.fp_mode,
        slaHari: i.sla_hari,
        publicKey: i.public_key_satgas,
        rujukan: i.rujukan ?? [],
        units: db.units.filter((u) => u.institution_id === i.id),
      })),
  );

const anchors: Route = ({ db }) =>
  json(
    db.anchors
      .slice(-30)
      .reverse()
      .map((x) => ({
        date: x.tanggal,
        root: x.merkle_root,
        size: x.jumlah_hash,
        chainHash: x.chain_hash,
        commitRef: x.commit_ref,
        createdAt: x.created_at,
      })),
  );

const evidenceProof: Route = ({ db, seg: [, , id] }) => {
  if (!id) return;
  const proof = anchorProof(db, id);
  if (!proof) throw new HttpError(404, 'Bukti tidak ditemukan');
  return json(proof);
};

const lookup: Route = ({ db, req, seg: [, , hash] }) => {
  if (!hash) return;
  if (!HEX64.test(hash)) throw new HttpError(400, 'Hash tidak valid');
  if (!limiters.misc.check('lk:' + ipHash(clientIp(req)), 60, 60_000))
    throw new HttpError(429, 'Terlalu cepat.');
  // Pencarian lewat sidik hanya untuk bukti institusi demo. Pada institusi nyata ia akan menjadi
  // "oracle keberadaan": siapa pun yang memegang salinan berkas (mis. terlapor) bisa memastikan
  // berkas itu pernah disimpan. Pemeriksaan data nyata memakai sertifikat milik pelapor.
  const hits = Object.values(db.evidence)
    .filter(
      (e) =>
        e.sha256_asli === hash &&
        db.institutions[db.reports[e.report_id]?.institution_id ?? '']?.demo,
    )
    .sort((x, y) => y.uploaded_at - x.uploaded_at);
  if (!hits.length) return json({ found: false });
  return json({ found: true, proof: anchorProof(db, hits[0].id) });
};

const compliance: Route = ({ db }) =>
  json(
    Object.values(db.institutions)
      .filter((i) => i.papan_publik)
      .map((i) => ({
        id: i.id,
        nama: i.nama,
        kota: i.kota,
        fiktif: i.demo,
        epsilon: i.dp_epsilon,
        kuartal: db.compliance
          .filter((x) => x.institution_id === i.id)
          .sort((x, y) => (x.kuartal < y.kuartal ? 1 : -1))
          .map((x) => ({
            kuartal: x.kuartal,
            enough: x.enough,
            persen: x.persen,
            median: x.median_bucket,
            jumlah: x.jumlah_bucket,
          })),
      })),
  );

/** Rute bernama `"METODE segmen"`; `*` berarti metode apa pun. */
const ROUTES: Record<string, Route> = {
  '* health': () => json({ ok: true, at: new Date().toISOString() }),
  'GET institutions': institutions,
  'GET anchors': anchors,
  'GET evidence': evidenceProof,
  'GET lookup': lookup,
  'GET compliance': compliance,
};

/** Rute `/api/public/*`: tanpa sesi. */
export const publik: Handler = (ctx) => {
  const [a, b] = ctx.seg;
  if (a !== 'public') return;
  return (ROUTES[`${ctx.method} ${b}`] ?? ROUTES[`* ${b}`])?.(ctx);
};
