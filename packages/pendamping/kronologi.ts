/** Pengingat lembut saat menulis kronologi. Aturan sederhana; tidak menilai isi cerita. */
import { normalize } from './text';

const BULAN =
  'januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember|jan|feb|mar|apr|jun|jul|agu|agt|sep|okt|nov|des';
const WAKTU = new RegExp(
  `\\b(${BULAN}|senin|selasa|rabu|kamis|jumat|sabtu|minggu|kemarin|semalam|tadi|pagi|siang|sore|malam|jam|pukul|semester|tahun|bulan lalu|minggu lalu|\\d{1,2}[./-]\\d{1,2}|20\\d\\d)\\b`,
);
const TEMPAT =
  /\b(di|ke)\s+(ruang|ruangan|kantor|kelas|lab|laboratorium|kos|kost|kampus|gedung|perpustakaan|mobil|rumah|hotel|kantin|lapangan|asrama|sekretariat|lantai|zoom|whatsapp|wa|instagram|telepon|grup)\b|\b(daring|online|lewat chat|lewat wa)\b/;
const SAKSI = /\b(saksi|teman|melihat|lihat|tahu|ada orang|bersama|cerita ke|bilang ke)\b/;
const URUTAN = /\b(lalu|kemudian|setelah|sebelum|sesudah|akhirnya|awalnya|pertama|berikutnya)\b/;
const RASA =
  /\b(takut|trauma|cemas|panik|malu|tidak bisa tidur|susah tidur|menangis|menunda|berhenti|mengundurkan|tertekan|stres|depresi|tidak berani)\b/;

export type Nudge = { id: 'waktu' | 'tempat' | 'saksi' | 'urutan' | 'dampak'; teks: string };

type Filled = Partial<Record<'kapan' | 'dimana' | 'saksi' | 'dampak', string>>;
type Rule = Nudge & { missing: (t: string, filled: Filled) => boolean };

const empty = (v?: string) => !v?.trim();
const words = (t: string) => t.split(' ').length;

/** Urutan aturan = urutan pertanyaan; hanya dua pertama yang berlaku yang ditampilkan. */
const RULES: Rule[] = [
  {
    id: 'waktu',
    teks: 'Kamu ingat kira-kira kapan? Bulan atau semester saja sudah membantu.',
    missing: (t, f) => empty(f.kapan) && !WAKTU.test(t),
  },
  {
    id: 'tempat',
    teks: 'Di mana kejadiannya? Ruangan, tempat, atau lewat aplikasi apa.',
    missing: (t, f) => empty(f.dimana) && !TEMPAT.test(t),
  },
  {
    id: 'urutan',
    teks: 'Bila sanggup, ceritakan urutannya: apa yang terjadi lebih dulu, lalu sesudahnya.',
    missing: (t) => words(t) > 25 && !URUTAN.test(t),
  },
  {
    id: 'saksi',
    teks: 'Apakah ada orang yang melihat, atau yang kamu ceritakan sesudahnya? Boleh dilewati.',
    missing: (t, f) => empty(f.saksi) && !SAKSI.test(t),
  },
  {
    id: 'dampak',
    teks: 'Bila mau, tulis dampaknya padamu, misalnya kuliah atau tidurmu terganggu. Boleh dilewati.',
    missing: (t, f) => empty(f.dampak) && !RASA.test(t),
  },
];

/**
 * Mengembalikan paling banyak dua pertanyaan untuk bagian yang belum muncul.
 * `filled` berisi kolom yang sudah diisi terpisah (kapan/di mana/saksi/dampak) agar tidak ditanyakan ulang.
 */
export function nudges(text: string, filled: Filled = {}): Nudge[] {
  const t = normalize(text);
  if (words(t) < 8) return [];
  return RULES.filter((r) => r.missing(t, filled))
    .slice(0, 2)
    .map(({ id, teks }) => ({ id, teks }));
}
