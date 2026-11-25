'use client';
import Link from 'next/link';
import { useDeferredValue, useMemo, useState } from 'react';
import { understandStory } from '@gema/pendamping';
import { Dictate } from '@/components/Dictate';
import { Rujukan } from '@/components/Rujukan';
import { carry } from '@/lib/ui/carry';
import { Ilustrasi } from '@/components/Ilustrasi';

const CONTOH = [
  'Dosen saya terus chat malam-malam minta ketemu berdua',
  'Pembimbing bilang skripsi saya tidak akan di-acc kalau saya tidak mau jalan berdua',
  'Senior sering komentar soal badan saya di depan teman-teman',
  'Dia sering pegang tangan dan pinggang saya padahal saya sudah menolak',
];

function Matches({ enough, hits }: { enough: boolean; hits: ReturnType<typeof understandStory> }) {
  return (
    <>
      {!enough && <p className="hasil-empty">Hasilnya muncul di sini saat kamu menulis.</p>}
      {enough && hits.length === 0 && (
        <div className="hasil-card">
          <p className="hasil-title">Kami belum bisa mencocokkannya.</p>
          <p>
            Itu tidak berarti yang kamu alami tidak penting. Pencocok ini hanya mengenali kata-kata
            umum. Kamu tetap boleh menyimpannya, dan Satgas yang menilai.
          </p>
        </div>
      )}
      {hits.length > 0 && (
        <div className="hasil-card">
          <p className="hasil-title">Yang kamu ceritakan mirip dengan bentuk yang diatur:</p>
          <ol className="bentuk">
            {hits.map((h) => (
              <li key={h.form.id}>
                <b>{h.form.label}</b>
                <small>{h.form.pasal}</small>
                <span className="kata">Kata yang kami tangkap: {h.matched.join(', ')}</span>
              </li>
            ))}
          </ol>
          <p className="small">
            Ini petunjuk, bukan keputusan hukum. Kamu berhak menyimpannya sekarang dan memutuskan
            nanti.
          </p>
        </div>
      )}
    </>
  );
}

function Examples({ onPick }: { onPick: (c: string) => void }) {
  return (
    <div className="contoh">
      <p className="small muted" style={{ margin: '0 0 .4rem' }}>
        Atau coba salah satu contoh:
      </p>
      <ul>
        {CONTOH.map((c) => (
          <li key={c}>
            <button type="button" onClick={() => onPick(c)}>
              {c}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Pahami() {
  const [text, setText] = useState('');
  const t = useDeferredValue(text);
  const hits = useMemo(() => understandStory(t), [t]);
  const enough = t.trim().split(/\s+/).length >= 4;
  return (
    <div className="wrap pahami">
      <header className="ph" data-tab="Pahami dulu">
        <Ilustrasi motif="pahami" />
        <h1>Apakah yang kamu alami termasuk kekerasan?</h1>
        <p className="lede">
          Ceritakan dengan kata-katamu sendiri. Kami cocokkan dengan bentuk kekerasan dalam
          Permendikbudristek 55/2024. Ceritamu diproses di perangkat ini dan tidak disimpan.
        </p>
      </header>

      <div className="ph-grid">
        <section aria-labelledby="tulis">
          <label id="tulis" htmlFor="cerita" className="label">
            Apa yang terjadi?
          </label>
          <textarea
            id="cerita"
            rows={7}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Tulis sesingkat atau sepanjang yang kamu mau."
          />
          <Dictate onText={(s) => setText((p) => (p ? `${p} ${s}` : s))} />
          {!text && <Examples onPick={setText} />}
        </section>

        <section className="hasil" aria-live="polite" aria-labelledby="hasil">
          <h2 id="hasil" className="sr">
            Hasil
          </h2>
          <Matches enough={enough} hits={hits} />
          <div className="row" style={{ marginTop: '1.2rem' }}>
            <Link className="btn teal" href="/mulai" onClick={() => carry(text)}>
              Simpan dulu, tanpa nama
            </Link>
            <Link className="btn ghost" href="/panduan#bantuan">
              Cari bantuan
            </Link>
          </div>
          {text && (
            <p className="small muted mt-sm">
              Bila kamu lanjut menyimpan, cerita ini dibawa ke formulir laporan dan dikunci di sana.
            </p>
          )}
        </section>
      </div>

      <details className="more pahami-rj">
        <summary>Butuh bicara dengan seseorang sekarang?</summary>
        <Rujukan compact />
      </details>
    </div>
  );
}
