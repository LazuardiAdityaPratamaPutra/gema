'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { SatgasBar } from '@/components/SatgasBar';
import { useSatgas } from '@/components/useSatgas';
import { api, ApiError } from '@/lib/api';
import { aesGcmDecrypt, b64u, decryptJson, encryptJson, fromB64u, fromUtf8 } from '@gema/crypto';
import { unwrapFromSatgas } from '@gema/pq-kem';
import { loadSatgasSecret } from '@/lib/satgas-key';
import type { SatgasSession } from '@/lib/store';
import { AAD, AAD_CATATAN, type BuktiMeta, type Narasi } from '@/lib/report-format';
import { fmtBytes, fmtDateTime } from '@/lib/format';
import { triggerDownload } from '@/lib/proof';
import { DosirAssist } from '@/components/DosirAssist';
import { ChatSignals } from '@/components/ChatSignals';
import { ApprovalGate } from '@/components/ApprovalGate';
import { OwnerProofSatgas } from '@/components/OwnerProofSatgas';
import { Rujukan } from '@/components/Rujukan';
import type { InstitutionInfo } from '@/lib/vault-client';
import { RELASI_LABEL } from '@gema/pendamping';

type Detail = {
  escalation: {
    id: string;
    alias: string;
    sumber: string;
    status: string;
    wrapped: never;
    institutionId: string;
    prioritas?: boolean;
  };
  sla: {
    due: number;
    terlambat: boolean;
    hariSisa: number | null;
    hariTerlambat: number;
    tingkat: number;
  };
  report: {
    unitNama: string;
    secrets: { narasi_ciphertext: string; bukti_meta_ciphertext: string };
    createdAt: number;
    flagFast: boolean;
  };
  evidence: {
    id: string;
    sha256: string;
    messageCount: number | null;
    ukuran: number;
    uploadedAt: number;
  }[];
  events: {
    id: string;
    at: number;
    actor: string;
    tipe: string;
    label: string;
    catatan?: string;
  }[];
  cluster: { total: number; tereskalasi: number; tersegel: number };
};
type Loaded =
  | 'butuh-persetujuan'
  | {
      d: Detail;
      decrypted: {
        dek: Uint8Array;
        narasi: Narasi;
        meta: BuktiMeta;
        notes: Record<string, string>;
      } | null;
    };

/** Mengambil dosir lalu mendekripsinya dengan kunci Satgas di perangkat ini. Tanpa efek samping pada state. */
async function fetchDosir(session: SatgasSession, id: string): Promise<Loaded> {
  let d: Detail;
  try {
    d = await api<Detail>(`satgas/cases/${id}`, { token: session.token });
  } catch (e) {
    if (e instanceof ApiError && e.status === 403 && e.data?.needApproval)
      return 'butuh-persetujuan';
    throw e;
  }
  const secret = loadSatgasSecret(session);
  if (!secret) return { d, decrypted: null };
  const dek = await unwrapFromSatgas(d.escalation.wrapped, secret, {
    institutionId: d.escalation.institutionId,
    escalationId: d.escalation.id,
  });
  const narasi = await decryptJson<Narasi>(
    dek,
    fromB64u(d.report.secrets.narasi_ciphertext),
    AAD.narasi,
  );
  const meta = await decryptJson<BuktiMeta>(
    dek,
    fromB64u(d.report.secrets.bukti_meta_ciphertext),
    AAD.meta,
  );
  const notes: Record<string, string> = {};
  for (const ev of d.events) {
    if (!ev.catatan) continue;
    try {
      const note = await decryptJson<{ teks: string; penulis: string }>(
        dek,
        fromB64u(ev.catatan),
        AAD_CATATAN,
      );
      notes[ev.id] = note.teks;
    } catch {
      // Catatan yang tidak bisa dibuka dilewati; sisanya tetap tampil.
    }
  }
  return { d, decrypted: { dek, narasi, meta, notes } };
}

const STATUSES = ['Diterima', 'Verifikasi', 'Rekomendasi', 'Tindak lanjut pimpinan', 'Selesai'];

