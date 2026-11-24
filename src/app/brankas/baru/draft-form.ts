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
  d.apa.trim().length >= 10,
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
  if (step === 1 && d.apa.trim().length < 10)
    return 'Ceritakan apa yang terjadi, minimal 10 huruf. Boleh singkat.';
  return '';
}
