/**
 * @gema/merkle — pohon Merkle bergaya RFC 6962/9162 dengan pemisah domain (0x00 daun, 0x01 simpul dalam).
 * Dipakai untuk (1) anchor harian bukti, (2) pohon pesan berbumbu pada Bukti per Pesan.
 */
import {
  sha256,
  concat,
  toHex,
  fromHex,
  utf8,
  b64u,
  fromB64u,
  constantTimeEqual,
  randomBytes,
} from '@gema/crypto';

const ZERO32 = new Uint8Array(32);

export const leafHash = (data: Uint8Array): Uint8Array =>
  sha256(concat(new Uint8Array([0x00]), data));
export const nodeHash = (l: Uint8Array, r: Uint8Array): Uint8Array =>
  sha256(concat(new Uint8Array([0x01]), l, r));

function largestPow2Below(n: number): number {
  let k = 1;
  while (k * 2 < n) k *= 2;
  return k;
}

/** `leaves` adalah hash daun yang sudah dihitung dengan leafHash. */
export function merkleRoot(leaves: Uint8Array[]): Uint8Array {
  const n = leaves.length;
  if (n === 0) return sha256(new Uint8Array(0));
  if (n === 1) return leaves[0];
  const k = largestPow2Below(n);
  return nodeHash(merkleRoot(leaves.slice(0, k)), merkleRoot(leaves.slice(k)));
}

export function auditPath(index: number, leaves: Uint8Array[]): Uint8Array[] {
  const n = leaves.length;
  if (index < 0 || index >= n) throw new Error('indeks di luar jangkauan');
  if (n === 1) return [];
  const k = largestPow2Below(n);
  if (index < k) return [...auditPath(index, leaves.slice(0, k)), merkleRoot(leaves.slice(k))];
  return [...auditPath(index - k, leaves.slice(k)), merkleRoot(leaves.slice(0, k))];
}

export function verifyPath(
  leaf: Uint8Array,
  index: number,
  size: number,
  path: Uint8Array[],
  root: Uint8Array,
): boolean {
  if (index < 0 || index >= size) return false;
  let fn = index;
  let sn = size - 1;
  let r = leaf;
  for (const p of path) {
    if (sn === 0) return false;
    if ((fn & 1) === 1 || fn === sn) {
      r = nodeHash(p, r);
      if ((fn & 1) === 0) {
        while ((fn & 1) === 0 && fn !== 0) {
          fn >>= 1;
          sn >>= 1;
        }
      }
    } else {
      r = nodeHash(r, p);
    }
    fn >>= 1;
    sn >>= 1;
  }
  return sn === 0 && constantTimeEqual(r, root);
}

/* ---------- Anchor harian: daun mengikat berkas dan pesan ---------- */

/** SHA-256(0x00 ‖ sha256_asli ‖ message_root); tanpa pesan, message_root = 32 byte nol. */
export function evidenceLeaf(
  sha256Original: Uint8Array,
  messageRoot: Uint8Array | null,
): Uint8Array {
  return leafHash(concat(sha256Original, messageRoot ?? ZERO32));
}

/* ---------- Bukti per Pesan ---------- */

export type CanonicalMessage = { ts: string; sender: string; text: string; attachment: string };

export function canonicalBytes(m: CanonicalMessage): Uint8Array {
  return utf8(JSON.stringify([m.ts, m.sender, m.text, m.attachment]));
}

/** L_i = SHA-256(0x00 ‖ garam_i ‖ m_i) dengan garam acak 16 byte per pesan. */
export function messageLeaf(salt: Uint8Array, m: CanonicalMessage): Uint8Array {
  return leafHash(concat(salt, canonicalBytes(m)));
}

export function newSalts(n: number): Uint8Array[] {
  return Array.from({ length: n }, () => randomBytes(16));
}

export function buildMessageTree(messages: CanonicalMessage[], salts: Uint8Array[]) {
  if (messages.length !== salts.length) throw new Error('jumlah garam tidak cocok');
  const leaves = messages.map((m, i) => messageLeaf(salts[i], m));
  return { leaves, root: merkleRoot(leaves), count: messages.length };
}

export type DisclosurePackage = {
  v: 1;
  evidenceId: string;
  messageRoot: string; // hex
  count: number;
  items: { index: number; message: CanonicalMessage; salt: string; path: string[] }[];
  note: string;
};

