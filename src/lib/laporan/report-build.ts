/**
 * Menyusun satu laporan terenkripsi. Dipakai klien (wizard) dan seed demo, sehingga keduanya
 * menghasilkan bentuk data yang sama.
 */
import {
  aesGcmEncrypt,
  b64u,
  encryptJson,
  newDek,
  sha256Async,
  toHex,
  wrapKey,
} from '@gema/crypto';
import { buildInputs, type Attributes } from '@gema/matching';
import { buildMessageTree, newSalts, type CanonicalMessage } from '@gema/merkle';
import { AAD, type BuktiMeta, type Narasi } from '@/lib/laporan/report-format';

export type FileInput = {
  nama: string;
  tipe: string;
  bytes: Uint8Array;
  messages?: CanonicalMessage[];
};
export type FpFn = (inputs: string[]) => Promise<string[]>;

export type BuiltReport = {
  dek: Uint8Array;
  secrets: { narasi_ciphertext: string; dek_wrapped_klien: string; bukti_meta_ciphertext: string };
  fingerprints: { varian: string; tingkat: string; fp: string }[];
  evidence: {
    clientId: string;
    sha256: string;
    messageRoot: string | null;
    messageCount: number | null;
    tipe: string;
    blob: Uint8Array;
  }[];
};

export async function buildReport(opts: {
  kek: Uint8Array;
  narasi: Omit<Narasi, 'v' | 'dibuat'>;
  attrs: Attributes;
  files: FileInput[];
  fp: FpFn;
}): Promise<BuiltReport> {
  const dek = newDek();
  const narasi: Narasi = { v: 1, ...opts.narasi, dibuat: new Date().toISOString() };

  const meta: BuktiMeta = { v: 1, items: [] };
  const evidence: BuiltReport['evidence'] = [];
  for (const f of opts.files) {
    // hash dihitung dari berkas asli SEBELUM enkripsi
    const sha = toHex(await sha256Async(f.bytes));
    let messageRoot: string | null = null;
    let count: number | null = null;
    const item: BuktiMeta['items'][number] = {
      sha256: sha,
      nama: f.nama,
      tipe: f.tipe,
      ukuran: f.bytes.length,
    };
    if (f.messages && f.messages.length) {
      const salts = newSalts(f.messages.length);
      const tree = buildMessageTree(f.messages, salts);
      messageRoot = toHex(tree.root);
      count = tree.count;
      item.salts = salts.map(b64u);
      item.messages = f.messages;
    }
    meta.items.push(item);
    evidence.push({
      clientId: sha,
      sha256: sha,
      messageRoot,
      messageCount: count,
      tipe: f.tipe,
      blob: await aesGcmEncrypt(dek, f.bytes, AAD.evidence),
    });
  }

  const inputs = buildInputs(opts.narasi.terlapor.nama, opts.narasi.terlapor.unitId, opts.attrs);
  const fps = inputs.length ? await opts.fp(inputs.map((i) => i.input)) : [];
  const fingerprints = inputs.map((i, n) => ({
    varian: i.variant,
    tingkat: i.tier,
    fp: fps[n],
  }));

  return {
    dek,
    secrets: {
      narasi_ciphertext: b64u(await encryptJson(dek, narasi, AAD.narasi)),
      dek_wrapped_klien: b64u(await wrapKey(opts.kek, dek, AAD.dek)),
      bukti_meta_ciphertext: b64u(await encryptJson(dek, meta, AAD.meta)),
    },
    fingerprints,
    evidence,
  };
}
