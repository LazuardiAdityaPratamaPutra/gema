/** Pemrosesan teks bahasa Indonesia yang ringan: normalisasi, token, dan pemotong imbuhan sederhana. */

export function normalize(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/(.)\1{2,}/g, '$1$1') // "sayaaaang" → "sayaang"
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const PARTICLES = /(lah|kah|pun|nya|ku|mu)$/;
const SUFFIX = /(kan|an|i)$/;
const PREFIXES: [RegExp, string][] = [
  [/^meny(?=[aiueo])/, 's'],
  [/^mem(?=[aiueo])/, 'p'],
  [/^men(?=[aiueo])/, 't'],
  [/^meng(?=[aiueo])/, 'k'],
  [/^peny(?=[aiueo])/, 's'],
  [/^pem(?=[aiueo])/, 'p'],
  [/^pen(?=[aiueo])/, 't'],
  [/^peng(?=[aiueo])/, 'k'],
  [/^(meng|meny|mem|men|peng|peny|pem|pen|di|ter|ber)/, ''],
  [/^(me|pe|ke|se)/, ''],
];
/** Awalan pendek hanya dibuang bila sisanya cukup panjang, agar "pesan" atau "pegang" tidak terpotong. */
const MIN_REST: Record<string, number> = { me: 5, pe: 5, ke: 5, se: 5 };

/** Pemotong imbuhan sederhana. Tidak sempurna, cukup untuk menyamakan "dipegang", "memegang", "pegangan". */
export function stem(word: string): string {
  let w = word;
  if (w.length <= 4) return w;
  w = w.replace(PARTICLES, '');
  if (w.length > 5) w = w.replace(SUFFIX, '');
  for (const [re, rep] of PREFIXES) {
    const m = w.match(re);
    if (m && w.length > 4) {
      const next = w.replace(re, rep);
      if (next.length >= (MIN_REST[m[0]] ?? 3)) {
        w = next;
        break;
      }
    }
  }
  return w;
}

function tokens(s: string): string[] {
  return normalize(s).split(' ').filter(Boolean);
}

export function stems(s: string): string[] {
  return tokens(s).map(stem);
}

/** Sebuah petunjuk cocok bila semua kata (dalam bentuk dasar) muncul berurutan dan berdekatan (jarak ≤ 2 kata). */
export function hasCue(textStems: string[], cueStems: string[]): boolean {
  if (cueStems.length === 0) return false;
  for (let i = 0; i < textStems.length; i++) {
    if (textStems[i] !== cueStems[0]) continue;
    let pos = i;
    let ok = true;
    for (let k = 1; k < cueStems.length; k++) {
      let found = -1;
      for (let j = pos + 1; j <= Math.min(textStems.length - 1, pos + 3); j++)
        if (textStems[j] === cueStems[k]) {
          found = j;
          break;
        }
      if (found < 0) {
        ok = false;
        break;
      }
      pos = found;
    }
    if (ok) return true;
  }
  return false;
}

export type Cue = { s: string[]; w: number; raw: string };
export function cues(list: string, w = 2): Cue[] {
  return list
    .split('|')
    .map((raw) => raw.trim())
    .filter(Boolean)
    .map((raw) => ({ raw, w, s: stems(raw) }));
}

export function sentences(s: string): string[] {
  return s
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+|\n+/)
    .map((x) => x.trim())
    .filter((x) => x.length > 0);
}
