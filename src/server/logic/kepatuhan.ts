import { bucketize, complianceSnapshot } from '@gema/dp';
import type { DB } from '../types';
import { DAY, businessDaysBetween, quarterEnd, quarterOf } from '../util';
import { audit } from './audit';
import { nowFor } from './sesi';

function median(a: number[]): number {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Kuartal yang sudah ditutup + tunda 14 hari. Derau ditambahkan SEKALI lalu disimpan. */
export function closeQuarters(db: DB, now = Date.now()): boolean {
  let changed = false;
  for (const inst of Object.values(db.institutions)) {
    const t = nowFor(db, inst.id);
    const cur = quarterOf(t);
    const quarters = new Set<string>();
    for (const e of Object.values(db.escalations).filter((x) => x.institution_id === inst.id))
      quarters.add(quarterOf(e.sla_due_at));
    for (const q of quarters) {
      if (q === cur) continue;
      if (quarterEnd(q) + 14 * DAY > t) continue;
      if (db.compliance.some((c) => c.institution_id === inst.id && c.kuartal === q)) continue;
      const esc = Object.values(db.escalations).filter(
        (x) => x.institution_id === inst.id && quarterOf(x.sla_due_at) === q,
      );
      const onTime = esc.filter((x) => x.selesai_at && x.selesai_at <= x.sla_due_at).length;
      const days = esc
        .filter((x) => x.selesai_at)
        .map((x) => businessDaysBetween(x.escalated_at, x.selesai_at!));
      const snap = complianceSnapshot(esc.length, onTime, median(days), inst.dp_epsilon);
      const jb = bucketize(snap.dueNoisy, 5);
      db.compliance.push({
        institution_id: inst.id,
        kuartal: q,
        enough: snap.enough,
        persen: snap.percent,
        median_bucket: snap.medianBucket,
        jumlah_bucket: jb,
        epsilon: inst.dp_epsilon,
        created_at: now,
      });
      audit(db, 'sistem', 'snapshot-kepatuhan', `${inst.id}:${q}:eps=${inst.dp_epsilon}`, now);
      changed = true;
    }
  }
  return changed;
}
