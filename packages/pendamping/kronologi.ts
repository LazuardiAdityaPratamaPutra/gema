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

/**
 * Mengembalikan paling banyak dua pertanyaan untuk bagian yang belum muncul.
 * `filled` berisi kolom yang sudah diisi terpisah (kapan/di mana/saksi/dampak) agar tidak ditanyakan ulang.
 */
export function nudges(
  text: string,
  filled: Partial<Record<'kapan' | 'dimana' | 'saksi' | 'dampak', string>> = {},
): Nudge[] {
  const t = normalize(text);
  if (t.split(' ').length < 8) return [];
  const out: Nudge[] = [];
  if (!filled.kapan?.trim() && !WAKTU.test(t))
    out.push({
      id: 'waktu',
      teks: 'Kamu ingat kira-kira kapan? Bulan atau semester saja sudah membantu.',
    });
  if (!filled.dimana?.trim() && !TEMPAT.test(t))
    out.push({
      id: 'tempat',
      teks: 'Di mana kejadiannya? Ruangan, tempat, atau lewat aplikasi apa.',
    });
  if (t.split(' ').length > 25 && !URUTAN.test(t))
    out.push({
      id: 'urutan',
      teks: 'Bila sanggup, ceritakan urutannya: apa yang terjadi lebih dulu, lalu sesudahnya.',
    });
  if (!filled.saksi?.trim() && !SAKSI.test(t))
    out.push({
      id: 'saksi',
      teks: 'Apakah ada orang yang melihat, atau yang kamu ceritakan sesudahnya? Boleh dilewati.',
    });
  if (!filled.dampak?.trim() && !RASA.test(t))
    out.push({
      id: 'dampak',
      teks: 'Bila mau, tulis dampaknya padamu, misalnya kuliah atau tidurmu terganggu. Boleh dilewati.',
    });
  return out.slice(0, 2);
}
