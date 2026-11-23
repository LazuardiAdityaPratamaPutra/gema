import { bucketize, complianceSnapshot, noisyCount } from '@gema/dp';
import { DEMO_INSTITUTION_ID } from '@/lib/demo';
import type { DB } from '../types';
import { DAY } from '../util';

const inst = DEMO_INSTITUTION_ID;

/** Snapshot Papan Kepatuhan dan Radar (fiktif, berderau; derau ditambahkan sekali saat dibuat). */
export function seedCompliance(db: DB, now: number) {
  // snapshot Papan Kepatuhan dan Radar (fiktif, berderau; derau ditambahkan sekali saat dibuat)
  const synthetic: Record<string, [number, number, number][]> = {
    // [due, onTime, medianHari] untuk 2026-Q1..Q3
    [inst]: [
      [16, 9, 7],
      [18, 12, 6],
      [24, 19, 4],
    ],
    'inst-poli': [
      [9, 8, 4],
      [11, 7, 6],
      [14, 12, 4],
    ],
    'inst-itc': [
      [30, 17, 8],
      [34, 21, 7],
      [38, 25, 6],
    ],
  };
  for (const [iid, rows] of Object.entries(synthetic)) {
    rows.forEach(([due, ok, med], i) => {
      const s = complianceSnapshot(due, ok, med, db.institutions[iid].dp_epsilon);
      db.compliance.push({
        institution_id: iid,
        kuartal: `2026-Q${i + 1}`,
        enough: s.enough,
        persen: s.percent,
        median_bucket: s.medianBucket,
        jumlah_bucket: bucketize(s.dueNoisy, 5),
        epsilon: db.institutions[iid].dp_epsilon,
        created_at: now - (3 - i) * 30 * DAY,
      });
    });
  }
  const radarTrue: [string, string, number, boolean][] = [
    ['u-ft', 'Fakultas Teknik', 7, true],
    ['u-feb', 'Fakultas Ekonomi dan Bisnis', 3, false],
    ['u-fisip', 'Fakultas Ilmu Sosial dan Politik', 5, true],
    ['u-fk', 'Fakultas Kedokteran', 1, false],
    ['u-bem', 'Unit Kegiatan Mahasiswa', 9, true],
  ];
  for (const [uidU, nama, n, rep] of radarTrue) {
    const noisy = noisyCount(n, 1);
    const b = bucketize(noisy, 3);
    db.radar.push({
      unit_id: uidU,
      unit_nama: nama,
      institution_id: inst,
      periode: '2026-Q3',
      bucket: b,
      pola_berulang: b !== null && rep,
      epsilon: 1,
    });
  }
}
