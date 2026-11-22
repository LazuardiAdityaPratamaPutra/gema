/**
 * Passkey dengan ekstensi WebAuthn PRF: perangkat (sidik jari, PIN, kunci keamanan) menurunkan rahasia
 * yang tidak pernah meninggalkannya. Rahasia itu membungkus kunci brankas, jadi masuk tidak butuh
 * kata sandi. Catatan: passkey membuka brankas ASLI langsung, tidak lewat Kode Paksa.
 */
import {
  b64u,
  concat,
  fromB64u,
  normalizeCaseCode,
  randomBytes,
  sha256,
  unwrapKey,
  utf8,
  wrapKey,
} from '@gema/crypto';
import { api } from './api';
import { reporterStore, type ReporterSession } from './store';

const AAD_PK = 'gema/passkey/v1';

const derive = (prf: Uint8Array) => ({
  authKey: sha256(concat(utf8('gema/pk/auth'), prf)),
  wrapKey: sha256(concat(utf8('gema/pk/wrap'), prf)),
});

/** Salinan ArrayBuffer ke Uint8Array murni, karena WebAuthn meminta BufferSource. */
const buf = (b: Uint8Array): ArrayBuffer =>
  b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;

export function passkeySupported(): boolean {
  return typeof window !== 'undefined' && !!window.PublicKeyCredential && !!navigator.credentials;
}

async function evalPrf(credId: Uint8Array, salt: Uint8Array): Promise<Uint8Array> {
  const cred = (await navigator.credentials.get({
    publicKey: {
      challenge: buf(randomBytes(32)),
      allowCredentials: [{ type: 'public-key', id: buf(credId) }],
      userVerification: 'required',
      timeout: 60_000,
      extensions: { prf: { eval: { first: buf(salt) } } } as AuthenticationExtensionsClientInputs,
    },
  })) as PublicKeyCredential | null;
  const first = (
    cred?.getClientExtensionResults() as { prf?: { results?: { first?: ArrayBuffer } } } | undefined
  )?.prf?.results?.first;
  if (!first) throw new Error('Perangkat atau peramban ini tidak mendukung passkey dengan PRF.');
  return new Uint8Array(first);
}

export async function setupPasskey(s: ReporterSession): Promise<void> {
  if (!passkeySupported()) throw new Error('Peramban ini belum mendukung passkey.');
  const salt = randomBytes(32);
  const created = (await navigator.credentials.create({
    publicKey: {
      challenge: buf(randomBytes(32)),
      rp: { name: 'Gema' },
      user: { id: buf(randomBytes(16)), name: 'brankas-gema', displayName: 'Brankas Gema' },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },
        { type: 'public-key', alg: -257 },
      ],
      authenticatorSelection: { userVerification: 'required', residentKey: 'discouraged' },
      timeout: 60_000,
      extensions: { prf: {} } as AuthenticationExtensionsClientInputs,
    },
  })) as PublicKeyCredential | null;
  if (!created) throw new Error('Pembuatan passkey dibatalkan.');
  const enabled = (created.getClientExtensionResults() as { prf?: { enabled?: boolean } }).prf
    ?.enabled;
  if (!enabled) throw new Error('Passkey ini tidak mendukung PRF. Coba perangkat atau kunci lain.');
  const credId = new Uint8Array(created.rawId);
  const k = derive(await evalPrf(credId, salt));
  await api('auth/passkey', {
    token: s.token,
    body: {
      credId: b64u(credId),
      salt: b64u(salt),
      authKey: b64u(k.authKey),
      wrappedKek: b64u(await wrapKey(k.wrapKey, fromB64u(s.kek), AAD_PK)),
    },
  });
}

export const passkeyStatus = (s: ReporterSession) =>
  api<{ set: boolean; setAt: number | null }>('auth/passkey', { token: s.token });

export const removePasskey = (s: ReporterSession) =>
  api('auth/passkey', { method: 'DELETE', token: s.token });

export async function loginWithPasskey(caseCodeRaw: string): Promise<ReporterSession> {
  if (!passkeySupported()) throw new Error('Peramban ini belum mendukung passkey.');
  const caseCode = normalizeCaseCode(caseCodeRaw);
  const ch = await api<{ credId: string; salt: string }>('auth/passkey/challenge', {
    body: { caseCode },
  });
  let prf: Uint8Array;
  try {
    prf = await evalPrf(fromB64u(ch.credId), fromB64u(ch.salt));
  } catch {
    throw new Error('Passkey tidak cocok untuk kode ini, atau dibatalkan.');
  }
  const k = derive(prf);
  const r = await api<{ token: string; scopeId: string; wrappedKek: string }>(
    'auth/passkey/login',
    { body: { caseCode, authKey: b64u(k.authKey) } },
  );
  const kek = await unwrapKey(k.wrapKey, fromB64u(r.wrappedKek), AAD_PK);
  const session: ReporterSession = {
    token: r.token,
    scopeId: r.scopeId,
    kek: b64u(kek),
    caseCode,
    vault: { t: 'real' },
  };
  reporterStore.set(session);
  return session;
}
