import crypto from 'node:crypto';
import { DEMO_INSTITUTION_ID, DEMO_MEMBERS, DEMO_PASSWORD, DEMO_UNITS } from '@/lib/demo/demo';
import { DEMO_SATGAS_PUBLIC } from '@/lib/demo/demo-keys';
import { demoEnabled } from '../demo-flag';
import type { DB } from '../types';
import { uid } from '../util';
import { hashPassword } from './password';

/** Institusi fiktif, unit, rujukan, dan akun Satgas demo. */
export function seedInstitutions(db: DB) {
  const inst = DEMO_INSTITUTION_ID;
  db.institutions[inst] = {
    id: inst,
    nama: 'Universitas Contoh',
    kota: 'Kota Fiktif',
    demo: true,
    public_key_satgas: DEMO_SATGAS_PUBLIC,
    sla_hari: 3, // Permendikbudristek 55/2024 Pasal 53: laporan ditindaklanjuti paling lambat 3 hari kerja
    fp_mode: 'oprf',
    papan_publik: true,
    ambang_tangga: { t1: 0, t2: 3, t3: 10 },
    dp_epsilon: 1,
    panel_mode: 'tunggal',
    rujukan: [
      {
        nama: 'Unit Layanan Psikologi Universitas Contoh',
        jenis: 'psikolog',
        kontak: 'Gedung Rektorat lt. 2 · ext. 2210 (fiktif)',
        catatan: 'Gratis untuk mahasiswa dan pegawai',
      },
      {
        nama: 'Lembaga Konsultasi Bantuan Hukum Fakultas Hukum',
        jenis: 'hukum',
        kontak: 'lkbh@contoh.ac.id (fiktif)',
        catatan: 'Pendampingan hukum tanpa biaya',
      },
      { nama: 'Klinik Pratama Kampus', jenis: 'medis', kontak: 'Gedung Klinik · 24 jam (fiktif)' },
    ],
  };
  // Institusi fiktif lain hanya untuk memperagakan Papan Kepatuhan (tanpa unit → tidak bisa dipilih pelapor)
  for (const [id, nama, kota] of [
    ['inst-poli', 'Politeknik Contoh Nusantara', 'Kota Fiktif B'],
    ['inst-itc', 'Institut Teknologi Contoh', 'Kota Fiktif C'],
  ] as const) {
    db.institutions[id] = { ...db.institutions[inst], id, nama, kota, fp_mode: 'hmac' };
  }
  for (const u of DEMO_UNITS) db.units.push({ ...u, institution_id: inst });

  for (const m of DEMO_MEMBERS) {
    const id = uid(6);
    db.members[id] = {
      id,
      institution_id: inst,
      email: m.email,
      nama: m.nama,
      role: m.role,
      // kata sandi publik hanya bila demo aktif; selain itu acak sehingga tidak ada kredensial yang diketahui umum
      pass_hash: hashPassword(
        demoEnabled() ? DEMO_PASSWORD : crypto.randomBytes(18).toString('hex'),
      ),
    };
  }
}
