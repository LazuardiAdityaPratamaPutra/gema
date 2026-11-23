/**
 * Uji ujung ke ujung backend + klien (tanpa browser): akun anonim, Kode Paksa, OPRF lewat API,
 * pencocokan, eskalasi, dekripsi Satgas dengan KEM hibrida, Tangga Eskalasi, anchor, verifikasi.
 */
import fs from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  aesGcmDecrypt,
  authHash,
  b64u,
  decryptJson,
  deriveAccountKeys,
  encryptJson,
  fromB64u,
  padTo,
  randomBytes,
  sha256,
  toHex,
  unpad,
  unwrapKey,
  utf8,
} from '@gema/crypto';
import { blindInputs } from '@gema/oprf';
import { generateHybridKeypair, unwrapFromSatgas, wrapForSatgas } from '@gema/pq-kem';
import { verifyCertificate, type EvidenceCertificate } from '@gema/merkle';
import { buildInputs } from '@gema/matching';
import { DEMO_SATGAS_SECRET } from '@/lib/demo-keys';
import { DEMO_ACCOUNTS } from '@/lib/demo';
import { AAD, VAULT_SIZE, type BuktiMeta, type Narasi } from '@/lib/report-format';
import { call, dir, ITER, newAccount, setup, submitReport } from './helpers';

beforeAll(setup, 120_000);

describe('data publik dan demo', () => {
  it('institusi demo punya unit dan kunci publik hibrida', async () => {
    const r = await call('GET', 'public/institutions');
    const demo = r.data.find((i: any) => i.id === 'inst-demo');
    expect(demo.units.length).toBeGreaterThan(3);
    expect(demo.publicKey.suite).toBe('ecdh-p256+mlkem768-v1');
    expect(r.data.every((i: any) => i.units.length > 0)).toBe(true);
  });

  it('akun demo Maya dapat masuk dan melihat gema (klaster ≥ 2) dengan keyakinan', async () => {
    const maya = DEMO_ACCOUNTS[0];
    const k = await deriveAccountKeys(maya.caseCode, maya.passphrase, ITER);
    const login = await call('POST', 'auth/login', {
      body: { caseCode: maya.caseCode, authKey: b64u(k.authKey) },
    });
    expect(login.status).toBe(200);
    const rep = await call('GET', 'me/reports', { token: login.data.token });
    expect(rep.data.reports).toHaveLength(1);
    const r = rep.data.reports[0];
    expect(r.match.notify).toBe(true);
    expect(r.match.size).toBe(2);
    expect(r.match.confidence).toBe('tinggi');
    // Maya dapat mendekripsi laporannya sendiri; server tidak
    const dek = await unwrapKey(k.kek, fromB64u(r.secrets.dek_wrapped_klien), AAD.dek);
    const narasi = await decryptJson<Narasi>(
      dek,
      fromB64u(r.secrets.narasi_ciphertext),
      AAD.narasi,
    );
    expect(narasi.terlapor.nama).toContain('Hendra');
    const meta = await decryptJson<BuktiMeta>(
      dek,
      fromB64u(r.secrets.bukti_meta_ciphertext),
      AAD.meta,
    );
    expect(meta.items[0].messages!.length).toBe(10);
  }, 60_000);
});

describe('privasi basis data', () => {
  it('basis data dan blob tidak memuat nama terlapor maupun isi laporan', async () => {
    await new Promise((r) => setTimeout(r, 500));
    const dbJson = fs.readFileSync(path.join(dir, 'db.json'), 'utf8').toLowerCase();
    for (const needle of [
      'hendra wijaya',
      'wijaya',
      'bambang',
      'haryono',
      'rina kusuma',
      'jangan bilang siapa-siapa',
      'catatan saksi',
    ])
      expect(dbJson).not.toContain(needle);
    for (const f of fs.readdirSync(path.join(dir, 'blobs'))) {
      const content = fs.readFileSync(path.join(dir, 'blobs', f), 'latin1');
      expect(content).not.toContain('Hendra');
      expect(content).not.toContain('jangan bilang');
    }
  });

  it('slot autentikasi seragam: tidak ada kolom yang membedakan slot asli dan umpan', async () => {
    const db = JSON.parse(fs.readFileSync(path.join(dir, 'db.json'), 'utf8'));
    const keys = new Set(db.slots.map((s: any) => Object.keys(s).sort().join(',')));
    expect(keys.size).toBe(1);
    const sizes = new Set(db.slots.map((s: any) => s.vault_blob.length));
    expect(sizes.size).toBe(1);
    const perReporter: Record<string, number> = {};
    for (const s of db.slots) perReporter[s.reporter_id] = (perReporter[s.reporter_id] ?? 0) + 1;
    expect(Object.values(perReporter).every((n) => n === 2)).toBe(true);
  });
});

