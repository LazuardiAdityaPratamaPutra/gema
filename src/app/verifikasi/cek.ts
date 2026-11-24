import { sha256Async, toHex } from '@gema/crypto';
import { CERT_STATEMENT, verifyCertificate, type EvidenceCertificate } from '@gema/merkle';
import { api } from '@/lib/api';

export type Result = {
  cert: EvidenceCertificate | null;
  fileHash: string;
  ok: boolean;
  detail: string;
  name: string;
  size: number;
};

const NO_RECORD =
  'Tidak ada catatan untuk berkas ini. Berkas mungkin belum pernah diunggah ke Gema, atau sudah berubah satu bit pun dari aslinya.';

/** Sertifikat dari tautan bila ada; kalau tidak, dicari lewat sidik berkas. */
async function certificateFor(hash: string, given: EvidenceCertificate | null) {
  if (given) return given;
  const r = await api<{ found: boolean; proof?: Omit<EvidenceCertificate, 'statement'> }>(
    `public/lookup/${hash}`,
  );
  return r.found && r.proof ? { ...r.proof, statement: CERT_STATEMENT } : null;
}

/** Hitung sidik berkas di perangkat lalu cocokkan dengan sertifikat. */
export async function checkFile(f: File, given: EvidenceCertificate | null): Promise<Result> {
  const fileHash = toHex(await sha256Async(new Uint8Array(await f.arrayBuffer())));
  const cert = await certificateFor(fileHash, given);
  const base = { fileHash, name: f.name, size: f.size };
  if (!cert) return { ...base, cert: null, ok: false, detail: NO_RECORD };
  const v = verifyCertificate(cert, fileHash);
  return { ...base, cert, ok: v.summary === 'cocok', detail: v.detail };
}
