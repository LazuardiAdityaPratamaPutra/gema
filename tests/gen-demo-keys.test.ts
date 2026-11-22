// Pembuat kunci demo satu kali. Jalankan: GEN_DEMO_KEYS=1 npx vitest run tests/gen-demo-keys
import { writeFileSync, existsSync } from 'node:fs';
import { it } from 'vitest';
import { generateHybridKeypair } from '@gema/pq-kem';

const target = new URL('../src/lib/demo-keys.ts', import.meta.url);

it.runIf(process.env.GEN_DEMO_KEYS === '1' || !existsSync(target))(
  'menghasilkan kunci demo Satgas',
  () => {
    const kp = generateHybridKeypair();
    writeFileSync(
      target,
      `/**
 * KUNCI DEMO — SENGAJA PUBLIK (FR-L2).
 * Dipakai hanya oleh institusi fiktif "Universitas Contoh" agar juri dapat membuka dosir tanpa mengurus berkas kunci.
 * Jangan pernah dipakai untuk institusi nyata. Kunci institusi nyata dibuat di browser Ketua Satgas (FR-K1).
 * Dibuat oleh tests/gen-demo-keys.test.ts
 */
import type { HybridPublicKey, HybridSecretKey } from '@gema/pq-kem';

export const DEMO_SATGAS_PUBLIC: HybridPublicKey = ${JSON.stringify(kp.publicKey)};
export const DEMO_SATGAS_SECRET: HybridSecretKey = ${JSON.stringify(kp.secretKey)};
`,
    );
  },
);
