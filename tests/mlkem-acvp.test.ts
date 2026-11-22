import { describe, expect, it } from 'vitest';
import { ml_kem768 } from '@noble/post-quantum/ml-kem.js';
import vec from './vectors/mlkem768-acvp.json';

const h = (s: string) => Uint8Array.from(s.match(/../g)!.map((x) => parseInt(x, 16)));
const hex = (b: Uint8Array) =>
  Array.from(b, (x) => x.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();

describe('ML-KEM-768 terhadap vektor resmi NIST ACVP (FIPS 203)', () => {
  it('keyGen: (d‖z) menghasilkan ek dan dk yang sama', () => {
    for (const t of vec.keyGen) {
      const { publicKey, secretKey } = ml_kem768.keygen(h(t.d + t.z));
      expect(hex(publicKey)).toBe(t.ek.toUpperCase());
      expect(hex(secretKey)).toBe(t.dk.toUpperCase());
    }
  });
  it('encapsulation: m menghasilkan c dan k yang sama', () => {
    for (const t of vec.encap) {
      const r = ml_kem768.encapsulate(h(t.ek), h(t.m));
      expect(hex(r.cipherText)).toBe(t.c.toUpperCase());
      expect(hex(r.sharedSecret)).toBe(t.k.toUpperCase());
    }
  });
  it('decapsulation: c dan dk menghasilkan k yang sama (termasuk penolakan implisit)', () => {
    for (const t of vec.decap)
      expect(hex(ml_kem768.decapsulate(h(t.c), h(t.dk)))).toBe(t.k.toUpperCase());
  });
});
