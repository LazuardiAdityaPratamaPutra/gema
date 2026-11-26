import { describe, expect, it } from 'vitest';
import { peringatanSistem } from '@/server/logic/kesehatan';
import type { DB } from '@/server/types';

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 10, 20);
const db = (over: { demo?: boolean; cron?: number; seeded?: number; evidence?: object[] }) =>
  ({
    institutions: { i: { demo: !!over.demo } },
    meta: { seededAt: over.seeded ?? NOW - 10 * DAY, cronTerakhir: over.cron },
    evidence: Object.fromEntries((over.evidence ?? []).map((e, n) => [n, e])),
  }) as unknown as DB;

describe('Peringatan sistem', () => {
  it('diam bila penjadwal baru berjalan dan tak ada bukti tertunda', () => {
    expect(peringatanSistem(db({ cron: NOW - 3_600_000 }), 'i', NOW)).toEqual([]);
  });

  it('memperingatkan penjadwal yang mati lebih dari dua hari', () => {
    expect(peringatanSistem(db({ cron: NOW - 3 * DAY }), 'i', NOW)[0]).toMatch(/dua hari lalu/);
  });

  it('memperingatkan penjadwal yang tak pernah berjalan, tetapi tidak untuk deploy yang baru lahir', () => {
    expect(peringatanSistem(db({}), 'i', NOW)[0]).toMatch(/belum pernah berjalan/);
    expect(peringatanSistem(db({ seeded: NOW - DAY }), 'i', NOW)).toEqual([]);
  });

  it('menghitung bukti yang tertinggal dari akar harian', () => {
    const ev = [
      { blob_ready: true, anchor_id: null, uploaded_at: NOW - 4 * DAY },
      { blob_ready: true, anchor_id: null, uploaded_at: NOW - DAY },
      { blob_ready: true, anchor_id: 'a', uploaded_at: NOW - 5 * DAY },
    ];
    const w = peringatanSistem(db({ cron: NOW - 1000, evidence: ev }), 'i', NOW);
    expect(w).toHaveLength(1);
    expect(w[0]).toMatch(/^1 bukti/);
  });

  it('melewati institusi demo', () => {
    expect(peringatanSistem(db({ demo: true }), 'i', NOW)).toEqual([]);
  });
});
