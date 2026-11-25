/**
 * Penjaga klaim: antarmuka dan dokumen demo tidak boleh berjanji lebih dari yang dibuktikan
 * arsitektur dan perilaku API. Gema tidak meminta nama, email, atau telepon, tetapi tidak dapat
 * menjamin anonimitas dari jaringan, perangkat, atau isi cerita. Penarikan eskalasi hanya mungkin
 * sebelum Satgas membuka kasus (lihat `withdrawEscalation`). Ukuran model suara tidak pernah diukur.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '..', '..');
function* walk(dir: string, ext: RegExp): Generator<string> {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(p, ext);
    else if (ext.test(e.name)) yield p;
  }
}
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
/** Seluruh berkas .tsx/.ts dalam satu folder halaman, karena halaman dipecah jadi komponen. */
const readDir = (rel: string) =>
  [...walk(path.join(ROOT, rel), /\.(tsx|ts)$/)]
    .sort()
    .map((f) => fs.readFileSync(f, 'utf8'))
    .join('\n');
const flat = (s: string) => s.replace(/\s+/g, ' ');

// Teks yang dibaca pengguna atau juri. Dokumen audit/changelog sengaja dikecualikan: mereka mengutip klaim lama.
const UI = [...walk(path.join(ROOT, 'src'), /\.(tsx|ts)$/)];
const DOKUMEN = ['README.md', 'docs/arsip/KESIAPAN-LOMBA.md', 'docs/panduan/DEPLOY.md'].map((f) =>
  path.join(ROOT, f),
);
const SEMUA = [...UI, ...DOKUMEN];
const rel = (f: string) => path.relative(ROOT, f);
const terbaca = (f: string) => flat(fs.readFileSync(f, 'utf8'));

function temukan(re: RegExp, files = SEMUA) {
  return files.filter((f) => re.test(terbaca(f))).map(rel);
}

