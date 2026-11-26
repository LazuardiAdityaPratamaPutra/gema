/**
 * Skema isi permintaan untuk setiap rute yang membaca JSON.
 * Bentuk dan tipe mengikuti parameter fungsi di `logic`; aturan isi (panjang kunci, format kode,
 * batas jumlah) tetap diperiksa di sana agar pesan galatnya tidak berubah.
 */
import { z } from 'zod';

/** Nilai pendek: kode, id, dan kunci. */
const short = z.string().max(512);
/** Nilai panjang: ciphertext dan blob base64url. */
const long = z.string().max(1_000_000);

const wrappedKey = z.object({
  suite: short,
  ctEcdh: long,
  ctMlkem: long,
  blob: long,
});

export const registerBody = z.object({
  caseCode: short,
  slots: z.array(z.object({ authKey: short, vaultBlob: long })).max(8),
});

export const loginBody = z.object({ caseCode: short, authKey: short });

export const decoyBody = z.object({ authKey: short.nullable(), vaultBlob: long });

export const passkeySetBody = z.object({
  credId: short,
  salt: short,
  authKey: short,
  wrappedKek: long,
});

export const caseCodeBody = z.object({ caseCode: short });

export const recoverySetBody = z.object({ authKey: short, wrappedKek: long });

export const recoverFinishBody = z.object({
  authKey: short,
  vaultBlob: long,
  deks: z.array(z.object({ reportId: short, wrapped: long })).max(100),
});

export const oprfBody = z.object({
  institutionId: short,
  draftId: short,
  blinded: z.array(short).max(1000),
});

export const hmacBody = z.object({
  institutionId: short,
  draftId: short,
  inputs: z.array(short).max(1000),
});

const varianEnum = z.enum(['V1', 'V2', 'V3', 'V4', 'W1', 'W2', 'S1', 'S2', 'S3']);
const tingkatEnum = z.enum(['kuat', 'lemah', 'penguat']);

export const createReportBody = z.object({
  institutionId: short,
  unitId: short,
  k: z.number(),
  secrets: z.object({
    narasi_ciphertext: long,
    dek_wrapped_klien: long,
    bukti_meta_ciphertext: long,
  }),
  ownerPub: short.optional(),
  fingerprints: z
    .array(z.object({ varian: varianEnum, tingkat: tingkatEnum, fp: short }))
    .max(5000),
  evidence: z
    .array(
      z.object({
        clientId: short,
        sha256: short,
        messageRoot: short.nullable(),
        messageCount: z.number().nullable(),
        tipe: short,
      }),
    )
    .max(50),
});

export const settingsBody = z.object({
  k: z.number().optional(),
  includeWeak: z.boolean().optional(),
  optIn: z.boolean().optional(),
});

export const escalateBody = z.object({
  escalationId: short,
  mode: z.enum(['bersama', 'tunggal']),
  wrapped: wrappedKey,
  prioritas: z.boolean().optional(),
});

export const conditionalBody = z.object({
  escalationId: short,
  wrapped: wrappedKey,
  minSize: z.number(),
  prioritas: z.boolean().optional(),
});

export const ownerBody = z.object({ ownerPub: short.optional() });

export const satgasLoginBody = z.object({
  email: short.optional(),
  password: short.optional(),
  demoRole: short.optional(),
});

export const panelBody = z.object({ mode: short.optional() });

export const assignBody = z.object({ memberId: short.nullable().optional() });

export const statusBody = z.object({ to: short });

export const noteBody = z.object({ catatan_ciphertext: long });

export const verifyOwnerBody = z.object({ challenge: short, proof: long });

/** Kunci publik hibrida: ECDH P-256 (44 huruf) dan ML-KEM-768 (1579 huruf), jadi bagian ML-KEM tidak boleh `short`. */
export const replaceKeyBody = z.object({
  publicKey: z
    .object({
      suite: short.optional(),
      ecdh: short.optional(),
      mlkem: z.string().max(4096).optional(),
    })
    .optional(),
});

export const advanceBody = z.object({ days: z.number().optional() });

export const commitRefBody = z.object({ date: short.optional(), commitRef: short.optional() });
