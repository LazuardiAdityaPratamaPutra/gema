/** Logika klien pelapor: akun anonim, enkripsi laporan, Jembatan Buta, eskalasi, Kode Paksa. Semua kunci hanya ada di perangkat. */
import {
  aesGcmDecrypt,
  authHash,
  b64u,
  decryptJson,
  deriveAccountKeys,
  encryptJson,
  fromB64u,
  generateCaseCode,
  padTo,
  randomBytes,
  unpad,
  unwrapKey,
  utf8,
} from '@gema/crypto';
import type { Attributes } from '@gema/matching';
import { ownerKeyFromDek, proveOwnership } from '@gema/zk';
import { api } from './api';
import { AAD, VAULT_SIZE, type BuktiMeta, type Narasi, type Vault } from './report-format';
import { buildReport, type FileInput, type FpFn } from './report-build';
import { reporterStore, type ReporterSession } from './store';

export type InstitutionInfo = {
  id: string;
  nama: string;
  kota: string;
  demo: boolean;
  fpMode: 'oprf' | 'hmac';
  slaHari: number;
  publicKey: { suite: string; ecdh: string; mlkem: string };
  units: { id: string; nama: string; tipe: string }[];
  rujukan?: {
    nama: string;
    jenis: 'psikolog' | 'hukum' | 'medis' | 'pendamping' | 'lainnya';
    kontak: string;
    catatan?: string;
  }[];
};

export type EvidenceView = {
  id: string;
  sha256: string;
  messageRoot: string | null;
  messageCount: number | null;
  ukuran: number;
  tipe: string;
  uploadedAt: number;
  blobReady: boolean;
  anchored: boolean;
};
export type SlaView = {
  status: string;
  due: number;
  escalated: number;
  hariSisa: number | null;
  hariTerlambat: number;
  tingkat: number;
  terlambat: boolean;
  h2: boolean;
};
export type ReportView = {
  id: string;
  institutionId: string;
  institutionNama: string;
  demo: boolean;
  unitId: string;
  unitNama: string;
  status: 'tersimpan' | 'tereskalasi';
  k: number;
  includeWeak: boolean;
  optIn: boolean;
  hasOwnerKey: boolean;
  conditional: null | { minSize: number; prioritas: boolean };
  createdAt: number;
  secrets: { narasi_ciphertext: string; dek_wrapped_klien: string; bukti_meta_ciphertext: string };
  evidence: EvidenceView[];
  match: {
    notify: boolean;
    size: number | null;
    confidence: 'rendah' | 'sedang' | 'tinggi' | null;
    weak: number | null;
    optedIn: number;
    flagFast: boolean;
  };
  escalation: null | {
    id: string;
    alias: string;
    sumber: string;
    escalatedAt: number;
    opened: boolean;
    sla: SlaView;
    events: { at: number; label: string; actor: string }[];
    ladder: { tingkat: number; at: number }[];
  };
};

export async function newCredentials(): Promise<{ caseCode: string; passphrase: string }> {
  const { generatePassphrase } = await import('@gema/passphrase');
  return { caseCode: generateCaseCode(), passphrase: generatePassphrase() };
}

async function vaultBlobFor(kek: Uint8Array, vault: Vault): Promise<string> {
  return b64u(padTo(await encryptJson(kek, vault, AAD.vault), VAULT_SIZE));
}

export async function registerAccount(caseCode: string, passphrase: string): Promise<void> {
  const keys = await deriveAccountKeys(caseCode, passphrase);
  const real = {
    authKey: b64u(keys.authKey),
    vaultBlob: await vaultBlobFor(keys.kek, { t: 'real' }),
  };
  // Slot kedua selalu ada; bila Kode Paksa tidak dipasang, isinya acak seukuran. Urutan diacak.
  const empty = { authKey: b64u(randomBytes(32)), vaultBlob: b64u(randomBytes(VAULT_SIZE)) };
  const slots = randomBytes(1)[0] & 1 ? [real, empty] : [empty, real];
  await api('auth/register', { body: { caseCode, slots } });
}

