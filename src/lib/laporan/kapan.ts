/** Waktu kejadian sebagai tanggal kalender (YYYY-MM-DD) atau hanya bulan (YYYY-MM); teks lama tetap terbaca apa adanya. */
const BULAN = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

const RE_TANGGAL = /^(\d{4})-(\d{2})-(\d{2})$/;
const RE_BULAN = /^(\d{4})-(\d{2})$/;

const dua = (n: number) => String(n).padStart(2, '0');

/** Tanggal hari ini menurut zona waktu perangkat, untuk batas atas kalender (kejadian tidak bisa di masa depan). */
export const hariIni = (now: Date = new Date()): string =>
  `${now.getFullYear()}-${dua(now.getMonth() + 1)}-${dua(now.getDate())}`;

export const bulanIni = (now: Date = new Date()): string => hariIni(now).slice(0, 7);

export type KapanMode = 'kosong' | 'tanggal' | 'bulan' | 'lama';

/** Jenis nilai yang tersimpan: 'lama' berarti teks bebas dari draf atau laporan sebelum ada kalender. */
export function kapanMode(v: string): KapanMode {
  const t = v.trim();
  if (!t) return 'kosong';
  if (RE_TANGGAL.test(t)) return 'tanggal';
  if (RE_BULAN.test(t)) return 'bulan';
  return 'lama';
}

/** Teks yang dibaca manusia: "15 Oktober 2026", "Oktober 2026", atau teks lama apa adanya. */
export function kapanLabel(v: string): string {
  const t = v.trim();
  const tgl = RE_TANGGAL.exec(t);
  if (tgl) {
    const bln = BULAN[Number(tgl[2]) - 1];
    return bln ? `${Number(tgl[3])} ${bln} ${tgl[1]}` : t;
  }
  const bul = RE_BULAN.exec(t);
  if (bul) {
    const bln = BULAN[Number(bul[2]) - 1];
    return bln ? `${bln} ${bul[1]}` : t;
  }
  return t;
}

/** Terisi dan masuk akal: tanggal atau bulan dari kalender tidak boleh di masa depan; teks lama dianggap sah. */
export function kapanSah(v: string, now: Date = new Date()): boolean {
  const mode = kapanMode(v);
  if (mode === 'kosong') return false;
  if (mode === 'tanggal') return v.trim() <= hariIni(now);
  if (mode === 'bulan') return v.trim() <= bulanIni(now);
  return true;
}
