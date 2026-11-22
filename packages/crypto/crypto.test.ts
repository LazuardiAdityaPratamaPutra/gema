import { describe, expect, it } from 'vitest';
import {
  aesGcmDecrypt,
  aesGcmEncrypt,
  authHash,
  b64u,
  deriveAccountKeys,
  fromB64u,
  generateCaseCode,
  newDek,
  normalizeCaseCode,
  padTo,
  unpad,
  unwrapKey,
  wrapKey,
  sha256,
  toHex,
  utf8,
} from './index';
import { WORDLIST, generatePassphrase, passphraseEntropyBits } from '../passphrase';

describe('crypto', () => {
  it('daftar kata cukup besar untuk ≈77 bit pada 6 kata', () => {
    expect(WORDLIST.length).toBe(7776);
    expect(new Set(WORDLIST).size).toBe(7776);
    expect(passphraseEntropyBits(6)).toBeGreaterThan(77);
  });

  it('SHA-256 sesuai vektor "abc"', () => {
    expect(toHex(sha256(utf8('abc')))).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('Kode Kasus 12 karakter Base32 tanpa karakter ambigu', () => {
    for (let i = 0; i < 50; i++) {
      const c = generateCaseCode();
      expect(c).toMatch(/^[A-HJKMNP-Z2-9]{12}$/);
    }
  });

  it('passphrase 6 kata', () => {
    expect(generatePassphrase().split(' ')).toHaveLength(6);
  });

  it('normalizeCaseCode menerima huruf kecil, tanda hubung, dan tertukar O/0', () => {
    expect(normalizeCaseCode('abcd-efgh-jkmn')).toBe('ABCDEFGHJKMN');
  });

  it('derivasi kunci deterministik dan authKey ≠ KEK', async () => {
    const a = await deriveAccountKeys('ABCDEFGHJKMN', 'satu dua tiga empat lima enam', 1000);
    const b = await deriveAccountKeys('abcd-efgh-jkmn', '  Satu  DUA tiga empat lima enam ', 1000);
    const c = await deriveAccountKeys('ABCDEFGHJKMN', 'satu dua tiga empat lima tujuh', 1000);
    expect(toHex(a.kek)).toBe(toHex(b.kek));
    expect(toHex(a.authKey)).toBe(toHex(b.authKey));
    expect(toHex(a.kek)).not.toBe(toHex(a.authKey));
    expect(toHex(a.kek)).not.toBe(toHex(c.kek));
    expect(authHash(a.authKey)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('AES-GCM: roundtrip, AAD salah gagal, satu bit diubah gagal', async () => {
    const k = newDek();
    const blob = await aesGcmEncrypt(k, utf8('halo'), 'ctx');
    expect(new TextDecoder().decode(await aesGcmDecrypt(k, blob, 'ctx'))).toBe('halo');
    await expect(aesGcmDecrypt(k, blob, 'lain')).rejects.toBeTruthy();
    const bad = blob.slice();
    bad[bad.length - 1] ^= 1;
    await expect(aesGcmDecrypt(k, bad, 'ctx')).rejects.toBeTruthy();
  });

  it('wrap/unwrap DEK', async () => {
    const kek = newDek();
    const dek = newDek();
    const w = await wrapKey(kek, dek, 'dek');
    expect(toHex(await unwrapKey(kek, w, 'dek'))).toBe(toHex(dek));
  });

  it('IV tidak berulang', async () => {
    const k = newDek();
    const a = await aesGcmEncrypt(k, utf8('x'), 'a');
    const b = await aesGcmEncrypt(k, utf8('x'), 'a');
    expect(toHex(a.slice(0, 12))).not.toBe(toHex(b.slice(0, 12)));
  });

  it('base64url dan padding', () => {
    const x = new Uint8Array([251, 255, 0, 1, 2]);
    expect(Array.from(fromB64u(b64u(x)))).toEqual(Array.from(x));
    const p = padTo(utf8('abc'), 64);
    expect(p.length).toBe(64);
    expect(new TextDecoder().decode(unpad(p))).toBe('abc');
  });
});
