import { persist } from '../db';
import type { DB } from '../types';
import { businessDaysBetween, uid } from '../util';
import { kabarkanTangga, type Ringkasan } from '../notify';
import { sealAnchors } from './anchor';
import { audit } from './audit';
import { closeQuarters } from './kepatuhan';
import { nowFor } from './sesi';

const NAMA_TINGKAT = { 1: 'Ketua Satgas', 2: 'Pimpinan', 3: 'Kementerian (agregat)' } as const;

/** Tingkat tangga yang berlaku untuk keterlambatan sekian hari kerja. */
const tingkatUntuk = (lateBD: number, th: { t2: number; t3: number }): 1 | 2 | 3 =>
  lateBD >= th.t3 ? 3 : lateBD >= th.t2 ? 2 : 1;

type Eskalasi = DB['escalations'][string];

/** Mencatat satu kenaikan tingkat: baris tangga, kejadian di riwayat kasus, dan jejak audit. */
function catatKenaikan(db: DB, e: Eskalasi, L: 1 | 2 | 3, lateBD: number, now: number) {
  const role = NAMA_TINGKAT[L];
  db.ladder.push({
    id: uid(8),
    escalation_id: e.id,
    alias: e.alias,
    tingkat: L,
    notified_role: role,
    hari_terlambat: lateBD,
    at: now,
  });
  db.events.push({
    id: uid(8),
    escalation_id: e.id,
    actor_role: 'sistem',
    tipe: 'tangga',
    label: `Peringatan naik ke T${L}: ${role}.`,
    catatan_ciphertext: null,
    at: now,
  });
  audit(db, 'sistem', `tangga-T${L}`, e.alias, now);
  e.tingkat_tangga = L;
}

/** Menaikkan tangga semua kasus yang terlambat. Mengembalikan ringkasan kenaikan baru per kampus dan tingkat. */
function naikkanTangga(db: DB) {
  const baru = new Map<string, Ringkasan>();
  for (const e of Object.values(db.escalations)) {
    if (e.status === 'Selesai') continue;
    const now = nowFor(db, e.institution_id);
    if (now <= e.sla_due_at) continue;
    const lateBD = businessDaysBetween(e.sla_due_at, now);
    const level = tingkatUntuk(lateBD, db.institutions[e.institution_id].ambang_tangga);
    for (let l = e.tingkat_tangga + 1; l <= level; l++) {
      const L = l as 1 | 2 | 3;
      catatKenaikan(db, e, L, lateBD, now);
      const k = `${e.institution_id}:${L}`;
      const r = baru.get(k) ?? { institusi: e.institution_id, tingkat: L, jumlah: 0 };
      r.jumlah += 1;
      baru.set(k, r);
    }
  }
  return baru;
}

/** Dijalankan berkala dan idempoten: menaikkan Tangga Eskalasi, merilis snapshot kuartal tertutup, menerbitkan anchor harian. */
export async function tick(db: DB) {
  const baru = naikkanTangga(db);
  const berubah = [baru.size > 0, !!sealAnchors(db, false), closeQuarters(db)];
  const changed = berubah.some(Boolean);
  if (changed) persist(db);
  if (baru.size > 0 && (await kabarkanTangga(db, [...baru.values()]))) persist(db);
  return { changed };
}
