import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/api';
import type { SatgasSession } from '@/lib/store';
import { island } from '@/lib/ui/island-bus';

type Props = { session: SatgasSession; caseId: string };

/** Anggota panel menyatakan konflik kepentingan. Alasan tidak ditanyakan dan tidak disimpan. */
export function MundurKasus({ session, caseId }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function mundur() {
    setBusy(true);
    setErr('');
    try {
      const r = await api<{ peringatan: string | null }>(`satgas/cases/${caseId}/mundur`, {
        method: 'POST',
        token: session.token,
        body: {},
      });
      island.toast(r.peringatan ?? 'Kamu mundur dari kasus ini. Pelapor ikut diberi tahu.');
      router.push('/satgas');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Gagal mundur dari kasus.');
      setBusy(false);
    }
  }

  return (
    <section className="my-lg" aria-labelledby="mundur-judul">
      <details className="more">
        <summary id="mundur-judul">Saya punya konflik kepentingan dengan kasus ini</summary>
        <p>
          Bila kamu mengenal pelapor atau terlapor, atau punya hubungan yang bisa memengaruhi
          penilaianmu, mundurlah. Setelah itu kamu tidak bisa membuka, menindak, atau menyetujui
          akses kasus ini lagi, dan kasus ini dilepas dari penugasanmu. Mundurnya kamu tercatat di
          log audit dan terlihat oleh pelapor, tanpa alasan dan tanpa namamu.
        </p>
        {err && (
          <p className="card warn small" role="alert">
            {err}
          </p>
        )}
        <button
          className="btn ghost"
          disabled={busy}
          aria-busy={busy}
          onClick={() => void mundur()}
        >
          Mundur dari kasus ini
        </button>
      </details>
    </section>
  );
}
