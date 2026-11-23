/**
 * @gema/matching — normalisasi nama terlapor, varian fingerprint, sidik penguat, Skor Keyakinan.
 * Berjalan di klien. Pada mode HMAC paket yang sama dipakai server.
 */

export type Role = 'dosen' | 'tendik' | 'mahasiswa' | 'lainnya';
export type LocationKind = 'kampus' | 'daring' | 'luar-kampus';
export type Attributes = { role?: Role; periods?: string[]; location?: LocationKind };

const TITLES = new Set([
  'dr',
  'drs',
  'dra',
  'drg',
  'prof',
  'ir',
  'h',
  'hj',
  'haji',
  'hajjah',
  'kh',
  'ust',
  'ustadz',
  'ustadzah',
  'bapak',
  'pak',
  'ibu',
  'bu',
  'mas',
  'mbak',
  'sdr',
  'sdri',
  'apt',
  'ns',
  'dipl',
  'ing',
  // sapaan daerah dan keagamaan yang sering mendahului nama
  'kak',
  'kakak',
  'bang',
  'abang',
  'om',
  'tante',
  'kang',
  'akang',
  'teh',
  'teteh',
  'uda',
  'uni',
  'bli',
  'mbok',
  'daeng',
  'gus',
  'ning',
  'romo',
  'pdt',
  'pendeta',
  'habib',
  'ustaz',
  'ustazah',
  'cik',
  'koh',
  'cece',
  'mang',
  'bung',
  'sus',
  'suster',
]);

/** Gelar belakang tanpa koma, mis. "S.Kom", "M.T.", "Ph.D" — ditandai oleh titik di dalam token. */
const DEGREE_TOKEN = /^[a-z]{1,4}(\.[a-z]{1,4})+\.?$/;
const DEGREE_PLAIN = new Set([
  'phd',
  'mba',
  'msc',
  'bsc',
  'llm',
  'mkom',
  'skom',
  'spd',
  'mpd',
  'msi',
  'mt',
  'mm',
  'mh',
  'sh',
  'se',
  'st',
  'ssi',
  'mkes',
  'amd',
  'sked',
  'sikom',
  'spdi',
  'mpdi',
  'spog',
  'spa',
  'sppd',
  'mpsi',
  'spsi',
  'mhum',
  'shum',
  'ssos',
  'msos',
  'sip',
  'sag',
  'mag',
  'ssn',
  'msn',
  'skep',
  'mkep',
  'sfarm',
  'mfarm',
  'stp',
  'mp',
  'ak',
  'cpa',
]);

export function normalizeName(raw: string): string {
  let s = raw.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  // gelar belakang biasanya setelah koma: "Hendra Wijaya, M.T."
  s = s.split(',')[0];
  const tokens = s
    .split(/\s+/)
    .filter(Boolean)
    .filter((t) => !DEGREE_TOKEN.test(t))
    .map((t) => ({ raw: t, bare: t.replace(/\./g, '') }))
    .filter((t, i, arr) => {
      if (TITLES.has(t.bare)) return false;
      // gelar belakang tanpa koma di akhir nama
      if (i === arr.length - 1 && arr.length > 1 && DEGREE_PLAIN.has(t.bare)) return false;
      return true;
    })
    .map((t) => t.bare);
  let out = tokens.join(' ');
  out = out.replace(/[^a-z0-9\s'-]/g, ' ').replace(/['-]/g, '');
  // ejaan lama → baru
  out = out.replace(/oe/g, 'u').replace(/dj/g, 'j').replace(/tj/g, 'c');
  return out.replace(/\s+/g, ' ').trim();
}

/** Kode fonetik sederhana per token: tahan variasi ejaan umum nama Indonesia. */
function phoneticToken(t: string): string {
  let s = t
    .replace(/kh/g, 'h')
    .replace(/ch/g, 'h')
    .replace(/sh|sy/g, 's')
    .replace(/th/g, 't')
    .replace(/ph/g, 'p')
    .replace(/ck/g, 'k')
    .replace(/q/g, 'k')
    .replace(/x/g, 'ks')
    .replace(/c/g, 'k')
    .replace(/[fv]/g, 'p')
    .replace(/z/g, 'j')
    .replace(/w(?=[aiueo])/g, 'w')
    .replace(/y$/, 'i')
    .replace(/y/g, 'j')
    .replace(/u/g, 'o') // Muhammad/Mohammad
    .replace(/(.)\1+/g, '$1'); // huruf ganda: Muhammad/Muhamad
  // devoicing akhir kata: Rahmad/Rahmat, Yusuf/Yusup
  s = s.replace(/d$/, 't').replace(/b$/, 'p').replace(/g$/, 'k');
  return s;
}

export type NameVariants = { v1: string; v2: string; v3: string; v4: string; tokens: string[] };