describe('klaim anonimitas', () => {
  it('ada berkas yang diperiksa', () => {
    expect(UI.length).toBeGreaterThan(40);
    expect(DOKUMEN.every((f) => fs.existsSync(f))).toBe(true);
  });
  const DILARANG: [RegExp, string][] = [
    [/brankas anonim/i, '"brankas anonim"'],
    [/secara anonim/i, '"secara anonim"'],
    [/identitas(nya)? tetap anonim/i, '"identitas tetap anonim"'],
    [/(?<!bukan ")tidak (bisa|dapat) dilacak/i, '"tidak bisa dilacak"'],
    [/(tak|tidak) (bisa|dapat) dibantah/i, '"tak bisa dibantah"'],
    [/terjamin aman|100 ?% aman|pasti aman/i, 'janji keamanan mutlak'],
    [/identitasmu tidak ada|karena tidak pernah diminta/i, '"identitasmu tidak ada di sana"'],
    [/\bbukti aman\b/i, 'judul "bukti aman" (keamanan tidak dapat dijamin)'],
  ];
  for (const [re, nama] of DILARANG)
    it(`tidak memuat janji ${nama}`, () => expect(temukan(re)).toEqual([]));
});

describe('klaim penarikan eskalasi', () => {
  it('tidak ada janji "tarik kapan saja"', () => {
    const re =
      /(menarik(nya)?|ditarik|penarikan|tarik)[^.;]{0,50}kapan saja|kapan saja[^.;]{0,30}(ditarik|menarik|dicabut)|dicabut kapan saja/i;
    expect(temukan(re)).toEqual([]);
  });

  it('setiap kalimat "bisa menarik/ditarik" memuat syaratnya', () => {
    const SYARAT =
      /(belum|sebelum Satgas) membuka|selama belum terpenuhi|tidak (bisa|dapat) (ditarik|menarik)/i;
    const tanpaSyarat: string[] = [];
    for (const f of SEMUA)
      for (const m of terbaca(f).matchAll(
        /[^.]*\b(bisa|dapat|boleh) (menarik|ditarik|dicabut)\b[^.]*\./gi,
      ))
        if (!SYARAT.test(m[0])) tanpaSyarat.push(`${rel(f)}: ${m[0].trim().slice(0, 100)}`);
    expect(tanpaSyarat).toEqual([]);
  });

  it('halaman brankas menjelaskan batas penarikan dan tidak menawarkan tarik setelah dibuka', () => {
    const s = flat(readDir('src/app/brankas/[id]'));
    expect(s).toContain('Penarikan hanya dapat dilakukan sebelum Satgas membuka kasus.');
    expect(s).toContain('selama Satgas belum membuka kasusnya');
    expect(s).toContain('e.opened ?');
    expect(s).toContain('persetujuan tidak dapat ditarik');
  });

  it('API tetap menolak penarikan setelah kasus dibuka (dasar dari teks di atas)', () => {
    const s = flat(read('src/server/logic/eskalasi.ts'));
    expect(s).toMatch(/if \(esc\.opened_at\)\s*throw new HttpError\(409/);
  });

  it('konfirmasi eskalasi menutup setelah berhasil, bukan hanya disembunyikan', () => {
    const s = flat(readDir('src/app/brankas/[id]'));
    // reset dijalankan lewat callback sukses `act`, setelah fn() dan load() tanpa galat
    expect(s).toMatch(/await fn\(\); await load\(\); setMsg\(ok\); onDone\?\.\(\);/);
    expect(s).toContain('() => setConfirmEsc(false)');
  });
});

describe('klaim ukuran dan kinerja model suara', () => {
  it('tidak ada angka ukuran model yang tak terukur', () => {
    const re =
      /(model|whisper|pengenal suara|diunduh|unduhan)[^.;]{0,80}\b\d+([.,]\d+)?\s?(MB|megabyte|GB)\b|\b\d+([.,]\d+)?\s?(MB|megabyte|GB)\b[^.;]{0,80}(model|whisper|pengenal suara|diunduh)/i;
    expect(temukan(re)).toEqual([]);
  });
  it('panduan memakai kata-kata faktual', () => {
    expect(flat(read('src/app/panduan/Bagian.tsx'))).toContain('perlu diunduh terlebih dahulu');
  });
});

describe('peringatan privasi', () => {
  it('Batas jujur memuat batas identifikasi lewat isi laporan', () => {
    const s = flat(read('src/app/panduan/Bagian.tsx'));
    expect(s).toContain('Isi laporan bisa mengungkap identitas.');
    expect(s).toContain('tangkapan layar');
    expect(s).toContain('<span>8 batas</span>');
    // jumlah butir pada daftar sama dengan angka di ringkasan
    const blok = s.split('id="batas"')[1].split('</details>')[0];
    expect((blok.match(/<li>/g) ?? []).length).toBe(8);
  });
  it('langkah Tinjau memperingatkan sebelum laporan dikunci, tanpa menuduh Gema meminta identitas', () => {
    // Peringatan ada di komponen langkah Tinjau; tombol kunci ada di halamannya. Urutan berkas di
    // disk berbeda antar sistem operasi, jadi keduanya dibaca terpisah, bukan digabung.
    const tinjau = flat(read('src/app/brankas/baru/StepReview.tsx'));
    const i = tinjau.indexOf('Tinjau, lalu kunci.');
    const j = tinjau.indexOf('<ReviewSummary');
    const catatan = tinjau.slice(i, j);
    expect(i).toBeGreaterThan(-1);
    expect(catatan).toContain('role="note"');
    expect(catatan).toContain('siapa pelapor atau orang lain');
    expect(catatan).toContain('Gema tidak meminta identitasmu');
    const halaman = flat(read('src/app/brankas/baru/page.tsx'));
    expect(halaman.indexOf('<StepReview')).toBeGreaterThan(-1);
    // Tombol kunci ada di StepNav, yang dirender sesudah langkah Tinjau.
    expect(halaman.indexOf('<StepReview')).toBeLessThan(halaman.indexOf('<StepNav'));
    expect(flat(read('src/app/brankas/baru/StepNav.tsx'))).toContain('Kunci dan simpan');
  });
  it('konfirmasi eskalasi menyebut risiko isi cerita dan batas penarikan', () => {
    const s = flat(readDir('src/app/brankas/[id]'));
    expect(s).toContain('bisa memuat petunjuk tentang siapa kamu');
    expect(s).toContain('selama Satgas belum membuka kasusnya');
  });
});
