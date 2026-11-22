import { describe, expect, it } from 'vitest';
import { p256_oprf } from '@noble/curves/nist.js';
import { fromHex, toHex, utf8 } from '@gema/crypto';
import {
  blindInputs,
  deriveInstitutionKey,
  evaluateBatch,
  finalizeInputs,
  isValidPoint,
  runLocal,
} from './index';

// RFC 9497 Lampiran A.3.1 (OPRF, P256-SHA256, mode 0x00)
const seed = fromHex('a3'.repeat(32));
const keyInfo = utf8('test key');
const skS = '159749d750713afe245d2d39ccfaae8381c53ce92d098a9375ee70739c7ac0bf';

describe('OPRF P256-SHA256 (RFC 9497)', () => {
  it('derivasi kunci sesuai test vector', () => {
    const kp = p256_oprf.oprf.deriveKeyPair(seed, keyInfo);
    expect(toHex(kp.secretKey)).toBe(skS);
  });

  it('keluaran sesuai test vector 1 (input 00) dan 2 (input 5a × 17)', () => {
    const kp = p256_oprf.oprf.deriveKeyPair(seed, keyInfo);
    const run = (hexInput: string) => {
      const input = fromHex(hexInput);
      const b = p256_oprf.oprf.blind(input);
      const ev = p256_oprf.oprf.blindEvaluate(kp.secretKey, b.blinded);
      return toHex(p256_oprf.oprf.finalize(input, b.blind, ev));
    };
    expect(run('00')).toBe('a0b34de5fa4c5b6da07e72af73cc507cceeb48981b97b7285fc375345fe495dd');
    expect(run('5a'.repeat(17))).toBe(
      'c748ca6dd327f0ce85f4ae3a8cd6d4d5390bbb804c9e12dcf94f853fece3dcce',
    );
  });
});

describe('Jembatan Buta', () => {
  const key = deriveInstitutionKey(new Uint8Array(32).fill(7), 'inst-1');

  it('masukan sama → fingerprint sama; berbeda → berbeda', () => {
    const [a, b, c] = runLocal(key.secretKey, [
      'v1:budi santoso:fk',
      'v1:budi santoso:fk',
      'v1:budi santosa:fk',
    ]);
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it('titik tersamar tidak membuka masukan dan berbeda tiap permintaan', () => {
    const x = blindInputs(['nama']);
    const y = blindInputs(['nama']);
    expect(toHex(x[0].blinded)).not.toBe(toHex(y[0].blinded));
    expect(toHex(x[0].blinded)).not.toContain(toHex(utf8('nama')));
  });

  it('kunci institusi berbeda → fingerprint berbeda', () => {
    const k2 = deriveInstitutionKey(new Uint8Array(32).fill(7), 'inst-2');
    expect(runLocal(key.secretKey, ['x'])[0]).not.toBe(runLocal(k2.secretKey, ['x'])[0]);
  });

  it('server menolak titik tak sah dan titik tak hingga', () => {
    expect(isValidPoint(new Uint8Array(33))).toBe(false);
    expect(isValidPoint(new Uint8Array([0]))).toBe(false);
    expect(() => evaluateBatch(key.secretKey, ['00'.repeat(33)])).toThrow();
    const ok = blindInputs(['a'])[0];
    expect(isValidPoint(ok.blinded)).toBe(true);
  });

  it('finalize menolak jumlah tidak cocok', () => {
    const b = blindInputs(['a', 'b']);
    expect(() => finalizeInputs(b, [])).toThrow();
  });
});
