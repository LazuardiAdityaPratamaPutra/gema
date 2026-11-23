/**
 * @gema/crypto — primitif kripto sisi klien dan server.
 * Hanya memakai WebCrypto (AES-GCM, PBKDF2, SHA-256) dan @noble/hashes (HKDF).
 * Tidak ada kripto buatan sendiri.
 */
import { hkdf } from '@noble/hashes/hkdf.js';
import { sha256 as nobleSha256 } from '@noble/hashes/sha2.js';

const enc = new TextEncoder();
const dec = new TextDecoder();

export const utf8 = (s: string): Uint8Array => enc.encode(s);
export const fromUtf8 = (b: Uint8Array): string => dec.decode(b);

const buf = (u: Uint8Array): BufferSource => u as unknown as BufferSource;

export function randomBytes(n: number): Uint8Array {
  const out = new Uint8Array(n);
  globalThis.crypto.getRandomValues(out);
  return out;
}

export function concat(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((a, p) => a + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

export function toHex(b: Uint8Array): string {
  let s = '';
  for (const x of b) s += x.toString(16).padStart(2, '0');
  return s;
}

export function fromHex(h: string): Uint8Array {
  if (h.length % 2 !== 0 || /[^0-9a-f]/i.test(h)) throw new Error('hex tidak valid');
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export function b64u(b: Uint8Array): string {
  let s = '';
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromB64u(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i];
  return d === 0;
}

/** SHA-256 sinkron (JS murni, noble). */
export function sha256(data: Uint8Array): Uint8Array {
  return nobleSha256(data);
}

/** SHA-256 untuk berkas besar: pakai WebCrypto bila ada, cadangan JS murni. */
export async function sha256Async(data: Uint8Array): Promise<Uint8Array> {
  try {
    if (globalThis.crypto?.subtle) {
      return new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', buf(data)));
    }
  } catch {
    /* jatuh ke cadangan */
  }
  return nobleSha256(data);
}

/* ---------- Kode Kasus dan passphrase ---------- */

// Base32 tanpa karakter yang mudah tertukar (0/O, 1/I/L)
const BASE32 = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function randomIndex(max: number): number {
  const limit = Math.floor(0x100000000 / max) * max;
  const a = new Uint32Array(1);
  do {
    globalThis.crypto.getRandomValues(a);
  } while (a[0] >= limit);
  return a[0] % max;
}

/** 12 karakter, ditampilkan 4-4-4. ≈ 59 bit. */
export function generateCaseCode(): string {
  let s = '';
  for (let i = 0; i < 12; i++) s += BASE32[randomIndex(BASE32.length)];
  return s;
}

export function formatCaseCode(code: string): string {
  return code.replace(/(.{4})(?=.)/g, '$1-');
}

export function normalizeCaseCode(input: string): string {
  return input
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1');
}

function normalizePassphrase(p: string): string {
  return p.normalize('NFKC').toLowerCase().trim().replace(/\s+/g, ' ');
}

/* ---------- Hierarki kunci ---------- */

const PBKDF2_ITERATIONS = 600_000;

export type AccountKeys = { authKey: Uint8Array; kek: Uint8Array };

/**
 * passphrase → PBKDF2-SHA256 (600 ribu iterasi, garam = Kode Kasus) → master
 * master → HKDF("auth") → authKey (dikirim; server hanya menyimpan hash-nya)
 * master → HKDF("kek")  → KEK (tidak pernah meninggalkan perangkat)
 *
 * Catatan: PRD 10.2 menurunkan authKey langsung dari passphrase dengan HKDF.
 * Di sini authKey ikut melewati PBKDF2 supaya hash di server tidak bisa ditebak
 * secepat HKDF biasa bila basis data bocor.
 */
export async function deriveAccountKeys(
  caseCode: string,
  passphrase: string,
  iterations = PBKDF2_ITERATIONS,
): Promise<AccountKeys> {
  const base = await globalThis.crypto.subtle.importKey(
    'raw',
    buf(utf8(normalizePassphrase(passphrase))),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const master = new Uint8Array(
    await globalThis.crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        hash: 'SHA-256',
        salt: buf(utf8('gema/v1/' + normalizeCaseCode(caseCode))),
        iterations,
      },
      base,
      256,
    ),
  );
  const authKey = hkdf(nobleSha256, master, undefined, utf8('gema/v1/auth'), 32);
  const kek = hkdf(nobleSha256, master, undefined, utf8('gema/v1/kek'), 32);
  return { authKey, kek };
}

/** Hash yang disimpan server untuk authKey. */
export function authHash(authKey: Uint8Array): string {
  return toHex(nobleSha256(concat(utf8('gema-auth-v1'), authKey)));
}

/* ---------- AES-256-GCM ---------- */

async function aesKey(key: Uint8Array, usage: KeyUsage[]): Promise<CryptoKey> {
  return globalThis.crypto.subtle.importKey('raw', buf(key), 'AES-GCM', false, usage);
}

/** Keluaran: iv (12 byte) ‖ ciphertext+tag. IV acak unik per blob. */
export async function aesGcmEncrypt(
  key: Uint8Array,
  plaintext: Uint8Array,
  aad: string,
): Promise<Uint8Array> {
  const iv = randomBytes(12);
  const ct = new Uint8Array(
    await globalThis.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: buf(iv), additionalData: buf(utf8(aad)) },
      await aesKey(key, ['encrypt']),
      buf(plaintext),
    ),
  );
  return concat(iv, ct);
}

export async function aesGcmDecrypt(
  key: Uint8Array,
  blob: Uint8Array,
  aad: string,
): Promise<Uint8Array> {
  if (blob.length < 12 + 16) throw new Error('blob terlalu pendek');
  const iv = blob.subarray(0, 12);
  const pt = await globalThis.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: buf(iv), additionalData: buf(utf8(aad)) },
    await aesKey(key, ['decrypt']),
    buf(blob.subarray(12)),
  );
  return new Uint8Array(pt);
}

export const newDek = (): Uint8Array => randomBytes(32);

export const wrapKey = (kek: Uint8Array, dek: Uint8Array, aad: string) =>
  aesGcmEncrypt(kek, dek, aad);
export const unwrapKey = (kek: Uint8Array, wrapped: Uint8Array, aad: string) =>
  aesGcmDecrypt(kek, wrapped, aad);

export async function encryptJson(
  key: Uint8Array,
  value: unknown,
  aad: string,
): Promise<Uint8Array> {
  return aesGcmEncrypt(key, utf8(JSON.stringify(value)), aad);
}

export async function decryptJson<T>(key: Uint8Array, blob: Uint8Array, aad: string): Promise<T> {
  return JSON.parse(fromUtf8(await aesGcmDecrypt(key, blob, aad))) as T;
}

/** Padding ke ukuran tetap (untuk brankas samaran supaya bentuk data seragam). */
export function padTo(data: Uint8Array, size: number): Uint8Array {
  if (data.length + 4 > size) throw new Error('data melebihi ukuran padding');
  const out = new Uint8Array(size);
  new DataView(out.buffer).setUint32(0, data.length);
  out.set(data, 4);
  out.set(randomBytes(size - 4 - data.length), 4 + data.length);
  return out;
}

export function unpad(padded: Uint8Array): Uint8Array {
  const len = new DataView(padded.buffer, padded.byteOffset, padded.byteLength).getUint32(0);
  if (len > padded.length - 4) throw new Error('padding rusak');
  return padded.slice(4, 4 + len);
}
