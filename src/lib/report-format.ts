import type { Attributes, Role } from '@gema/matching';
import type { CanonicalMessage } from '@gema/merkle';
import type { Relasi } from '@gema/pendamping';

/** Isi laporan yang dienkripsi di perangkat. Server hanya melihat ciphertext-nya. */
export type Narasi = {
  v: 1;
  kapan: string;
  dimana: string;
  apa: string;
  saksi: string;
  bukti: string;
  dampak: string;
  terlapor: {
    nama: string;
    alias?: string;
    unitId: string;
    unitNama: string;
    peran?: Role;
    relasi?: Relasi;
  };
  atribut: Attributes;
  dibuat: string;
};

/** Metadata bukti, dienkripsi bersama laporan. Garam pesan hanya ada di sini. */
export type BuktiMeta = {
  v: 1;
  items: {
    sha256: string;
    nama: string;
    tipe: string;
    ukuran: number;
    salts?: string[]; // b64u, satu per pesan
    messages?: CanonicalMessage[];
  }[];
};

export const AAD = {
  narasi: 'gema/narasi/v1',
  meta: 'gema/meta/v1',
  evidence: 'gema/evidence/v1',
  dek: 'gema/dek/v1',
  vault: 'gema/vault/v1',
} as const;

export const VAULT_SIZE = 4096;
export const MAX_FILE = 20 * 1024 * 1024;
export const MAX_FILES = 10;

export type Vault = { t: 'real' } | { t: 'decoy'; judul: string; isi: string };

export const STATUS_LABEL: Record<string, string> = {
  tersimpan: 'Tersimpan, hanya kamu yang bisa membaca',
  tereskalasi: 'Dieskalasi ke Satgas',
};

export const AAD_CATATAN = 'gema/catatan/v1';
