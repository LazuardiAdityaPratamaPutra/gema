import { describe, expect, it } from 'vitest';
import { randomBytes } from '@gema/crypto';
import { ownerKeyFromDek, proveOwnership, verifyOwnership } from './index';

describe('bukti pemilik (Schnorr NIZK)', () => {
  const dek = randomBytes(32);
  const key = ownerKeyFromDek(dek);
  const ctx = 'KS-ABC123|tantangan-1';

  it('kunci publik stabil dari DEK yang sama, berbeda untuk DEK lain', () => {
    expect(ownerKeyFromDek(dek).publicKey).toBe(key.publicKey);
    expect(ownerKeyFromDek(randomBytes(32)).publicKey).not.toBe(key.publicKey);
  });

  it('bukti sah lolos, dan tiap bukti berbeda (acak) tetapi sama-sama sah', () => {
    const a = proveOwnership(key, ctx);
    const b = proveOwnership(key, ctx);
    expect(a).not.toBe(b);
    expect(verifyOwnership(key.publicKey, a, ctx)).toBe(true);
    expect(verifyOwnership(key.publicKey, b, ctx)).toBe(true);
  });

  it('terikat konteks: tantangan atau alias lain menolak (anti-replay)', () => {
    const p = proveOwnership(key, ctx);
    expect(verifyOwnership(key.publicKey, p, 'KS-ABC123|tantangan-2')).toBe(false);
    expect(verifyOwnership(key.publicKey, p, 'KS-XYZ999|tantangan-1')).toBe(false);
  });

  it('pemilik lain tidak bisa membuktikan; bukti rusak dan masukan ngawur ditolak', () => {
    const other = ownerKeyFromDek(randomBytes(32));
    expect(verifyOwnership(key.publicKey, proveOwnership(other, ctx), ctx)).toBe(false);
    const p = proveOwnership(key, ctx);
    expect(
      verifyOwnership(key.publicKey, p.slice(0, -2) + (p.endsWith('AA') ? 'BB' : 'AA'), ctx),
    ).toBe(false);
    for (const bad of ['', 'x', 'AAAA'])
      expect(verifyOwnership(key.publicKey, bad, ctx)).toBe(false);
    expect(verifyOwnership('ngawur', p, ctx)).toBe(false);
  });

  it('bukti tidak memuat kunci rahasia', () => {
    const p = proveOwnership(key, ctx);
    expect(p).not.toContain(key.secret.toString(16));
    expect(p.length).toBe(87); // 65 byte → 87 karakter base64url
  });
});