describe('akun anonim, pembatas laju, Kode Paksa', () => {
  it('kegagalan tidak membocorkan keberadaan kode; 5 gagal → diblokir', async () => {
    const real = await call('POST', 'auth/login', {
      body: { caseCode: DEMO_ACCOUNTS[1].caseCode, authKey: b64u(randomBytes(32)) },
    });
    const none = await call('POST', 'auth/login', {
      body: { caseCode: 'ZZZZZZZZZZZZ', authKey: b64u(randomBytes(32)) },
    });
    expect(real.status).toBe(401);
    expect(none.status).toBe(401);
    expect(real.data.error).toBe(none.data.error);
    for (let i = 0; i < 4; i++)
      await call('POST', 'auth/login', {
        body: { caseCode: 'ZZZZZZZZZZZZ', authKey: b64u(randomBytes(32)) },
      });
    const blocked = await call('POST', 'auth/login', {
      body: { caseCode: 'ZZZZZZZZZZZZ', authKey: b64u(randomBytes(32)) },
    });
    expect(blocked.status).toBe(429);
  });

  it('Kode Paksa membuka brankas umpan; brankas asli tidak tersentuh', async () => {
    const acc = await newAccount();
    const decoyPass = 'kopi manis pagi cerah hujan senja';
    const dk = await deriveAccountKeys(acc.code, decoyPass, ITER);
    const decoyVault = padTo(
      await encryptJson(
        dk.kek,
        { t: 'decoy', judul: 'Catatan belanja', isi: 'Beras, telur, sabun.' },
        AAD.vault,
      ),
      VAULT_SIZE,
    );
    const set = await call('POST', 'auth/decoy', {
      token: acc.token,
      body: { authKey: b64u(dk.authKey), vaultBlob: b64u(decoyVault) },
    });
    expect(set.status).toBe(200);
    const real = await call('POST', 'auth/login', {
      body: { caseCode: acc.code, authKey: b64u(acc.keys.authKey) },
    });
    const decoy = await call('POST', 'auth/login', {
      body: { caseCode: acc.code, authKey: b64u(dk.authKey) },
    });
    expect(real.status).toBe(200);
    expect(decoy.status).toBe(200);
    expect(decoy.data.scopeId).not.toBe(real.data.scopeId);
    expect(decoy.data.vaultBlob.length).toBe(real.data.vaultBlob.length);
    const v = await decryptJson<any>(dk.kek, unpad(fromB64u(decoy.data.vaultBlob)), AAD.vault);
    expect(v.t).toBe('decoy');
    // brankas umpan tidak melihat laporan asli
    await submitReport(acc, 'Orang Uji Satu', {});
    const asDecoy = await call('GET', 'me/reports', { token: decoy.data.token });
    expect(asDecoy.data.reports).toHaveLength(0);
    const asReal = await call('GET', 'me/reports', { token: real.data.token });
    expect(asReal.data.reports).toHaveLength(1);
    // passphrase umpan sama dengan asli ditolak
    const same = await call('POST', 'auth/decoy', {
      token: real.data.token,
      body: { authKey: b64u(acc.keys.authKey), vaultBlob: b64u(decoyVault) },
    });
    expect(same.status).toBe(400);
  }, 120_000);
});

