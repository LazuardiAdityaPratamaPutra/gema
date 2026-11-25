/**
 * Mode Demo (FR-L1 s.d. FR-L6): institusi UPN Veteran Jawa Timur dan akun peran Satgas/Pimpinan/Auditor/Pengawas
 * dengan basis data KOSONG: tidak ada pelapor, laporan, kasus, atau angka kepatuhan rekaan, supaya tidak ada
 * isi karangan yang terbaca sebagai fakta tentang kampus nyata. Alur dicoba dengan membuat brankas sendiri.
 *
 * Fixture lengkap (tiga pelapor, kasus tereskalasi, snapshot) hanya dimuat bila `GEMA_SEED_CONTOH=on`,
 * dipakai oleh pengujian otomatis, bukan oleh produk.
 */
import { deriveInstitutionKey, runLocal } from '@gema/oprf';
import { DEMO_INSTITUTION_ID } from '@/lib/demo/demo';
import { secretSeed } from '../db';
import { sealAnchors, tick } from '../logic';
import type { DB } from '../types';
import { DAY } from '../util';
import { seedCompliance } from './kepatuhan';
import { seedInstitutions } from './institusi';
import { seedReports } from './laporan';
import { seedReporters } from './pelapor';

export { checkPassword } from './password';

export async function seedDemo(db: DB) {
  const now = Date.now();
  seedInstitutions(db);
  if (process.env.GEMA_SEED_CONTOH !== 'on') {
    db.meta.seededAt = now;
    return;
  }
  db.meta.contoh = true;
  const kp = deriveInstitutionKey(secretSeed(), DEMO_INSTITUTION_ID);
  const fp = async (inputs: string[]) => runLocal(kp.secretKey, inputs);
  const reporters = await seedReporters(db, now);
  await seedReports(db, now, reporters, fp);
  sealAnchors(db, true, now - 2 * DAY); // anchor pertama: seluruh bukti seed
  seedCompliance(db, now);
  db.meta.seededAt = now;
  await tick(db);
}
