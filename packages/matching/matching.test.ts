import { describe, expect, it } from 'vitest';
import { buildInputs, confidenceFor, nameVariants, normalizeName, strongMatch } from './index';

describe('normalisasi nama', () => {
  it('gelar depan, belakang, huruf besar, tanda baca', () => {
    expect(normalizeName('Dr. Hendra Wijaya, M.T.')).toBe('hendra wijaya');
    expect(normalizeName('Prof. Dr. Ir. H. Budi Santoso, S.Kom., M.Kom., Ph.D.')).toBe(
      'budi santoso',
    );
    expect(normalizeName('  HENDRA   WIJAYA ')).toBe('hendra wijaya');
    expect(normalizeName('Ahmad Fauzi S.Kom')).toBe('ahmad fauzi');
    expect(normalizeName('Hj. Siti Nurhaliza')).toBe('siti nurhaliza');
  });
  it('ejaan lama → baru', () => {
    expect(normalizeName('Soetrisno Poernomo')).toBe('sutrisno purnomo');
    expect(normalizeName('Widjaja Tjahjono')).toBe('wijaja cahjono');
  });
  it('inisial tunggal tidak dihapus sebagai gelar', () => {
    expect(normalizeName('M. Rizky')).toBe('m rizky');
  });
});

// 30 pasang nama yang seharusnya cocok (variasi gelar, urutan, ejaan)
const TRUE_PAIRS: [string, string][] = [
  ['Dr. Hendra Wijaya, M.T.', 'hendra wijaya'],
  ['Budi Santoso', 'Santoso Budi'],
  ['Budi Hartono Santoso', 'Budi Santoso'],
  ['Muhammad Rizky', 'Mohammad Rizki'],
  ['Muhammad Yusuf', 'Muhamad Yusup'],
  ['Rachmat Hidayat', 'Rahmat Hidayat'],
  ['Achmad Fauzi', 'Ahmad Fauzi'],
  ['Prof. Siti Aminah', 'Siti Aminah, Ph.D'],
  ['Soeharto Wibowo', 'Suharto Wibowo'],
  ['Agus Setiawan S.Kom', 'Agus Setiawan'],
  ['Dewi Lestari', 'Dewi  Lestari'],
  ['Wahyu Kurniawan', 'Wahyoe Kurniawan'],
  ['Ir. H. Bambang Sutrisno', 'Bambang Sutrisno'],
  ['Eko Prasetyo', 'Prasetyo Eko'],
  ['Hj. Nurul Hidayah', 'Nurul Hidayah'],
  ['Rudi Hermawan', 'Rudy Hermawan'],
  ['Dedi Kurniadi', 'Deddy Kurniadi'],
  ['Syarifuddin Ali', 'Sarifuddin Ali'],
  ['Joko Widodo Putra', 'Joko Putra'],
  ['Yusuf Maulana', 'Yoesoef Maulana'],
  ['Andi Wijayanto', 'Andi Widjajanto'],
  ['Slamet Riyadi', 'Selamet Riyadi'],
  ['Taufik Hidayat', 'Taupik Hidayat'],
  ['Zulkifli Hasan', 'Julkipli Hasan'],
  ['Kartika Putri Ayu', 'Kartika Ayu'],
  ['Dr. Ratna Sari Dewi, M.Si.', 'Ratna Dewi'],
  ['Fajar Nugroho', 'Fajar  Nugroho, S.T.'],
  ['Ahmad Dahlan', 'Dahlan Ahmad'],
  ['Maria Magdalena Putri', 'Maria Putri'],
  ['Hasan Basri', 'Hasan Basry'],
];

// 20 pasang nama berbeda yang sengaja mirip: tidak boleh dianggap sama
const NEAR_PAIRS: [string, string][] = [
  ['Rina Wijaya', 'Rini Wijaya'],
  ['Budi Santoso', 'Budi Santosa'],
  ['Andi Pratama', 'Andika Pratama'],
  ['Dewi Lestari', 'Dewa Lestari'],
  ['Hendra Wijaya', 'Hendro Wijaya'],
  ['Siti Aminah', 'Siti Aisyah'],
  ['Agus Salim', 'Agus Salam'],
  ['Eko Prasetyo', 'Eka Prasetyo'],
  ['Ahmad Fauzi', 'Ahmad Faisal'],
  ['Rizky Ramadhan', 'Rizal Ramadhan'],
  ['Bambang Sutrisno', 'Bambang Sutrisna'],
  ['Nur Hidayat', 'Nur Hidayah'],
  ['Wahyu Kurniawan', 'Wahyu Kurniati'],
  ['Joko Susilo', 'Jaka Susilo'],
  ['Putri Ayu', 'Putra Ayu'],
  ['Sari Dewi', 'Sari Dewa'],
  ['Dedi Kurniadi', 'Dodi Kurniadi'],
  ['Tono Wibowo', 'Toni Wibowo'],
  ['Lina Marlina', 'Lani Marlina'],
  ['Fajar Nugroho', 'Fajri Nugroho'],
];

