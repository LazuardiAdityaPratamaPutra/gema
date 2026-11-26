import { describe, expect, it } from 'vitest';
import {
  EMPTY,
  missingHint,
  periodeDipilih,
  periodeLabel,
  periodeOpsi,
  stepReady,
} from '@/app/brankas/baru/draft-form';
import { bulanIni, hariIni, kapanLabel, kapanMode, kapanSah } from '@/lib/laporan/kapan';

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

describe('kapan (kalender)', () => {
  it('hariIni dan bulanIni memakai zona waktu perangkat', () => {
    const d = new Date(2026, 10, 26, 23, 30);
    expect(hariIni(d)).toBe('2026-11-26');
    expect(bulanIni(d)).toBe('2026-11');
  });
  it('kapanMode membedakan tanggal, bulan, teks lama, dan kosong', () => {
    expect(kapanMode('2026-10-15')).toBe('tanggal');
    expect(kapanMode('2026-10')).toBe('bulan');
    expect(kapanMode('Sekitar sebulan lalu.')).toBe('lama');
    expect(kapanMode('  ')).toBe('kosong');
  });
  it('kapanLabel terbaca manusia dan membiarkan teks lama', () => {
    expect(kapanLabel('2026-10-05')).toBe('5 Oktober 2026');
    expect(kapanLabel('2026-12')).toBe('Desember 2026');
    expect(kapanLabel('Sekitar 2 November 2026, malam hari.')).toBe(
      'Sekitar 2 November 2026, malam hari.',
    );
    expect(kapanLabel('2026-13-01')).toBe('2026-13-01');
    expect(kapanLabel('')).toBe('');
  });
  it('kapanSah menolak kosong dan masa depan, menerima masa lalu dan teks lama', () => {
    const sekarang = new Date(2026, 10, 26);
    expect(kapanSah('', sekarang)).toBe(false);
    expect(kapanSah('2026-11-26', sekarang)).toBe(true);
    expect(kapanSah('2026-11-27', sekarang)).toBe(false);
    expect(kapanSah('2026-11', sekarang)).toBe(true);
    expect(kapanSah('2026-12', sekarang)).toBe(false);
    expect(kapanSah('Sekitar sebulan lalu.', sekarang)).toBe(true);
  });
  it('stepReady menolak tanggal di masa depan', () => {
    const dasar = { ...EMPTY, apa: 'Cerita kejadian yang cukup panjang.', dimana: 'Ruang dosen' };
    expect(stepReady({ ...dasar, kapan: '2099-01-01' })[1]).toBe(false);
    expect(missingHint({ ...dasar, kapan: '2099-01-01' }, 1)).toMatch(/masa depan/i);
  });
  it('tanggal dari kalender dianggap terisi oleh stepReady', () => {
    const dasar = { ...EMPTY, apa: 'Cerita kejadian yang cukup panjang.' };
    expect(stepReady({ ...dasar, kapan: '2026-10-15', dimana: 'Ruang dosen' })[1]).toBe(true);
  });
});
