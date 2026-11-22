import { describe, expect, it } from 'vitest';
import { randomBytes, toHex } from '@gema/crypto';
import { combine, split } from './index';

describe('Shamir 2-dari-3', () => {
  it('dua bagian mana pun merekonstruksi rahasia', () => {
    const secret = randomBytes(32);
    const s = split(secret, 2, 3);
    for (const [a, b] of [
      [0, 1],
      [0, 2],
      [1, 2],
      [2, 0],
    ]) {
      expect(toHex(combine([s[a], s[b]]))).toBe(toHex(secret));
    }
  });

  it('satu bagian saja tidak membuka rahasia (hasil gabungan salah)', () => {
    const secret = randomBytes(32);
    const s = split(secret, 2, 3);
    // menebak: dengan satu bagian dan bagian palsu hasilnya tidak sama
    const fake = { x: 2, y: randomBytes(32) };
    expect(toHex(combine([s[0], fake]))).not.toBe(toHex(secret));
    expect(() => combine([s[0]])).toThrow();
  });

  it('satu bagian tidak membocorkan byte rahasia secara langsung', () => {
    const secret = new Uint8Array(32).fill(0xaa);
    let same = 0;
    for (let i = 0; i < 20; i++) {
      const s = split(secret, 2, 3);
      same += s[0].y.filter((v) => v === 0xaa).length;
    }
    expect(same / (20 * 32)).toBeLessThan(0.05);
  });

  it('bagian ganda ditolak, parameter tidak valid ditolak', () => {
    const s = split(randomBytes(8), 2, 3);
    expect(() => combine([s[0], s[0]])).toThrow();
    expect(() => split(randomBytes(8), 1, 3)).toThrow();
    expect(() => split(randomBytes(8), 4, 3)).toThrow();
  });

  it('ambang 3-dari-5', () => {
    const secret = randomBytes(16);
    const s = split(secret, 3, 5);
    expect(toHex(combine([s[4], s[1], s[2]]))).toBe(toHex(secret));
  });
});
