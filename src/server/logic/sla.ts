import { persist } from '../db';
import type { CaseStatus, DB, Escalation, SatgasRole } from '../types';
import { CASE_STATUSES } from '../types';
import { HttpError, businessDaysBetween, uid } from '../util';
import { audit } from './audit';
import { nowFor } from './sesi';

export type SlaView = {
  status: CaseStatus;
  due: number;
  escalated: number;
  hariSisa: number | null;
  hariTerlambat: number;
  tingkat: number;
  terlambat: boolean;
  h2: boolean;
};

export function slaView(db: DB, e: Escalation): SlaView {
  const now = nowFor(db, e.institution_id);
  const late = e.status !== 'Selesai' && now > e.sla_due_at;
  const lateBD = late ? businessDaysBetween(e.sla_due_at, now) : 0;
  const remainingBD =
    !late && e.status !== 'Selesai' ? businessDaysBetween(now, e.sla_due_at) : null;
  return {
    status: e.status,
    due: e.sla_due_at,
    escalated: e.escalated_at,
    hariSisa: remainingBD,
    hariTerlambat: lateBD,
    tingkat: e.tingkat_tangga,
    terlambat: late,
    h2: !late && e.status !== 'Selesai' && remainingBD !== null && remainingBD <= 2,
  };
}

export function advanceStatus(
  db: DB,
  e: Escalation,
  to: CaseStatus,
  actor: { role: SatgasRole; name: string },
) {
  const from = CASE_STATUSES.indexOf(e.status);
  const target = CASE_STATUSES.indexOf(to);
  if (target !== from + 1) throw new HttpError(409, 'Status hanya dapat maju satu langkah.');
  const now = nowFor(db, e.institution_id);
  e.status = to;
  if (to === 'Selesai') e.selesai_at = now;
  db.events.push({
    id: uid(8),
    escalation_id: e.id,
    actor_role: actor.role,
    tipe: 'status',
    label: `Status menjadi "${to}".`,
    catatan_ciphertext: null,
    at: now,
  });
  audit(db, `${actor.role}:${actor.name}`, 'ubah-status:' + to, e.alias, now);
  persist(db);
}
