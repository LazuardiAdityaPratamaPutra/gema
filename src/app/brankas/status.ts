import type { ReportView } from '@/lib/vault/vault-client';

export type Tone = 'saved' | 'esc' | 'late' | 'done';

/** Keadaan satu laporan di daftar brankas: tahap (0 disimpan, 1 di Satgas, 2 selesai), nada, dan petunjuk. */
export function fileStatus(r: Pick<ReportView, 'escalation' | 'match'>): {
  step: 0 | 1 | 2;
  tone: Tone;
  next: { t: string; s: string };
} {
  const e = r.escalation;
  if (!e)
    return {
      step: 0,
      tone: 'saved',
      next: r.match.notify
        ? NEXT_MATCH
        : { t: 'Hanya kamu yang bisa membaca', s: 'Tambah bukti, atau eskalasi saat siap' },
    };
  const selesai = e.sla.status === 'Selesai';
  const tone: Tone = selesai ? 'done' : e.sla.terlambat ? 'late' : 'esc';
  const next = r.match.notify ? NEXT_MATCH : escalatedNext(e, selesai);
  return { step: selesai ? 2 : 1, tone, next };
}

const NEXT_MATCH = {
  t: 'Ada laporan lain tentang terlapor yang sama',
  s: 'Buka untuk melihat, tanpa identitas siapa pun',
};

function escalatedNext(e: NonNullable<ReportView['escalation']>, selesai: boolean) {
  if (selesai) return { t: 'Penanganan selesai', s: 'Riwayat tetap tersimpan di sini' };
  if (e.sla.terlambat)
    return {
      t: `Satgas terlambat ${e.sla.hariTerlambat} hari kerja`,
      s: `Sudah diteruskan ke tingkat ${e.sla.tingkat}`,
    };
  return {
    t: `Tenggat Satgas: ${e.sla.hariSisa ?? 0} hari kerja lagi`,
    s: `Status ${e.sla.status.toLowerCase()}`,
  };
}
