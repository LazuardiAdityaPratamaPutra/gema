/**
 * @gema/chat-parser — mengurai ekspor chat WhatsApp (.txt Android dan iOS) menjadi daftar pesan.
 * Berjalan sepenuhnya di perangkat. Baris yang tidak dikenali digabung ke pesan sebelumnya, tidak dibuang.
 */
import type { CanonicalMessage } from '@gema/merkle';

type ParsedMessage = CanonicalMessage & { iso: string | null; system: boolean };
export type ParseResult = {
  messages: ParsedMessage[];
  stats: {
    totalLines: number;
    messageStarts: number;
    continuationLines: number;
    dateOrder: 'dmy' | 'mdy';
  };
};

const TS = String.raw`(?<d1>\d{1,2})[/.](?<d2>\d{1,2})[/.](?<y>\d{2,4}),?\s+(?<hh>\d{1,2})[.:](?<mm>\d{2})(?:[.:](?<ss>\d{2}))?\s*(?<ap>[AaPp]\.?[Mm]\.?)?`;
const ANDROID = new RegExp(`^(?<ts>${TS})\\s+[-–—]\\s+(?<rest>.*)$`);
const IOS = new RegExp(`^\\[(?<ts>${TS})\\]\\s+(?<rest>.*)$`);

const ATTACH_PATTERNS: RegExp[] = [
  /^(.+?)\s+\((?:file attached|file terlampir|file dilampirkan)\)$/i,
  /^<(?:attached|terlampir|lampiran):\s*(.+?)>$/i,
];
const MEDIA_OMITTED =
  /^<?(?:media omitted|media tidak disertakan|gambar tidak disertakan|image omitted|video omitted|audio omitted|sticker omitted)>?$/i;

function clean(line: string): string {
  return line
    .replace(/[‎‏‪-‮﻿]/g, '')
    .replace(/[  ]/g, ' ')
    .replace(/\r$/, '');
}

type Start = {
  a: number;
  b: number;
  y: number;
  hh: number;
  mm: number;
  ss: number | null;
  ampm: string | null;
  rest: string;
  raw: string;
};

function matchStart(line: string): Start | null {
  const m = ANDROID.exec(line) ?? IOS.exec(line);
  if (!m || !m.groups) return null;
  const g = m.groups;
  return {
    a: +g.d1,
    b: +g.d2,
    y: +g.y,
    hh: +g.hh,
    mm: +g.mm,
    ss: g.ss ? +g.ss : null,
    ampm: g.ap ? g.ap.replace(/\./g, '').toLowerCase() : null,
    rest: g.rest,
    raw: g.ts.replace(/\s+/g, ' ').trim(),
  };
}

/** Jam 12 jam (am/pm) menjadi jam 24; tanpa penanda am/pm jam dipakai apa adanya. */
function to24h(hour: number, ampm: string | null): number {
  if (!ampm) return hour;
  if (ampm.startsWith('p') && hour < 12) return hour + 12;
  if (ampm.startsWith('a') && hour === 12) return 0;
  return hour;
}

function toIso(s: Start, order: 'dmy' | 'mdy'): string | null {
  const day = order === 'dmy' ? s.a : s.b;
  const month = order === 'dmy' ? s.b : s.a;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const year = s.y < 100 ? 2000 + s.y : s.y;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${year}-${p(month)}-${p(day)}T${p(to24h(s.hh, s.ampm))}:${p(s.mm)}:${p(s.ss ?? 0)}`;
}

function splitSender(rest: string): { sender: string; text: string } {
  const i = rest.indexOf(': ');
  if (i <= 0 || i > 80) return { sender: '', text: rest };
  return { sender: rest.slice(0, i), text: rest.slice(i + 2) };
}

export function parseWhatsApp(raw: string): ParseResult {
  const lines = raw.split('\n').map(clean);
  // hapus baris kosong di akhir berkas
  while (lines.length && lines[lines.length - 1] === '') lines.pop();

  const starts: (Start | null)[] = lines.map(matchStart);
  let order: 'dmy' | 'mdy' = 'dmy';
  const sawFirstOver12 = starts.some((s) => s && s.a > 12);
  const sawSecondOver12 = starts.some((s) => s && s.b > 12);
  if (!sawFirstOver12 && sawSecondOver12) order = 'mdy';

  const messages: ParsedMessage[] = [];
  let messageStarts = 0;
  let continuationLines = 0;

  lines.forEach((line, i) => {
    const st = starts[i];
    if (st) {
      messageStarts++;
      const { sender, text } = splitSender(st.rest);
      messages.push({
        ts: st.raw,
        sender,
        text,
        attachment: '',
        iso: toIso(st, order),
        system: sender === '',
      });
    } else {
      continuationLines++;
      if (messages.length === 0) {
        if (line.trim() === '') return;
        messages.push({ ts: '', sender: '', text: line, attachment: '', iso: null, system: true });
      } else {
        messages[messages.length - 1].text += '\n' + line;
      }
    }
  });

  for (const m of messages) {
    m.text = m.text.replace(/\n+$/, '');
    const t = m.text.trim();
    if (MEDIA_OMITTED.test(t)) {
      m.attachment = '(media tidak disertakan)';
      m.text = '';
      continue;
    }
    for (const re of ATTACH_PATTERNS) {
      const am = re.exec(t.split('\n')[0]);
      if (am) {
        m.attachment = am[1].trim();
        m.text = t.split('\n').slice(1).join('\n');
        break;
      }
    }
  }

  return {
    messages,
    stats: { totalLines: lines.length, messageStarts, continuationLines, dateOrder: order },
  };
}

/** Ekspor WhatsApp berupa teks? Heuristik cepat sebelum memanggil parser. */
export function looksLikeWhatsApp(raw: string): boolean {
  const head = raw.split('\n').slice(0, 20).map(clean);
  return head.some((l) => matchStart(l) !== null);
}
