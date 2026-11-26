import Link from 'next/link';
import { QUICK_EXIT_LIMITS, quickExit } from '@/lib/ui/quick-exit';
import { IExit } from '../Icons';
import type { Link_ } from './links';
import type { NavModel } from './model';

/** Lembar menu untuk layar sempit: daftar tujuan, aksi utama, masuk, keluar sesi, dan keluar cepat. */
export function MenuSheet({
  model,
  open,
  isActive,
  close,
  signOut,
}: {
  model: NavModel;
  open: boolean;
  isActive: (href: string) => boolean;
  close: () => void;
  signOut: (() => void) | null;
}) {
  const { links, cta, who, kind } = model;
  const item = (l: Link_) => (
    <li key={l.href + l.label}>
      <Link href={l.href} aria-current={isActive(l.href) ? 'page' : undefined} onClick={close}>
        <b>{l.label}</b>
        <small>{l.hint}</small>
      </Link>
    </li>
  );
  return (
    <div id="nb-sheet" className="nb-sheet" inert={!open || (links.length === 0 && !cta)}>
      {who && <p className="nb-who">{who}</p>}
      <ul>{links.map(item)}</ul>
      <div className="nb-sheet-act">
        {cta && (
          <Link href={cta.href} className="btn teal block" onClick={close}>
            {cta.label}
          </Link>
        )}
        {kind === 'guest' && (
          <Link href="/masuk" className="btn ghost block" onClick={close}>
            Masuk dengan kode
          </Link>
        )}
        {signOut && (
          <button
            type="button"
            className="btn ghost block"
            onClick={() => {
              close();
              signOut();
            }}
          >
            Keluar akun
          </button>
        )}
        <button type="button" className="btn danger block" onClick={() => void quickExit()}>
          <IExit /> Keluar cepat
        </button>
        <p className="nb-qx-note">{QUICK_EXIT_LIMITS}</p>
      </div>
    </div>
  );
}
