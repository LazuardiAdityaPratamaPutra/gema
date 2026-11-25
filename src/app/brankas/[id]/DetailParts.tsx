import Link from 'next/link';
import { VeilBar } from '@/components/Veil';
import type { Narasi } from '@/lib/laporan/report-format';
import { fmtDate } from '@/lib/ui/format';
import type { ReportView } from '@/lib/vault/vault-client';

export function NewBanner() {
  return (
    <div className="card tint sukses" role="status" style={{ marginBottom: '1.5rem' }}>
      <strong className="sukses-judul">Tersimpan dan terkunci.</strong>
      <ul>
        <li>Terenkripsi di perangkatmu sebelum disimpan.</li>
        <li>Hanya kamu yang bisa membacanya.</li>
        <li>
          Tidak ada yang dikirim ke Satgas. Kamu yang memutuskan kapan, di bagian bawah halaman ini.
        </li>
      </ul>
    </div>
  );
}

export function ReportHeader({ r, narasi }: { r: ReportView; narasi: Narasi }) {
  return (
    <header className="ph">
      <Link href="/brankas" className="back">
        Kembali ke Brankasmu
      </Link>
      <h1>{r.institutionNama}</h1>
      <p className="muted">
        {r.unitNama}, dibuat {fmtDate(r.createdAt)}, terlapor:{' '}
        <strong style={{ color: 'inherit' }}>{narasi.terlapor.nama}</strong>
      </p>
    </header>
  );
}

/** Pemberitahuan pola: terlapor yang sama muncul di laporan lain, tanpa membuka siapa pun. */
export function MatchNote({ match }: { match: ReportView['match'] }) {
  if (!match.notify) return null;
  return (
    <section className="card my-lg" aria-labelledby="pola">
      <h2 className="title-md" id="pola">
        Ada pola yang cocok
      </h2>
      <p>
        Terlapor ini tampaknya juga muncul dalam laporan lain di kampus yang sama (kelompok{' '}
        {match.size} laporan, keyakinan <strong>{match.confidence}</strong>
        {match.weak ? `, ${match.weak} kecocokan lemah` : ''}). Kamu tidak melihat siapa mereka, dan
        mereka tidak melihatmu.
      </p>
      <p className="small muted">
        Keyakinan menunjukkan seberapa banyak penanda yang sama (nama terlapor, ditambah peran,
        periode, atau tempat bila diisi). Ini petunjuk, bukan kepastian dan bukan tuduhan, dan tidak
        menunjukkan seberapa benar atau berat kejadiannya.
      </p>
      {match.flagFast && (
        <p className="small">
          Jarak antar laporan ini pendek, sehingga ditandai untuk perhatian lebih cepat bila
          dieskalasi.
        </p>
      )}
    </section>
  );
}

/** Isi laporan yang sudah didekripsi, dengan tabir penutup bawaan; kolom kosong dilewati. */
export function ReportBody({ n }: { n: Narasi }) {
  const rows = (
    [
      ['Kejadian', n.apa],
      ['Kapan', n.kapan],
      ['Di mana', n.dimana],
      ['Saksi', n.saksi],
      ['Dampak', n.dampak],
      ['Catatan bukti', n.bukti],
    ] as const
  ).filter(([, v]) => v);
  return (
    <>
      <VeilBar defaultOn what="Isi laporan dan bukti" />
      <section aria-labelledby="isi" className="card my-lg sensitive">
        <h2 className="title-md" id="isi">
          Isi laporan
        </h2>
        <dl style={{ margin: 0, display: 'grid', gap: '.9rem' }}>
          {rows.map(([k, v]) => (
            <div key={k}>
              <dt className="label mb-0">{k}</dt>
              <dd style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{v}</dd>
            </div>
          ))}
        </dl>
      </section>
    </>
  );
}
