/** Penanda pesan penting dalam ekspor chat. Berjalan di perangkat; tidak ada pesan yang dikirim ke mana pun. */
import { cues, hasCue, stems, type Cue } from './text';

export type SignalKind = 'rahasia' | 'imbalan' | 'ancaman' | 'ajakan' | 'seksual' | 'tubuh';
export const SIGNAL_LABEL: Record<SignalKind | 'malam', string> = {
  rahasia: 'Minta dirahasiakan',
  imbalan: 'Janji atau imbalan akademik',
  ancaman: 'Ancaman atau tekanan',
  ajakan: 'Ajakan bertemu berdua',
  seksual: 'Bernuansa seksual',
  tubuh: 'Komentar tentang tubuh',
  malam: 'Dikirim larut malam',
};

const RULES: Record<SignalKind, Cue[]> = {
  rahasia: cues(
    'jangan bilang|jangan cerita|jangan kasih tahu|rahasia kita|rahasiakan|hapus chat|hapus pesan|antara kita saja|cukup kita berdua|jangan lapor',
  ),
  imbalan: cues(
    'nilai kamu|nilaimu|nilai saya urus|saya urus|saya bantu lulus|acc skripsi|tanda tangan|lulus cepat|beasiswa|asisten saya|proyek saya|bimbingan khusus|nilai a',
  ),
  ancaman: cues(
    'awas kalau|kalau tidak mau|kalau kamu tidak|saya bisa bikin|tidak lulus|nilai e|nilai jelek|saya laporkan|saya sebar|mengulang mata kuliah|tahu akibatnya|jangan macam macam',
  ),
  ajakan: cues(
    'ketemu berdua|ke ruangan saya|ke ruang saya|datang sendiri|datang sendirian|ke kos|ke hotel|check in|jalan berdua|makan malam berdua|antar pulang|jemput kamu|video call|vc',
  ),
  seksual: cues(
    'sayang|cium|peluk|kangen kamu|pacar|seksi|foto bugil|kirim foto|tidur bareng|tidur bersama|mesra|nakal|bobo|ranjang',
  ),
  tubuh: cues(
    'badan kamu|tubuh kamu|bentuk badan|kamu cantik|cantik banget|bibir kamu|dada|paha|pinggang|bajumu|pakaianmu|rokmu',
  ),
};

export type ChatMessage = { ts: string; sender: string; text: string };
export type FlaggedMessage = {
  i: number;
  ts: string;
  sender: string;
  text: string;
  kinds: (SignalKind | 'malam')[];
};
export type ChatReading = {
  total: number;
  flagged: FlaggedMessage[];
  counts: Partial<Record<SignalKind | 'malam', number>>;
  bySender: { sender: string; total: number; flagged: number; malam: number }[];
};

/** Jam dari stempel waktu ekspor WhatsApp, mis. "12/03/2026 21.14" atau "3/12/26, 9:14 PM". */
export function hourOf(ts: string): number | null {
  const m = ts.match(/(\d{1,2})[.:](\d{2})(?:[.:]\d{2})?\s*([ap]\.?\s?m\.?)?/i);
  if (!m) return null;
  let h = Number(m[1]);
  const ap = m[3]?.toLowerCase().replace(/[.\s]/g, '');
  if (ap === 'pm' && h < 12) h += 12;
  if (ap === 'am' && h === 12) h = 0;
  return h >= 0 && h < 24 ? h : null;
}
export const isLate = (h: number | null) => h !== null && (h >= 22 || h < 5);

export function readChat(messages: ChatMessage[]): ChatReading {
  const flagged: FlaggedMessage[] = [];
  const counts: ChatReading['counts'] = {};
  const senders = new Map<string, { total: number; flagged: number; malam: number }>();
  messages.forEach((m, i) => {
    if (!m.sender) return;
    const s = senders.get(m.sender) ?? { total: 0, flagged: 0, malam: 0 };
    s.total++;
    const ts = stems(m.text);
    const kinds: FlaggedMessage['kinds'] = [];
    for (const k of Object.keys(RULES) as SignalKind[])
      if (RULES[k].some((c) => hasCue(ts, c.s))) kinds.push(k);
    const late = isLate(hourOf(m.ts));
    if (late) s.malam++;
    // "larut malam" hanya ditandai bila pesannya juga memuat sinyal lain, agar tidak membanjiri
    if (kinds.length) {
      if (late) kinds.push('malam');
      kinds.forEach((k) => (counts[k] = (counts[k] ?? 0) + 1));
      flagged.push({ i, ts: m.ts, sender: m.sender, text: m.text, kinds });
      s.flagged++;
    }
    senders.set(m.sender, s);
  });
  return {
    total: messages.filter((m) => m.sender).length,
    flagged,
    counts,
    bySender: [...senders.entries()]
      .map(([sender, v]) => ({ sender, ...v }))
      .sort((a, b) => b.flagged - a.flagged),
  };
}
