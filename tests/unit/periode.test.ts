import { describe, expect, it } from 'vitest';
import {
  EMPTY,
  missingHint,
  periodeDipilih,
  periodeLabel,
  periodeOpsi,
  stepReady,
} from '@/app/brankas/baru/draft-form';

describe('periode kejadian sebagai pilihan', () => {
  it('Agustus sampai Desember memulai semester ganjil tahun ajaran itu', () => {
    const o = periodeOpsi(new Date(2026, 10, 25), 3);
    expect(o.map((x) => x.value)).toEqual([
      '2026/2027-ganjil',
      '2025/2026-genap',
      '2025/2026-ganjil',
    ]);
  });
  it('Januari masih ganjil tahun ajaran sebelumnya, Februari sampai Juli genap', () => {
    expect(periodeOpsi(new Date(2027, 0, 10), 1)[0].value).toBe('2026/2027-ganjil');
    expect(periodeOpsi(new Date(2027, 2, 10), 1)[0].value).toBe('2026/2027-genap');
    expect(periodeOpsi(new Date(2026, 6, 31), 1)[0].value).toBe('2025/2026-genap');
  });
  it('nilai baku sama untuk semua pelapor, sehingga bisa dicocokkan persis', () => {
    expect(
      periodeOpsi(new Date(2026, 10, 1), 8).every((o) =>
        /^\d{4}\/\d{4}-(ganjil|genap)$/.test(o.value),
      ),
    ).toBe(true);
  });
  it('label terbaca, nilai lama yang tak dikenal ditampilkan apa adanya', () => {
    expect(periodeLabel('2026/2027-ganjil')).toBe('Ganjil 2026/2027');
    expect(periodeLabel('2025-1')).toBe('2025-1');
    expect(periodeDipilih('a, b ,,c')).toEqual(['a', 'b', 'c']);
  });
});

describe('Kapan dan Di mana wajib', () => {
  const dasar = { ...EMPTY, apa: 'Cerita kejadian yang cukup panjang.' };
  it('Lanjut tertahan sampai keduanya terisi', () => {
    expect(stepReady(dasar)[1]).toBe(false);
    expect(stepReady({ ...dasar, kapan: 'Oktober 2026' })[1]).toBe(false);
    expect(stepReady({ ...dasar, kapan: 'Oktober 2026', dimana: '  ' })[1]).toBe(false);
    expect(stepReady({ ...dasar, kapan: 'Oktober 2026', dimana: 'Ruang dosen' })[1]).toBe(true);
  });
  it('petunjuk menyebut isian yang kurang, berurutan', () => {
    expect(missingHint(dasar, 1)).toMatch(/kapan/i);
    expect(missingHint({ ...dasar, kapan: 'x' }, 1)).toMatch(/di mana/i);
    expect(missingHint({ ...dasar, kapan: 'x', dimana: 'y' }, 1)).toBe('');
  });
});
