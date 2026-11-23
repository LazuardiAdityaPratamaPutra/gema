import type { Draft } from '@/lib/drafts';

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
