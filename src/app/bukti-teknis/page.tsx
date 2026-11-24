'use client';
import { useEffect, useState } from 'react';
import { randomBytes, sha256Async, toHex, utf8 } from '@gema/crypto';
import { blindInputs, deriveInstitutionKey, evaluateBatch, finalizeInputs } from '@gema/oprf';
import { combine, split, type Share } from '@gema/shamir';

const CONTOH = '12/03/2026 21.14 - Hendra (fiktif): Jangan bilang siapa-siapa ya';
const short = (h: string) => `${h.slice(0, 10)}…${h.slice(-6)}`;
const sameBytes = (a: Uint8Array, b: Uint8Array) =>
  a.length === b.length && a.every((x, i) => x === b[i]);

function Batas({ bukti, bukan }: { bukti: string; bukan: string }) {
  return (
    <dl className="ctx-list" style={{ marginTop: '1rem' }}>
      <div>
        <dt>Yang dibuktikan</dt>
        <dd>{bukti}</dd>
      </div>
      <div>
        <dt>Yang tidak dibuktikan</dt>
        <dd>{bukan}</dd>
      </div>
    </dl>
  );
}

function Integritas() {
  const [teks, setTeks] = useState(CONTOH);
  const [diubah, setDiubah] = useState(false);
  const [asli, setAsli] = useState('');
  const [cek, setCek] = useState('');
  useEffect(() => {
    let batal = false;
    void (async () => {
      const a = toHex(await sha256Async(utf8(teks)));
      const c = toHex(await sha256Async(utf8(diubah ? teks + '.' : teks)));
      if (!batal) {
        setAsli(a);
        setCek(c);
      }
    })();
    return () => {
      batal = true;
    };
  }, [teks, diubah]);
  const cocok = asli !== '' && asli === cek;
  return (
    <section className="card" aria-labelledby="b1">
      <h2 id="b1" className="title-md">
        1. Berkas diubah satu karakter, sidiknya berubah
      </h2>
      <p>
        Sidik SHA-256 dihitung langsung di peramban ini. Centang kotak di bawah untuk menambah satu
        titik pada salinan yang diperiksa.
      </p>
      <div className="field">
        <label htmlFor="b1-teks">Isi berkas (ubah bebas, data fiktif)</label>
        <textarea id="b1-teks" value={teks} onChange={(e) => setTeks(e.target.value)} />
      </div>
      <label className="choice" style={{ marginBottom: '1rem' }}>
        <input type="checkbox" checked={diubah} onChange={(e) => setDiubah(e.target.checked)} />
        <span>Periksa salinan yang sudah diubah satu karakter</span>
      </label>
      <p className="small">
        Sidik tercatat: <code>{short(asli)}</code>
      </p>
      <p className="small">
        Sidik salinan diperiksa: <code>{short(cek)}</code>
      </p>
      <p role="status" className={`card ${cocok ? 'tint' : 'alert'} small`}>
        {cocok
          ? 'Cocok: berkas sama dengan yang dicatat.'
          : 'Tidak cocok: berkas berbeda dari yang dicatat.'}
      </p>
      <Batas
        bukti="Salinan ini identik atau berbeda dengan berkas yang sidiknya dicatat pada waktu T."
        bukan="Siapa yang membuat berkas, apakah isinya benar, atau apakah percakapan aslinya terjadi. Sidik dihitung di perangkat pelapor; server tidak dapat membaca isi untuk memeriksanya."
      />
    </section>
  );
}

type Hasil = 'belum' | 'gagal' | 'berhasil';

/** Apakah bagian yang dipilih memulihkan rahasia. Satu bagian, atau bagian yang tak cocok, gagal. */
function hasilPemulihan(rahasia: Uint8Array | null, bagian: Share[], pilih: number[]): Hasil {
  if (!rahasia || pilih.length === 0) return 'belum';
  try {
    return sameBytes(combine(pilih.map((i) => bagian[i])), rahasia) ? 'berhasil' : 'gagal';
  } catch {
    return 'gagal';
  }
}

function Ambang() {
  const [rahasia, setRahasia] = useState<Uint8Array | null>(null);
  const [bagian, setBagian] = useState<Share[]>([]);
  const [pilih, setPilih] = useState<number[]>([]);
  const bagi = () => {
    const r = randomBytes(32);
    setRahasia(r);
    setBagian(split(r, 2, 3));
    setPilih([]);
  };
  const hasil = hasilPemulihan(rahasia, bagian, pilih);
  return (
    <section className="card" aria-labelledby="b2">
      <h2 id="b2" className="title-md">
        2. Satu bagian tidak cukup, dua bagian berbeda cukup
      </h2>
      <p>
        Prinsip yang sama dipakai untuk Empat Mata dan pemulihan: sebuah rahasia dibagi menjadi tiga
        bagian, dan hanya dua yang berbeda dapat memulihkannya. Ini peragaan di peramban dengan
        rahasia acak, bukan kunci Satgas sungguhan.
      </p>
      <button type="button" className="btn ghost sm" onClick={bagi}>
        {rahasia ? 'Bagi ulang' : 'Bagi rahasia menjadi 3 bagian'}
      </button>
      {rahasia && (
        <fieldset style={{ border: 0, padding: 0, margin: '1rem 0 0' }}>
          <legend className="small">Bagian yang dikumpulkan</legend>
          {bagian.map((b, i) => (
            <label key={b.x} className="choice">
              <input
                type="checkbox"
                checked={pilih.includes(i)}
                onChange={(e) =>
                  setPilih((p) => (e.target.checked ? [...p, i] : p.filter((x) => x !== i)))
                }
              />
              <span>
                Bagian {i + 1} <code>{toHex(b.y).slice(0, 8)}…</code>
              </span>
            </label>
          ))}
        </fieldset>
      )}
      {rahasia && (
        <p
          role="status"
          className={`card ${hasil === 'berhasil' ? 'tint' : hasil === 'gagal' ? 'alert' : ''} small`}
          style={{ marginTop: '1rem' }}
        >
          {hasil === 'belum' && 'Pilih bagian untuk mencoba memulihkan rahasia.'}
          {hasil === 'gagal' &&
            `Dengan ${pilih.length} bagian, rahasia tidak dapat dipulihkan. Hasil yang diperoleh tidak sama dengan rahasia asli.`}
          {hasil === 'berhasil' && `Dengan ${pilih.length} bagian berbeda, rahasia pulih utuh.`}
        </p>
      )}
      <Batas
        bukti="Ambang 2-dari-3 bekerja secara matematis: kurang dari dua bagian tidak memberi informasi tentang rahasia."
        bukan="Siapa orang di balik bagian itu. Dua orang yang berkolusi tetap dapat memulihkan rahasia; Empat Mata mengurangi risiko satu orang, bukan menghapus kolusi."
      />
    </section>
  );
}

