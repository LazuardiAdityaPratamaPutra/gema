import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { logout, type ReportView } from '@/lib/vault/vault-client';
import { fmtWhen } from '@/lib/ui/format';
import type { Draft } from '@/lib/laporan/drafts';

/** Kode Paksa: isi yang tampak sepenuhnya berasal dari vault tiruan. */
export function DecoyVault({ judul, isi, token }: { judul: string; isi: string; token: string }) {
  const router = useRouter();
  return (
    <div className="narrow">
      <h1>{judul}</h1>
      <div className="card">
        <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{isi}</p>
      </div>
      <button
        className="btn ghost sm mt-md"
        onClick={async () => {
          await logout(token);
          router.push('/');
        }}
      >
        Keluar
      </button>
    </div>
  );
}

export function VaultHeader({ list }: { list: ReportView[] }) {
  return (
    <header className="ph ph-row" data-tab="Terkunci di perangkat ini">
      <div>
        <h1>Brankasmu</h1>
        {list.length > 0 && (
          <p className="lede" style={{ margin: '.4rem 0 0' }}>
            {list.length} laporan
            {list.some((r) => r.escalation)
              ? `, ${list.filter((r) => r.escalation).length} sudah di tangan Satgas`
              : ', semuanya hanya bisa kamu baca'}
            .
          </p>
        )}
      </div>
      <div className="row">
        <Link href="/brankas/baru" className="btn">
          Laporan baru
        </Link>
      </div>
    </header>
  );
}

export function DraftCard({ draft }: { draft: Draft }) {
  return (
    <section className="card tint draft-card" aria-labelledby="draf">
      <h2 id="draf" className="title-sm m-0">
        Ada laporan yang belum selesai
      </h2>
      <p className="small m-0">
        Terakhir disimpan {fmtWhen(draft.savedAt)}, di langkah {Math.min(draft.step, 2) + 1} dari 3.
        Isinya terenkripsi dan hanya ada di perangkat ini.
      </p>
      <Link href="/brankas/baru" className="btn teal sm">
        Lanjutkan laporan
      </Link>
    </section>
  );
}

export function EmptyVault() {
  return (
    <section className="vault-empty" aria-labelledby="kosong">
      <h2 id="kosong">Brankasmu masih kosong.</h2>
      <p>Tidak ada batas waktu. Mulai kapan pun kamu siap, dan hanya kamu yang melihat isinya.</p>
      <div className="row">
        <Link href="/brankas/baru" className="btn teal">
          Simpan laporan pertama
        </Link>
        <Link href="/pahami" className="btn ghost">
          Ragu? Pahami dulu
        </Link>
      </div>
    </section>
  );
}
