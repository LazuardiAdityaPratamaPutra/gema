import { describe, expect, it } from 'vitest';
import {
  drafts,
  hasCue,
  hourOf,
  nudges,
  readChat,
  stem,
  stems,
  summarize,
  understandStory,
} from './index';

describe('teks', () => {
  it('memotong imbuhan umum', () => {
    expect(stem('dipegang')).toBe(stem('memegang'));
    expect(stem('mencium')).toBe(stem('dicium'));
    expect(stem('pesannya')).toBe('pesan');
  });
  it('petunjuk frasa boleh berjarak', () => {
    expect(hasCue(stems('dia memegang erat paha saya'), stems('memegang paha'))).toBe(true);
    expect(hasCue(stems('paha ayam dipegang'), stems('memegang paha'))).toBe(false);
  });
});

describe('pemahaman cerita', () => {
  it('mengenali sentuhan dan bujukan nilai', () => {
    const hits = understandStory(
      'Waktu bimbingan dia memegang paha saya lalu bilang nilaimu saya urus asal mau ketemu berdua.',
    );
    const ids = hits.map((h) => h.form.id);
    expect(ids).toContain('l');
    expect(ids).toContain('j');
  });
  it('mengenali pesan bernuansa seksual', () => {
    const hits = understandStory(
      'Dosen itu terus kirim pesan mesum dan minta foto lewat WhatsApp tengah malam',
    );
    expect(hits[0].form.id).toBe('e');
  });
  it('tidak memaksakan hasil pada cerita netral', () => {
    expect(understandStory('Saya ingin bertanya jadwal kuliah semester depan.')).toEqual([]);
  });
});

describe('chat', () => {
  const msgs = [
    { ts: '12/03/2026 21.14', sender: 'Hendra', text: 'Jangan bilang siapa-siapa ya' },
    { ts: '12/03/2026 21.15', sender: 'Saya', text: 'Kenapa Pak?' },
    {
      ts: '12/03/2026 23.16',
      sender: 'Hendra',
      text: 'Nanti nilaimu saya urus, datang sendiri ke ruangan saya',
    },
  ];
  it('menandai rahasia, imbalan, ajakan, larut malam', () => {
    const r = readChat(msgs);
    expect(r.flagged).toHaveLength(2);
    expect(r.flagged[0].kinds).toContain('rahasia');
    expect(r.flagged[1].kinds).toEqual(expect.arrayContaining(['imbalan', 'ajakan', 'malam']));
    expect(r.bySender[0].sender).toBe('Hendra');
  });
  it('membaca jam 12/24', () => {
    expect(hourOf('3/12/26, 9:14 PM')).toBe(21);
    expect(hourOf('12/03/2026 07.05')).toBe(7);
  });
});

describe('pengingat kronologi', () => {
  it('menanyakan waktu dan tempat bila belum ada', () => {
    const n = nudges(
      'Dia terus mengirim pesan yang membuat saya tidak nyaman dan meminta saya datang',
    );
    expect(n.map((x) => x.id)).toEqual(['waktu', 'tempat']);
  });
  it('tidak bertanya ulang bila kolom terpisah terisi', () => {
    const n = nudges(
      'Dia terus mengirim pesan yang membuat saya tidak nyaman dan meminta saya datang',
      { kapan: 'Maret', dimana: 'Ruang dosen' },
    );
    expect(n.map((x) => x.id)).not.toContain('waktu');
  });
});

describe('ringkasan dosir', () => {
  it('menyusun fakta, perhatian, dan draf pelindungan bila ada relasi akademik', () => {
    const d = {
      apa: 'Saya mahasiswa bimbingannya. Dia memeluk saya di ruangannya. Setelah itu dia mengirim pesan jangan bilang siapa-siapa.',
      kapan: 'Maret 2026',
      dimana: 'Ruang dosen',
      terlapor: {
        nama: 'Hendra',
        unitNama: 'Fakultas Teknik',
        peran: 'dosen',
        relasi: 'pembimbing' as const,
      },
      bukti: [
        {
          nama: 'chat.txt',
          messages: [
            { ts: '12/03/2026 23.10', sender: 'Hendra', text: 'jangan bilang siapa-siapa' },
          ],
        },
      ],
    };
    const r = summarize(d);
    expect(r.inti.length).toBeGreaterThan(0);
    expect(r.fakta.find(([k]) => k === 'Relasi akademik')).toBeTruthy();
    expect(r.perhatian[0]).toMatch(/bergantung/);
    const ds = drafts('KS-ABC', d, r, '21 Nov 2026');
    expect(ds.map((x) => x.judul)).toContain('Usulan pelindungan sementara');
    expect(ds[0].isi).toContain('memeluk');
  });
});
