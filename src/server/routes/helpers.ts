import type { DB } from '../types';

/** Nama anggota Satgas, atau `null` bila tidak ada penanggung jawab. */
export function memberName(db: DB, id: string | null | undefined): string | null {
  return id ? (db.members[id]?.nama ?? null) : null;
}
