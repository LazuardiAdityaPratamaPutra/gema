import Link from 'next/link';
import type { SatgasSession } from '@/lib/store';

/** Kampus sungguhan yang Ketuanya belum membuat kunci: eskalasi ditolak, jadi anggota perlu tahu sebabnya. */
export function KunciBelumSiap({ session }: { session: SatgasSession }) {
  if (session.institution.demo || session.institution.kunciSiap !== false) return null;
  return (
    <p className="card warn" role="status">
      <strong>Kunci Satgas belum dibuat.</strong> Selama itu pelapor belum bisa mengeskalasi laporan
      ke kampusmu.{' '}
      {session.member.role === 'Ketua' ? (
        <>
          Buat kunci di halaman <Link href="/satgas/kunci">Kunci</Link>.
        </>
      ) : (
        'Minta Ketua membuat kunci.'
      )}
    </p>
  );
}
