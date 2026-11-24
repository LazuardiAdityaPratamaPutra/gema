import { describe, expect, it } from 'vitest';
import { buildCertificatePdf } from '@/lib/vault/proof';
import type { EvidenceCertificate } from '@gema/merkle';

const base = {
  evidenceId: 'ev_1234567890abcdef',
  sha256: 'a'.repeat(64),
  uploadedAt: '2026-11-24T10:00:00Z',
  leaf: 'b'.repeat(64),
} as EvidenceCertificate;
const opts = { namaBerkas: 'foto.jpg', ukuran: '1,2 MB', origin: 'https://gema.example' };

describe('buildCertificatePdf', () => {
  it('menghasilkan PDF satu halaman tanpa akar harian', async () => {
    const bytes = await buildCertificatePdf(base, opts);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
  });

  it('menghasilkan PDF dengan akar harian dan pesan tercatat', async () => {
    const cert = {
      ...base,
      messageRoot: 'c'.repeat(64),
      messageCount: 7,
      anchor: {
        root: 'd'.repeat(64),
        date: '2026-11-24',
        index: 2,
        size: 9,
        chainHash: null,
        commitRef: null,
      },
    } as EvidenceCertificate;
    const bytes = await buildCertificatePdf(cert, opts);
    expect(bytes.length).toBeGreaterThan(base ? 1000 : 0);
  });
});
