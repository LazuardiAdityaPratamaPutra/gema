/**
 * Empat Mata untuk kunci Satgas: kunci rahasia dipecah 2-dari-3 (Shamir), tiga bagian dipegang tiga orang.
 * Satu bagian saja tidak memberi informasi apa pun; dua bagian mana pun merakit ulang kunci di tab ini.
 */
import { b64u, concat, fromB64u, sha256, utf8 } from '@gema/crypto';
import { combine, split } from '@gema/shamir';
import type { HybridSecretKey } from '@gema/pq-kem';

const PREFIX = 'GEMA-KUNCI-v1';

const checksum = (y: Uint8Array) => b64u(sha256(concat(utf8(PREFIX), y)).slice(0, 4));

export function splitSatgasSecret(institutionId: string, secret: HybridSecretKey): string[] {
  const bytes = utf8(JSON.stringify(secret));
  return split(bytes, 2, 3).map(
    (p) => `${PREFIX}.${p.x}.${institutionId}.${b64u(p.y)}.${checksum(p.y)}`,
  );
}

type Parsed = { x: number; institutionId: string; y: Uint8Array };

function parsePart(raw: string): Parsed {
  const [prefix, x, institutionId, y, sum] = raw.trim().split('.');
  if (prefix !== PREFIX || !x || !institutionId || !y || !sum)
    throw new Error('Bagian kunci tidak dikenali. Pastikan berkas utuh dan dari Gema.');
  const bytes = fromB64u(y);
  if (checksum(bytes) !== sum)
    throw new Error('Bagian kunci rusak (checksum tidak cocok). Salin ulang dari berkas aslinya.');
  return { x: Number(x), institutionId, y: bytes };
}

export function combineSatgasSecret(rawParts: string[], institutionId: string): HybridSecretKey {
  const parts = rawParts.map(parsePart);
  if (parts.length < 2) throw new Error('Butuh dua bagian kunci dari dua orang berbeda.');
  if (parts.some((p) => p.institutionId !== institutionId))
    throw new Error('Ada bagian kunci milik kampus lain.');
  if (new Set(parts.map((p) => p.x)).size !== parts.length)
    throw new Error('Dua bagian yang sama. Gunakan bagian dari dua orang berbeda.');
  let secret: HybridSecretKey;
  try {
    secret = JSON.parse(
      new TextDecoder().decode(combine(parts.map((p) => ({ x: p.x, y: p.y })))),
    ) as HybridSecretKey;
  } catch {
    throw new Error(
      'Bagian kunci tidak berpasangan. Periksa bahwa semuanya dari pembagian yang sama.',
    );
  }
  if (secret.suite !== 'ecdh-p256+mlkem768-v1' || !secret.ecdh || !secret.mlkem)
    throw new Error(
      'Bagian kunci tidak berpasangan. Periksa bahwa semuanya dari pembagian yang sama.',
    );
  return secret;
}
