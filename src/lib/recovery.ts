/**
 * Pemulihan lewat orang tepercaya. Kunci brankas (KEK) dibungkus dengan rahasia acak R yang dipecah
 * 2-dari-3 (Shamir). Server hanya menyimpan KEK terbungkus dan hash verifikasi; ia tidak pernah melihat R.
 * Memulihkan butuh Kode Kasus DAN dua bagian dari dua orang berbeda.
 */
import {
  b64u,
  concat,
  deriveAccountKeys,
  encryptJson,
  fromB64u,
  normalizeCaseCode,
  padTo,
  randomBytes,
  sha256,
  unwrapKey,
  utf8,
  wrapKey,
} from '@gema/crypto';
import { combine, split } from '@gema/shamir';
import { api } from './api';
import { AAD, VAULT_SIZE } from './report-format';
import { reporterStore, type ReporterSession } from './store';
import type { ReportView } from './vault-client';

const PREFIX = 'GEMA-PULIH-v1';
const AAD_REC = 'gema/recovery/v1';

const checksum = (y: Uint8Array) => b64u(sha256(concat(utf8(PREFIX), y)).slice(0, 4));
const derive = (r: Uint8Array) => ({
  authKey: sha256(concat(utf8('gema/rec/auth'), r)),
  wrapKey: sha256(concat(utf8('gema/rec/wrap'), r)),
});

export function makeShares(r: Uint8Array): string[] {
  return split(r, 2, 3).map((p) => `${PREFIX}.${p.x}.${b64u(p.y)}.${checksum(p.y)}`);
}

export function secretFromShares(raw: string[]): Uint8Array {
  const parts = raw.map((t) => {
    const [prefix, x, y, sum] = t.replace(/\s+/g, '').split('.');
    if (prefix !== PREFIX || !x || !y || !sum)
      throw new Error('Bagian pemulihan tidak dikenali. Salin utuh, termasuk awalan GEMA-PULIH.');
    const bytes = fromB64u(y);
    if (checksum(bytes) !== sum)
      throw new Error('Ada salah ketik di salah satu bagian (checksum tidak cocok). Periksa lagi.');
    return { x: Number(x), y: bytes };
  });
  if (parts.length < 2) throw new Error('Butuh dua bagian dari dua orang berbeda.');
  if (new Set(parts.map((p) => p.x)).size !== parts.length)
    throw new Error('Dua bagian yang sama. Gunakan bagian dari dua orang berbeda.');
  return combine(parts);
}

/** Dipanggil saat sudah masuk ke brankas asli. Mengembalikan tiga bagian untuk dibagikan. */
export async function setupRecovery(s: ReporterSession): Promise<string[]> {
  const r = randomBytes(32);
  const k = derive(r);
  const wrappedKek = b64u(await wrapKey(k.wrapKey, fromB64u(s.kek), AAD_REC));
  await api('auth/recovery', { token: s.token, body: { authKey: b64u(k.authKey), wrappedKek } });
  return makeShares(r);
}

export const recoveryStatus = (s: ReporterSession) =>
  api<{ set: boolean; setAt: number | null }>('auth/recovery', { token: s.token });

export const clearRecovery = (s: ReporterSession) =>
  api('auth/recovery', { method: 'DELETE', token: s.token });

/** Pulihkan brankas dengan Kode Kasus + dua bagian, lalu pasang kata sandi baru. */
export async function recoverAccount(
  caseCodeRaw: string,
  shareTexts: string[],
  newPassphrase: string,
): Promise<void> {
  const caseCode = normalizeCaseCode(caseCodeRaw);
  const k = derive(secretFromShares(shareTexts));
  const start = await api<{ token: string; wrappedKek: string }>('auth/recover', {
    body: { caseCode, authKey: b64u(k.authKey) },
  });
  let oldKek: Uint8Array;
  try {
    oldKek = await unwrapKey(k.wrapKey, fromB64u(start.wrappedKek), AAD_REC);
  } catch {
    throw new Error('Bagian pemulihan tidak cocok dengan brankas ini.');
  }
  const { reports } = await api<{ reports: ReportView[] }>('me/reports', { token: start.token });
  const neu = await deriveAccountKeys(caseCode, newPassphrase);
  const deks = await Promise.all(
    reports.map(async (r) => {
      const dek = await unwrapKey(oldKek, fromB64u(r.secrets.dek_wrapped_klien), AAD.dek);
      return { reportId: r.id, wrapped: b64u(await wrapKey(neu.kek, dek, AAD.dek)) };
    }),
  );
  await api('auth/recover/finish', {
    token: start.token,
    body: {
      authKey: b64u(neu.authKey),
      vaultBlob: b64u(padTo(await encryptJson(neu.kek, { t: 'real' }, AAD.vault), VAULT_SIZE)),
      deks,
    },
  });
  await api('auth/logout', { method: 'POST', token: start.token }).catch(() => undefined);
  reporterStore.clear();
}
