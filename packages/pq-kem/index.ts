/**
 * @gema/pq-kem — KEM hibrida ECDH P-256 + ML-KEM-768 (FIPS 203) untuk membungkus kunci data.
 *
 *   K = HKDF-SHA256( ss_ecdh ‖ ss_mlkem , info = id_institusi ‖ id_eskalasi ‖ ct_ecdh ‖ ct_mlkem )
 *
 * Pembungkus hanya terbuka bila penyerang memecahkan kedua komponen.
 * Yang tahan kuantum hanya pembungkus kunci ini; data memakai AES-256-GCM.
 * `kem_suite` ditulis pada setiap pembungkus agar algoritma dapat diganti.
 */
import { p256 } from '@noble/curves/nist.js';
import { ml_kem768 } from '@noble/post-quantum/ml-kem.js';
import { hkdf } from '@noble/hashes/hkdf.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { aesGcmDecrypt, aesGcmEncrypt, b64u, concat, fromB64u, utf8 } from '@gema/crypto';

export const KEM_SUITE_HYBRID = 'ecdh-p256+mlkem768-v1';
export const KEM_SUITE_ECDH_ONLY = 'ecdh-p256-v1'; // cadangan berlabel bila ML-KEM gagal

export type HybridPublicKey = { suite: string; ecdh: string; mlkem: string };
export type HybridSecretKey = { suite: string; ecdh: string; mlkem: string };
export type WrappedKey = {
  suite: string;
  ctEcdh: string; // kunci publik sementara
  ctMlkem: string;
  blob: string; // iv ‖ AES-GCM(DEK)
};

export function generateHybridKeypair(): {
  publicKey: HybridPublicKey;
  secretKey: HybridSecretKey;
} {
  const e = p256.keygen();
  const m = ml_kem768.keygen();
  return {
    publicKey: { suite: KEM_SUITE_HYBRID, ecdh: b64u(e.publicKey), mlkem: b64u(m.publicKey) },
    secretKey: { suite: KEM_SUITE_HYBRID, ecdh: b64u(e.secretKey), mlkem: b64u(m.secretKey) },
  };
}

const u32 = (n: number) =>
  new Uint8Array([(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]);
const lp = (b: Uint8Array) => concat(u32(b.length), b); // length-prefix: pengikatan konteks tanpa ambigu

function combine(
  ssEcdh: Uint8Array,
  ssMlkem: Uint8Array,
  ctx: { institutionId: string; escalationId: string },
  ctEcdh: Uint8Array,
  ctMlkem: Uint8Array,
) {
  const info = concat(
    utf8('gema/kem/v1'),
    lp(utf8(ctx.institutionId)),
    lp(utf8(ctx.escalationId)),
    lp(ctEcdh),
    lp(ctMlkem),
  );
  return hkdf(sha256, concat(ssEcdh, ssMlkem), undefined, info, 32);
}

const xOnly = (shared: Uint8Array) => shared.slice(1, 33);

export async function wrapForSatgas(
  dek: Uint8Array,
  pk: HybridPublicKey,
  ctx: { institutionId: string; escalationId: string },
): Promise<WrappedKey> {
  const eph = p256.keygen();
  const ssEcdh = xOnly(p256.getSharedSecret(eph.secretKey, fromB64u(pk.ecdh)));
  const enc = ml_kem768.encapsulate(fromB64u(pk.mlkem));
  const K = combine(ssEcdh, enc.sharedSecret, ctx, eph.publicKey, enc.cipherText);
  const aad = `gema/dek-satgas/${ctx.institutionId}/${ctx.escalationId}`;
  const blob = await aesGcmEncrypt(K, dek, aad);
  return {
    suite: KEM_SUITE_HYBRID,
    ctEcdh: b64u(eph.publicKey),
    ctMlkem: b64u(enc.cipherText),
    blob: b64u(blob),
  };
}

export async function unwrapFromSatgas(
  w: WrappedKey,
  sk: HybridSecretKey,
  ctx: { institutionId: string; escalationId: string },
): Promise<Uint8Array> {
  if (w.suite !== KEM_SUITE_HYBRID) throw new Error('suite tidak dikenal: ' + w.suite);
  const ctEcdh = fromB64u(w.ctEcdh);
  const ctMlkem = fromB64u(w.ctMlkem);
  const ssEcdh = xOnly(p256.getSharedSecret(fromB64u(sk.ecdh), ctEcdh));
  const ssMlkem = ml_kem768.decapsulate(ctMlkem, fromB64u(sk.mlkem));
  const K = combine(ssEcdh, ssMlkem, ctx, ctEcdh, ctMlkem);
  return aesGcmDecrypt(
    K,
    fromB64u(w.blob),
    `gema/dek-satgas/${ctx.institutionId}/${ctx.escalationId}`,
  );
}
