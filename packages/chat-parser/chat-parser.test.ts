import { describe, expect, it } from 'vitest';
import { looksLikeWhatsApp, parseWhatsApp } from './index';

// 10 fixture: Android/iOS, 12/24 jam, Indonesia/Inggris, multibaris, sistem, lampiran
const fixtures: {
  name: string;
  text: string;
  expectMessages: number;
  firstSender: string;
  firstText?: string;
}[] = [
  {
    name: 'Android ID 24 jam',
    text: '31/12/2023 14.05 - Maya: halo pak\n31/12/2023 14.06 - Pak Budi: ya?\n',
    expectMessages: 2,
    firstSender: 'Maya',
    firstText: 'halo pak',
  },
  {
    name: 'Android EN 12 jam',
    text: '12/31/23, 2:05 PM - Maya: hi\n12/31/23, 2:06 PM - Pak Budi: yes\n',
    expectMessages: 2,
    firstSender: 'Maya',
  },
  {
    name: 'Android EN dengan U+202F',
    text: '12/31/23, 2:05 PM - Maya: hi\n12/31/23, 2:06 PM - Pak Budi: yes\n',
    expectMessages: 2,
    firstSender: 'Maya',
  },
  {
    name: 'iOS ID bertanda kurung',
    text: '[31/12/23 14.05.33] Maya: halo\n[31/12/23 14.06.01] Pak Budi: ya\n',
    expectMessages: 2,
    firstSender: 'Maya',
  },
  {
    name: 'iOS EN 12 jam',
    text: '[12/31/23, 2:05:33 PM] Maya: hi\n[12/31/23, 2:06:01 PM] Pak Budi: yes\n',
    expectMessages: 2,
    firstSender: 'Maya',
  },
  {
    name: 'pesan multibaris',
    text: '31/12/2023 14.05 - Maya: baris satu\nbaris dua\n\nbaris empat\n31/12/2023 14.06 - Pak Budi: oke\n',
    expectMessages: 2,
    firstSender: 'Maya',
    firstText: 'baris satu\nbaris dua\n\nbaris empat',
  },
  {
    name: 'pesan sistem tanpa pengirim',
    text: '31/12/2023 14.00 - Pesan dan panggilan terenkripsi secara end-to-end.\n31/12/2023 14.05 - Maya: halo\n',
    expectMessages: 2,
    firstSender: '',
  },
  {
    name: 'lampiran Android (file terlampir)',
    text: '31/12/2023 14.05 - Maya: IMG-20231231-WA0001.jpg (file terlampir)\n31/12/2023 14.06 - Maya: <Media tidak disertakan>\n',
    expectMessages: 2,
    firstSender: 'Maya',
  },
  {
    name: 'format tanggal mm/dd terdeteksi dari hari > 12',
    text: '12/31/2023, 14:05 - Maya: a\n12/30/2023, 14:06 - Pak Budi: b\n',
    expectMessages: 2,
    firstSender: 'Maya',
  },
  {
    name: 'baris pembuka tak dikenal tidak dibuang',
    text: 'Ekspor chat dengan Pak Budi\n31/12/2023 14.05 - Maya: halo\n31/12/2023 14.06 - Pak Budi: ya\n',
    expectMessages: 3,
    firstSender: '',
  },
];

describe('parser ekspor WhatsApp', () => {
  for (const f of fixtures) {
    it(f.name, () => {
      const r = parseWhatsApp(f.text);
      expect(r.messages).toHaveLength(f.expectMessages);
      expect(r.messages[0].sender).toBe(f.firstSender);
      if (f.firstText !== undefined) expect(r.messages[0].text).toBe(f.firstText);
    });
  }

  it('cakupan: seluruh baris awal pesan terurai (≥ 95%) pada semua fixture', () => {
    let starts = 0;
    let expected = 0;
    for (const f of fixtures) {
      const r = parseWhatsApp(f.text);
      starts += r.stats.messageStarts;
      expected += f.text
        .split('\n')
        .filter((l) => /^\[?\d{1,2}[/.]\d{1,2}[/.]\d{2,4}/.test(l)).length;
    }
    expect(starts / expected).toBeGreaterThanOrEqual(0.95);
  });

  it('lampiran dikenali dan teks pesan tidak hilang', () => {
    const r = parseWhatsApp(fixtures[7].text);
    expect(r.messages[0].attachment).toBe('IMG-20231231-WA0001.jpg');
    expect(r.messages[1].attachment).toBe('(media tidak disertakan)');
  });

  it('urutan tanggal dan ISO', () => {
    const r = parseWhatsApp('05/06/23, 2:05 PM - Maya: hi\n06/06/23, 2:06 PM - Pak Budi: yes\n');
    expect(r.stats.dateOrder).toBe('dmy'); // ambigu → bawaan Indonesia; nilai mentah tetap tersimpan
    expect(r.messages[0].ts).toContain('05/06/23');
    const r2 = parseWhatsApp(fixtures[8].text);
    expect(r2.stats.dateOrder).toBe('mdy');
    expect(r2.messages[0].iso).toBe('2023-12-31T14:05:00');
    const r3 = parseWhatsApp(fixtures[4].text);
    expect(r3.messages[0].iso).toBeTruthy();
  });

  it('looksLikeWhatsApp', () => {
    expect(looksLikeWhatsApp(fixtures[0].text)).toBe(true);
    expect(looksLikeWhatsApp('catatan biasa\nbukan chat')).toBe(false);
  });

  it('stempel waktu mentah dipertahankan agar kanonik tidak bergantung tebakan format', () => {
    const r = parseWhatsApp(fixtures[3].text);
    expect(r.messages[0].ts).toBe('31/12/23 14.05.33');
  });
});