export async function login(caseCode: string, passphrase: string): Promise<ReporterSession> {
  const keys = await deriveAccountKeys(caseCode, passphrase);
  const r = await api<{ token: string; scopeId: string; vaultBlob: string }>('auth/login', {
    body: { caseCode, authKey: b64u(keys.authKey) },
  });
  const vault = await decryptJson<Vault>(keys.kek, unpad(fromB64u(r.vaultBlob)), AAD.vault);
  const session: ReporterSession = {
    token: r.token,
    scopeId: r.scopeId,
    kek: b64u(keys.kek),
    caseCode: caseCode.toUpperCase().replace(/[^A-Z0-9]/g, ''),
    vault,
  };
  reporterStore.set(session);
  return session;
}

export async function logout(token?: string) {
  if (token) await api('auth/logout', { method: 'POST', token }).catch(() => undefined);
  reporterStore.clear();
}

export const listReports = (s: ReporterSession) =>
  api<{ reports: ReportView[] }>('me/reports', { token: s.token }).then((r) => r.reports);

export async function openReport(
  s: ReporterSession,
  r: ReportView,
): Promise<{ dek: Uint8Array; narasi: Narasi; meta: BuktiMeta }> {
  const dek = await unwrapKey(fromB64u(s.kek), fromB64u(r.secrets.dek_wrapped_klien), AAD.dek);
  const narasi = await decryptJson<Narasi>(dek, fromB64u(r.secrets.narasi_ciphertext), AAD.narasi);
  const meta = await decryptJson<BuktiMeta>(
    dek,
    fromB64u(r.secrets.bukti_meta_ciphertext),
    AAD.meta,
  );
  return { dek, narasi, meta };
}

export async function downloadEvidence(
  s: ReporterSession,
  evidenceId: string,
  dek: Uint8Array,
): Promise<Uint8Array> {
  const blob = await api<Uint8Array>(`evidence/${evidenceId}/blob`, { token: s.token });
  return aesGcmDecrypt(dek, blob, AAD.evidence);
}

/** Jembatan Buta: nama disamarkan di perangkat; server hanya mengevaluasi titik tersamar. Mode HMAC = cadangan berlabel. */
export function fingerprintFn(s: ReporterSession, inst: InstitutionInfo, draftId: string): FpFn {
  if (inst.fpMode === 'hmac') {
    return async (inputs) =>
      (
        await api<{ fps: string[] }>('fp/hmac', {
          token: s.token,
          body: { institutionId: inst.id, draftId, inputs },
        })
      ).fps;
  }
  return async (inputs) => {
    const { blindInputs, finalizeInputs } = await import('@gema/oprf');
    const { toHex } = await import('@gema/crypto');
    const blinded = blindInputs(inputs);
    const r = await api<{ evaluated: string[] }>('oprf/evaluate', {
      token: s.token,
      body: { institutionId: inst.id, draftId, blinded: blinded.map((b) => toHex(b.blinded)) },
    });
    return finalizeInputs(blinded, r.evaluated);
  };
}

export type SubmitInput = {
  inst: InstitutionInfo;
  narasi: Parameters<typeof buildReport>[0]['narasi'];
  attrs: Attributes;
  files: FileInput[];
  k: number;
};

