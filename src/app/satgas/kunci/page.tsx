'use client';
import { HeaderPhoto } from '@/components/HeaderPhoto';
import { useEffect, useState } from 'react';
import { SatgasBar } from '@/components/SatgasBar';
import { useSatgas } from '@/components/useSatgas';
import { api } from '@/lib/api';
import { generateHybridKeypair } from '@gema/pq-kem';
import { loadSatgasSecret, parseSecretFile, storeSatgasSecret } from '@/lib/vault/satgas-key';
import { triggerDownload } from '@/lib/vault/proof';
import { combineSatgasSecret, splitSatgasSecret } from '@/lib/vault/key-shares';
import { satgasStore, type SatgasSession } from '@/lib/store';

type KeyFormProps = { session: SatgasSession; setMsg: (m: string) => void };

/** Memuat kunci rahasia dari berkas JSON cadangan ke sesi tab ini. */
function ImportKey({ session, setMsg }: KeyFormProps) {
  return (
    <div className="field">
      <label htmlFor="imp">Impor berkas kunci rahasia</label>
      <input
        id="imp"
        type="file"
        accept="application/json"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          try {
            storeSatgasSecret(session, parseSecretFile(await f.text()));
            setMsg('Kunci dimuat untuk sesi tab ini. Ia hilang saat tab ditutup.');
          } catch (x) {
            setMsg(x instanceof Error ? x.message : 'Gagal memuat.');
          }
        }}
      />
    </div>
  );
}

/** Merakit kunci dari dua berkas bagian (Empat Mata); hasilnya hanya ada di tab ini. */
function AssembleKey({ session, setMsg }: KeyFormProps) {
  return (
    <div className="field">
      <label htmlFor="parts">Pilih dua berkas bagian kunci</label>
      <input
        id="parts"
        type="file"
        accept=".txt,text/plain"
        multiple
        onChange={async (e) => {
          const files = [...(e.target.files ?? [])];
          if (!files.length) return;
          try {
            const texts = await Promise.all(files.map((f) => f.text()));
            storeSatgasSecret(session, combineSatgasSecret(texts, session.institution.id));
            setMsg('Kunci dirakit untuk sesi tab ini. Ia hilang saat tab ditutup.');
          } catch (x) {
            setMsg(x instanceof Error ? x.message : 'Gagal merakit kunci.');
          }
        }}
      />
    </div>
  );
}

type Mode = 'tunggal' | '2dari3';
type Acts = { session: SatgasSession; setMsg: (m: string) => void };

/** Mode panel kampus: tunggal, atau Empat Mata (setiap pembukaan dosir perlu persetujuan lain). */
function PanelMode({
  session,
  panel,
  setPanel,
  setMsg,
}: Acts & { panel: Mode; setPanel: (m: Mode) => void }) {
  return (
    <section className="card" aria-labelledby="panel">
      <h2 className="title-sm" id="panel">
        Mode panel: {panel === '2dari3' ? 'Empat Mata aktif' : 'tunggal'}
      </h2>
      <p>
        {panel === '2dari3'
          ? 'Dosir dan bukti hanya terbuka bila anggota Satgas lain menyetujui permintaan pembukaan, berlaku 30 menit.'
          : 'Ketua atau Anggota dapat membuka dosir sendirian. Aktifkan Empat Mata agar setiap pembukaan butuh persetujuan anggota lain.'}
      </p>
      <button
        className="btn ghost"
        onClick={() => {
          const next = panel === '2dari3' ? 'tunggal' : '2dari3';
          void api('satgas/panel', { token: session.token, body: { mode: next } })
            .then(() => {
              setPanel(next);
              setMsg(
                next === '2dari3'
                  ? 'Empat Mata aktif.'
                  : 'Kembali ke mode tunggal. Perubahan ini tercatat di jejak audit.',
              );
            })
            .catch((x) => setMsg(x.message));
        }}
      >
        {panel === '2dari3' ? 'Kembali ke mode tunggal' : 'Aktifkan Empat Mata'}
      </button>
    </section>
  );
}

