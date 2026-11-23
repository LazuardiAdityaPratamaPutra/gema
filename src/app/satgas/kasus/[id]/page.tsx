'use client';
import { HeaderPhoto } from '@/components/HeaderPhoto';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { SatgasBar } from '@/components/SatgasBar';
import { useSatgas } from '@/components/useSatgas';
import { api } from '@/lib/api';
import type { BuktiMeta, Narasi } from '@/lib/report-format';
import { fmtDateTime } from '@/lib/format';
import { DosirAssist } from '@/components/DosirAssist';
import { ApprovalGate } from '@/components/ApprovalGate';
import { OwnerProofSatgas } from '@/components/OwnerProofSatgas';
import { Rujukan } from '@/components/Rujukan';
import type { InstitutionInfo } from '@/lib/vault-client';
import { RELASI_LABEL } from '@gema/pendamping';
import { VeilBar } from '@/components/Veil';
import { BuktiKasus } from './BuktiKasus';
import { CatatanInternal } from './CatatanInternal';
import { Penanggung } from './Penanggung';
import { Perkembangan } from './Perkembangan';
import { fetchDosir, type Detail, type Loaded } from './dosir';

export default function Dosir() {
  const { id } = useParams<{ id: string }>();
  const { session } = useSatgas();
  const [d, setD] = useState<Detail | null>(null);
  const [dek, setDek] = useState<Uint8Array | null>(null);
  const [narasi, setNarasi] = useState<Narasi | null>(null);
  const [meta, setMeta] = useState<BuktiMeta | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState('');
  const [noKey, setNoKey] = useState(false);
  const [locked, setLocked] = useState(false);
  const [inst, setInst] = useState<InstitutionInfo | null>(null);
  const [team, setTeam] = useState<{ id: string; nama: string; role: string }[]>([]);
  useEffect(() => {
    if (session?.member.role === 'Ketua')
      api<{ members: typeof team }>('satgas/team', { token: session.token })
        .then((r) => setTeam(r.members))
        .catch(() => undefined);
  }, [session]);
  useEffect(() => {
    api<InstitutionInfo[]>('public/institutions')
      .then((l) => setInst(l.find((i) => i.id === session?.institution.id) ?? null))
      .catch(() => undefined);
  }, [session]);
  const assistInput = useMemo(
    () =>
      narasi && meta
        ? {
            apa: narasi.apa,
            kapan: narasi.kapan,
            dimana: narasi.dimana,
            saksi: narasi.saksi,
            dampak: narasi.dampak,
            terlapor: {
              nama: narasi.terlapor.nama,
              unitNama: narasi.terlapor.unitNama,
              peran: narasi.terlapor.peran,
              relasi: narasi.terlapor.relasi,
            },
            bukti: meta.items.map((m) => ({ nama: m.nama, messages: m.messages })),
          }
        : null,
    [narasi, meta],
  );

  const apply = useCallback((l: Loaded) => {
    setLocked(l === 'butuh-persetujuan');
    if (l === 'butuh-persetujuan') return;
    setD(l.d);
    setNoKey(!l.decrypted);
    if (!l.decrypted) return;
    setDek(l.decrypted.dek);
    setNarasi(l.decrypted.narasi);
    setMeta(l.decrypted.meta);
    setNotes(l.decrypted.notes);
  }, []);
  const load = useCallback(async () => {
    if (session) apply(await fetchDosir(session, id));
  }, [session, id, apply]);
  useEffect(() => {
    if (!session) return;
    fetchDosir(session, id)
      .then(apply)
      .catch((e) => setMsg(e.message));
  }, [session, id, apply]);

  if (session && locked)
    return (
      <div className="wrap">
        <header className="ph ph-foto">
          <HeaderPhoto />
          <SatgasBar s={session} />
          <Link href="/satgas" className="back">
            Kembali ke daftar kasus
          </Link>
          <h1>Dosir terkunci</h1>
        </header>
        <ApprovalGate session={session} caseId={id} onApproved={() => void load()} />
      </div>
    );
  if (!session || !d)
    return (
      <div className="narrow">
        <p role="status">{msg || 'Membuka dosir…'}</p>
      </div>
    );
  const role = session.member.role;
  const canRead = role === 'Ketua' || role === 'Anggota';
  const act = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      await load();
      setMsg('Tersimpan.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Gagal.');
    }
  };

  const reload = async () => {
    await load();
  };

  return (
    <div className="wrap" style={{ maxWidth: 900 }}>
      <header className="ph ph-foto">
        <HeaderPhoto />
        <SatgasBar s={session} />
        <Link href="/satgas" className="back">
          Kembali ke daftar kasus
        </Link>
        <h1>{d.escalation.alias}</h1>
        <p className="muted">
          {d.report.unitNama}, {d.escalation.sumber}, status{' '}
          <strong style={{ color: 'inherit' }}>{d.escalation.status}</strong>, tenggat{' '}
          {fmtDateTime(d.sla.due)}
          {d.sla.terlambat && (
            <>
              {' '}
              <span className="pill rose">Terlambat T{d.sla.tingkat}</span>
            </>
          )}
          {d.escalation.prioritas && (
            <>
              {' '}
              <span className="pill prio">Prioritas, relasi kuasa</span>
            </>
          )}
        </p>
      </header>
      {msg && (
        <p className="card warn small" role="status">
          {msg}
        </p>
      )}
      {d.cluster.total > 1 && (
        <p className="card tint">
          Laporan ini bagian dari kelompok {d.cluster.total} laporan yang cocok (
          {d.cluster.tereskalasi} tereskalasi, {d.cluster.tersegel} masih tersegel dan tidak terbaca
          oleh siapa pun selain pelapornya).
        </p>
      )}

      {canRead && narasi && (
        <>
          <VeilBar defaultOn what="Isi laporan dan bukti" />
          <section className="card my-lg sensitive">
            <h2 className="title-md">Laporan</h2>
            <p>
              <strong>Terlapor:</strong> {narasi.terlapor.nama} ({narasi.terlapor.peran})
              {narasi.terlapor.relasi && (
                <>
                  , <strong>Relasi:</strong> {RELASI_LABEL[narasi.terlapor.relasi]}
                </>
              )}
            </p>
            <p style={{ whiteSpace: 'pre-wrap' }}>{narasi.apa}</p>
            <p className="muted small">
              {[narasi.kapan, narasi.dimana]
                .filter(Boolean)
                .map((x) => x.trim().replace(/[.,]$/, ''))
                .join(', ')}
            </p>
          </section>
        </>
      )}
      <Penanggung session={session} d={d} caseId={id} team={team} setMsg={setMsg} reload={reload} />

      <Perkembangan session={session} d={d} caseId={id} notes={notes} act={act} />

      {canRead && assistInput && <DosirAssist alias={d.escalation.alias} input={assistInput} />}
      {canRead && noKey && (
        <p className="card warn">
          Isi terkunci. Muat kunci rahasia Satgas di halaman <Link href="/satgas/kunci">Kunci</Link>
          , lalu kembali ke sini.
        </p>
      )}

      {canRead && <BuktiKasus session={session} d={d} meta={meta} dek={dek} act={act} />}

      {canRead && <OwnerProofSatgas session={session} caseId={id} />}
      {canRead && (
        <section className="card my-lg" aria-labelledby="rjk">
          <h2 className="title-sm" id="rjk">
            Rujukan untuk pelapor
          </h2>
          <p className="hint">
            Sampaikan pilihan ini saat menghubungi pelapor. Layanan kampus diatur Ketua Satgas.
          </p>
          <Rujukan kampus={inst?.rujukan} namaKampus={inst?.nama} compact />
        </section>
      )}

      {canRead && dek && <CatatanInternal session={session} caseId={id} dek={dek} act={act} />}
    </div>
  );
}