export const DISCLOSURE_NOTE =
  'Paket ini membuktikan bahwa pesan-pesan di bawah ada di berkas yang tercatat pada waktu unggah. ' +
  'Ia tidak membuktikan keaslian asal-usul percakapan dan tidak membuktikan konteksnya.';

export function buildDisclosure(
  evidenceId: string,
  messages: CanonicalMessage[],
  salts: Uint8Array[],
  selected: number[],
): DisclosurePackage {
  const tree = buildMessageTree(messages, salts);
  return {
    v: 1,
    evidenceId,
    messageRoot: toHex(tree.root),
    count: tree.count,
    items: [...new Set(selected)]
      .sort((a, b) => a - b)
      .map((i) => ({
        index: i,
        message: messages[i],
        salt: b64u(salts[i]),
        path: auditPath(i, tree.leaves).map(toHex),
      })),
    note: DISCLOSURE_NOTE,
  };
}

export function verifyDisclosure(pkg: DisclosurePackage): {
  ok: boolean;
  results: { index: number; ok: boolean }[];
} {
  const root = fromHex(pkg.messageRoot);
  const results = pkg.items.map((it) => {
    try {
      const leaf = messageLeaf(fromB64u(it.salt), it.message);
      return {
        index: it.index,
        ok: verifyPath(leaf, it.index, pkg.count, it.path.map(fromHex), root),
      };
    } catch {
      return { index: it.index, ok: false };
    }
  });
  return { ok: results.length > 0 && results.every((r) => r.ok), results };
}

/* ---------- Sertifikat dan verifikasi ---------- */

export type AnchorProof = {
  date: string;
  root: string;
  size: number;
  index: number;
  path: string[];
  chainHash: string | null;
  commitRef: string | null;
};

export type EvidenceCertificate = {
  v: 1;
  evidenceId: string;
  sha256: string;
  messageRoot: string | null;
  messageCount: number | null;
  uploadedAt: string;
  leaf: string;
  anchor: AnchorProof | null;
  statement: string;
};

export const CERT_STATEMENT =
  'Yang dibuktikan: keutuhan berkas dan keberadaan pesan di dalamnya pada waktu T. ' +
  'Bukan keaslian asal-usul percakapan atau konteksnya, dan bukan jaminan diterima sebagai alat bukti.';

export type VerifyResult = {
  fileMatches: boolean;
  leafConsistent: boolean;
  anchored: boolean;
  anchorValid: boolean | null;
  summary: 'cocok' | 'tidak-cocok';
  detail: string;
};

export function verifyCertificate(cert: EvidenceCertificate, fileSha256Hex: string): VerifyResult {
  const fileMatches = fileSha256Hex.toLowerCase() === cert.sha256.toLowerCase();
  let leafConsistent = false;
  try {
    const leaf = evidenceLeaf(
      fromHex(cert.sha256),
      cert.messageRoot ? fromHex(cert.messageRoot) : null,
    );
    leafConsistent = toHex(leaf) === cert.leaf.toLowerCase();
  } catch {
    leafConsistent = false;
  }
  let anchorValid: boolean | null = null;
  if (cert.anchor) {
    try {
      anchorValid = verifyPath(
        fromHex(cert.leaf),
        cert.anchor.index,
        cert.anchor.size,
        cert.anchor.path.map(fromHex),
        fromHex(cert.anchor.root),
      );
    } catch {
      anchorValid = false;
    }
  }
  const ok = fileMatches && leafConsistent && anchorValid !== false;
  let detail: string;
  if (!fileMatches) detail = 'Berkas ini berbeda dari berkas yang tercatat (hash tidak sama).';
  else if (!leafConsistent)
    detail = 'Sertifikat tidak konsisten: daun Merkle tidak sesuai hash dan akar pesan.';
  else if (anchorValid === false)
    detail = 'Jalur Merkle tidak sampai ke akar yang tertulis di sertifikat.';
  else if (anchorValid === null)
    detail = 'Berkas cocok dengan hash tercatat. Akar harian belum terbit saat sertifikat dibuat.';
  else detail = 'Berkas cocok dan jalur Merkle sampai ke akar harian.';
  return {
    fileMatches,
    leafConsistent,
    anchored: !!cert.anchor,
    anchorValid,
    summary: ok ? 'cocok' : 'tidak-cocok',
    detail,
  };
}
