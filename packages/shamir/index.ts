/**
 * @gema/shamir — pecah rahasia Shamir di GF(2^8) (polinom 0x11b, generator 3).
 * Dipakai untuk mode Empat Mata: DEK dipecah 2-dari-3.
 */
import { randomBytes } from '@gema/crypto';

const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    // x *= 3 di GF(256)
    let x2 = x << 1;
    if (x2 & 0x100) x2 ^= 0x11b;
    x = x2 ^ x;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
})();

const mul = (a: number, b: number) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);
const inv = (a: number) => {
  if (a === 0) throw new Error('tidak ada invers untuk 0');
  return EXP[255 - LOG[a]];
};

export type Share = { x: number; y: Uint8Array };

export function split(secret: Uint8Array, threshold: number, shares: number): Share[] {
  if (threshold < 2 || shares < threshold || shares > 255) throw new Error('parameter tidak valid');
  const out: Share[] = Array.from({ length: shares }, (_, i) => ({
    x: i + 1,
    y: new Uint8Array(secret.length),
  }));
  for (let b = 0; b < secret.length; b++) {
    const coeffs = [secret[b], ...Array.from(randomBytes(threshold - 1))];
    for (const s of out) {
      // Horner
      let acc = 0;
      for (let k = coeffs.length - 1; k >= 0; k--) acc = mul(acc, s.x) ^ coeffs[k];
      s.y[b] = acc;
    }
  }
  return out;
}

export function combine(parts: Share[]): Uint8Array {
  if (parts.length < 2) throw new Error('butuh minimal dua bagian');
  const xs = parts.map((p) => p.x);
  if (new Set(xs).size !== xs.length) throw new Error('bagian ganda');
  const len = parts[0].y.length;
  const out = new Uint8Array(len);
  for (let b = 0; b < len; b++) {
    let acc = 0;
    for (let i = 0; i < parts.length; i++) {
      let num = 1;
      let den = 1;
      for (let j = 0; j < parts.length; j++) {
        if (i === j) continue;
        num = mul(num, parts[j].x);
        den = mul(den, parts[i].x ^ parts[j].x);
      }
      acc ^= mul(parts[i].y[b], mul(num, inv(den)));
    }
    out[b] = acc;
  }
  return out;
}
