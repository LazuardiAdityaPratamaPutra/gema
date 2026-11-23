const TZ = 'Asia/Jakarta';
const DAY = 86_400_000;

const dateFmt = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: TZ,
});
const dateTimeFmt = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone: TZ,
});
const num = new Intl.NumberFormat('id-ID');

/** Relatif hanya sampai seminggu; setelah itu tanggal absolut (tidak ada "340 hari lalu"). */
export function fmtWhen(ts: number, now = Date.now()): string {
  const d = now - ts;
  if (d < 0 || d >= 7 * DAY) return dateFmt.format(ts);
  if (d < 60_000) return 'baru saja';
  if (d < 3_600_000) return `${Math.floor(d / 60_000)} menit lalu`;
  if (d < DAY) return `${Math.floor(d / 3_600_000)} jam lalu`;
  const days = Math.floor(d / DAY);
  return days === 1 ? 'kemarin' : `${days} hari lalu`;
}

export const fmtDate = (ts: number) => dateFmt.format(ts);
export const fmtDateTime = (ts: number) => dateTimeFmt.format(ts);

export function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1).replace('.', ',')} KB`;
  return `${(n / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
}

const rules = new Intl.PluralRules('id-ID');
/** Pluralisasi lewat Intl.PluralRules agar teks siap i18n (Bahasa Indonesia hanya memakai bentuk "other"). */
export function count(n: number, forms: { one?: string; other: string }): string {
  const form = rules.select(n) === 'one' && forms.one ? forms.one : forms.other;
  return `${num.format(n)} ${form}`;
}

export const shortHash = (h: string, n = 8) => `${h.slice(0, n)}…${h.slice(-n)}`;
