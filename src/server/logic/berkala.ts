import { persist } from '../db';
import type { DB } from '../types';
import { businessDaysBetween, uid } from '../util';
import { sealAnchors } from './anchor';
import { audit } from './audit';
import { closeQuarters } from './kepatuhan';
import { nowFor } from './sesi';

/** Dijalankan berkala dan idempoten: menaikkan Tangga Eskalasi, merilis snapshot kuartal tertutup, menerbitkan anchor harian. */
export async function tick(db: DB) {
  let changed = false;
  for (const e of Object.values(db.escalations)) {
    if (e.status === 'Selesai') continue;
    const inst = db.institutions[e.institution_id];
    const now = nowFor(db, e.institution_id);
    if (now <= e.sla_due_at) continue;
    const lateBD = businessDaysBetween(e.sla_due_at, now);
    const th = inst.ambang_tangga;
    const level = (lateBD >= th.t3 ? 3 : lateBD >= th.t2 ? 2 : 1) as 1 | 2 | 3;
    for (let l = e.tingkat_tangga + 1; l <= level; l++) {
      const L = l as 1 | 2 | 3;
      const role = L === 1 ? 'Ketua Satgas' : L === 2 ? 'Pimpinan' : 'Kementerian (agregat)';
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
      changed = true;
    }
  }
  if (sealAnchors(db, false)) changed = true;
  if (closeQuarters(db)) changed = true;
  if (changed) persist(db);
  return { changed };
}
