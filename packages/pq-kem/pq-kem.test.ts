import { describe, expect, it } from 'vitest';
import { b64u, fromB64u, newDek, toHex } from '@gema/crypto';
import { generateHybridKeypair, unwrapFromSatgas, wrapForSatgas } from './index';

const ctx = { institutionId: 'inst', escalationId: 'esc-1' };

describe('KEM hibrida ECDH P-256 + ML-KEM-768', () => {
  it('Satgas dapat membuka; ukuran ciphertext ML-KEM-768 = 1088 byte', async () => {
    const kp = generateHybridKeypair();
    const dek = newDek();
    const w = await wrapForSatgas(dek, kp.publicKey, ctx);
    expect(fromB64u(w.ctMlkem).length).toBe(1088);
    expect(toHex(await unwrapFromSatgas(w, kp.secretKey, ctx))).toBe(toHex(dek));
  });

  it('komponen ECDH dikorupsi → gagal', async () => {
    const kp = generateHybridKeypair();
    const w = await wrapForSatgas(newDek(), kp.publicKey, ctx);
    const e = fromB64u(w.ctEcdh).slice();
    e[5] ^= 1;
    await expect(
      unwrapFromSatgas({ ...w, ctEcdh: b64u(e) }, kp.secretKey, ctx),
    ).rejects.toBeTruthy();
  });

  it('komponen ML-KEM dikorupsi → gagal', async () => {
    const kp = generateHybridKeypair();
    const w = await wrapForSatgas(newDek(), kp.publicKey, ctx);
    const m = fromB64u(w.ctMlkem).slice();
    m[100] ^= 1;
    await expect(
      unwrapFromSatgas({ ...w, ctMlkem: b64u(m) }, kp.secretKey, ctx),
    ).rejects.toBeTruthy();
  });

  it('konteks berbeda (eskalasi lain) → gagal; kunci Satgas lain → gagal', async () => {
    const kp = generateHybridKeypair();
    const other = generateHybridKeypair();
    const w = await wrapForSatgas(newDek(), kp.publicKey, ctx);
    await expect(
      unwrapFromSatgas(w, kp.secretKey, { ...ctx, escalationId: 'esc-2' }),
    ).rejects.toBeTruthy();
    await expect(unwrapFromSatgas(w, other.secretKey, ctx)).rejects.toBeTruthy();
  });

  it('penanda kem_suite tidak dikenal ditolak', async () => {
    const kp = generateHybridKeypair();
    const w = await wrapForSatgas(newDek(), kp.publicKey, ctx);
    await expect(unwrapFromSatgas({ ...w, suite: 'x' }, kp.secretKey, ctx)).rejects.toThrow();
  });
});
