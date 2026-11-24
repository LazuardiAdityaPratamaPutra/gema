/** Status kartu laporan di daftar brankas: tahap, nada warna, dan petunjuk langkah berikutnya. */
import { describe, expect, it } from 'vitest';
import { fileStatus } from '@/app/brankas/status';

type In = Parameters<typeof fileStatus>[0];
const sla = (o: Partial<NonNullable<In['escalation']>['sla']> = {}) =>
  ({
    status: 'Diterima',
    terlambat: false,
    hariSisa: 5,
    hariTerlambat: 0,
    tingkat: 0,
    ...o,
  }) as never;
const esc = (o = {}): In['escalation'] => ({ alias: 'KS-1', sla: sla(o) }) as never;
const match = (notify: boolean) => ({ notify }) as never;

describe('fileStatus', () => {
  it('belum dieskalasi: tahap 0, hanya pelapor yang membaca', () => {
    const s = fileStatus({ escalation: null, match: match(false) } as In);
    expect(s).toMatchObject({ step: 0, tone: 'saved' });
    expect(s.next.t).toBe('Hanya kamu yang bisa membaca');
  });

  it('pola cocok didahulukan sebagai petunjuk, di tahap mana pun', () => {
    const a = fileStatus({ escalation: null, match: match(true) } as In);
    expect(a.next.t).toContain('laporan lain');
    expect(a).toMatchObject({ step: 0, tone: 'saved' });
    const b = fileStatus({ escalation: esc(), match: match(true) } as In);
    expect(b.next.t).toContain('laporan lain');
    expect(b).toMatchObject({ step: 1, tone: 'esc' });
  });

  it('dieskalasi: sisa hari kerja dan status', () => {
    const s = fileStatus({ escalation: esc({ hariSisa: 3 }), match: match(false) } as In);
    expect(s).toMatchObject({ step: 1, tone: 'esc' });
    expect(s.next).toEqual({ t: 'Tenggat Satgas: 3 hari kerja lagi', s: 'Status diterima' });
    expect(
      fileStatus({ escalation: esc({ hariSisa: null }), match: match(false) } as In).next.t,
    ).toBe('Tenggat Satgas: 0 hari kerja lagi');
  });

  it('terlambat: nada late dan tingkat tangga', () => {
    const s = fileStatus({
      escalation: esc({ terlambat: true, hariTerlambat: 4, tingkat: 2 }),
      match: match(false),
    } as In);
    expect(s).toMatchObject({ step: 1, tone: 'late' });
    expect(s.next).toEqual({
      t: 'Satgas terlambat 4 hari kerja',
      s: 'Sudah diteruskan ke tingkat 2',
    });
  });

  it('selesai: tahap 2, walau tadinya terlambat', () => {
    const s = fileStatus({
      escalation: esc({ status: 'Selesai', terlambat: true }),
      match: match(false),
    } as In);
    expect(s).toMatchObject({ step: 2, tone: 'done' });
    expect(s.next.t).toBe('Penanganan selesai');
  });
});
