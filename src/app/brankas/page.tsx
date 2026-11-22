'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useReporter } from '@/components/useReporter';
import { listReports, logout, type ReportView } from '@/lib/vault-client';
import { fmtWhen, count } from '@/lib/format';
import { useRouter } from 'next/navigation';

export default function Brankas() {
  const { session } = useReporter();
  const router = useRouter();
  const [reports, setReports] = useState<ReportView[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!session) return;
    listReports(session)
      .then(setReports)
      .catch((e) => setError(e.message));
  }, [session]);

  if (!session)
    return (
      <div className="narrow">
        <p role="status">Memeriksa sesi…</p>
      </div>
    );

  // Kode Paksa: isi yang tampak sepenuhnya berasal dari vault tiruan.
  if (session.vault.t === 'decoy') {
    return (
      <div className="narrow">
        <h1>{session.vault.judul}</h1>
        <div className="card">
          <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{session.vault.isi}</p>
        </div>
        <button
          className="btn ghost sm mt-md"
          onClick={async () => {
            await logout(session.token);
            router.push('/');
          }}
        >
          Keluar
        </button>
      </div>
    );
  }

  const list = reports ?? [];

  return (
    <div className="wrap vault">
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
      {error && (
        <p className="err" role="alert">
          {error}
        </p>
      )}
      {!reports && !error && <p role="status">Memuat…</p>}

      {reports && reports.length === 0 && (
        <section className="vault-empty" aria-labelledby="kosong">
          <h2 id="kosong">Brankasmu masih kosong.</h2>
          <p>
            Tidak ada batas waktu. Mulai kapan pun kamu siap, dan hanya kamu yang melihat isinya.
          </p>
          <div className="row">
            <Link href="/brankas/baru" className="btn teal">
              Simpan laporan pertama
            </Link>
            <Link href="/pahami" className="btn ghost">
              Ragu? Pahami dulu
            </Link>
          </div>
        </section>
      )}

      <ol className="files">
        {list.map((r) => {
          const e = r.escalation;
          const selesai = e?.sla.status === 'Selesai';
          const step = selesai ? 2 : e ? 1 : 0;
          const tone = selesai ? 'done' : e?.sla.terlambat ? 'late' : e ? 'esc' : 'saved';
          const next = r.match.notify
            ? {
                t: 'Ada laporan lain tentang terlapor yang sama',
                s: 'Buka untuk melihat, tanpa identitas siapa pun',
              }
            : e
              ? selesai
                ? { t: 'Penanganan selesai', s: 'Riwayat tetap tersimpan di sini' }
                : e.sla.terlambat
                  ? {
                      t: `Satgas terlambat ${e.sla.hariTerlambat} hari kerja`,
                      s: `Sudah diteruskan ke tingkat ${e.sla.tingkat}`,
                    }
                  : {
                      t: `Tenggat Satgas: ${e.sla.hariSisa ?? 0} hari kerja lagi`,
                      s: `Status ${e.sla.status.toLowerCase()}`,
                    }
              : { t: 'Hanya kamu yang bisa membaca', s: 'Tambah bukti, atau eskalasi saat siap' };
          return (
            <li key={r.id} data-tone={tone}>
              <span className="file-tab">
                {
                  {
                    saved: 'Disimpan',
                    esc: 'Di Satgas',
                    late: 'Satgas terlambat',
                    done: 'Selesai',
                  }[tone]
                }
              </span>
              <Link href={`/brankas/${r.id}`} className="file">
                <ol
                  className="track"
                  aria-label={`Tahap: ${['disimpan', 'di Satgas', 'selesai'][step]}`}
                >
                  {['Disimpan', 'Di Satgas', 'Selesai'].map((l, i) => (
                    <li key={l} data-on={i <= step} aria-current={i === step ? 'step' : undefined}>
                      <span />
                      {l}
                    </li>
                  ))}
                </ol>
                <div className="file-main">
                  <p className="file-meta">
                    {fmtWhen(r.createdAt)}, {count(r.evidence.length, { other: 'bukti' })}
                    {e ? `, ${e.alias}` : ''}
                  </p>
                  <h2>{r.unitNama}</h2>
                  <p className="file-inst">{r.institutionNama}</p>
                </div>
                <div className="file-next">
                  <b>{next.t}</b>
                  <small>{next.s}</small>
                </div>
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