/** Pembuatan kunci Satgas baru di perangkat ini; hanya kunci publik yang dikirim ke server. */
function NewKey({ session, setPanel, setMsg }: Acts & { setPanel: (m: Mode) => void }) {
  const [confirmGen, setConfirmGen] = useState(false);
  const [split, setSplit] = useState(true);

  async function generate() {
    const { publicKey, secretKey } = generateHybridKeypair();
    // Unduh cadangan DULU; baru umumkan kunci publik, supaya kasus baru tidak pernah terkunci tanpa cadangan.
    const id = session.institution.id;
    if (split) {
      splitSatgasSecret(id, secretKey).forEach((part, i) =>
        triggerDownload(`bagian-kunci-${i + 1}-dari-3-${id}.txt`, part, 'text/plain'),
      );
    } else {
      triggerDownload(
        `kunci-satgas-${id}.json`,
        JSON.stringify({ institutionId: id, secret: secretKey }, null, 2),
        'application/json',
      );
    }
    await api('satgas/key', { token: session.token, body: { publicKey } });
    satgasStore.set({ ...session, institution: { ...session.institution, kunciSiap: true } });
    if (split) {
      await api('satgas/panel', { token: session.token, body: { mode: '2dari3' } });
      setPanel('2dari3');
    }
    storeSatgasSecret(session, secretKey);
    setConfirmGen(false);
    setMsg(
      split
        ? 'Kunci baru aktif dan dipecah menjadi 3 bagian. Bagikan satu bagian ke tiap pemegang; jangan simpan dua bagian di satu tempat.'
        : 'Kunci baru aktif. Simpan berkas cadangan di dua tempat terpisah. Kasus lama tetap memerlukan kunci lama.',
    );
  }

  return (
    <section className="card">
      <h2 className="title-sm">Buat kunci baru (Ketua)</h2>
      <p>Kunci dibuat di perangkat ini. Hanya kunci publiknya dikirim ke server.</p>
      <label className="check">
        <input type="checkbox" checked={split} onChange={(e) => setSplit(e.target.checked)} />
        <span>
          <b>Pecah jadi 3 bagian (Empat Mata)</b>: tiga pemegang, dua cukup untuk membuka. Tidak ada
          satu orang pun yang memegang kunci utuh.
        </span>
      </label>
      {!confirmGen ? (
        <button className="btn ghost" onClick={() => setConfirmGen(true)}>
          Buat dan umumkan kunci baru
        </button>
      ) : (
        <div className="card warn">
          <p>Laporan yang sudah dieskalasi dengan kunci lama tetap butuh kunci lama. Lanjutkan?</p>
          <div className="row">
            <button
              className="btn teal"
              onClick={() => void generate().catch((x) => setMsg(x.message))}
            >
              Ya, buat
            </button>
            <button className="btn ghost" onClick={() => setConfirmGen(false)}>
              Batal
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

export default function Kunci() {
  const { session } = useSatgas();
  const [msg, setMsg] = useState('');
  const [panel, setPanel] = useState<Mode | null>(null);
  const token = session?.token;
  useEffect(() => {
    if (!token) return;
    api<{ institution: { panelMode: 'tunggal' | '2dari3' } }>('satgas/me', { token })
      .then((r) => setPanel(r.institution.panelMode))
      .catch(() => undefined);
  }, [token]);
  if (!session)
    return (
      <div className="narrow">
        <p role="status">Memeriksa sesi…</p>
      </div>
    );
  const has = !!loadSatgasSecret(session);
  const isKetua = session.member.role === 'Ketua';

  return (
    <div className="narrow kunci">
      <header className="ph ph-foto">
        <HeaderPhoto />
        <SatgasBar s={session} />
        <h1>Kunci Satgas</h1>
        <p className="lede">
          Laporan yang dieskalasi dikunci untuk kunci publik kampusmu. Hanya kunci rahasia di
          tanganmu yang dapat membukanya. Gema tidak menyimpan dan tidak dapat memulihkannya.
        </p>
      </header>
      {session.institution.demo && (
        <p className="card warn">
          Mode Demo memakai kunci demo yang sengaja publik. Halaman ini untuk kampus sungguhan.
        </p>
      )}
      {msg && (
        <p className="card tint" role="status">
          {msg}
        </p>
      )}
      <div className="kunci-grid">
        <div className="kunci-kiri">
          <p>
            Status di tab ini:{' '}
            <strong>{has ? 'kunci rahasia termuat' : 'belum ada kunci rahasia'}</strong>.
          </p>
          <ImportKey session={session} setMsg={setMsg} />
          <section className="card" aria-labelledby="rakit">
            <h2 className="title-sm" id="rakit">
              Rakit kunci dari dua bagian (Empat Mata)
            </h2>
            <p>
              Dua pemegang membawa bagian kuncinya masing-masing ke perangkat ini. Kunci hanya
              dirakit di tab ini dan hilang saat tab ditutup. Satu bagian saja tidak berguna.
            </p>
            <AssembleKey session={session} setMsg={setMsg} />
          </section>
        </div>
        {isKetua && (
          <div className="kunci-kanan">
            {panel && (
              <PanelMode session={session} panel={panel} setPanel={setPanel} setMsg={setMsg} />
            )}
            {!session.institution.demo && (
              <NewKey session={session} setPanel={setPanel} setMsg={setMsg} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
