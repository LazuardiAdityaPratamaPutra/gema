import { describe, expect, it } from 'vitest';
import {
  buildCatatanPenanganan,
  dataCatatan,
  sidikCatatan,
} from '@/lib/laporan/catatan-penanganan';
import type { ReportView } from '@/lib/vault/vault-client';

const T0 = Date.UTC(2026, 10, 2, 3, 0);
const laporan = (over: Partial<NonNullable<ReportView['escalation']>> = {}): ReportView =>
  ({
    id: 'rahasia-id-laporan',
    institutionId: 'inst-x',
    institutionNama: 'Kampus <Uji> & "Rekan"',
    unitId: 'u-1',
    unitNama: 'Fakultas Rahasia',
    createdAt: T0,
    secrets: {
      narasi_ciphertext: 'CIPHER-NARASI',
      dek_wrapped_klien: 'x',
      bukti_meta_ciphertext: 'y',
    },
    evidence: [{ id: 'e1', sha256: 'a'.repeat(64), uploadedAt: T0, anchored: true }],
    escalation: {
      id: 'esc-1',
      alias: 'GM-4821',
      sumber: 'tunggal',
      escalatedAt: T0 + 3600_000,
      opened: false,
      openedAt: null,
      sla: { due: T0 + 5 * 86_400_000, terlambat: true, hariTerlambat: 4, tingkat: 2 },
      events: [{ at: T0 + 7200_000, label: 'Status menjadi <b>Verifikasi</b>.', actor: 'Ketua' }],
      ladder: [{ tingkat: 1, at: T0 + 6 * 86_400_000 }],
      ...over,
    },
  }) as unknown as ReportView;

describe('Catatan penanganan', () => {
  it('memuat kronologi, tenggat, dan sidik', async () => {
    const html = await buildCatatanPenanganan(laporan(), T0 + 9 * 86_400_000);
    expect(html).toContain('GM-4821');
    expect(html).toContain('4 hari kerja, tingkat 2');
    expect(html).toContain('naik ke tingkat 1, Ketua Satgas');
    expect(html).toContain('a'.repeat(64));
    expect(html).toMatch(/Sidik catatan[\s\S]*<code>[0-9a-f]{64}<\/code>/);
  });

  it('meng-escape teks dan tidak membocorkan isi atau identitas', async () => {
    const html = await buildCatatanPenanganan(laporan());
    expect(html).not.toContain('<b>Verifikasi</b>');
    expect(html).toContain('&#60;b&#62;Verifikasi');
    expect(html).toContain('Kampus &#60;Uji&#62; &#38; &#34;Rekan&#34;');
    for (const rahasia of ['CIPHER-NARASI', 'rahasia-id-laporan', 'Fakultas Rahasia', '<script'])
      expect(html).not.toContain(rahasia);
  });

  it('sidik stabil untuk data sama dan berubah bila data berubah', async () => {
    const a = await sidikCatatan(dataCatatan(laporan()));
    expect(a).toBe(await sidikCatatan(dataCatatan(laporan())));
    expect(a).not.toBe(
      await sidikCatatan(dataCatatan(laporan({ opened: true, openedAt: T0 + 86_400_000 }))),
    );
  });

  it('menolak laporan yang belum dikirim ke Satgas', async () => {
    const r = { ...laporan(), escalation: null } as unknown as ReportView;
    await expect(buildCatatanPenanganan(r)).rejects.toThrow(/belum dikirim/);
  });
});
