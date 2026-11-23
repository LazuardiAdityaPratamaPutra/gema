/** Eskalasi, eskalasi bersyarat, dan Bukti Pemilik di sisi klien. */
import { b64u, randomBytes } from '@gema/crypto';
import { ownerKeyFromDek, proveOwnership } from '@gema/zk';
import { api } from './api';
import type { ReporterSession } from './store';
import type { InstitutionInfo, ReportView } from './vault-types';

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
