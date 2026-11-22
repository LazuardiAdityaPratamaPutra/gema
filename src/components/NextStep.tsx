import Link from 'next/link';
import type { ReactNode } from 'react';

type Act = { href: string; label: string; ghost?: boolean };
/** Langkah berikutnya di dasar halaman: selalu ada jalan lanjut, maksimal dua tombol. */
export function NextStep({
  title,
  children,
  acts,
}: {
  title: string;
  children?: ReactNode;
  acts: Act[];
}) {
  return (
    <aside className="next" aria-label="Langkah berikutnya">
      <div>
        <h2>{title}</h2>
        {children && <p>{children}</p>}
      </div>
      <div className="next-acts">
        {acts.map((a) => (
          <Link
            key={a.href + a.label}
            href={a.href}
            className={`btn ${a.ghost ? 'ghost' : 'teal'}`}
          >
            {a.label}
          </Link>
        ))}
      </div>
    </aside>
  );
}
