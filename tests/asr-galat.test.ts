import { describe, expect, it } from 'vitest';
import { canDictateNow, describeAsrError } from '../src/lib/asr-config';

describe('ketahanan dikte', () => {
  it('offline tanpa model: tidak boleh mulai merekam', () => {
    expect(canDictateNow(false, false)).toBe(false);
  });
  it('offline dengan model di cache atau online: boleh', () => {
    expect(canDictateNow(false, true)).toBe(true);
    expect(canDictateNow(true, false)).toBe(true);
  });
  it('offline: pesan menyebut koneksi dan jalan keluar mengetik', () => {
    const m = describeAsrError('', false);
    expect(m).toMatch(/koneksi/i);
    expect(m).toMatch(/ketik/i);
  });
  it('online tetapi unduhan gagal: dibedakan dari offline', () => {
    const m = describeAsrError('Failed to fetch', true);
    expect(m).toMatch(/diunduh/i);
    expect(m).not.toMatch(/Tidak ada koneksi/);
  });
  it('galat lain tidak membocorkan teks pengecualian mentah', () => {
    const m = describeAsrError('TypeError: x is not a function at foo.js:12', true);
    expect(m).not.toMatch(/TypeError|foo\.js/);
    expect(m).toMatch(/tidak dikirim/i);
  });
});
