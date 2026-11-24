/**
 * Mode Demo (FR-L1 s.d. FR-L6): institusi fiktif "Universitas Contoh", akun Satgas/Pimpinan/Auditor/Pengawas,
 * tiga pelapor fiktif dan data seed yang memperagakan alur simpan → cocokkan → eskalasi → tangani → verifikasi.
 * Semua isi fiktif. Laporan dibangun dengan kode yang sama dengan wizard klien.
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
  const kp = deriveInstitutionKey(secretSeed(), DEMO_INSTITUTION_ID);
  const fp = async (inputs: string[]) => runLocal(kp.secretKey, inputs);
  const reporters = await seedReporters(db, now);
  await seedReports(db, now, reporters, fp);
  sealAnchors(db, true, now - 2 * DAY); // anchor pertama: seluruh bukti seed
  seedCompliance(db, now);
  db.meta.seededAt = now;
  await tick(db);
}
