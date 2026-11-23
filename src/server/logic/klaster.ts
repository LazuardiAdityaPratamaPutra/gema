import { confidenceFor, type Confidence } from '@gema/matching';
import { fpIndex } from '../db';
import type { DB, Report } from '../types';
import { DAY } from '../util';

export type MatchInfo = {
  notify: boolean;
  size: number | null;
  confidence: Confidence | null;
  weak: number | null;
  optedIn: number;
  flagFast: boolean;
};

function fpsOf(db: DB, reportId: string) {
  return db.fingerprints.filter((f) => f.report_id === reportId);
}

export function clusterMembers(db: DB, reportId: string): Report[] {
  const idx = fpIndex();
  const start = db.reports[reportId];
  if (!start) return [];
  const seen = new Set<string>([reportId]);
  const queue = [start];
  while (queue.length) {
    const r = queue.shift()!;
    for (const f of fpsOf(db, r.id).filter((x) => x.tingkat === 'kuat')) {
      for (const rid of idx.get(`kuat|${f.fp_hash}`) ?? []) {
        const o = db.reports[rid];
        if (!o || seen.has(rid) || o.reporter_id === r.reporter_id) continue;
        seen.add(rid);
        queue.push(o);
      }
    }
  }
  return [...seen].map((id) => db.reports[id]);
}

export function matchInfo(db: DB, reportId: string): MatchInfo {
  const r = db.reports[reportId];
  const members = clusterMembers(db, reportId);
  const reporters = new Set(members.map((m) => m.reporter_id));
  const size = reporters.size;
  if (size < r.k_threshold)
    return { notify: false, size: null, confidence: null, weak: null, optedIn: 0, flagFast: false };
  const own = fpsOf(db, reportId)
    .filter((f) => f.tingkat === 'penguat')
    .map((f) => f.fp_hash);
  const others = members
    .filter((m) => m.id !== reportId)
    .map((m) =>
      fpsOf(db, m.id)
        .filter((f) => f.tingkat === 'penguat')
        .map((f) => f.fp_hash),
    );
  const confidence = confidenceFor(own, others);
  let weak: number | null = null;
  if (r.include_weak) {
    const idx = fpIndex();
    const w = new Set<string>();
    for (const f of fpsOf(db, reportId).filter((x) => x.tingkat === 'lemah')) {
      for (const rid of idx.get(`lemah|${f.fp_hash}`) ?? []) {
        const o = db.reports[rid];
        if (o && o.reporter_id !== r.reporter_id && !reporters.has(o.reporter_id))
          w.add(o.reporter_id);
      }
    }
    weak = w.size;
  }
  const optedIn = new Set(members.filter((m) => m.opt_in).map((m) => m.reporter_id)).size;
  const times = members.map((m) => m.created_at);
  const flagFast = Math.max(...times) - Math.min(...times) < DAY;
  return { notify: true, size, confidence, weak, optedIn, flagFast };
}

/** Untuk Satgas: hanya angka — berapa laporan di klaster, berapa yang tereskalasi, berapa yang tersegel. */
export function clusterCounts(db: DB, reportId: string) {
  const members = clusterMembers(db, reportId);
  const escalated = members.filter((m) => m.status === 'tereskalasi').length;
  return { total: members.length, tereskalasi: escalated, tersegel: members.length - escalated };
}
