import { describe, expect, it } from 'vitest';
import { bucketize, complianceSnapshot, discreteLaplace, noisyCount, PrivacyBudget } from './index';

describe('privasi diferensial', () => {
  it('derau berpusat di nol dan bervariasi sesuai skala', () => {
    const N = 20000;
    let sum = 0;
    let abs = 0;
    for (let i = 0; i < N; i++) {
      const z = discreteLaplace(1, 3);
      sum += z;
      abs += Math.abs(z);
    }
    expect(Math.abs(sum / N)).toBeLessThan(0.2);
    // E|Z| untuk Laplace diskret skala b=3 ≈ 3 (sedikit di bawahnya)
    expect(abs / N).toBeGreaterThan(2.3);
    expect(abs / N).toBeLessThan(3.6);
  });

  it('epsilon lebih besar → derau lebih kecil', () => {
    const mean = (eps: number) => {
      let a = 0;
      for (let i = 0; i < 5000; i++) a += Math.abs(discreteLaplace(eps, 3));
      return a / 5000;
    };
    expect(mean(4)).toBeLessThan(mean(0.5));
  });

  it('hitungan berderau tidak pernah negatif dan berupa bilangan bulat', () => {
    for (let i = 0; i < 500; i++) {
      const n = noisyCount(0);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(n)).toBe(true);
    }
  });

  it('ambang minimal dan bucket diterapkan pada angka berderau', () => {
    expect(bucketize(2, 3)).toBeNull();
    expect(bucketize(3, 3)).toBe('3-5');
    expect(bucketize(8, 3)).toBe('6-10');
    expect(bucketize(40, 3)).toBe('>10');
  });

  it('anggaran epsilon: habis → rilis tertunda', () => {
    const b = new PrivacyBudget(2);
    expect(b.spend(1)).toBe(true);
    expect(b.spend(1)).toBe(true);
    expect(b.spend(1)).toBe(false);
  });

  it('snapshot kepatuhan: data belum cukup bila hitungan berderau di bawah 5', () => {
    // uji acak: ambang longgar agar tidak sesekali gagal karena derau
    let notEnough = 0;
    for (let i = 0; i < 200; i++) if (!complianceSnapshot(0, 0, 4, 2).enough) notEnough++;
    expect(notEnough).toBeGreaterThan(170);
    const big = complianceSnapshot(400, 360, 4, 1);
    expect(big.enough).toBe(true);
    expect(big.percent).toBeGreaterThan(70);
    expect(big.percent).toBeLessThanOrEqual(100);
  });

  it('menolak epsilon tidak positif', () => {
    expect(() => discreteLaplace(0, 3)).toThrow();
  });
});
