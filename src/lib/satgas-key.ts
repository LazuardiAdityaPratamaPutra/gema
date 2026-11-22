import { DEMO_SATGAS_SECRET } from './demo-keys';
import type { HybridSecretKey } from '@gema/pq-kem';
import type { SatgasSession } from './store';

const K = 'gema.sk';

/** Kunci rahasia Satgas hanya hidup di sessionStorage tab ini. Kampus sungguhan wajib menyimpan berkas cadangannya sendiri. */
export function loadSatgasSecret(s: SatgasSession): HybridSecretKey | null {
  if (s.institution.demo) return DEMO_SATGAS_SECRET;
  try {
    const raw = sessionStorage.getItem(K);
    if (!raw) return null;
    const o = JSON.parse(raw) as { institutionId: string; secret: HybridSecretKey };
    return o.institutionId === s.institution.id ? o.secret : null;
  } catch {
    return null;
  }
}

export function storeSatgasSecret(s: SatgasSession, secret: HybridSecretKey) {
  sessionStorage.setItem(K, JSON.stringify({ institutionId: s.institution.id, secret }));
}

export function parseSecretFile(text: string): HybridSecretKey {
  const o = JSON.parse(text) as Partial<HybridSecretKey> & { secret?: HybridSecretKey };
  const k = (o.secret ?? o) as HybridSecretKey;
  if (k.suite !== 'ecdh-p256+mlkem768-v1' || !k.ecdh || !k.mlkem)
    throw new Error('Berkas bukan kunci rahasia Gema yang valid.');
  return k;
}
