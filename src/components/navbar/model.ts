/** Menu yang tampil di navbar, ditentukan murni dari halaman dan sesi yang aktif. */
import type { ReporterSession, SatgasSession } from '@/lib/store';
import { GUEST, REPORTER, satgasLinks, type Cta, type Link_ } from './links';

export type NavKind = 'staff' | 'reporter' | 'guest';

export type NavModel = {
  kind: NavKind;
  links: Link_[];
  /** Tombol aksi utama; `null` bila tidak ada atau halaman tujuannya sedang dibuka. */
  cta: Cta | null;
  /** Keterangan peran di atas daftar menu ponsel. */
  who: string;
  home: string;
};

/** Halaman umum yang juga ada di menu Satgas, jadi menu Satgas tetap dipakai selama sesinya aktif. */
const SHARED_WITH_STAFF = ['/papan', '/panduan', '/bukti-teknis'];

const isShared = (path: string) =>
  SHARED_WITH_STAFF.some((p) => path === p || path.startsWith(p + '/'));

/** Apakah halaman ini ditampilkan dengan menu staf Satgas? */
export function isStaffView(
  path: string,
  satgas: SatgasSession | null,
  reporter: ReporterSession | null,
): boolean {
  if (!satgas || path === '/satgas/masuk') return false;
  return path.startsWith('/satgas') || (isShared(path) && !reporter);
}

const GUEST_CTA: Cta = { href: '/mulai', label: 'Mulai melapor', short: 'Mulai' };
const REPORTER_CTA: Cta = { href: '/brankas/baru', label: 'Laporan baru', short: 'Lapor' };

function modelFor(
  path: string,
  satgas: SatgasSession | null,
  reporter: ReporterSession | null,
): NavModel {
  if (satgas && isStaffView(path, satgas, reporter))
    return {
      kind: 'staff',
      links: satgasLinks(satgas.member.role),
      cta: null,
      who: satgas.member.role,
      home: '/satgas',
    };
  if (reporter) {
    // Brankas tiruan (Kode Paksa): menu tidak boleh membocorkan fitur lain.
    const decoy = reporter.vault.t === 'decoy';
    return {
      kind: 'reporter',
      links: decoy ? [] : REPORTER,
      cta: decoy ? null : REPORTER_CTA,
      who: decoy ? '' : 'Masuk di perangkat ini',
      home: '/brankas',
    };
  }
  return { kind: 'guest', links: GUEST, cta: GUEST_CTA, who: '', home: '/' };
}

export function navModel(
  path: string,
  satgas: SatgasSession | null,
  reporter: ReporterSession | null,
): NavModel {
  const m = modelFor(path, satgas, reporter);
  // Aksi utama tidak ditampilkan di halaman tujuannya sendiri, dan tidak diulang di beranda
  // pengunjung karena hero sudah memuat tombol yang sama.
  const berandaTamu = m.kind === 'guest' && path === '/';
  return m.cta && (path === m.cta.href || berandaTamu) ? { ...m, cta: null } : m;
}

/** Tautan menyala bila halaman ini miliknya, kecuali ada tautan lain yang lebih spesifik. */
export function isActive(path: string, href: string, links: Link_[]): boolean {
  if (path === href) return true;
  if (!path.startsWith(href + '/')) return false;
  return !links.some(
    (o) => o.href !== href && o.href.startsWith(href + '/') && path.startsWith(o.href),
  );
}
