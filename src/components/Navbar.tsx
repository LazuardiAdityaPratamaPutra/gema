'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { reporterStore, satgasStore } from '@/lib/store';
import { useIslandState } from '@/lib/island-bus';
import { quickExit } from '@/lib/quick-exit';
import { api } from '@/lib/api';
import { Echo } from './Echo';
import { ICheck, IExit } from './Icons';

type Link_ = { href: string; label: string; hint: string };
type Cta = { href: string; label: string; short: string };

const GUEST: Link_[] = [
  { href: '/pahami', label: 'Pahami dulu', hint: 'Apakah yang kualami termasuk kekerasan?' },
  { href: '/verifikasi', label: 'Periksa bukti', hint: 'Cek keutuhan berkas, tanpa akun' },
  { href: '/papan', label: 'Papan', hint: 'Ketepatan waktu penanganan tiap kampus' },
  { href: '/panduan', label: 'Bantuan', hint: 'SAPA 129, Komnas Perempuan, LPSK' },
  { href: '/demo', label: 'Demo', hint: 'Seluruh alur dengan data fiktif' },
  { href: '/satgas/masuk', label: 'Untuk Satgas', hint: 'Masuk dengan akun Satgas' },
];
const REPORTER: Link_[] = [
  { href: '/brankas', label: 'Brankasmu', hint: 'Laporan dan bukti yang tersimpan' },
  { href: '/pahami', label: 'Pahami dulu', hint: 'Bantuan menyusun cerita' },
  { href: '/verifikasi', label: 'Periksa bukti', hint: 'Cek keutuhan berkas' },
  {
    href: '/brankas/pengaturan',
    label: 'Kode Paksa',
    hint: 'Brankas tiruan bila kamu dipaksa membuka',
  },
  { href: '/panduan', label: 'Bantuan', hint: 'Cara kerja dan kontak darurat' },
];
function satgasLinks(role: string): Link_[] {
  const out: Link_[] = [];
  if (['Ketua', 'Anggota', 'Pimpinan'].includes(role))
    out.push({ href: '/satgas', label: 'Kasus', hint: 'Tenggat dan tangga eskalasi' });
  if (role === 'Pengawas')
    out.push({ href: '/satgas', label: 'Pengawasan', hint: 'Angka agregat tingkat 3' });
  if (role === 'Pimpinan')
    out.push({ href: '/satgas/radar', label: 'Radar', hint: 'Pola per unit dan periode' });
  if (['Auditor', 'Ketua'].includes(role))
    out.push({ href: '/satgas/audit', label: 'Jejak audit', hint: 'Apakah rantai hash utuh?' });
  if (role === 'Ketua')
    out.push({ href: '/satgas/kunci', label: 'Kunci', hint: 'Buat atau impor kunci Satgas' });
  out.push({ href: '/papan', label: 'Papan', hint: 'Ketepatan waktu penanganan' });
  out.push({ href: '/panduan', label: 'Panduan', hint: 'Cara kerja dan batas jujur' });
  return out;
}

