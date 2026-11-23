import { fromHex, toHex } from '@gema/crypto';
import { auditPath, merkleRoot } from '@gema/merkle';
import { persist } from '../db';
import type { DB } from '../types';
import { chainHash, uid, wibDate } from '../util';
import { audit } from './audit';

export function sealAnchors(db: DB, force: boolean, now = Date.now()) {
  const today = wibDate(now);
  const pending = Object.values(db.evidence)
    .filter((e) => !e.anchor_id && e.blob_ready && (force || wibDate(e.uploaded_at) < today))
    .sort((a, b) => a.uploaded_at - b.uploaded_at);
  if (!pending.length) return null;
  const leaves = pending.map((e) => e.leaf);
  const root = toHex(merkleRoot(leaves.map(fromHex)));
  const prev = db.anchors.length ? db.anchors[db.anchors.length - 1].chain_hash : 'genesis';
  const id = uid(8);
  const anchor = {
    id,
    tanggal: today,
    merkle_root: root,
    jumlah_hash: leaves.length,
    leaves,
    chain_hash: chainHash(prev, { root, tanggal: today, n: leaves.length }),
    commit_ref: null,
    created_at: now,
  };
  db.anchors.push(anchor);
  for (const e of pending) e.anchor_id = id;
  audit(db, 'sistem', 'anchor-merkle', `${today}:${root.slice(0, 12)}`, now);
  persist(db);
  return anchor;
}

export function anchorProof(db: DB, evidenceId: string) {
  const e = db.evidence[evidenceId];
  if (!e) return null;
  const a = e.anchor_id ? db.anchors.find((x) => x.id === e.anchor_id) : null;
  let anchor = null;
  if (a) {
    const leaves = a.leaves.map(fromHex);
    const index = a.leaves.indexOf(e.leaf);
    anchor = {
      date: a.tanggal,
      root: a.merkle_root,
      size: a.jumlah_hash,
      index,
      path: auditPath(index, leaves).map(toHex),
      chainHash: a.chain_hash,
      commitRef: a.commit_ref,
    };
  }
  return {
    v: 1 as const,
    evidenceId: e.id,
    sha256: e.sha256_asli,
    messageRoot: e.message_root,
    messageCount: e.jumlah_pesan,
    uploadedAt: new Date(e.uploaded_at).toISOString(),
    leaf: e.leaf,
    anchor,
  };
}