export default function Dosir() {
  const { id } = useParams<{ id: string }>();
  const { session } = useSatgas();
  const [d, setD] = useState<Detail | null>(null);
  const [dek, setDek] = useState<Uint8Array | null>(null);
  const [narasi, setNarasi] = useState<Narasi | null>(null);
  const [meta, setMeta] = useState<BuktiMeta | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState('');
  const [noKey, setNoKey] = useState(false);
  const [locked, setLocked] = useState(false);
  const [inst, setInst] = useState<InstitutionInfo | null>(null);
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
        <header className="ph">
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
  const idx = STATUSES.indexOf(d.escalation.status);

  return (
    <div className="wrap" style={{ maxWidth: 900 }}>
      <header className="ph">
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
        <section className="card my-lg">
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
      )}
      {canRead && <OwnerProofSatgas session={session} caseId={id} />}
      {canRead && assistInput && <DosirAssist alias={d.escalation.alias} input={assistInput} />}
      {canRead && noKey && (
        <p className="card warn">
          Isi terkunci. Muat kunci rahasia Satgas di halaman <Link href="/satgas/kunci">Kunci</Link>
          , lalu kembali ke sini.
        </p>
      )}

      {canRead && (
        <section className="my-lg">
          <h2 className="title-md">Bukti</h2>
          {d.evidence.map((ev) => {
            const m = meta?.items.find((x) => x.sha256 === ev.sha256);
            return (
              <div
                key={ev.id}
                className="card row"
                style={{ justifyContent: 'space-between', marginBottom: '.6rem' }}
              >
                <span>
                  <strong>{m?.nama ?? 'Berkas'}</strong>{' '}
                  <span className="muted small">
                    {fmtBytes(ev.ukuran)}, {fmtDateTime(ev.uploadedAt)}
                  </span>
                </span>
                {dek && (
                  <button
                    className="btn ghost sm"
                    onClick={() =>
                      void act(async () =>
                        triggerDownload(
                          m?.nama ?? 'bukti',
                          await aesGcmDecrypt(
                            dek,
                            await api<Uint8Array>(`evidence/${ev.id}/blob`, {
                              token: session.token,
                            }),
                            AAD.evidence,
                          ),
                        ),
                      )
                    }
                  >
                    Unduh
                  </button>
                )}
                {m?.messages?.length ? (
                  <div style={{ flexBasis: '100%' }}>
                    <ChatSignals messages={m.messages} />
                  </div>
                ) : null}
              </div>
            );
          })}
        </section>
      )}

      <section className="my-lg">
        <h2 className="title-md">Perkembangan</h2>
        <ul className="timeline">
          {d.events.map((e) => (
            <li key={e.id}>
              <strong>{e.label}</strong>{' '}
              <span className="muted small">
                {fmtDateTime(e.at)}, {e.actor}
              </span>
              {notes[e.id] && <p style={{ margin: '.3rem 0 0' }}>{notes[e.id]}</p>}
            </li>
          ))}
        </ul>
        {(idx < STATUSES.length - 1 && role !== 'Anggota') ||
        (role === 'Anggota' && idx < STATUSES.length - 2) ? (
          <div className="row">
            {role !== 'Pimpinan' && idx < STATUSES.length - 2 && (
              <button
                className="btn teal sm"
                onClick={() =>
                  void act(() =>
                    api(`satgas/cases/${id}/status`, {
                      token: session.token,
                      body: { to: STATUSES[idx + 1] },
                    }),
                  )
                }
              >
                Lanjut ke: {STATUSES[idx + 1]}
              </button>
            )}
            {(role === 'Ketua' || role === 'Pimpinan') && idx < STATUSES.length - 1 && (
              <button
                className="btn ghost sm"
                onClick={() =>
                  void act(() =>
                    api(`satgas/cases/${id}/status`, {
                      token: session.token,
                      body: { to: 'Selesai' },
                    }),
                  )
                }
              >
                Tandai selesai
              </button>
            )}
          </div>
        ) : null}
      </section>

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

      {canRead && dek && (
        <section className="card">
          <h2 className="title-sm">Catatan internal</h2>
          <p className="hint">Dienkripsi dengan kunci kasus; server tidak membacanya.</p>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} aria-label="Catatan" />
          <button
            className="btn teal sm mt-sm"
            disabled={!note.trim()}
            onClick={() =>
              void act(async () => {
                const ct = await encryptJson(
                  dek,
                  { teks: note.trim(), penulis: session.member.nama },
                  AAD_CATATAN,
                );
                await api(`satgas/cases/${id}/notes`, {
                  token: session.token,
                  body: { catatan_ciphertext: b64u(ct) },
                });
                setNote('');
              })
            }
          >
            Simpan catatan
          </button>
        </section>
      )}
    </div>
  );
}
void fromUtf8;
