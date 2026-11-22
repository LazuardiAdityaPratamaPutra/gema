'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { SatgasSession } from '@/lib/store';

type Mine = { escalationId: string; approvedAt: number | null }[];

/** Mode Empat Mata: dosir dibuka berdua. Pemohon meminta, anggota lain yang berbeda menyetujui di daftar kasusnya. */
export function ApprovalGate({
  session,
  caseId,
  onApproved,
}: {
  session: SatgasSession;
  caseId: string;
  onApproved: () => void;
}) {
  const [asked, setAsked] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!asked) return;
    const t = setInterval(() => {
      api<{ milikku: Mine }>('satgas/approvals', { token: session.token })
        .then((r) => {
          if (r.milikku.some((a) => a.escalationId === caseId && a.approvedAt)) onApproved();
        })
        .catch(() => undefined);
    }, 4000);
    return () => clearInterval(t);
  }, [asked, caseId, onApproved, session.token]);

  async function ask() {
    setErr('');
    try {
      await api(`satgas/cases/${caseId}/approval`, { token: session.token, body: {} });
      setAsked(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Gagal meminta persetujuan.');
    }
  }

  return (
    <section className="card tint" aria-labelledby="empat-mata">
      <h2 className="title-md" id="empat-mata">
        Empat Mata: dosir ini dibuka berdua
      </h2>
      <p>
        Kampusmu memakai panel dua orang. Isi laporan hanya terbuka bila satu anggota Satgas lain
        menyetujui, dan persetujuan berlaku 30 menit untukmu saja. Tiap permintaan dan persetujuan
        tercatat di jejak audit.
      </p>
      {asked ? (
        <p role="status">
          <strong>Menunggu persetujuan.</strong> Minta anggota lain membuka halaman Kasus;
          permintaanmu muncul di sana. Halaman ini terbuka sendiri begitu disetujui.
        </p>
      ) : (
        <button className="btn teal" onClick={() => void ask()}>
          Minta persetujuan anggota lain
        </button>
      )}
      {err && (
        <p className="err" role="alert">
          {err}
        </p>
      )}
    </section>
  );
}
