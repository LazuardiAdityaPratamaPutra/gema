import type { DB, Institution } from '../types';
import { HttpError } from '../util';

export function institutionOf(db: DB, id: string): Institution {
  const inst = db.institutions[id];
  if (!inst) throw new HttpError(404, 'Institusi tidak ditemukan');
  return inst;
}
