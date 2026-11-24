import type { LocationKind, Role } from '@gema/matching';
import type { Relasi } from '@gema/pendamping';
import { clearDraft, type Draft } from '@/lib/laporan/drafts';
import type { FileInput } from '@/lib/laporan/report-build';
import type { ReporterSession } from '@/lib/store';
import { island } from '@/lib/ui/island-bus';
import { submitReport, type InstitutionInfo } from '@/lib/vault/vault-client';

export type UnitInfo = InstitutionInfo['units'][number];

/** Mengunci laporan dari draf, lalu menghapus draf. Mengembalikan id laporan. */
export async function sendReport(
  session: ReporterSession,
  inst: InstitutionInfo,
  unit: UnitInfo,
  d: Draft,
  files: FileInput[],
): Promise<string> {
  const atribut = {
    role: d.peran as Role,
    location: d.lokasi as LocationKind,
    periods: d.periode
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean),
  };
  const id = await submitReport(
    session,
    {
      inst,
      k: d.k,
      files,
      attrs: atribut,
      narasi: {
        kapan: d.kapan,
        dimana: d.dimana,
        apa: d.apa,
        saksi: d.saksi,
        bukti: d.bukti,
        dampak: d.dampak,
        terlapor: {
          nama: d.nama.trim(),
          alias: d.alias.trim() || undefined,
          unitId: unit.id,
          unitNama: unit.nama,
          peran: d.peran as Role,
          relasi: (d.relasi || undefined) as Relasi | undefined,
        },
        atribut,
      },
    },
    (label, done, total) => island.progress(label, done, total),
  );
  await clearDraft(session.caseCode, 'baru');
  return id;
}

/** Pesan galat saat penguncian gagal; menegaskan bahwa isian dan draf tidak hilang. */
export function sendFailMessage(e: unknown): string {
  const dasar = e instanceof Error ? e.message : 'Gagal mengunci laporan.';
  return `${dasar} Laporanmu belum terkunci, tetapi isianmu masih ada di layar dan draf tidak hilang. Coba lagi sebentar lagi.`;
}
