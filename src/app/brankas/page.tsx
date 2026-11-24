'use client';
import { useEffect, useState } from 'react';
import { useReporter } from '@/components/useReporter';
import { listReports, type ReportView } from '@/lib/vault/vault-client';
import { loadDraft, type Draft } from '@/lib/laporan/drafts';
import { LoadError } from '@/components/LoadError';
import { FileCard } from './FileCard';
import { DecoyVault, DraftCard, EmptyVault, VaultHeader } from './VaultParts';

export default function Brankas() {
  const { session } = useReporter();
  const [reports, setReports] = useState<ReportView[] | null>(null);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);

  useEffect(() => {
    if (!session) return;
    void loadDraft(session.kek, session.caseCode, 'baru').then((x) =>
      setDraft(x && (x.nama || x.apa) ? x : null),
    );
  }, [session]);

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
    return <DecoyVault judul={session.vault.judul} isi={session.vault.isi} token={session.token} />;
  }

  const list = reports ?? [];

  return (
    <div className="wrap vault">
      <VaultHeader list={list} />
      {error && <LoadError what="brankasmu" message={error} />}
      {!reports && !error && <p role="status">Memuat…</p>}

      {draft && <DraftCard draft={draft} />}

      {reports && reports.length === 0 && <EmptyVault />}

      <ol className="files">
        {list.map((r) => (
          <FileCard key={r.id} r={r} />
        ))}
      </ol>
    </div>
  );
}
