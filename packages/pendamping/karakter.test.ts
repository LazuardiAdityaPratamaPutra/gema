/** Karakterisasi aturan pengingat kronologi dan ringkasan dosir: urutan, batas dua, dan nilai bawaan. */
import { describe, expect, it } from 'vitest';
import { nudges, summarize } from './index';

// Tidak memuat kata waktu, tempat, saksi, urutan, atau perasaan yang dikenali aturan.
const POLOS =
  'dosen itu mengirim pesan yang membuat saya tidak nyaman dan terus mengulanginya lagi';
const PANJANG = `${POLOS} ${POLOS} ${POLOS}`; // lebih dari 25 kata
const SEMUA = { kapan: 'x', dimana: 'x', saksi: 'x', dampak: 'x' };
const ids = (t: string, f = {}) => nudges(t, f).map((n) => n.id);

describe('nudges', () => {
  it('cerita terlalu pendek tidak diberi pengingat', () => {
    expect(ids('saya takut sekali')).toEqual([]);
  });

  it('paling banyak dua, berurutan: waktu lalu tempat', () => {
    expect(ids(POLOS)).toEqual(['waktu', 'tempat']);
  });

  it('kolom yang sudah diisi tidak ditanyakan lagi', () => {
    expect(ids(POLOS, { kapan: 'Maret' })).toEqual(['tempat', 'saksi']);
    expect(ids(POLOS, { kapan: 'Maret', dimana: 'ruang dosen' })).toEqual(['saksi', 'dampak']);
    expect(ids(POLOS, { kapan: ' ', dimana: '' })).toEqual(['waktu', 'tempat']); // spasi = kosong
  });

  it('pengingat urutan hanya untuk cerita panjang tanpa kata urutan', () => {
    const f = { kapan: 'x', dimana: 'x' };
    expect(ids(POLOS, f)).toEqual(['saksi', 'dampak']);
    expect(ids(PANJANG, f)).toEqual(['urutan', 'saksi']);
    expect(ids(`${PANJANG} lalu pergi`, f)).toEqual(['saksi', 'dampak']);
  });

  it('tiap isyarat dalam teks menggugurkan pengingatnya', () => {
    const f = { ...SEMUA };
    expect(ids(POLOS, { ...f, kapan: '' })).toEqual(['waktu']);
    expect(ids(`${POLOS} kemarin`, { ...f, kapan: '' })).toEqual([]);
    expect(ids(POLOS, { ...f, dimana: '' })).toEqual(['tempat']);
    expect(ids(`${POLOS} di ruang dosen`, { ...f, dimana: '' })).toEqual([]);
    expect(ids(POLOS, { ...f, saksi: '' })).toEqual(['saksi']);
    expect(ids(`${POLOS} teman saya tahu`, { ...f, saksi: '' })).toEqual([]);
    expect(ids(POLOS, { ...f, dampak: '' })).toEqual(['dampak']);
    expect(ids(`${POLOS} saya takut`, { ...f, dampak: '' })).toEqual([]);
  });

  it('semua terisi tidak menghasilkan apa pun', () => {
    expect(ids(POLOS, SEMUA)).toEqual([]);
  });
});

describe('summarize: fakta dan perhatian', () => {
  const dasar = {
    apa: 'Dosen itu mengirim pesan yang tidak pantas kepada saya.',
    terlapor: { nama: 'Pak A', unitNama: 'Fakultas B' },
    bukti: [],
  };

  it('nilai bawaan bila isian kosong', () => {
    const r = summarize({ ...dasar, kapan: '  ' });
    expect(r.fakta).toEqual([
      ['Terlapor', 'Pak A, Fakultas B'],
      ['Kapan', 'Tidak disebutkan'],
      ['Di mana', 'Tidak disebutkan'],
      ['Saksi', 'Tidak disebutkan'],
      ['Bukti', 'Belum ada berkas'],
    ]);
    expect(r.perhatian).toEqual([]);
    expect(r.chat).toBeNull();
  });

  it('peran, relasi, berkas, dan pesan chat masuk ke fakta pada urutan yang tetap', () => {
    const r = summarize({
      ...dasar,
      kapan: ' Maret ',
      terlapor: { nama: 'Pak A', unitNama: 'Fakultas B', peran: 'dosen', relasi: 'tidak' },
      bukti: [
        { nama: 'a.txt', messages: [{ ts: '1', sender: 'A', text: 'halo' }] },
        { nama: 'b.jpg' },
      ],
    });
    expect(r.fakta.map(([k]) => k)).toEqual([
      'Terlapor',
      'Relasi akademik',
      'Kapan',
      'Di mana',
      'Saksi',
      'Bukti',
    ]);
    expect(r.fakta[0][1]).toBe('Pak A (dosen), Fakultas B');
    expect(r.fakta.find(([k]) => k === 'Kapan')![1]).toBe('Maret');
    expect(r.fakta.find(([k]) => k === 'Bukti')![1]).toBe('2 berkas, 1 pesan chat');
    expect(r.chat).not.toBeNull();
  });

  it('perhatian: ketergantungan hanya untuk relasi akademik, dampak menambah satu catatan', () => {
    for (const relasi of ['pembimbing', 'pengajar', 'atasan'] as const)
      expect(summarize({ ...dasar, terlapor: { ...dasar.terlapor, relasi } }).perhatian[0]).toMatch(
        /bergantung/,
      );
    for (const relasi of ['tidak', 'tidak-tahu'] as const)
      expect(summarize({ ...dasar, terlapor: { ...dasar.terlapor, relasi } }).perhatian).toEqual(
        [],
      );
    const r = summarize({ ...dasar, dampak: 'sulit tidur' });
    expect(r.perhatian).toEqual([
      'Pelapor menyebut dampak pada dirinya. Tawarkan pendampingan psikologis.',
    ]);
  });

  it('inti paling banyak dua kalimat, tetap urut seperti di cerita', () => {
    const apa = 'Awalnya biasa saja. Dia memeluk saya paksa. Lalu dia mengancam saya. Saya pulang.';
    const { inti } = summarize({ ...dasar, apa });
    expect(inti.length).toBeLessThanOrEqual(2);
    const pos = inti.map((s) => apa.indexOf(s));
    expect(pos).toEqual([...pos].sort((a, b) => a - b));
  });
});
