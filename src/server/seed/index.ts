/**
 * Mode Demo (FR-L1 s.d. FR-L6): institusi UPN Veteran Jawa Timur dan akun peran Satgas/Pimpinan/Auditor/Pengawas.
 *
 * Data contoh (tiga pelapor fiktif, kasus tereskalasi, snapshot kepatuhan) dimuat bila Mode Demo aktif, kecuali
 * `GEMA_SEED_CONTOH=off`. `GEMA_SEED_CONTOH=on` memaksanya (dipakai pengujian). Bila demo mati, basis data kosong.
 * Semua isi contoh fiktif dan diberi label "Mode demo" di antarmuka.
 */
import { deriveInstitutionKey, runLocal } from '@gema/oprf';
import { DEMO_INSTITUTION_ID } from '@/lib/demo/demo';
import { demoEnabled } from '../demo-flag';
import { secretSeed } from '../db';
import { sealAnchors, tick } from '../logic';
import type { DB } from '../types';
import { DAY } from '../util';
import { seedCompliance } from './kepatuhan';
import { seedInstitusiSungguhan } from './admin';
import { seedInstitutions } from './institusi';
import { seedReports } from './laporan';
import { seedReporters } from './pelapor';

export { checkPassword } from './password';
export { provisionAdmin } from './admin';

export async function seedDemo(db: DB) {
  const now = Date.now();
  // Mode sungguhan: institusi asli tanpa data rekaan, apa pun nilai GEMA_SEED_CONTOH.
  if (!demoEnabled()) {
    seedInstitusiSungguhan(db);
    db.meta.seededAt = now;
    return;
  }
  seedInstitutions(db);
  if (process.env.GEMA_SEED_CONTOH === 'off') {
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
