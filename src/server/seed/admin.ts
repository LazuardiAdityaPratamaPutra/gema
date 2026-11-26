/**
 * Mode sungguhan (Mode Demo mati): institusi UPN Veteran Jawa Timur yang asli, tanpa data atau akun rekaan.
 * Akun admin Satgas dibuat dari variabel lingkungan `GEMA_SATGAS_AKUN`, bukan dari kode.
 *
 * Contoh nilai (satu baris JSON):
 *   [{"email":"ketua@upnjatim.ac.id","nama":"Nama Ketua","role":"Ketua","password":"sandi-panjang-rahasia"}]
 */
import { generateHybridKeypair } from '@gema/pq-kem';
import { DEMO_UNITS } from '@/lib/demo/demo';
import { demoEnabled } from '../demo-flag';
import type { DB, SatgasRole } from '../types';
import { uid } from '../util';
import { RUJUKAN_UPN } from './institusi';
import { checkPassword, hashPassword } from './password';

const INSTITUSI_SUNGGUHAN_ID = 'inst-upnjatim';

type AkunAdmin = { email: string; nama: string; role: SatgasRole; password: string };

const PERAN: readonly SatgasRole[] = ['Ketua', 'Anggota', 'Auditor', 'Pimpinan', 'Pengawas'];
const MIN_SANDI = 12;
const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function bacaJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error('GEMA_SATGAS_AKUN bukan JSON yang valid.');
  }
}

const teks = (v: unknown) => (typeof v === 'string' ? v : '');

/** Satu akun: isian dinormalkan lalu diperiksa; galat menyebut nomor akunnya. */
function periksaAkun(x: unknown, nomor: number, dipakai: Set<string>): AkunAdmin {
  const n = `Akun ke-${nomor} di GEMA_SATGAS_AKUN`;
  const a = (x ?? {}) as Record<string, unknown>;
  const email = teks(a.email).trim().toLowerCase();
  const nama = teks(a.nama).trim();
  const role = a.role as SatgasRole;
  const password = teks(a.password);
  if (!RE_EMAIL.test(email)) throw new Error(`${n}: email tidak valid.`);
  if (dipakai.has(email)) throw new Error(`${n}: email ${email} dipakai dua kali.`);
  if (!nama || nama.length > 80) throw new Error(`${n}: nama kosong atau lebih dari 80 huruf.`);
  if (!PERAN.includes(role))
    throw new Error(`${n}: role harus salah satu dari ${PERAN.join(', ')}.`);
  if (password.length < MIN_SANDI)
    throw new Error(`${n}: kata sandi minimal ${MIN_SANDI} karakter.`);
  dipakai.add(email);
  return { email, nama, role, password };
}

/** Membaca dan memeriksa `GEMA_SATGAS_AKUN`. Salah isi dilaporkan dengan jelas, bukan diam-diam diabaikan. */
export function parseAkunAdmin(raw: string | undefined): AkunAdmin[] {
  if (!raw || !raw.trim()) return [];
  const data = bacaJson(raw);
  if (!Array.isArray(data) || data.length === 0)
    throw new Error('GEMA_SATGAS_AKUN harus berupa daftar akun yang tidak kosong.');
  const dipakai = new Set<string>();
  const hasil = data.map((x, i) => periksaAkun(x, i + 1, dipakai));
  if (!hasil.some((h) => h.role === 'Ketua'))
    throw new Error('GEMA_SATGAS_AKUN harus memuat minimal satu akun Ketua.');
  return hasil;
}

/**
 * Institusi sungguhan. Kunci publik Satgas di sini hanya penampung: pasangan kuncinya dibuat lalu rahasianya
 * langsung dibuang, dan `kunci_siap` tetap false sehingga eskalasi ditolak sampai Ketua membuat kunci sendiri.
 * Dengan begitu tidak ada dosir nyata yang pernah terkunci ke kunci yang diketahui orang lain.
 */
export function seedInstitusiSungguhan(db: DB) {
  const id = INSTITUSI_SUNGGUHAN_ID;
  db.institutions[id] = {
    id,
    nama: 'UPN Veteran Jawa Timur',
    kota: 'Surabaya',
    demo: false,
    public_key_satgas: generateHybridKeypair().publicKey,
    kunci_siap: false,
    sla_hari: 3, // Permendikbudristek 55/2024 Pasal 53: laporan ditindaklanjuti paling lambat 3 hari kerja
    fp_mode: 'oprf',
    papan_publik: true,
    ambang_tangga: { t1: 0, t2: 3, t3: 10 },
    dp_epsilon: 1,
    panel_mode: 'tunggal',
    rujukan: RUJUKAN_UPN,
  };
  for (const u of DEMO_UNITS) db.units.push({ ...u, institution_id: id });
}

/**
 * Dijalankan tiap basis data dimuat. Hanya di mode sungguhan: menyamakan akun admin dengan `GEMA_SATGAS_AKUN`
 * (akun baru dibuat, kata sandi atau peran yang berubah diperbarui). Akun yang dihapus dari variabel tidak
 * dihapus otomatis.
 */
export async function provisionAdmin(db: DB): Promise<void> {
  if (demoEnabled()) return;
  const akun = parseAkunAdmin(process.env.GEMA_SATGAS_AKUN);
  const inst = db.institutions[INSTITUSI_SUNGGUHAN_ID];
  if (!inst) {
    if (akun.length === 0) return;
    throw new Error(
      'Basis data ini dibuat dalam Mode Demo. Mode sungguhan memerlukan basis data baru: kosongkan GEMA_DATA_DIR atau gunakan basis data lain.',
    );
  }
  if (akun.length === 0) {
    console.warn(
      '[gema] GEMA_SATGAS_AKUN belum diatur: belum ada akun admin yang bisa masuk ke Satgas.',
    );
    return;
  }
  let berubah = false;
  for (const a of akun) {
    const ada = Object.values(db.members).find((m) => m.email === a.email);
    if (!ada) {
      const idm = uid(6);
      db.members[idm] = {
        id: idm,
        institution_id: inst.id,
        email: a.email,
        nama: a.nama,
        role: a.role,
        pass_hash: hashPassword(a.password),
      };
      berubah = true;
      continue;
    }
    if (ada.institution_id !== inst.id) continue;
    if (ada.nama !== a.nama || ada.role !== a.role) {
      ada.nama = a.nama;
      ada.role = a.role;
      berubah = true;
    }
    if (!checkPassword(a.password, ada.pass_hash)) {
      ada.pass_hash = hashPassword(a.password);
      berubah = true;
    }
  }
  if (berubah) db.meta.adminDiperbarui = Date.now();
}
