/**
 * @gema/dp — privasi diferensial untuk angka agregat yang dipublikasikan.
 * Derau Laplace diskret (selisih dua variabel geometrik) dengan RNG kriptografis.
 * Derau ditambahkan SEKALI per (unit, periode) saat snapshot dibuat lalu disimpan,
 * sehingga memuat ulang halaman tidak dapat dirata-ratakan.
 *
 * Batas yang diakui: implementasi memakai bilangan titik-mengambang (diketahui punya celah
 * halus pada DP); unit kecil menjadi sangat kasar; derau tidak menghapus pengetahuan luar penyerang.
 */

/** Seragam di (0,1) dari 53 bit acak kriptografis. */
function uniform(): number {
  const a = new Uint32Array(2);
  do {
    globalThis.crypto.getRandomValues(a);
  } while (a[0] === 0 && a[1] === 0);
  const hi = a[0] >>> 5; // 27 bit
  const lo = a[1] >>> 6; // 26 bit
  return (hi * 67108864 + lo + 0.5) / 9007199254740992;
}

function geometric(alpha: number): number {
  // P(G = k) = (1 - alpha) alpha^k, k ≥ 0
  return Math.floor(Math.log(uniform()) / Math.log(alpha));
}

/** Derau Laplace diskret dengan skala b = sensitivitas / epsilon. */
export function discreteLaplace(epsilon: number, sensitivity: number): number {
  if (!(epsilon > 0) || !(sensitivity > 0))
    throw new Error('epsilon dan sensitivitas harus positif');
  const alpha = Math.exp(-epsilon / sensitivity);
  return geometric(alpha) - geometric(alpha);
}

const SENSITIVITY = 3; // batas laporan aktif per pelapor
const DEFAULT_EPSILON = 1;

export function noisyCount(
  trueCount: number,
  epsilon = DEFAULT_EPSILON,
  sensitivity = SENSITIVITY,
): number {
  return Math.max(0, Math.round(trueCount + discreteLaplace(epsilon, sensitivity)));
}

export type Bucket = '3-5' | '6-10' | '>10' | null;

/** Ambang minimal diterapkan pada angka BERDERAU, bukan angka asli. */
export function bucketize(noisy: number, minimum: number): Bucket {
  if (noisy < minimum) return null;
  if (noisy <= 5) return '3-5';
  if (noisy <= 10) return '6-10';
  return '>10';
}

/** Anggaran epsilon kumulatif per unit; bila habis, rilis berikutnya ditunda. */
export class PrivacyBudget {
  constructor(
    public readonly max: number,
    public spent = 0,
  ) {}
  canSpend(eps: number): boolean {
    return this.spent + eps <= this.max + 1e-9;
  }
  spend(eps: number): boolean {
    if (!this.canSpend(eps)) return false;
    this.spent += eps;
    return true;
  }
}

/** Snapshot kepatuhan: persen tepat waktu dan median hari dari hitungan berderau. */
export function complianceSnapshot(
  due: number,
  onTime: number,
  medianDays: number,
  epsilon = DEFAULT_EPSILON,
  minimum = 5,
): {
  enough: boolean;
  dueNoisy: number;
  onTimeNoisy: number;
  percent: number | null;
  medianBucket: string | null;
} {
  const dueNoisy = noisyCount(due, epsilon);
  const onTimeNoisy = Math.min(dueNoisy, noisyCount(onTime, epsilon));
  if (dueNoisy < minimum)
    return { enough: false, dueNoisy, onTimeNoisy, percent: null, medianBucket: null };
  const m = Math.max(0, Math.round(medianDays + discreteLaplace(epsilon, SENSITIVITY)));
  const medianBucket =
    m <= 3 ? '≤ 3 hari' : m <= 5 ? '4–5 hari' : m <= 10 ? '6–10 hari' : '> 10 hari';
  return {
    enough: true,
    dueNoisy,
    onTimeNoisy,
    percent: Math.round((onTimeNoisy / dueNoisy) * 100),
    medianBucket,
  };
}
