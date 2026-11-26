/** Pembantu uji API: memanggil router langsung tanpa server, membuat akun anonim, dan mengirim laporan. */
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { expect } from 'vitest';
import {
  b64u,
  deriveAccountKeys,
  encryptJson,
  generateCaseCode,
  padTo,
  randomBytes,
  toHex,
  utf8,
} from '@gema/crypto';
import { blindInputs, finalizeInputs } from '@gema/oprf';
import { ownerKeyFromDek } from '@gema/zk';
import { AAD, VAULT_SIZE } from '@/lib/laporan/report-format';
import { buildReport } from '@/lib/laporan/report-build';

export const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gema-e2e-'));
process.env.GEMA_DATA_DIR = dir;
// Fixture lengkap (pelapor dan kasus rekaan) hanya untuk pengujian; produk dimulai kosong.
process.env.GEMA_SEED_CONTOH = 'on';

let handle: (req: Request, method: string, seg: string[]) => Promise<Response>;

/** Mengarahkan fetch() klien (src/lib/api.ts) langsung ke router, supaya fungsi klien asli bisa diuji tanpa server. */
export function installFetch() {
  // store.ts memberi tahu komponen lewat window; di Node cukup peredam.
  (globalThis as { window?: unknown }).window ??= { dispatchEvent: () => true };
  globalThis.fetch = (async (input: string, init: RequestInit = {}) => {
    const url = new URL(String(input), 'http://localhost');
    const method = init.method ?? 'GET';
    const req = new Request(url, { ...init, method });
    return handle(req, method, url.pathname.replace(/^\/api\//, '').split('/'));
  }) as typeof fetch;
}

/** Panggil sekali di beforeAll: memuat router setelah GEMA_DATA_DIR diatur. */
export async function setup() {
  ({ handle } = await import('@/server/router'));
  await call('GET', 'public/health');
}

export async function call(
  method: string,
  p: string,
  opts: { token?: string; body?: unknown; raw?: Uint8Array } = {},
) {
  const headers: Record<string, string> = {
    'x-forwarded-for': '10.0.0.' + Math.floor(Math.random() * 250),
  };
  if (opts.token) headers.authorization = 'Bearer ' + opts.token;
  let body: BodyInit | undefined;
  if (opts.raw) body = opts.raw as unknown as BodyInit;
  else if (opts.body !== undefined) {
    headers['content-type'] = 'application/json';
    body = JSON.stringify(opts.body);
  }
  const req = new Request('http://localhost/api/' + p, { method, headers, body });
  const res = await handle(req, method, p.split('?')[0].split('/'));
  const type = res.headers.get('content-type') ?? '';
  const data = type.includes('json') ? await res.json() : new Uint8Array(await res.arrayBuffer());
  return { status: res.status, data: data as any };
}

export const ITER = 600_000;
export async function newAccount(withDecoy?: string) {
  const code = generateCaseCode();
  const pass = 'satu dua tiga empat lima enam';
  const k = await deriveAccountKeys(code, pass, ITER);
  const real = {
    authKey: b64u(k.authKey),
    vaultBlob: b64u(padTo(await encryptJson(k.kek, { t: 'real' }, AAD.vault), VAULT_SIZE)),
  };
  const empty = { authKey: b64u(randomBytes(32)), vaultBlob: b64u(randomBytes(VAULT_SIZE)) };
  const reg = await call('POST', 'auth/register', {
    body: { caseCode: code, slots: [empty, real] },
  });
  expect(reg.status).toBe(201);
  const login = await call('POST', 'auth/login', {
    body: { caseCode: code, authKey: real.authKey },
  });
  expect(login.status).toBe(200);
  void withDecoy;
  return {
    code,
    pass,
    keys: k,
    token: login.data.token as string,
    scope: login.data.scopeId as string,
  };
}

async function evalFp(token: string, institutionId: string, draftId: string, inputs: string[]) {
  const blinded = blindInputs(inputs);
  const r = await call('POST', 'oprf/evaluate', {
    token,
    body: { institutionId, draftId, blinded: blinded.map((b) => toHex(b.blinded)) },
  });
  if (r.status !== 200) throw new Error('oprf ' + r.status + ' ' + r.data.error);
  return finalizeInputs(blinded, r.data.evaluated);
}

export async function submitReport(
  acc: Awaited<ReturnType<typeof newAccount>>,
  nama: string,
  attrs: any,
  text = 'isi berkas bukti rahasia',
  institutionId = 'inst-demo',
) {
  const built = await buildReport({
    kek: acc.keys.kek,
    narasi: {
      kapan: 'kemarin',
      dimana: 'kampus',
      apa: 'cerita rahasia pelapor',
      saksi: '',
      bukti: '',
      dampak: '',
      terlapor: { nama, unitId: 'u-ft', unitNama: 'Fakultas Teknik dan Sains', peran: attrs.role },
      atribut: attrs,
    },
    attrs,
    files: [{ nama: 'bukti.txt', tipe: 'text/plain', bytes: utf8(text) }],
    fp: (inputs) => evalFp(acc.token, institutionId, 'draft-' + randomId(), inputs),
  });
  const res = await call('POST', 'reports', {
    token: acc.token,
    body: {
      institutionId,
      unitId: 'u-ft',
      k: 2,
      ownerPub: ownerKeyFromDek(built.dek).publicKey,
      secrets: built.secrets,
      fingerprints: built.fingerprints,
      evidence: built.evidence.map(({ blob, ...m }) => m),
    },
  });
  if (res.status !== 201) return { res, built };
  for (const e of res.data.evidence) {
    const ev = built.evidence.find((x) => x.clientId === e.clientId)!;
    const up = await call('PUT', `evidence/${e.id}/blob`, { token: acc.token, raw: ev.blob });
    expect(up.status).toBe(200);
  }
  return { res, built };
}

const randomId = () => b64u(randomBytes(6));

/** Mematikan Empat Mata butuh persetujuan anggota panel lain: Ketua meminta, Pimpinan menyetujui, Ketua mengulang. */
export async function cabutEmpatMata(ketua: string, penyetuju: string) {
  const minta = await call('POST', 'satgas/panel', { token: ketua, body: { mode: 'tunggal' } });
  if (minta.status !== 409) return minta;
  const daftar = await call('GET', 'satgas/approvals', { token: penyetuju });
  const a = daftar.data.menungguKamu.find((x: { cabut?: boolean }) => x.cabut);
  await call('POST', `satgas/approvals/${a.id}/approve`, { token: penyetuju, body: {} });
  return call('POST', 'satgas/panel', { token: ketua, body: { mode: 'tunggal' } });
}
