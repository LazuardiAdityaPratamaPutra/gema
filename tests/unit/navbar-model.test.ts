/** Menu navbar ditentukan murni dari halaman dan sesi: tamu, pelapor, brankas tiruan, dan staf Satgas. */
import { describe, expect, it } from 'vitest';
import { isActive, isStaffView, navModel } from '@/components/navbar/model';
import { REPORTER } from '@/components/navbar/links';
import type { ReporterSession, SatgasSession } from '@/lib/store';

const reporter = (t: 'real' | 'decoy' = 'real') =>
  ({
    token: 't',
    scopeId: 's',
    kek: 'k',
    caseCode: 'c',
    vault: { t },
  }) as unknown as ReporterSession;
const satgas = (role = 'Ketua'): SatgasSession => ({
  token: 't',
  member: { nama: 'A', role, email: 'a@x' },
  institution: { id: 'i', nama: 'U', demo: true },
});

describe('navModel', () => {
  it('tamu: menu umum dan ajakan membuat brankas', () => {
    const m = navModel('/pahami', null, null);
    expect(m.kind).toBe('guest');
    expect(m.cta?.href).toBe('/mulai');
    expect(m.home).toBe('/');
    expect(m.links.map((l) => l.label)).toContain('Papan');
  });

  it('ajakan utama tidak tampil di halaman tujuannya sendiri', () => {
    expect(navModel('/mulai', null, null).cta).toBeNull();
    expect(navModel('/brankas/baru', null, reporter()).cta).toBeNull();
  });

  it('pelapor: menu brankas, keterangan, dan ajakan laporan baru', () => {
    const m = navModel('/brankas', null, reporter());
    expect(m.kind).toBe('reporter');
    expect(m.links).toBe(REPORTER);
    expect(m.cta?.href).toBe('/brankas/baru');
    expect(m.who).toBe('Brankas aktif di perangkat ini');
    expect(m.home).toBe('/brankas');
  });

  it('brankas tiruan (Kode Paksa) tidak menampilkan menu, ajakan, atau keterangan', () => {
    const m = navModel('/brankas', null, reporter('decoy'));
    expect(m.links).toEqual([]);
    expect(m.cta).toBeNull();
    expect(m.who).toBe('');
  });

  it('staf: menu mengikuti peran dan tanpa ajakan', () => {
    const ketua = navModel('/satgas', satgas('Ketua'), null);
    expect(ketua.kind).toBe('staff');
    expect(ketua.cta).toBeNull();
    expect(ketua.who).toBe('Ketua');
    expect(ketua.home).toBe('/satgas');
    expect(ketua.links.map((l) => l.label)).toEqual(
      expect.arrayContaining(['Kasus', 'Jejak audit', 'Kunci']),
    );
    const auditor = navModel('/satgas/audit', satgas('Auditor'), null);
    expect(auditor.links.map((l) => l.label)).not.toContain('Kunci');
  });

  it('halaman masuk Satgas memakai menu tamu walau sesi masih ada', () => {
    expect(isStaffView('/satgas/masuk', satgas(), null)).toBe(false);
    expect(navModel('/satgas/masuk', satgas(), null).kind).toBe('guest');
  });

  it('halaman umum memakai menu staf hanya bila tidak ada brankas pelapor', () => {
    expect(navModel('/papan', satgas(), null).kind).toBe('staff');
    expect(navModel('/panduan/data', satgas(), null).kind).toBe('staff');
    expect(navModel('/papan', satgas(), reporter()).kind).toBe('reporter');
    expect(navModel('/pahami', satgas(), null).kind).toBe('guest');
  });
});

describe('isActive', () => {
  it('menyala pada halaman yang sama dan turunannya', () => {
    expect(isActive('/papan', '/papan', REPORTER)).toBe(true);
    expect(isActive('/brankas/baru', '/brankas', REPORTER)).toBe(true);
    expect(isActive('/pahami', '/brankas', REPORTER)).toBe(false);
  });

  it('tidak menyala bila ada tautan lain yang lebih spesifik untuk halaman itu', () => {
    expect(isActive('/brankas/pengaturan', '/brankas', REPORTER)).toBe(false);
    expect(isActive('/brankas/pengaturan', '/brankas/pengaturan', REPORTER)).toBe(true);
  });
});