export async function submitReport(
  s: ReporterSession,
  input: SubmitInput,
  onStep: (label: string, done?: number, total?: number) => void,
): Promise<string> {
  onStep('Mengunci laporan di perangkatmu…');
  const draftId = b64u(randomBytes(9));
  const built = await buildReport({
    kek: fromB64u(s.kek),
    narasi: input.narasi,
    attrs: input.attrs,
    files: input.files,
    fp: async (inputs) => {
      onStep(
        input.inst.fpMode === 'oprf'
          ? 'Menyamarkan nama terlapor di perangkatmu…'
          : 'Menghitung sidik pencocokan…',
      );
      return fingerprintFn(s, input.inst, draftId)(inputs);
    },
  });
  onStep('Mengirim data yang sudah terkunci…');
  const res = await api<{ reportId: string; evidence: { clientId: string; id: string }[] }>(
    'reports',
    {
      token: s.token,
      body: {
        institutionId: input.inst.id,
        unitId: input.narasi.terlapor.unitId,
        k: input.k,
        ownerPub: ownerKeyFromDek(built.dek).publicKey,
        secrets: built.secrets,
        fingerprints: built.fingerprints,
        evidence: built.evidence.map(({ blob: _b, ...m }) => m),
      },
    },
  );
  let n = 0;
  for (const e of res.evidence) {
    const ev = built.evidence.find((x) => x.clientId === e.clientId)!;
    onStep('Mengunggah berkas terenkripsi…', n, built.evidence.length);
    await api(`evidence/${e.id}/blob`, { method: 'PUT', token: s.token, raw: ev.blob });
    n++;
  }
  onStep('Selesai', n, built.evidence.length);
  return res.reportId;
}

export async function escalateReport(
  s: ReporterSession,
  r: ReportView,
  dek: Uint8Array,
  inst: InstitutionInfo,
  mode: 'tunggal' | 'bersama',
  prioritas = false,
) {
  const { wrapForSatgas } = await import('@gema/pq-kem');
  const escalationId = b64u(randomBytes(9));
  const wrapped = await wrapForSatgas(dek, inst.publicKey, {
    institutionId: inst.id,
    escalationId,
  });
  return api<{ ok: true; alias: string; due: number }>(`reports/${r.id}/escalate`, {
    token: s.token,
    body: { escalationId, mode, wrapped, prioritas },
  });
}

/** Eskalasi Bersyarat: kunci dibungkus untuk Satgas sekarang, tetapi baru dikirim bila cukup pelapor cocok. */
export async function setConditionalEscalation(
  s: ReporterSession,
  r: ReportView,
  dek: Uint8Array,
  inst: InstitutionInfo,
  minSize: number,
  prioritas = false,
) {
  const { wrapForSatgas } = await import('@gema/pq-kem');
  const escalationId = b64u(randomBytes(9));
  const wrapped = await wrapForSatgas(dek, inst.publicKey, {
    institutionId: inst.id,
    escalationId,
  });
  return api<{ fired: boolean }>(`reports/${r.id}/bersyarat`, {
    token: s.token,
    body: { escalationId, wrapped, minSize, prioritas },
  });
}

export const clearConditionalEscalation = (s: ReporterSession, r: ReportView) =>
  api(`reports/${r.id}/bersyarat`, { method: 'DELETE', token: s.token });

/** Bukti Pemilik: membuktikan memegang kunci laporan tanpa membukanya. Laporan lama mendaftarkan kunci dulu. */
export async function makeOwnerProof(
  s: ReporterSession,
  r: ReportView,
  dek: Uint8Array,
  alias: string,
  challenge: string,
): Promise<string> {
  const key = ownerKeyFromDek(dek);
  if (!r.hasOwnerKey)
    await api(`reports/${r.id}/owner`, { token: s.token, body: { ownerPub: key.publicKey } });
  return proveOwnership(key, `${alias}|${challenge.trim()}`);
}

export async function setKodePaksa(
  s: ReporterSession,
  decoyPassphrase: string,
  judul: string,
  isi: string,
) {
  const keys = await deriveAccountKeys(s.caseCode, decoyPassphrase);
  await api('auth/decoy', {
    token: s.token,
    body: {
      authKey: b64u(keys.authKey),
      vaultBlob: await vaultBlobFor(keys.kek, { t: 'decoy', judul, isi }),
    },
  });
}

export async function removeKodePaksa(s: ReporterSession) {
  await api('auth/decoy', {
    token: s.token,
    body: { authKey: null, vaultBlob: b64u(randomBytes(VAULT_SIZE)) },
  });
}

export const demoNote = utf8('');
void authHash;
