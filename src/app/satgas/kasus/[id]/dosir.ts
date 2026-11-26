import { decryptJson, fromB64u } from '@gema/crypto';
import { unwrapFromSatgas } from '@gema/pq-kem';
import { api, ApiError } from '@/lib/api';
import { AAD, AAD_CATATAN, type BuktiMeta, type Narasi } from '@/lib/laporan/report-format';
import { loadSatgasSecret } from '@/lib/vault/satgas-key';
import type { SatgasSession } from '@/lib/store';
import { kapanLabel } from '@/lib/laporan/kapan';

export type Detail = {
  escalation: {
    id: string;
    alias: string;
    sumber: string;
    status: string;
    wrapped: never;
    institutionId: string;
    prioritas?: boolean;
    penanggungJawab?: string | null;
    penanggungJawabId?: string | null;
  };
  sla: {
    due: number;
    terlambat: boolean;
    hariSisa: number | null;
    hariTerlambat: number;
    tingkat: number;
  };
  report: {
    unitNama: string;
    secrets: { narasi_ciphertext: string; bukti_meta_ciphertext: string };
    createdAt: number;
    flagFast: boolean;
  };
  evidence: {
    id: string;
    sha256: string;
    messageCount: number | null;
    ukuran: number;
    uploadedAt: number;
  }[];
  events: {
    id: string;
    at: number;
    actor: string;
    tipe: string;
    label: string;
    catatan?: string;
  }[];
  cluster: { total: number; tereskalasi: number; tersegel: number };
};

export type Loaded =
  | 'butuh-persetujuan'
  | {
      d: Detail;
      decrypted: {
        dek: Uint8Array;
        narasi: Narasi;
        meta: BuktiMeta;
        notes: Record<string, string>;
      } | null;
    };

/** Mengambil dosir lalu mendekripsinya dengan kunci Satgas di perangkat ini. Tanpa efek samping pada state. */
export async function fetchDosir(session: SatgasSession, id: string): Promise<Loaded> {
  let d: Detail;
  try {
    d = await api<Detail>(`satgas/cases/${id}`, { token: session.token });
  } catch (e) {
    if (e instanceof ApiError && e.status === 403 && e.data?.needApproval)
      return 'butuh-persetujuan';
    throw e;
  }
  const secret = loadSatgasSecret(session);
  if (!secret) return { d, decrypted: null };
  const dek = await unwrapFromSatgas(d.escalation.wrapped, secret, {
    institutionId: d.escalation.institutionId,
    escalationId: d.escalation.id,
  });
  const narasi = await decryptJson<Narasi>(
    dek,
    fromB64u(d.report.secrets.narasi_ciphertext),
    AAD.narasi,
  );
  const meta = await decryptJson<BuktiMeta>(
    dek,
    fromB64u(d.report.secrets.bukti_meta_ciphertext),
    AAD.meta,
  );
  const notes: Record<string, string> = {};
  for (const ev of d.events) {
    if (!ev.catatan) continue;
    try {
      const note = await decryptJson<{ teks: string; penulis: string }>(
        dek,
        fromB64u(ev.catatan),
        AAD_CATATAN,
      );
      notes[ev.id] = note.teks;
    } catch {
      // Catatan yang tidak bisa dibuka dilewati; sisanya tetap tampil.
    }
  }
  return { d, decrypted: { dek, narasi, meta, notes } };
}

export const STATUSES = [
  'Diterima',
  'Verifikasi',
  'Rekomendasi',
  'Tindak lanjut pimpinan',
  'Selesai',
];

/** Bahan ringkasan dan draf pendamping, diambil dari isi laporan dan metadata bukti yang sudah terbuka. */
export function assistInputOf(narasi: Narasi | null, meta: BuktiMeta | null) {
  if (!narasi || !meta) return null;
  const { terlapor } = narasi;
  return {
    apa: narasi.apa,
    kapan: kapanLabel(narasi.kapan),
    dimana: narasi.dimana,
    saksi: narasi.saksi,
    dampak: narasi.dampak,
    terlapor: {
      nama: terlapor.nama,
      unitNama: terlapor.unitNama,
      peran: terlapor.peran,
      relasi: terlapor.relasi,
    },
    bukti: meta.items.map((m) => ({ nama: m.nama, messages: m.messages })),
  };
}