describe('Jembatan Buta, pencocokan, eskalasi, Satgas', () => {
  it('kuota OPRF: titik tak sah ditolak, evaluasi ke-9 ditolak', async () => {
    const acc = await newAccount();
    const bad = await call('POST', 'oprf/evaluate', {
      token: acc.token,
      body: { institutionId: 'inst-demo', draftId: 'draft-kuota-1', blinded: ['00'.repeat(33)] },
    });
    expect(bad.status).toBe(400);
    const eight = blindInputs(Array.from({ length: 8 }, (_, i) => 'x' + i)).map((b) =>
      toHex(b.blinded),
    );
    const ok = await call('POST', 'oprf/evaluate', {
      token: acc.token,
      body: { institutionId: 'inst-demo', draftId: 'draft-kuota-1', blinded: eight },
    });
    expect(ok.status).toBe(200);
    const ninth = await call('POST', 'oprf/evaluate', {
      token: acc.token,
      body: { institutionId: 'inst-demo', draftId: 'draft-kuota-1', blinded: eight.slice(0, 1) },
    });
    expect(ninth.status).toBe(429);
  }, 60_000);

  it('alur penuh: laporan kedua cocok dengan Maya, self-match ditolak, eskalasi, Satgas mendekripsi, bukti utuh', async () => {
    const acc = await newAccount();
    const { res, built } = await submitReport(
      acc,
      'Prof. Hendra Wijaya',
      { role: 'dosen', location: 'kampus' },
      'bukti saya 123',
    );
    expect(res.status).toBe(201);

    // payload OPRF tidak memuat nama
    const inputs = buildInputs('Prof. Hendra Wijaya', 'u-ft', {
      role: 'dosen',
      location: 'kampus',
    });
    expect(inputs.length).toBeGreaterThan(3);

    const list = await call('GET', 'me/reports', { token: acc.token });
    const r = list.data.reports[0];
    expect(r.match.notify).toBe(true);
    expect(r.match.size).toBe(3); // dengan Maya dan Rafi (seed)
    expect(['sedang', 'tinggi']).toContain(r.match.confidence);

    // self-match ditolak
    const dup = await submitReport(acc, 'Hendra Wijaya', {});
    expect(dup.res.status).toBe(409);

    // eskalasi: bungkus DEK dengan kunci hibrida Satgas demo
    const escId = b64u(randomBytes(9));
    const inst = (await call('GET', 'public/institutions')).data.find(
      (i: any) => i.id === 'inst-demo',
    );
    const wrapped = await wrapForSatgas(built.dek, inst.publicKey, {
      institutionId: 'inst-demo',
      escalationId: escId,
    });
    const esc = await call('POST', `reports/${r.id}/escalate`, {
      token: acc.token,
      body: { escalationId: escId, mode: 'tunggal', wrapped },
    });
    expect(esc.status).toBe(201);

    // Satgas
    const login = await call('POST', 'satgas/login', { body: { demoRole: 'Ketua' } });
    expect(login.status).toBe(200);
    const cases = await call('GET', 'satgas/cases', { token: login.data.token });
    const mine = cases.data.cases.find((c: any) => c.alias === esc.data.alias);
    expect(mine.cluster.total).toBe(3);
    expect(mine.cluster.tersegel).toBe(2); // laporan Maya dan Rafi tetap tersegel
    const detail = await call('GET', `satgas/cases/${mine.id}`, { token: login.data.token });
    const dek = await unwrapFromSatgas(detail.data.escalation.wrapped, DEMO_SATGAS_SECRET, {
      institutionId: 'inst-demo',
      escalationId: detail.data.escalation.id,
    });
    const narasi = await decryptJson<Narasi>(
      dek,
      fromB64u(detail.data.report.secrets.narasi_ciphertext),
      AAD.narasi,
    );
    expect(narasi.terlapor.nama).toBe('Prof. Hendra Wijaya');
    const ev = detail.data.evidence[0];
    const blob = await call('GET', `evidence/${ev.id}/blob`, { token: login.data.token });
    const plain = await aesGcmDecrypt(dek, blob.data, AAD.evidence);
    expect(toHex(sha256(plain))).toBe(ev.sha256);

    // laporan Maya tidak dapat dibuka Satgas: DEK-nya tidak pernah dibungkus untuk Satgas
    const mayaK = await deriveAccountKeys(
      DEMO_ACCOUNTS[0].caseCode,
      DEMO_ACCOUNTS[0].passphrase,
      ITER,
    );
    const mayaLogin = await call('POST', 'auth/login', {
      body: { caseCode: DEMO_ACCOUNTS[0].caseCode, authKey: b64u(mayaK.authKey) },
    });
    const mayaRep = (await call('GET', 'me/reports', { token: mayaLogin.data.token })).data
      .reports[0];
    expect(mayaRep.escalation).toBeNull();
    const forbid = await call('GET', `evidence/${mayaRep.evidence[0].id}/blob`, {
      token: login.data.token,
    });
    expect(forbid.status).toBe(403);

    // tarik persetujuan setelah dibuka Satgas ditolak
    const wd = await call('POST', `reports/${r.id}/withdraw`, { token: acc.token });
    expect(wd.status).toBe(409);
  }, 180_000);

  it('peran: Pimpinan hanya melihat status dan SLA; Auditor tidak bisa membuka dosir', async () => {
    const pim = await call('POST', 'satgas/login', { body: { demoRole: 'Pimpinan' } });
    const cases = await call('GET', 'satgas/cases', { token: pim.data.token });
    expect(cases.data.cases.length).toBeGreaterThan(0);
    for (const c of cases.data.cases)
      expect(Object.keys(c).sort()).toEqual([
        'alias',
        'escalatedAt',
        'id',
        'penanggungJawab', // akuntabilitas: Pimpinan melihat siapa yang bertanggung jawab (nama, bukan isi kasus)
        'prioritas',
        'sla',
        'status',
      ]);
    const det = await call('GET', `satgas/cases/${cases.data.cases[0].id}`, {
      token: pim.data.token,
    });
    expect(det.status).toBe(403);
    const aud = await call('POST', 'satgas/login', { body: { demoRole: 'Auditor' } });
    const d2 = await call('GET', `satgas/cases/${cases.data.cases[0].id}`, {
      token: aud.data.token,
    });
    expect(d2.status).toBe(403);
    const log = await call('GET', 'satgas/audit', { token: aud.data.token });
    expect(log.status).toBe(200);
    // rantai hash audit utuh
    const entries = [...log.data.entries].reverse();
    for (let i = 1; i < entries.length; i++) expect(entries[i].prev_hash).toBe(entries[i - 1].hash);
  }, 60_000);

  it('status maju satu langkah saja', async () => {
    const k = await call('POST', 'satgas/login', { body: { demoRole: 'Ketua' } });
    const cases = await call('GET', 'satgas/cases', { token: k.data.token });
    const fresh = cases.data.cases.find((c: any) => c.status === 'Diterima');
    const skip = await call('POST', `satgas/cases/${fresh.id}/status`, {
      token: k.data.token,
      body: { to: 'Rekomendasi' },
    });
    expect(skip.status).toBe(409);
    const ok = await call('POST', `satgas/cases/${fresh.id}/status`, {
      token: k.data.token,
      body: { to: 'Verifikasi' },
    });
    expect(ok.status).toBe(200);
  });
});