describe('akurasi pencocokan', () => {
  it('recall ≥ 90% pada 30 pasang nama uji', () => {
    const hit = TRUE_PAIRS.filter(([a, b]) => strongMatch(a, b)).length;
    const missed = TRUE_PAIRS.filter(([a, b]) => !strongMatch(a, b));
    console.info(`recall: ${hit}/${TRUE_PAIRS.length}`, missed);
    expect(hit / TRUE_PAIRS.length).toBeGreaterThanOrEqual(0.9);
  });

  it('false positive ≤ 5% pada 20 pasang nama mirip', () => {
    const fp = NEAR_PAIRS.filter(([a, b]) => strongMatch(a, b));
    console.info(`false positive: ${fp.length}/${NEAR_PAIRS.length}`, fp);
    expect(fp.length / NEAR_PAIRS.length).toBeLessThanOrEqual(0.05);
  });

  it('unit berbeda tidak pernah cocok pada tingkat kuat', () => {
    expect(strongMatch('Budi Santoso', 'Budi Santoso', 'fk')).toBe(true);
    const a = buildInputs('Budi Santoso', 'fk').map((x) => x.input);
    const b = buildInputs('Budi Santoso', 'ft').map((x) => x.input);
    expect(a.some((x) => b.includes(x))).toBe(false);
  });
});

describe('masukan fingerprint', () => {
  it('maksimal 8 masukan dan tidak ada duplikat', () => {
    const inputs = buildInputs('Budi Hartono Santoso', 'fk', {
      role: 'dosen',
      periods: ['2024/2025-ganjil', '2023/2024-genap'],
      location: 'kampus',
    });
    expect(inputs.length).toBeLessThanOrEqual(8);
    expect(new Set(inputs.map((i) => i.input)).size).toBe(inputs.length);
  });
  it('W1 (nama lengkap lintas unit) hanya untuk nama ≥ 3 token', () => {
    expect(buildInputs('Budi Santoso', 'fk').some((i) => i.variant === 'W1')).toBe(false);
    expect(buildInputs('Budi Hartono Santoso', 'fk').some((i) => i.variant === 'W1')).toBe(true);
  });
  it('atribut tidak pernah berdiri sendiri: selalu terikat nama', () => {
    const s = buildInputs('Budi Santoso', 'fk', { role: 'dosen' }).filter(
      (i) => i.tier === 'penguat',
    );
    expect(s.every((i) => i.input.includes('budi santoso'))).toBe(true);
  });
  it('varian V4 tahan ejaan', () => {
    expect(nameVariants('Muhammad').v4).toBe(nameVariants('Mohamad').v4);
  });
});

describe('Skor Keyakinan', () => {
  it('0 atribut sama → rendah, 1 → sedang, ≥2 → tinggi', () => {
    expect(confidenceFor(['a', 'b'], [['x']])).toBe('rendah');
    expect(confidenceFor(['a', 'b'], [['a']])).toBe('sedang');
    expect(confidenceFor(['a', 'b'], [['a', 'b']])).toBe('tinggi');
    expect(confidenceFor(['a', 'b'], [['a'], ['b']])).toBe('sedang'); // nilai tertinggi per pasangan
  });
  it('pelapor tanpa atribut selalu rendah', () => {
    expect(confidenceFor([], [['a', 'b']])).toBe('rendah');
  });
});

describe('normalisasi lanjutan', () => {
  it('membuang sapaan daerah dan gelar tambahan', () => {
    expect(normalizeName('Kang Asep Sunandar, S.Pd.I.')).toBe('asep sunandar');
    expect(normalizeName('Bli Made Wirawan SPdI')).toBe('made wirawan');
    expect(normalizeName('dr. Rina Kartika Sp.OG')).toBe('rina kartika');
  });
  it('inisial nama belakang menjadi kecocokan lemah, bukan kuat', () => {
    const a = buildInputs('Hendra W.', 'u1');
    const b = buildInputs('Dr. Hendra Wijaya, M.T.', 'u1');
    const weakA = a.filter((x) => x.variant === 'W2').map((x) => x.input);
    expect(b.some((x) => x.variant === 'W2' && weakA.includes(x.input))).toBe(true);
    expect(strongMatch('Hendra W.', 'Hendra Wijaya', 'u1')).toBe(false);
  });
});
