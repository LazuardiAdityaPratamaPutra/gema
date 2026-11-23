import { b64u, concat, randomBytes, sha256, toHex, utf8 } from '@gema/crypto';

export const DAY = 86_400_000;
const WIB = 7 * 3_600_000;

export const uid = (n = 12): string => b64u(randomBytes(n));
export const hex = toHex;
export const sha256hex = (s: string): string => toHex(sha256(utf8(s)));

const dayIndex = (t: number) => Math.floor((t + WIB) / DAY);
const weekday = (t: number) => (dayIndex(t) + 4) % 7; // 0 = Minggu
export const isBusinessDay = (t: number) => {
  const w = weekday(t);
  return w !== 0 && w !== 6;
};

export function addBusinessDays(from: number, n: number): number {
  let t = from;
  let added = 0;
  while (added < n) {
    t += DAY;
    if (isBusinessDay(t)) added++;
  }
  return t;
}

/** Jumlah hari kerja yang sudah lewat dari `from` sampai `to`. */
export function businessDaysBetween(from: number, to: number): number {
  if (to <= from) return 0;
  let count = 0;
  for (let d = dayIndex(from) + 1; d <= dayIndex(to); d++) {
    const w = (d + 4) % 7;
    if (w !== 0 && w !== 6) count++;
  }
  return count;
}

export function wibDate(t: number): string {
  const d = new Date(t + WIB);
  return d.toISOString().slice(0, 10);
}

export function quarterOf(t: number): string {
  const d = new Date(t + WIB);
  return `${d.getUTCFullYear()}-Q${Math.floor(d.getUTCMonth() / 3) + 1}`;
}

export function quarterEnd(q: string): number {
  const [y, qq] = q.split('-Q').map(Number);
  return Date.UTC(y, qq * 3, 1) - WIB;
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Pembatas laju jendela geser. Hitungan hidup di `store` (bagian dari basis data), sehingga bertahan
 * saat server restart; `onChange` dipanggil agar penyimpanan terjadwal.
 */
export class RateLimiter {
  constructor(
    private store: () => Record<string, number[]>,
    private onChange: () => void = () => undefined,
  ) {}
  check(key: string, max: number, windowMs: number, now = Date.now()): boolean {
    const hits = this.store();
    const arr = (hits[key] ?? []).filter((t) => now - t < windowMs);
    const allowed = arr.length < max;
    if (allowed) arr.push(now);
    hits[key] = arr;
    if (Object.keys(hits).length > 5000) this.sweep(windowMs, now);
    this.onChange();
    return allowed;
  }
  count(key: string, windowMs: number, now = Date.now()): number {
    return (this.store()[key] ?? []).filter((t) => now - t < windowMs).length;
  }
  clear() {
    const hits = this.store();
    for (const k of Object.keys(hits)) delete hits[k];
    this.onChange();
  }
  /** Buang kunci yang semua catatannya sudah di luar jendela (jendela terpanjang kami: satu hari). */
  private sweep(windowMs: number, now: number) {
    const hits = this.store();
    const keep = Math.max(windowMs, 86_400_000);
    for (const [k, arr] of Object.entries(hits))
      if (!arr.some((t) => now - t < keep)) delete hits[k];
  }
}

export function chainHash(prev: string, payload: unknown): string {
  return toHex(sha256(concat(utf8(prev), utf8(JSON.stringify(payload)))));
}

/**
 * Alamat klien dari `x-forwarded-for`. Entri paling kiri dapat dipalsukan klien, jadi yang dipercaya
 * adalah entri ke-`hops` dari kanan (hops = jumlah proksi tepercaya di depan server, bawaan 1, atur
 * lewat GEMA_TRUSTED_PROXIES). Tanpa header: 'lokal'.
 */
export function clientIpFrom(xff: string | null, hops = 1): string {
  const parts = (xff ?? '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
  if (!parts.length) return 'lokal';
  const n = Math.max(1, Math.floor(hops) || 1);
  return parts[Math.max(0, parts.length - n)];
}
