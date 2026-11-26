import type { DB } from '../types';
import { DAY } from '../util';

/** Batas sebelum penjadwal harian dianggap mati. Dua hari memberi ruang satu hari yang terlewat. */
const BATAS = 2 * DAY;

/**
 * Tanda bahwa jaminan otomatis (tangga eskalasi dan jangkar harian) benar-benar berjalan.
 * Kegagalan diam-diam di sini membuat kasus yang dipendam tidak naik, jadi harus terlihat oleh Ketua dan Auditor.
 * Institusi demo dilewati karena tidak memakai penjadwal.
 */
export function peringatanSistem(db: DB, institutionId: string, now = Date.now()): string[] {
  if (db.institutions[institutionId]?.demo) return [];
  const out: string[] = [];
  const dasar = db.meta.cronTerakhir ?? db.meta.seededAt;
  if (dasar && now - dasar > BATAS)
    out.push(
      db.meta.cronTerakhir
        ? 'Penjadwal harian terakhir berjalan lebih dari dua hari lalu. Kasus yang terlambat tidak naik tingkat selama penjadwal mati. Periksa workflow anchor-harian dan rahasia GEMA_URL serta GEMA_CRON_SECRET.'
        : 'Penjadwal harian belum pernah berjalan. Kasus yang terlambat tidak akan naik tingkat. Aktifkan workflow anchor-harian dan pasang rahasia GEMA_URL serta GEMA_CRON_SECRET.',
    );
  const tertunda = Object.values(db.evidence).filter(
    (e) => e.blob_ready && !e.anchor_id && now - e.uploaded_at > BATAS,
  ).length;
  if (tertunda > 0)
    out.push(
      `${tertunda} bukti belum masuk akar harian lebih dari dua hari. Jejak waktu bukti tertunda sampai penjadwal berjalan.`,
    );
  return out;
}
