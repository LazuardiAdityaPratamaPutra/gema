import { anchorProof, ipHash, limiters } from '../logic';
import { HttpError } from '../util';
import { clientIp, json, type Handler } from './context';

/** Rute `/api/public/*`: tanpa sesi. */
export const publik: Handler = ({ method, seg: [a, b, c], req, db }) => {
  if (a !== 'public') return;

  if (b === 'health') return json({ ok: true, at: new Date().toISOString() });

  if (b === 'institutions' && method === 'GET')
    return json(
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

  if (b === 'anchors' && method === 'GET')
    return json(
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

  if (b === 'evidence' && c && method === 'GET') {
    const proof = anchorProof(db, c);
    if (!proof) throw new HttpError(404, 'Bukti tidak ditemukan');
    return json(proof);
  }

  if (b === 'lookup' && c && method === 'GET') {
    if (!/^[0-9a-f]{64}$/.test(c)) throw new HttpError(400, 'Hash tidak valid');
    if (!limiters.misc.check('lk:' + ipHash(clientIp(req)), 60, 60_000))
      throw new HttpError(429, 'Terlalu cepat.');
    // Pencarian lewat sidik hanya untuk bukti institusi demo. Pada institusi nyata ia akan menjadi
    // "oracle keberadaan": siapa pun yang memegang salinan berkas (mis. terlapor) bisa memastikan
    // berkas itu pernah disimpan. Pemeriksaan data nyata memakai sertifikat milik pelapor.
    const hits = Object.values(db.evidence)
      .filter(
        (e) =>
          e.sha256_asli === c &&
          db.institutions[db.reports[e.report_id]?.institution_id ?? '']?.demo,
      )
      .sort((x, y) => y.uploaded_at - x.uploaded_at);
    if (!hits.length) return json({ found: false });
    return json({ found: true, proof: anchorProof(db, hits[0].id) });
  }

  if (b === 'compliance' && method === 'GET')
    return json(
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
};