export function Navbar() {
  const path = usePathname();
  const router = useRouter();
  const reporter = reporterStore.use();
  const satgas = satgasStore.use();
  const bus = useIslandState();
  // Menu terbuka hanya untuk halaman tempat ia dibuka, jadi pindah halaman otomatis menutupnya.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === path;
  const setOpen = (next: boolean) => setOpenOn(next ? path : null);
  const boxRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const z =
      path === '/'
        ? 'home'
        : /^\/(brankas|mulai|masuk|pulihkan)/.test(path)
          ? 'lapor'
          : path.startsWith('/satgas')
            ? 'satgas'
            : path.startsWith('/papan')
              ? 'papan'
              : path.startsWith('/demo')
                ? 'demo'
                : 'cek';
    document.documentElement.dataset.zone = z;
  }, [path]);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: PointerEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpenOn(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenOn(null);
    };
    document.addEventListener('pointerdown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const inStaff = path.startsWith('/satgas') && !!satgas && path !== '/satgas/masuk';
  let links = GUEST;
  let cta: Cta | null = { href: '/mulai', label: 'Buat brankas anonim', short: 'Mulai' };
  let who = '';
  let signOut: (() => void) | null = null;
  if (inStaff && satgas) {
    links = satgasLinks(satgas.member.role);
    cta = null;
    who = `${satgas.member.role}${satgas.institution.demo ? ', mode demo' : ''}`;
    signOut = () => {
      void api('auth/logout', { method: 'POST', token: satgas.token }).catch(() => undefined);
      satgasStore.clear();
      router.push('/satgas/masuk');
    };
  } else if (reporter) {
    const decoy = reporter.vault.t === 'decoy';
    // Brankas tiruan (Kode Paksa): menu tidak boleh membocorkan fitur lain.
    links = decoy ? [] : REPORTER;
    cta = decoy ? null : { href: '/brankas/baru', label: 'Laporan baru', short: 'Lapor' };
    who = decoy ? '' : 'Brankas aktif di perangkat ini';
    signOut = () => {
      void api('auth/logout', { method: 'POST', token: reporter.token }).catch(() => undefined);
      reporterStore.clear();
      router.push('/');
    };
  }
  // CTA tidak ditampilkan di halaman tujuannya sendiri.
  if (cta && path === cta.href) cta = null;
  const active = (href: string) =>
    path === href ||
    (path.startsWith(href + '/') &&
      !links.some(
        (o) => o.href !== href && o.href.startsWith(href + '/') && path.startsWith(o.href),
      ));
  const home = inStaff ? '/satgas' : reporter ? '/brankas' : '/';

  return (
    <header className="nb" ref={boxRef} data-open={open}>
      <div className="nb-bar">
        <Link href={home} className="nb-brand" aria-label="Gema, ke halaman utama">
          <Echo size={26} />
          <span>Gema</span>
        </Link>
        <nav className="nb-links" aria-label="Menu utama">
          {links.map((l) => (
            <Link
              key={l.href + l.label}
              href={l.href}
              aria-current={active(l.href) ? 'page' : undefined}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="nb-end">
          {cta && (
            <Link href={cta.href} className="nb-cta" aria-label={cta.label}>
              <span className="nb-cta-long">{cta.label}</span>
              <span className="nb-cta-short" aria-hidden="true">
                {cta.short}
              </span>
            </Link>
          )}
          {signOut && (
            <button type="button" className="nb-ghost nb-signout" onClick={signOut}>
              Keluar sesi
            </button>
          )}
          <button
            type="button"
            className="nb-qx"
            aria-label="Keluar cepat: hapus data lokal dan buka situs netral"
            onClick={() => void quickExit()}
            title="Keluar cepat. Esc dua kali juga bisa, kapan saja"
          >
            <span className="nb-qx-long">Keluar cepat</span>
            <span className="nb-qx-short" aria-hidden="true">
              <IExit />
            </span>
          </button>
          <button
            type="button"
            className="nb-burger"
            aria-expanded={open}
            aria-controls="nb-sheet"
            aria-label={open ? 'Tutup menu' : 'Buka menu'}
            onClick={() => setOpen(!open)}
          >
            <span aria-hidden="true" />
          </button>
        </div>
      </div>
      <div id="nb-sheet" className="nb-sheet" inert={!open || (links.length === 0 && !cta)}>
        {who && <p className="nb-who">{who}</p>}
        <ul>
          {links.map((l) => (
            <li key={l.href + l.label}>
              <Link
                href={l.href}
                aria-current={active(l.href) ? 'page' : undefined}
                onClick={() => setOpen(false)}
              >
                <b>{l.label}</b>
                <small>{l.hint}</small>
              </Link>
            </li>
          ))}
        </ul>
        <div className="nb-sheet-act">
          {cta && (
            <Link href={cta.href} className="btn teal block" onClick={() => setOpen(false)}>
              {cta.label}
            </Link>
          )}
          {!reporter && !inStaff && (
            <Link href="/masuk" className="btn ghost block" onClick={() => setOpen(false)}>
              Masuk dengan kode
            </Link>
          )}
          {signOut && (
            <button
              type="button"
              className="btn ghost block"
              onClick={() => {
                setOpen(false);
                signOut!();
              }}
            >
              Keluar sesi
            </button>
          )}
          <button type="button" className="btn danger block" onClick={() => void quickExit()}>
            <IExit /> Keluar cepat
          </button>
        </div>
      </div>
      {bus.mode !== 'idle' && (
        <div className="nb-status" role="status" aria-live="polite" data-mode={bus.mode}>
          {bus.mode === 'progress' ? (
            <span className="wave" aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
            </span>
          ) : (
            <ICheck />
          )}
          <b>{bus.label}</b>
          {bus.mode === 'progress' && (
            <small>
              {bus.total ? `${bus.value ?? 0} dari ${bus.total}` : 'Jangan tutup halaman'}
            </small>
          )}
        </div>
      )}
    </header>
  );
}
