/**
 * Ringkasan dosir dan draf dokumen untuk Satgas. Ekstraktif dan berbasis templat:
 * tidak mengarang fakta, hanya menyusun ulang isi laporan. Selalu ditandai "draf otomatis".
 */
import { understandStory, type FormHit } from './forms';
import { readChat, SIGNAL_LABEL, type ChatMessage, type ChatReading } from './chat';
import { sentences, stems } from './text';

export type Relasi = 'pembimbing' | 'pengajar' | 'atasan' | 'tidak' | 'tidak-tahu';
export const RELASI_LABEL: Record<Relasi, string> = {
  pembimbing: 'Pembimbing akademik, skripsi, atau tesis',
  pengajar: 'Dosen pengampu atau penguji',
  atasan: 'Atasan kerja atau pemberi proyek',
  tidak: 'Tidak ada hubungan akademik',
  'tidak-tahu': 'Tidak yakin',
};
export const isDependent = (r?: Relasi) => r === 'pembimbing' || r === 'pengajar' || r === 'atasan';

export type DosirInput = {
  apa: string;
  kapan?: string;
  dimana?: string;
  saksi?: string;
  dampak?: string;
  terlapor: { nama: string; unitNama: string; peran?: string; relasi?: Relasi };
  bukti: { nama: string; messages?: ChatMessage[] }[];
};

export type Ringkasan = {
  inti: string[];
  bentuk: FormHit[];
  chat: ChatReading | null;
  fakta: [string, string][];
  perhatian: string[];
};

export function summarize(d: DosirInput): Ringkasan {
  const bentuk = understandStory(d.apa, 4);
  const cueStems = new Set(bentuk.flatMap((h) => h.matched.flatMap((m) => stems(m))));
  const ss = sentences(d.apa);
  const scored = ss.map((s, i) => ({
    s,
    i,
    score: stems(s).filter((x) => cueStems.has(x)).length + (i === 0 ? 0.5 : 0),
  }));
  const inti = scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 2)
    .sort((a, b) => a.i - b.i)
    .map((x) => x.s);
  const msgs = d.bukti.flatMap((b) => b.messages ?? []);
  const chat = msgs.length ? readChat(msgs) : null;
  const fakta: [string, string][] = [
    [
      'Terlapor',
      `${d.terlapor.nama}${d.terlapor.peran ? ` (${d.terlapor.peran})` : ''}, ${d.terlapor.unitNama}`,
    ],
    ['Kapan', d.kapan?.trim() || 'Tidak disebutkan'],
    ['Di mana', d.dimana?.trim() || 'Tidak disebutkan'],
    ['Saksi', d.saksi?.trim() || 'Tidak disebutkan'],
    [
      'Bukti',
      d.bukti.length
        ? `${d.bukti.length} berkas${msgs.length ? `, ${msgs.length} pesan chat` : ''}`
        : 'Belum ada berkas',
    ],
  ];
  if (d.terlapor.relasi) fakta.splice(1, 0, ['Relasi akademik', RELASI_LABEL[d.terlapor.relasi]]);
  const perhatian: string[] = [];
  if (isDependent(d.terlapor.relasi))
    perhatian.push(
      'Pelapor bergantung secara akademik pada terlapor. Pertimbangkan pelindungan sementara sejak awal.',
    );
  if (chat?.counts.ancaman)
    perhatian.push(`${chat.counts.ancaman} pesan memuat ancaman atau tekanan.`);
  if (chat?.counts.rahasia)
    perhatian.push(`${chat.counts.rahasia} pesan meminta kejadian dirahasiakan.`);
  if (d.dampak?.trim())
    perhatian.push('Pelapor menyebut dampak pada dirinya. Tawarkan pendampingan psikologis.');
  return { inti, bentuk, chat, fakta, perhatian };
}

export type Draf = { judul: string; isi: string };

export function drafts(alias: string, d: DosirInput, r: Ringkasan, tanggal: string): Draf[] {
  const bentuk = r.bentuk
    .filter((b) => b.form.seksual)
    .map((b) => `${b.form.ringkas} (${b.form.pasal})`);
  const sinyal = r.chat
    ? Object.entries(r.chat.counts).map(
        ([k, n]) => `${SIGNAL_LABEL[k as keyof typeof SIGNAL_LABEL]}: ${n} pesan`,
      )
    : [];
  const out: Draf[] = [
    {
      judul: 'Catatan penelaahan awal',
      isi: [
        `Kasus ${alias} · disusun ${tanggal}`,
        '',
        'Pokok laporan (kutipan dari pelapor):',
        ...r.inti.map((s) => `- "${s}"`),
        '',
        'Dugaan bentuk yang perlu ditelaah:',
        ...(bentuk.length
          ? bentuk.map((b) => `- ${b}`)
          : ['- Belum teridentifikasi otomatis; telaah manual.']),
        ...(sinyal.length ? ['', 'Temuan pada bukti chat:', ...sinyal.map((s) => `- ${s}`)] : []),
        '',
        'Rencana tindak lanjut: [isi oleh Satgas]',
      ].join('\n'),
    },
    {
      judul: 'Undangan klarifikasi terlapor',
      isi: [
        `Nomor: [isi] · Perihal: Undangan klarifikasi`,
        '',
        `Yth. ${d.terlapor.nama}`,
        d.terlapor.unitNama,
        '',
        'Sehubungan dengan laporan yang sedang ditangani Satuan Tugas Pencegahan dan Penanganan Kekerasan (Satgas PPKPT), kami mengundang Saudara untuk memberikan keterangan pada:',
        'Hari, tanggal: [isi]',
        'Waktu: [isi]',
        'Tempat: [isi]',
        '',
        'Pemeriksaan dilakukan secara tertutup. Identitas pelapor tidak disampaikan dalam undangan ini.',
        '',
        'Ketua Satgas PPKPT',
        '[nama dan tanda tangan]',
      ].join('\n'),
    },
  ];
  if (isDependent(d.terlapor.relasi)) {
    out.push({
      judul: 'Usulan pelindungan sementara',
      isi: [
        `Kasus ${alias} · kepada Pimpinan Perguruan Tinggi`,
        '',
        `Pelapor memiliki hubungan akademik dengan terlapor (${RELASI_LABEL[d.terlapor.relasi!].toLowerCase()}). Untuk mencegah tekanan selama penanganan, Satgas mengusulkan:`,
        '- Pengalihan sementara pembimbing/penguji/penilai pelapor kepada dosen lain.',
        '- Penilaian akademik pelapor yang melibatkan terlapor ditinjau pihak lain.',
        '- Larangan sementara bagi terlapor untuk menghubungi pelapor di luar jalur resmi.',
        '',
        'Usulan ini tidak menyimpulkan kesalahan terlapor.',
        '',
        'Ketua Satgas PPKPT',
      ].join('\n'),
    });
  }
  return out;
}