export function nameVariants(raw: string): NameVariants {
  const v1 = normalizeName(raw);
  const tokens = v1.split(' ').filter(Boolean);
  const v2 = [...tokens].sort().join(' ');
  const v3 = tokens.length >= 2 ? `${tokens[0]} ${tokens[tokens.length - 1]}` : v1;
  const v4 = tokens.map(phoneticToken).join(' ');
  return { v1, v2, v3, v4, tokens };
}

/* ---------- Input OPRF/HMAC ---------- */

export type FingerprintInput = {
  /** nama varian untuk tampilan dan penyimpanan: V1..V4, W1, S1..S3 */
  variant: 'V1' | 'V2' | 'V3' | 'V4' | 'W1' | 'W2' | 'S1' | 'S2' | 'S3';
  tier: 'kuat' | 'lemah' | 'penguat';
  input: string;
};

const MAX_INPUTS = 8;

/**
 * Menyusun seluruh masukan fingerprint untuk satu terlapor:
 *  - kuat:    value + ":" + id_unit              (V1..V4)
 *  - lemah:   "weak:" + V1                       (hanya bila ≥ 3 token)
 *  - penguat: kode + ":" + V1 + ":" + id_unit + ":" + nilai atribut
 * Dibatasi 8 masukan (kuota evaluasi). Periode kedua adalah yang pertama dikorbankan.
 */
export function buildInputs(
  rawName: string,
  unitId: string,
  attrs: Attributes = {},
): FingerprintInput[] {
  const nv = nameVariants(rawName);
  if (!nv.v1) return [];
  const out: FingerprintInput[] = [
    { variant: 'V1', tier: 'kuat', input: `${nv.v1}:${unitId}` },
    { variant: 'V2', tier: 'kuat', input: `${nv.v2}:${unitId}` },
    { variant: 'V3', tier: 'kuat', input: `${nv.v3}:${unitId}` },
    { variant: 'V4', tier: 'kuat', input: `${nv.v4}:${unitId}` },
  ];
  if (nv.tokens.length >= 3) out.push({ variant: 'W1', tier: 'lemah', input: `weak:${nv.v1}` });
  // nama depan + inisial nama belakang: "Hendra W." ~ "Hendra Wijaya" (hanya kecocokan lemah, satu unit)
  if (nv.tokens.length >= 2 && nv.tokens[0].length >= 3)
    out.push({
      variant: 'W2',
      tier: 'lemah',
      input: `weak2:${nv.tokens[0]} ${nv.tokens[nv.tokens.length - 1][0]}:${unitId}`,
    });
  if (attrs.role)
    out.push({ variant: 'S1', tier: 'penguat', input: `S1:${nv.v1}:${unitId}:${attrs.role}` });
  const periods = (attrs.periods ?? []).slice(0, 2);
  periods.forEach((p) =>
    out.push({ variant: 'S2', tier: 'penguat', input: `S2:${nv.v1}:${unitId}:${p}` }),
  );
  if (attrs.location)
    out.push({ variant: 'S3', tier: 'penguat', input: `S3:${nv.v1}:${unitId}:${attrs.location}` });

  // dedup masukan identik (nama dua token: V1 = V2 = V3) untuk menghemat kuota
  const seen = new Set<string>();
  const uniq = out.filter((x) => (seen.has(x.input) ? false : (seen.add(x.input), true)));
  // batasi 8: buang periode kedua lebih dulu
  while (uniq.length > MAX_INPUTS) {
    const idx = [...uniq].map((x) => x.variant).lastIndexOf('S2');
    uniq.splice(idx >= 0 ? idx : uniq.length - 1, 1);
  }
  return uniq;
}

/** Pencocokan di sisi uji: dua nama (satu unit) cocok bila berbagi minimal satu masukan kuat. */
export function strongMatch(a: string, b: string, unitId = 'u'): boolean {
  const sa = new Set(
    buildInputs(a, unitId)
      .filter((x) => x.tier === 'kuat')
      .map((x) => x.input),
  );
  return buildInputs(b, unitId).some((x) => x.tier === 'kuat' && sa.has(x.input));
}

/* ---------- Skor Keyakinan ---------- */

export type Confidence = 'rendah' | 'sedang' | 'tinggi';

/**
 * Untuk pelapor i: jumlah sidik penguat (kode berbeda) yang sama dengan sedikitnya satu anggota klaster
 * lain; nilai tertinggi di antara pasangan. 0 rendah, 1 sedang, ≥2 tinggi.
 */
export function confidenceFor(own: string[], others: string[][]): Confidence {
  const ownSet = new Set(own);
  let best = 0;
  for (const o of others) {
    const n = new Set(o.filter((fp) => ownSet.has(fp))).size;
    if (n > best) best = n;
  }
  return best >= 2 ? 'tinggi' : best === 1 ? 'sedang' : 'rendah';
}
