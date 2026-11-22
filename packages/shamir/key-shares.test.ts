import { describe, expect, it } from 'vitest';
import { generateHybridKeypair } from '@gema/pq-kem';
import { combineSatgasSecret, splitSatgasSecret } from '@/lib/key-shares';

describe('pembagian kunci Satgas 2-dari-3', () => {
  const { secretKey } = generateHybridKeypair();
  const parts = splitSatgasSecret('inst-x', secretKey);

  it('dua bagian mana pun merakit kunci yang persis sama', () => {
    for (const [i, j] of [
      [0, 1],
      [0, 2],
      [1, 2],
      [2, 0],
    ])
      expect(combineSatgasSecret([parts[i], parts[j]], 'inst-x')).toEqual(secretKey);
  });

  it('satu bagian, bagian ganda, kampus lain, dan bagian rusak ditolak', () => {
    expect(() => combineSatgasSecret([parts[0]], 'inst-x')).toThrow(/dua bagian/);
    expect(() => combineSatgasSecret([parts[0], parts[0]], 'inst-x')).toThrow(/sama/);
    expect(() => combineSatgasSecret([parts[0], parts[1]], 'inst-lain')).toThrow(/kampus lain/);
    const rusak = parts[1].replace(/.$/, (c) => (c === 'A' ? 'B' : 'A'));
    expect(() => combineSatgasSecret([parts[0], rusak], 'inst-x')).toThrow(/rusak/);
    expect(() => combineSatgasSecret([parts[0], 'sampah'], 'inst-x')).toThrow(/tidak dikenali/);
  });

  it('bagian dari dua pembagian berbeda tidak merakit kunci yang sah', () => {
    const other = splitSatgasSecret('inst-x', generateHybridKeypair().secretKey);
    expect(() => combineSatgasSecret([parts[0], other[1]], 'inst-x')).toThrow(/tidak berpasangan/);
  });

  it('satu bagian saja tidak memuat kunci (tidak ada JSON terbaca)', () => {
    expect(parts[0]).not.toContain(secretKey.mlkem.slice(0, 20));
  });
});
