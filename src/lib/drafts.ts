/** Draf laporan terenkripsi di IndexedDB (autosave tiap 10 detik). Kunci = KEK dari sesi. Berkas bukti tidak disimpan di draf. */
import {
  aesGcmDecrypt,
  aesGcmEncrypt,
  b64u,
  fromB64u,
  fromUtf8,
  sha256,
  toHex,
  utf8,
} from '@gema/crypto';

const DB = 'gema-draf';
const STORE = 'draf';
const AAD = 'gema/draft/v1';

export type Draft = {
  kapan: string;
  dimana: string;
  apa: string;
  saksi: string;
  bukti: string;
  dampak: string;
  nama: string;
  alias: string;
  unitId: string;
  peran: string;
  periode: string;
  lokasi: string;
  k: number;
  institutionId: string;
  step: number;
  savedAt: number;
  relasi?: string;
};

function open(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

const slot = (caseCode: string, scope: string) =>
  toHex(sha256(utf8(`draf|${caseCode}|${scope}`))).slice(0, 24);

export async function saveDraft(
  kekB64: string,
  caseCode: string,
  scope: string,
  d: Draft,
): Promise<void> {
  const blob = await aesGcmEncrypt(fromB64u(kekB64), utf8(JSON.stringify(d)), AAD);
  const db = await open();
  await new Promise<void>((res, rej) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(b64u(blob), slot(caseCode, scope));
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
  db.close();
}

export async function loadDraft(
  kekB64: string,
  caseCode: string,
  scope: string,
): Promise<Draft | null> {
  try {
    const db = await open();
    const v = await new Promise<string | undefined>((res, rej) => {
      const r = db.transaction(STORE).objectStore(STORE).get(slot(caseCode, scope));
      r.onsuccess = () => res(r.result as string | undefined);
      r.onerror = () => rej(r.error);
    });
    db.close();
    if (!v) return null;
    return JSON.parse(fromUtf8(await aesGcmDecrypt(fromB64u(kekB64), fromB64u(v), AAD))) as Draft;
  } catch {
    return null;
  }
}

export async function clearDraft(caseCode: string, scope: string): Promise<void> {
  try {
    const db = await open();
    await new Promise<void>((res) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(slot(caseCode, scope));
      tx.oncomplete = () => res();
      tx.onerror = () => res();
    });
    db.close();
  } catch {
    /* abaikan */
  }
}
