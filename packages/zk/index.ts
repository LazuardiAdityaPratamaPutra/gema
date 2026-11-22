/**
 * @gema/zk — bukti nol-pengetahuan Schnorr (Fiat–Shamir) di kurva P-256.
 * Dipakai untuk "Bukti Pemilik": pelapor membuktikan ia memegang kunci sebuah laporan tanpa membuka kunci itu
 * dan tanpa identitas. Bukti terikat pada konteks (alias kasus + tantangan Satgas), jadi tidak bisa dipakai ulang.
 *
 * Kunci: x = HKDF(DEK laporan, "gema/zk/owner/v1"); kunci publik X = x·G dititipkan di server saat laporan dibuat.
 * Bukti: pilih k acak, R = k·G, c = H(X, R, konteks), s = k + c·x (mod n). Verifikasi: s·G = R + c·X.
 */
import { p256 } from '@noble/curves/nist.js';
import { hkdf } from '@noble/hashes/hkdf.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { b64u, concat, fromB64u, utf8 } from '@gema/crypto';

const Point = p256.Point;
const n = Point.Fn.ORDER;
const G = Point.BASE;

const toBig = (b: Uint8Array) =>
  BigInt('0x' + [...b].map((x) => x.toString(16).padStart(2, '0')).join(''));
const toBytes32 = (x: bigint) => {
  const out = new Uint8Array(32);
  let v = x;
  for (let i = 31; i >= 0; i--) {
    out[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return out;
};

/** Skalar dari HKDF 48 byte (bias dapat diabaikan), tidak pernah nol. */
function scalarFrom(seed: Uint8Array, info: string): bigint {
  const x = toBig(hkdf(sha256, seed, undefined, utf8(info), 48)) % (n - 1n);
  return x + 1n;
}

export type OwnerKey = { secret: bigint; publicKey: string };

export function ownerKeyFromDek(dek: Uint8Array): OwnerKey {
  const secret = scalarFrom(dek, 'gema/zk/owner/v1');
  return { secret, publicKey: b64u(G.multiply(secret).toBytes(true)) };
}

const challenge = (X: Uint8Array, R: Uint8Array, context: string) =>
  toBig(sha256(concat(utf8('gema/zk/schnorr/v1'), X, R, utf8(context)))) % n;

/** Bukti = R (33 byte) || s (32 byte), dikodekan b64url. */
export function proveOwnership(key: OwnerKey, context: string): string {
  const X = G.multiply(key.secret).toBytes(true);
  const k = scalarFrom(p256.utils.randomSecretKey(), 'gema/zk/nonce');
  const R = G.multiply(k).toBytes(true);
  const c = challenge(X, R, context);
  const s = (k + c * key.secret) % n;
  return b64u(concat(R, toBytes32(s)));
}

export function verifyOwnership(publicKey: string, proof: string, context: string): boolean {
  try {
    const Xb = fromB64u(publicKey);
    const raw = fromB64u(proof);
    if (Xb.length !== 33 || raw.length !== 65) return false;
    const Rb = raw.slice(0, 33);
    const s = toBig(raw.slice(33));
    if (s <= 0n || s >= n) return false;
    const X = Point.fromBytes(Xb);
    const R = Point.fromBytes(Rb);
    const c = challenge(Xb, Rb, context);
    return G.multiply(s).equals(R.add(X.multiply(c)));
  } catch {
    return false;
  }
}

export function isValidPublicKey(publicKey: string): boolean {
  try {
    const b = fromB64u(publicKey);
    if (b.length !== 33) return false;
    Point.fromBytes(b).assertValidity();
    return true;
  } catch {
    return false;
  }
}
