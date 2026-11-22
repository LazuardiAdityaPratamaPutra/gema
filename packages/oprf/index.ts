/**
 * @gema/oprf — Jembatan Buta.
 * OPRF mode dasar RFC 9497, ciphersuite P256-SHA256, dari @noble/curves (versi terpin).
 *
 * Klien: blind(input) → kirim `blinded` → finalize(input, blind, evaluated) → fingerprint.
 * Server: evaluate(secretKey, blinded) memakai kunci per institusi; tidak pernah melihat input.
 */
import { p256_oprf } from '@noble/curves/nist.js';
import { p256 } from '@noble/curves/nist.js';
import { fromHex, toHex, utf8 } from '@gema/crypto';

export const OPRF_SUITE = 'P256-SHA256';
export const MAX_EVALUATIONS_PER_REPORT = 8;

export type BlindedInput = { input: string; blind: Uint8Array; blinded: Uint8Array };

/** Klien: samarkan seluruh masukan (nama + varian) sebelum dikirim. */
export function blindInputs(inputs: string[]): BlindedInput[] {
  return inputs.map((input) => {
    const r = p256_oprf.oprf.blind(utf8(input));
    return { input, blind: r.blind, blinded: r.blinded };
  });
}

/** Klien: buka samaran dan hitung fingerprint (hex 64). */
export function finalizeInputs(items: BlindedInput[], evaluatedHex: string[]): string[] {
  if (items.length !== evaluatedHex.length) throw new Error('jumlah evaluasi tidak cocok');
  return items.map((it, i) =>
    toHex(p256_oprf.oprf.finalize(utf8(it.input), it.blind, fromHex(evaluatedHex[i]))),
  );
}

/** Server: titik masukan harus titik P-256 sah (terkompresi 33 byte), bukan titik tak hingga. */
export function isValidPoint(bytes: Uint8Array): boolean {
  if (bytes.length !== 33 || (bytes[0] !== 0x02 && bytes[0] !== 0x03)) return false;
  try {
    const pt = p256.Point.fromBytes(bytes);
    pt.assertValidity();
    return !pt.is0();
  } catch {
    return false;
  }
}

export function deriveInstitutionKey(masterSeed: Uint8Array, institutionId: string) {
  return p256_oprf.oprf.deriveKeyPair(masterSeed, utf8('gema-institution:' + institutionId));
}

/** Server: evaluasi satu batch titik tersamar. Menolak seluruh batch bila ada titik tidak sah. */
export function evaluateBatch(secretKey: Uint8Array, blindedHex: string[]): string[] {
  const pts = blindedHex.map((h) => {
    const b = fromHex(h);
    if (!isValidPoint(b)) throw new Error('titik tidak valid');
    return b;
  });
  return pts.map((p) => toHex(p256_oprf.oprf.blindEvaluate(secretKey, p)));
}

/** Penyederhana untuk uji dan demo: protokol penuh dalam satu proses. */
export function runLocal(secretKey: Uint8Array, inputs: string[]): string[] {
  const blinded = blindInputs(inputs);
  const evaluated = evaluateBatch(
    secretKey,
    blinded.map((b) => toHex(b.blinded)),
  );
  return finalizeInputs(blinded, evaluated);
}
