import crypto from 'node:crypto';
import { DEMO_INSTITUTION_ID, DEMO_MEMBERS, DEMO_PASSWORD, DEMO_UNITS } from '@/lib/demo/demo';
import { DEMO_SATGAS_PUBLIC } from '@/lib/demo/demo-keys';
import { demoEnabled } from '../demo-flag';
import type { DB, Institution } from '../types';
import { uid } from '../util';
import { hashPassword } from './password';

/** Rujukan kampus. Kontak Satgas berasal dari profil WhatsApp Bisnis resminya (diberikan pengelola, 25 Nov 2026). */
export const RUJUKAN_UPN: NonNullable<Institution['rujukan']> = [
  {
    nama: 'Satgas PPKS UPN "Veteran" Jawa Timur',
    jenis: 'lainnya',
    kontak: 'WhatsApp +62 896-7509-8855, surel ppks@upnjatim.ac.id',
    catatan: 'tercantum buka 24 jam',
  },
];

/** Institusi (UPN Veteran Jawa Timur), unit, rujukan, dan akun Satgas demo. Tidak memuat laporan atau kasus. */
export function seedInstitutions(db: DB) {
  const inst = DEMO_INSTITUTION_ID;
  db.institutions[inst] = {
    id: inst,
    nama: 'UPN Veteran Jawa Timur',
    kota: 'Surabaya',
    demo: true,
    public_key_satgas: DEMO_SATGAS_PUBLIC,
    sla_hari: 3, // Permendikbudristek 55/2024 Pasal 53: laporan ditindaklanjuti paling lambat 3 hari kerja
    fp_mode: 'oprf',
    papan_publik: true,
    ambang_tangga: { t1: 0, t2: 3, t3: 10 },
    dp_epsilon: 1,
    panel_mode: 'tunggal',
    rujukan: RUJUKAN_UPN,
  };
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
