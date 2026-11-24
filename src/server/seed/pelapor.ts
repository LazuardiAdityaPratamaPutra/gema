import {
  authHash,
  b64u,
  deriveAccountKeys,
  encryptJson,
  normalizeCaseCode,
  padTo,
  randomBytes,
} from '@gema/crypto';
import { DEMO_ACCOUNTS } from '@/lib/demo/demo';
import { AAD, VAULT_SIZE } from '@/lib/laporan/report-format';
import type { DB } from '../types';
import { DAY, uid } from '../util';

export type SeedReporter = { id: string; kek: Uint8Array; scope: string };

/** Akun pelapor fiktif; slot kedua selalu ada dan urutannya diacak. */
export async function seedReporters(db: DB, now: number): Promise<Record<string, SeedReporter>> {
  const reporters: Record<string, { id: string; kek: Uint8Array; scope: string }> = {};
  for (const a of DEMO_ACCOUNTS) {
    const keys = await deriveAccountKeys(a.caseCode, a.passphrase);
    const id = uid(10);
    db.reporters[id] = { id, case_code: normalizeCaseCode(a.caseCode), created_at: now - 12 * DAY };
    const real = {
      slot_id: uid(8),
      reporter_id: id,
      scope_id: uid(10),
      auth_hash: authHash(keys.authKey),
      vault_blob: b64u(padTo(await encryptJson(keys.kek, { t: 'real' }, AAD.vault), VAULT_SIZE)),
    };
    const empty = {
      slot_id: uid(8),
      reporter_id: id,
      scope_id: uid(10),
      auth_hash: authHash(randomBytes(32)),
      vault_blob: b64u(randomBytes(VAULT_SIZE)),
    };
    // urutan acak: tidak ada petunjuk slot mana yang nyata
    const order = randomBytes(1)[0] & 1 ? [real, empty] : [empty, real];
    db.slots.push(...order);
    reporters[a.key] = { id, kek: keys.kek, scope: real.scope_id };
  }
  return reporters;
}
