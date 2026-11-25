import type { Draft } from '@/lib/laporan/drafts';

export const EMPTY: Draft = {
  kapan: '',
  dimana: '',
  apa: '',
  saksi: '',
  bukti: '',
  dampak: '',
  nama: '',
  alias: '',
  unitId: '',
  peran: 'dosen',
  periode: '',
  lokasi: 'kampus',
  k: 2,
  institutionId: '',
  step: 0,
  savedAt: 0,
  relasi: '',
};
export const STEPS = ['Siapa dan di mana', 'Kejadian dan bukti', 'Tinjau dan kunci'];
export const PERAN_LABEL: Record<string, string> = {
  dosen: 'Dosen',
  tendik: 'Tenaga kependidikan',
  mahasiswa: 'Mahasiswa',
  lainnya: 'Lainnya',
};
export const hasExtras = (d: Draft) => !!(d.saksi || d.dampak || d.alias || d.periode);
export const fmtClock = (ms: number) =>
  new Date(ms).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

/** Setter satu kolom draf; menandai draf berubah sehingga tersimpan otomatis. */
export type SetField = <K extends keyof Draft>(k: K, v: Draft[K]) => void;

/** Apakah isian tiap langkah sudah cukup untuk lanjut. Langkah terakhir (tinjauan) selalu boleh. */
export const stepReady = (d: Draft): boolean[] => [
  !!d.institutionId && !!d.unitId && d.nama.trim().length >= 3,
  d.apa.trim().length >= 10 && d.kapan.trim() !== '' && d.dimana.trim() !== '',
  true,
];

/** Petunjuk satu kalimat tentang isian yang masih kurang di langkah ini; kosong bila sudah cukup. */
export function missingHint(d: Draft, step: number): string {
  if (step === 0) {
    if (!d.institutionId) return 'Pilih kampus dulu.';
    if (!d.unitId) return 'Pilih unit terlapor dulu.';
    if (d.nama.trim().length < 3) return 'Tulis nama terlapor, minimal 3 huruf.';
    return '';
  }
  if (step === 1) {
    if (d.apa.trim().length < 10)
      return 'Ceritakan apa yang terjadi, minimal 10 huruf. Boleh singkat.';
    if (!d.kapan.trim()) return 'Isi kapan kejadiannya. Kira-kira juga boleh.';
    if (!d.dimana.trim()) return 'Isi di mana kejadiannya. Tempat umum juga boleh.';
  }
  return '';
}

/** Pilihan periode kejadian: semester akademik terbaru, dengan nilai baku yang sama persis bagi semua pelapor. */
export type PeriodeOpsi = { value: string; label: string };

export function periodeOpsi(now: Date = new Date(), n = 8): PeriodeOpsi[] {
  // Ganjil: Agustus–Januari, genap: Februari–Juli. Tahun ajaran dimulai pada tahun kalender Agustus.
  const m = now.getMonth() + 1;
  let tahun = m >= 8 ? now.getFullYear() : now.getFullYear() - 1;
  let ganjil = m >= 8 || m === 1;
  const out: PeriodeOpsi[] = [];
  for (let i = 0; i < n; i++) {
    const ta = `${tahun}/${tahun + 1}`;
    out.push({
      value: `${ta}-${ganjil ? 'ganjil' : 'genap'}`,
      label: `${ganjil ? 'Ganjil' : 'Genap'} ${ta}`,
    });
    // mundur satu semester: dari ganjil ke genap tahun ajaran sebelumnya, dari genap ke ganjil tahun ajaran yang sama
    if (ganjil) {
      ganjil = false;
      tahun -= 1;
    } else ganjil = true;
  }
  return out;
}

/** Nilai periode yang tersimpan dalam draf (dipisah koma). */
export const periodeDipilih = (periode: string): string[] =>
  periode
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);

/** Label yang terbaca untuk nilai periode; nilai lama yang tidak dikenal ditampilkan apa adanya. */
export function periodeLabel(value: string): string {
  const m = /^(\d{4}\/\d{4})-(ganjil|genap)$/.exec(value);
  return m ? `${m[2] === 'ganjil' ? 'Ganjil' : 'Genap'} ${m[1]}` : value;
}