function Oprf() {
  const [nama, setNama] = useState('Dr. Contoh Fiktif');
  const [out, setOut] = useState<{ b1: string; b2: string; f1: string; f2: string } | null>(null);
  const [galat, setGalat] = useState('');
  const hitung = () => {
    try {
      setGalat('');
      const kunci = deriveInstitutionKey(randomBytes(32), 'peragaan-peramban');
      const putaran = () => {
        const b = blindInputs([nama.trim().toLowerCase()]);
        const ev = evaluateBatch(
          kunci.secretKey,
          b.map((x) => toHex(x.blinded)),
        );
        return { blinded: toHex(b[0].blinded), final: finalizeInputs(b, ev)[0] };
      };
      const a = putaran();
      const c = putaran();
      setOut({ b1: a.blinded, b2: c.blinded, f1: a.final, f2: c.final });
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Gagal menghitung.');
    }
  };
  return (
    <section className="card" aria-labelledby="b3">
      <h2 id="b3" className="title-md">
        3. Nama yang sama menghasilkan kode yang sama, tanpa server melihat nama
      </h2>
      <p>
        Pelapor menyamarkan nama sebelum mengirimnya. Penyamaran berbeda tiap kali, tetapi setelah
        dibuka hasilnya sama, sehingga laporan serupa bisa dicocokkan. Peragaan memakai kunci acak
        di peramban ini, bukan kunci institusi.
      </p>
      <div className="field">
        <label htmlFor="b3-nama">Nama terlapor fiktif</label>
        <input id="b3-nama" value={nama} onChange={(e) => setNama(e.target.value)} />
      </div>
      <button type="button" className="btn ghost sm" onClick={hitung} disabled={!nama.trim()}>
        Hitung dua kali
      </button>
      {galat && (
        <p className="err" role="alert">
          {galat}
        </p>
      )}
      {out && (
        <div role="status" className="small" style={{ marginTop: '1rem' }}>
          <p>
            Yang dikirim ke server, putaran 1: <code>{short(out.b1)}</code>
          </p>
          <p>
            Yang dikirim ke server, putaran 2: <code>{short(out.b2)}</code>
          </p>
          <p>
            Kode setelah dibuka, putaran 1: <code>{short(out.f1)}</code>
          </p>
          <p>
            Kode setelah dibuka, putaran 2: <code>{short(out.f2)}</code>
          </p>
          <p className={`card ${out.f1 === out.f2 && out.b1 !== out.b2 ? 'tint' : 'alert'}`}>
            {out.f1 === out.f2 && out.b1 !== out.b2
              ? 'Yang dikirim berbeda tiap kali, kode akhirnya sama.'
              : 'Hasil tidak sesuai harapan; jangan dipercaya.'}
          </p>
        </div>
      )}
      <Batas
        bukti="Server menghitung tanpa melihat nama, dan dua pelapor yang mengetik nama persis sama memperoleh kode yang sama."
        bukan="Ejaan berbeda menghasilkan kode berbeda (Gema memakai beberapa varian ejaan untuk mengurangi ini). Kecocokan bukan bukti bahwa tuduhan benar."
      />
    </section>
  );
}

export default function BuktiTeknis() {
  return (
    <div className="narrow">
      <header className="ph" data-tab="Bukti teknis">
        <h1>Bukti teknis yang bisa kamu coba</h1>
        <p className="lede">
          Tiga hal yang kami klaim, dijalankan langsung di peramban ini dengan kode yang sama dengan
          aplikasi. Tidak ada animasi pura-pura: hasilnya dihitung saat kamu menekan tombol.
        </p>
      </header>
      <div className="stack">
        <Integritas />
        <Ambang />
        <Oprf />
      </div>
      <p className="small muted my-lg">
        Peragaan memakai data fiktif dan kunci acak. Keamanan sistem sesungguhnya bergantung juga
        pada perangkat pengguna, penerapan server, dan orang yang memegang kunci; lihat batas di
        setiap bagian dan di halaman Panduan.
      </p>
    </div>
  );
}
