'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { reporterStore, satgasStore } from '@/lib/store';
import { useIslandState } from '@/lib/ui/island-bus';
import { Echo, Wordmark } from './Echo';
import { MenuSheet } from './navbar/MenuSheet';
import { QuickExitButton } from './navbar/QuickExitButton';
import { StatusPill } from './navbar/StatusPill';
import { isActive, navModel } from './navbar/model';
import { useMenu } from './navbar/useMenu';
import { useOnline } from './navbar/useOnline';
import { useScrolled } from './navbar/useScrolled';
import { useSignOut } from './navbar/useSignOut';
import { zoneOf } from './navbar/zone';

export function Navbar() {
  const online = useOnline();
  const path = usePathname();
  const reporter = reporterStore.use();
  const satgas = satgasStore.use();
  const bus = useIslandState();
  const { open, setOpen, boxRef } = useMenu(path);
  const scrolled = useScrolled();
  const model = navModel(path, satgas, reporter);
  const signOut = useSignOut(model.kind, satgas, reporter);
  const { links, cta } = model;
  const active = (href: string) => isActive(path, href, links);

  useEffect(() => {
    document.documentElement.dataset.zone = zoneOf(path);
  }, [path]);

  return (
    <header className="nb" ref={boxRef} data-open={open} data-scrolled={scrolled}>
      {!online && (
        <p className="nb-offline" role="status">
          Koneksi terputus. Draf tetap tersimpan di perangkat ini. Mengunci laporan, eskalasi, dan
          memuat data baru menunggu koneksi kembali.
        </p>
      )}
      <div className="nb-bar">
        <Link href={model.home} className="nb-brand" aria-label="Gema, ke halaman utama">
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
      <MenuSheet
        model={model}
        open={open}
        isActive={active}
        close={() => setOpen(false)}
        signOut={signOut}
      />
      <StatusPill bus={bus} />
    </header>
  );
}