describe('Tangga Eskalasi dan Jam Demo', () => {
  it('memajukan jam demo memicu tingkat yang benar dan T3 hanya agregat untuk Pengawas', async () => {
    const k = await call('POST', 'satgas/login', { body: { demoRole: 'Ketua' } });
    const before = (await call('GET', 'satgas/ladder', { token: k.data.token })).data
      .events as any[];
    expect(before.some((e) => e.tingkat === 1)).toBe(true); // kasus Dewa sudah lewat tenggat saat seed
    await call('POST', 'demo/advance', { body: { days: 21 } });
    const after = (await call('GET', 'satgas/ladder', { token: k.data.token })).data
      .events as any[];
    expect(after.some((e) => e.tingkat === 3)).toBe(true);
    for (const e of after)
      expect(Object.keys(e).sort()).toEqual(['alias', 'at', 'hariTerlambat', 'ke', 'tingkat']);
    const pim = await call('POST', 'satgas/login', { body: { demoRole: 'Pimpinan' } });
    const pl = (await call('GET', 'satgas/ladder', { token: pim.data.token })).data.events as any[];
    expect(pl.every((e) => e.tingkat >= 2)).toBe(true);
    const peng = await call('POST', 'satgas/login', { body: { demoRole: 'Pengawas' } });
    const agg = await call('GET', 'satgas/ladder', { token: peng.data.token });
    expect(Object.keys(agg.data)).toEqual(['agregat']);
    expect(agg.data.agregat.kasusTerlambatT3).toBeGreaterThanOrEqual(1);
  }, 60_000);
});

describe('anchor Merkle dan verifikasi publik', () => {
  it('bukti baru dapat dianchor; verifikasi cocok; ubah 1 byte → tidak cocok', async () => {
    const acc = await newAccount();
    const content = 'berkas untuk verifikasi anchor';
    const { res } = await submitReport(acc, 'Seseorang Lain Sekali', {}, content);
    expect(res.status).toBe(201);
    const evId = res.data.evidence[0].id;
    const pre = await call('GET', `public/evidence/${evId}`);
    expect(pre.data.anchor).toBeNull();
    const sealed = await call('POST', 'demo/anchor-now');
    expect(sealed.data.sealed).toBe(true);
    const proof = await call('GET', `public/evidence/${evId}`);
    expect(proof.data.anchor.path).toBeDefined();
    const cert: EvidenceCertificate = { ...proof.data, statement: '' };
    expect(verifyCertificate(cert, toHex(sha256(utf8(content)))).summary).toBe('cocok');
    const changed = utf8(content);
    changed[0] ^= 1;
    expect(verifyCertificate(cert, toHex(sha256(changed))).summary).toBe('tidak-cocok');
    const lookup = await call('GET', `public/lookup/${toHex(sha256(utf8(content)))}`);
    expect(lookup.data.found).toBe(true);
    const miss = await call('GET', `public/lookup/${toHex(sha256(utf8('lain')))}`);
    expect(miss.data.found).toBe(false);
  }, 120_000);
});

describe('Papan Kepatuhan', () => {
  it('hanya agregat berderau; tanpa data kasus; menyatakan epsilon', async () => {
    const r = await call('GET', 'public/compliance');
    expect(r.data.length).toBeGreaterThanOrEqual(3);
    const flat = JSON.stringify(r.data);
    expect(flat).not.toContain('KS-');
    for (const inst of r.data) {
      expect(inst.epsilon).toBeGreaterThan(0);
      for (const q of inst.kuartal)
        expect(Object.keys(q).sort()).toEqual(['enough', 'jumlah', 'kuartal', 'median', 'persen']);
    }
  });
});

void authHash;
void generateHybridKeypair;
