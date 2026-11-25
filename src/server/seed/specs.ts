/** Isi laporan fiktif untuk Mode Demo. Semua nama dan peristiwa rekaan. */
import type { Relasi } from '@gema/pendamping';
import type { Escalation } from '../types';
import { DEMO_CHAT, DEMO_NOTE_SAKSI } from '@/lib/demo/demo';

export type Spec = {
  nama: string;
  unitId: string;
  unitNama: string;
  peran?: 'dosen' | 'tendik' | 'mahasiswa' | 'lainnya';
  attrs: {
    role?: 'dosen' | 'tendik' | 'mahasiswa' | 'lainnya';
    periods?: string[];
    location?: 'kampus' | 'daring' | 'luar-kampus';
  };
  teks: {
    kapan: string;
    dimana: string;
    apa: string;
    saksi: string;
    bukti: string;
    dampak: string;
  };
  files: { nama: string; tipe: string; text: string; chat?: boolean }[];
  ageDays: number;
  escalate?: {
    daysAgo: number;
    status: Escalation['status'];
    mode: 'tunggal' | 'bersama';
    prioritas?: boolean;
  };
  relasi?: Relasi;
};

export const SPECS: Record<string, Spec[]> = {
  maya: [
    {
      nama: 'Dr. Hendra Wijaya, M.T.',
      unitId: 'u-ft',
      unitNama: 'Fakultas Teknik dan Sains',
      attrs: { role: 'dosen', periods: ['2026/2027-ganjil'], location: 'kampus' },
      teks: {
        kapan: 'Akhir Oktober sampai awal November 2026.',
        dimana: 'Pesan WhatsApp dan ruang dosen di gedung Fakultas Teknik.',
        apa: 'Dosen pembimbing berulang kali meminta saya datang sendirian malam hari ke ruangannya dan menahan nilai bila saya menolak. Saya diminta merahasiakannya.',
        saksi: 'Seorang teman melihat saya keluar dari ruang dosen malam itu.',
        bukti: 'Ekspor chat WhatsApp 31 Oktober sampai 1 November.',
        dampak: 'Saya jadi takut bimbingan dan menunda skripsi.',
      },
      files: [{ nama: 'chat-bimbingan.txt', tipe: 'text/plain', text: DEMO_CHAT, chat: true }],
      ageDays: 9,
    },
  ],
  rafi: [
    {
      nama: 'Hendra Wijaya',
      unitId: 'u-ft',
      unitNama: 'Fakultas Teknik dan Sains',
      attrs: { role: 'dosen', location: 'kampus' },
      teks: {
        kapan: 'Sekitar 2 November 2026, malam hari.',
        dimana: 'Lorong lantai 3 gedung Fakultas Teknik.',
        apa: 'Saya melihat seorang mahasiswi keluar dari ruang dosen dalam keadaan menangis. Dosen tersebut berdiri di pintu dan menutupnya.',
        saksi: 'Tidak ada saksi lain yang saya ketahui.',
        bukti: 'Catatan pribadi saya.',
        dampak: 'Saya khawatir tetapi tidak ingin dihubungi balik.',
      },
      files: [{ nama: 'catatan-saksi.txt', tipe: 'text/plain', text: DEMO_NOTE_SAKSI }],
      ageDays: 5,
    },
  ],
  dewa: [
    {
      nama: 'Bambang Haryono',
      unitId: 'u-fisip',
      unitNama: 'Fakultas Ilmu Sosial, Budaya, dan Politik',
      attrs: { role: 'tendik' },
      teks: {
        kapan: 'Sekitar sebulan lalu.',
        dimana: 'Ruang administrasi fakultas.',
        apa: 'Petugas administrasi mengancam tidak memproses berkas saya bila saya tidak menuruti permintaannya yang membuat saya tidak nyaman. (Data fiktif untuk demo.)',
        saksi: 'Tidak ada.',
        bukti: 'Tidak ada berkas.',
        dampak: 'Saya menunda pengurusan administrasi.',
      },
      files: [
        {
          nama: 'catatan-pribadi.txt',
          tipe: 'text/plain',
          text: 'Catatan pribadi fiktif untuk demo. Tidak berisi data sungguhan.',
        },
      ],
      ageDays: 20,
      escalate: { daysAgo: 16, status: 'Verifikasi', mode: 'tunggal' },
    },
    {
      nama: 'Rina Kusuma',
      unitId: 'u-feb',
      unitNama: 'Fakultas Ekonomi dan Bisnis',
      attrs: { role: 'dosen' },
      teks: {
        kapan: 'Dua pekan lalu.',
        dimana: 'Ruang rapat jurusan.',
        apa: 'Dosen pengampu saya berulang kali berkomentar soal badan saya di depan peserta rapat. Setelah itu dia mengirim pesan jangan bilang siapa-siapa, nilaimu saya urus. (Data fiktif untuk demo.)',
        saksi: 'Beberapa peserta rapat.',
        bukti: 'Tidak ada.',
        dampak: 'Saya merasa tidak aman hadir pada rapat berikutnya.',
      },
      files: [
        {
          nama: 'chat-dosen.txt',
          tipe: 'text/plain',
          chat: true,
          text: '05/11/2026 22.41 - Dosen R: Tadi di rapat kamu cantik banget, bajumu pas di badan kamu\n05/11/2026 22.43 - Saya: Maaf Bu, saya kurang nyaman\n05/11/2026 23.02 - Dosen R: Jangan bilang siapa-siapa ya, nilaimu saya urus\n06/11/2026 08.10 - Dosen R: Besok datang sendiri ke ruangan saya jam 7 malam\n',
        },
      ],
      ageDays: 4,
      escalate: { daysAgo: 2, status: 'Diterima', mode: 'tunggal', prioritas: true },
      relasi: 'pengajar',
    },
  ],
};
