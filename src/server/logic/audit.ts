import type { AuditEntry, DB } from '../types';
import { chainHash, uid } from '../util';

/* ---------- audit ---------- */
export function audit(
  db: DB,
  aktor: string,
  aksi: string,
  objek: string,
  at = Date.now(),
): AuditEntry {
  const prev = db.audit.length ? db.audit[db.audit.length - 1].hash : 'genesis';
  const entry = { id: uid(8), aktor, aksi, objek, at };
  const e: AuditEntry = { ...entry, prev_hash: prev, hash: chainHash(prev, entry) };
  db.audit.push(e);
  return e;
}
