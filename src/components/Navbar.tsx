'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { reporterStore, satgasStore } from '@/lib/store';
import { useIslandState } from '@/lib/island-bus';
import { QUICK_EXIT_LIMITS, quickExit } from '@/lib/quick-exit';
import { api } from '@/lib/api';
import { Echo, Wordmark } from './Echo';
import { ICheck, IExit } from './Icons';
import { QuickExitButton } from './navbar/QuickExitButton';
import { GUEST, REPORTER, satgasLinks, type Cta } from './navbar/links';
import { useOnline } from './navbar/useOnline';
import { zoneOf } from './navbar/zone';

export function Navbar() {
  const online = useOnline();
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
    const z = zoneOf(path);
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

  // Halaman umum yang juga ada di menu Satgas (Papan, Panduan): menu Satgas tetap dipakai selama
  // sesinya aktif dan tidak ada brankas pelapor di perangkat ini.
  const sharedWithStaff = ['/papan', '/panduan', '/bukti-teknis'].some(
    (p) => path === p || path.startsWith(p + '/'),
  );
  const inStaff =
    !!satgas &&
    path !== '/satgas/masuk' &&
    (path.startsWith('/satgas') || (sharedWithStaff && !reporter));
  let links = GUEST;
  let cta: Cta | null = { href: '/mulai', label: 'Buat brankas', short: 'Mulai' };
  let who = '';
  let signOut: (() => void) | null = null;
  if (inStaff && satgas) {
    links = satgasLinks(satgas.member.role);
    cta = null;
    who = satgas.member.role;
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
      {!online && (
        <p className="nb-offline" role="status">
          Koneksi terputus. Draf tetap tersimpan di perangkat ini. Mengunci laporan, eskalasi, dan
          memuat data baru menunggu koneksi kembali.
        </p>
      )}
      <div className="nb-bar">
        <Link href={home} className="nb-brand" aria-label="Gema, ke halaman utama">
          <Echo size={30} />
          <span>
            <Wordmark height={30} />
          </span>
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
            <Link href={cta.href} className="nb-cta">
              {/* nama aksesibel = teks yang tampak (WCAG 2.5.3): CSS menyembunyikan salah satunya */}
              <span className="nb-cta-long">{cta.label}</span>
              <span className="nb-cta-short">{cta.short}</span>
            </Link>
          )}
          {signOut && (
            <button type="button" className="nb-ghost nb-signout" onClick={signOut}>
              Keluar sesi
            </button>
          )}
          <QuickExitButton />
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
          <p className="nb-qx-note">{QUICK_EXIT_LIMITS}</p>
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
