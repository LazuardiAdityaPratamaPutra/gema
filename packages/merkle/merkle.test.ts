import { describe, expect, it } from 'vitest';
import { sha256, toHex, utf8 } from '@gema/crypto';
import {
  auditPath,
  buildDisclosure,
  buildMessageTree,
  evidenceLeaf,
  leafHash,
  merkleRoot,
  newSalts,
  verifyCertificate,
  verifyDisclosure,
  verifyPath,
  type CanonicalMessage,
  type EvidenceCertificate,
} from './index';

const leaves = (n: number) => Array.from({ length: n }, (_, i) => leafHash(utf8('daun-' + i)));

describe('pohon Merkle', () => {
  it('semua jalur terverifikasi untuk berbagai ukuran pohon', () => {
    for (const n of [1, 2, 3, 4, 5, 7, 8, 9, 16, 31, 100]) {
      const ls = leaves(n);
      const root = merkleRoot(ls);
      for (let i = 0; i < n; i++) {
        expect(verifyPath(ls[i], i, n, auditPath(i, ls), root)).toBe(true);
      }
    }
  });

  it('daun salah, indeks salah, atau ukuran salah → gagal', () => {
    const ls = leaves(10);
    const root = merkleRoot(ls);
    const p = auditPath(3, ls);
    expect(verifyPath(ls[4], 3, 10, p, root)).toBe(false);
    expect(verifyPath(ls[3], 2, 10, p, root)).toBe(false);
    expect(verifyPath(ls[3], 3, 20, p, root)).toBe(false);
    expect(verifyPath(ls[3], 3, 10, p.slice(1), root)).toBe(false);
  });

  it('pemisah domain: daun ≠ simpul dalam', () => {
    const a = leafHash(utf8('x'));
    expect(toHex(a)).not.toBe(toHex(sha256(utf8('x'))));
  });
});

const msgs: CanonicalMessage[] = [
  { ts: '31/12/2023 14.05', sender: 'Maya', text: 'ok', attachment: '' },
  { ts: '31/12/2023 14.06', sender: 'Dr. X', text: 'jangan bilang siapa-siapa', attachment: '' },
  { ts: '31/12/2023 14.07', sender: 'Maya', text: 'ok', attachment: '' },
  { ts: '31/12/2023 14.09', sender: 'Dr. X', text: '', attachment: 'IMG-0001.jpg' },
  { ts: '31/12/2023 14.10', sender: 'Maya', text: 'baik', attachment: '' },
];

describe('Bukti per Pesan', () => {
  const salts = newSalts(msgs.length);

  it('pesan terpilih terverifikasi tanpa membuka pesan lain', () => {
    const pkg = buildDisclosure('ev1', msgs, salts, [1, 3]);
    expect(pkg.items).toHaveLength(2);
    expect(JSON.stringify(pkg)).not.toContain('baik');
    expect(JSON.stringify(pkg)).not.toContain('"Maya"');
    expect(verifyDisclosure(pkg).ok).toBe(true);
  });

  it('ubah 1 karakter → tidak cocok', () => {
    const pkg = buildDisclosure('ev1', msgs, salts, [1]);
    pkg.items[0].message = { ...pkg.items[0].message, text: 'jangan bilang siapa-siapa.' };
    expect(verifyDisclosure(pkg).ok).toBe(false);
  });

  it('pesan pendek yang sama ("ok") menghasilkan daun berbeda karena garam', () => {
    const t = buildMessageTree(msgs, salts);
    expect(toHex(t.leaves[0])).not.toBe(toHex(t.leaves[2]));
  });

  it('akar yang sama tidak dapat dipalsukan dengan garam lain', () => {
    const pkg = buildDisclosure('ev1', msgs, salts, [1]);
    pkg.items[0].salt = 'AAAAAAAAAAAAAAAAAAAAAA';
    expect(verifyDisclosure(pkg).ok).toBe(false);
  });
});

describe('sertifikat bukti', () => {
  const file = utf8('isi berkas bukti');
  const fileHash = sha256(file);
  const msgRoot = sha256(utf8('root pesan'));
  const batch = [
    evidenceLeaf(sha256(utf8('lain')), null),
    evidenceLeaf(fileHash, msgRoot),
    evidenceLeaf(sha256(utf8('lagi')), null),
  ];
  const root = merkleRoot(batch);
  const cert: EvidenceCertificate = {
    v: 1,
    evidenceId: 'e1',
    sha256: toHex(fileHash),
    messageRoot: toHex(msgRoot),
    messageCount: 5,
    uploadedAt: '2026-11-21T10:00:00Z',
    leaf: toHex(batch[1]),
    anchor: {
      date: '2026-11-21',
      root: toHex(root),
      size: 3,
      index: 1,
      path: auditPath(1, batch).map(toHex),
      chainHash: null,
      commitRef: null,
    },
    statement: '',
  };

  it('berkas asli → cocok', () => {
    expect(verifyCertificate(cert, toHex(fileHash)).summary).toBe('cocok');
  });

  it('ubah 1 byte berkas → tidak cocok', () => {
    const changed = file.slice();
    changed[0] ^= 1;
    expect(verifyCertificate(cert, toHex(sha256(changed))).summary).toBe('tidak-cocok');
  });

  it('jalur Merkle dirusak → tidak cocok', () => {
    const bad = { ...cert, anchor: { ...cert.anchor!, path: cert.anchor!.path.slice().reverse() } };
    expect(verifyCertificate(bad, toHex(fileHash)).summary).toBe('tidak-cocok');
  });

  it('sertifikat tanpa anchor tetap memeriksa hash dengan keterangan menunggu akar', () => {
    const r = verifyCertificate({ ...cert, anchor: null }, toHex(fileHash));
    expect(r.summary).toBe('cocok');
    expect(r.anchored).toBe(false);
  });
});
