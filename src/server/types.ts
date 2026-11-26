import type { HybridPublicKey, WrappedKey } from '@gema/pq-kem';

type FpMode = 'oprf' | 'hmac';
export type SatgasRole = 'Ketua' | 'Anggota' | 'Auditor' | 'Pimpinan' | 'Pengawas' | 'Admin';
export const CASE_STATUSES = [
  'Diterima',
  'Verifikasi',
  'Rekomendasi',
  'Tindak lanjut pimpinan',
  'Selesai',
] as const;
export type CaseStatus = (typeof CASE_STATUSES)[number];

export type Institution = {
  id: string;
  nama: string;
  kota: string;
  demo: boolean;
  public_key_satgas: HybridPublicKey;
  /** false pada institusi sungguhan sampai Ketua membuat kunci sendiri; selama itu eskalasi ditolak */
  kunci_siap?: boolean;
  sla_hari: number;
  fp_mode: FpMode;
  papan_publik: boolean;
  /** ambang tiap tingkat dalam hari kerja keterlambatan */
  ambang_tangga: { t1: number; t2: number; t3: number };
  dp_epsilon: number;
  panel_mode: 'tunggal' | '2dari3';
  /** layanan rujukan milik kampus (psikolog, bantuan hukum, klinik); layanan nasional ada di klien */
  rujukan?: Rujukan[];
};

type Rujukan = {
  nama: string;
  jenis: 'psikolog' | 'hukum' | 'medis' | 'pendamping' | 'lainnya';
  kontak: string;
  catatan?: string;
};

type Unit = {
  id: string;
  institution_id: string;
  nama: string;
  tipe: 'Fakultas' | 'Prodi' | 'Unit kerja';
};

type Reporter = {
  id: string;
  case_code: string;
  created_at: number;
  /** Pemulihan lewat orang tepercaya: kunci pelapor dibungkus dengan rahasia yang dipecah 2-dari-3. Server tidak pernah melihat rahasianya. */
  /** Passkey dengan ekstensi PRF sebagai jalan masuk tambahan ke brankas asli. Rahasia PRF tidak pernah meninggalkan perangkat. */
  passkey?: {
    cred_id: string;
    salt: string;
    auth_hash: string;
    wrapped_kek: string;
    scope_id: string;
    set_at: number;
  };
  recovery?: { auth_hash: string; wrapped_kek: string; scope_id: string; set_at: number };
};

/** Selalu 2 per akun; yang tak dipakai berisi nilai acak seukuran. Tidak ada kolom yang membedakan slot asli dan umpan. */
type AuthSlot = {
  slot_id: string;
  reporter_id: string;
  scope_id: string;
  auth_hash: string;
  vault_blob: string;
};

type ReportSecrets = {
  narasi_ciphertext: string; // b64u
  dek_wrapped_klien: string; // b64u
  bukti_meta_ciphertext: string; // b64u
};

export type Report = {
  id: string;
  reporter_id: string;
  scope_id: string;
  institution_id: string;
  unit_id: string;
  status: 'tersimpan' | 'tereskalasi';
  k_threshold: number;
  include_weak: boolean;
  opt_in: boolean;
  created_at: number;
  secrets: ReportSecrets;
  /** Kunci publik Schnorr (P-256) untuk Bukti Pemilik; kuncinya diturunkan dari DEK, jadi hanya pelapor yang bisa membuat bukti. */
  owner_pub?: string;
  /** Eskalasi Bersyarat: pembungkus kunci yang sudah disiapkan pelapor; dijalankan otomatis bila syarat terpenuhi. */
  conditional?: Conditional;
};

type Conditional = {
  escalation_id: string;
  wrapped: WrappedKey;
  prioritas: boolean;
  /** jumlah pelapor berbeda (termasuk diri sendiri) pada klaster yang memicu eskalasi */
  min_size: number;
  set_at: number;
};

type Evidence = {
  id: string;
  report_id: string;
  sha256_asli: string;
  message_root: string | null;
  jumlah_pesan: number | null;
  ukuran: number; // ukuran ciphertext
  tipe: string;
  uploaded_at: number;
  leaf: string;
  blob_ready: boolean;
  anchor_id: string | null;
};

export type Fingerprint = {
  report_id: string;
  varian: 'V1' | 'V2' | 'V3' | 'V4' | 'W1' | 'W2' | 'S1' | 'S2' | 'S3';
  tingkat: 'kuat' | 'lemah' | 'penguat';
  fp_hash: string;
  unit_id: string;
};

export type Escalation = {
  id: string;
  report_id: string;
  institution_id: string;
  alias: string; // ID acak untuk notifikasi
  sumber: 'bersama' | 'tunggal';
  dek_wrapped_satgas: WrappedKey;
  escalated_at: number;
  sla_due_at: number;
  status: CaseStatus;
  /** pelapor menandai bergantung secara akademik pada terlapor; hanya sebuah boolean, diberikan atas persetujuan saat eskalasi */
  prioritas: boolean;
  tingkat_tangga: 0 | 1 | 2 | 3;
  opened_at: number | null;
  selesai_at: number | null;
  /** anggota Satgas yang bertanggung jawab atas kasus (ditetapkan Ketua); null = belum ditugaskan */
  assignee_id?: string | null;
  assigned_at?: number | null;
};

type CaseEvent = {
  id: string;
  escalation_id: string;
  actor_role: SatgasRole | 'sistem' | 'pelapor';
  tipe: string;
  label: string;
  catatan_ciphertext: string | null;
  at: number;
};
type LadderEvent = {
  id: string;
  escalation_id: string;
  alias: string;
  tingkat: 1 | 2 | 3;
  notified_role: string;
  hari_terlambat: number;
  at: number;
};

type Member = {
  id: string;
  institution_id: string;
  email: string;
  nama: string;
  role: SatgasRole;
  pass_hash: string;
};

type Anchor = {
  id: string;
  tanggal: string; // YYYY-MM-DD (WIB)
  merkle_root: string;
  jumlah_hash: number;
  leaves: string[];
  chain_hash: string;
  commit_ref: string | null;
  created_at: number;
};

export type AuditEntry = {
  id: string;
  aktor: string;
  aksi: string;
  objek: string;
  at: number;
  prev_hash: string;
  hash: string;
};
type RadarSnapshot = {
  unit_id: string;
  unit_nama: string;
  institution_id: string;
  periode: string;
  bucket: '3-5' | '6-10' | '>10' | null;
  pola_berulang: boolean;
  epsilon: number;
};
type ComplianceSnapshot = {
  institution_id: string;
  kuartal: string;
  enough: boolean;
  persen: number | null;
  median_bucket: string | null;
  jumlah_bucket: string | null;
  epsilon: number;
  created_at: number;
};

export type Session =
  | { kind: 'reporter'; reporter_id: string; scope_id: string; exp: number }
  | { kind: 'satgas'; member_id: string; institution_id: string; role: SatgasRole; exp: number };

/**
 * Keadaan yang dulu hanya di memori proses: sesi (kunci = SHA-256 token), jendela pembatas laju
 * (kunci sudah di-hash, garam IP harian tidak disimpan), dan tantangan Bukti Pemilik. Disimpan agar restart
 * server tidak mengeluarkan pengguna atau mengulang hitungan percobaan masuk.
 */
type Runtime = {
  sessions: Record<string, Session>;
  hits: Record<string, Record<string, number[]>>;
  challenges: Record<string, number>;
};

/** Mode Empat Mata: satu anggota meminta akses dosir, anggota lain yang berbeda menyetujuinya. */
type Approval = {
  id: string;
  escalation_id: string;
  institution_id: string;
  requester_id: string;
  approver_id: string | null;
  requested_at: number;
  approved_at: number | null;
};

export type DB = {
  v: 1;
  institutions: Record<string, Institution>;
  units: Unit[];
  reporters: Record<string, Reporter>;
  slots: AuthSlot[];
  reports: Record<string, Report>;
  evidence: Record<string, Evidence>;
  fingerprints: Fingerprint[];
  escalations: Record<string, Escalation>;
  events: CaseEvent[];
  ladder: LadderEvent[];
  members: Record<string, Member>;
  anchors: Anchor[];
  audit: AuditEntry[];
  radar: RadarSnapshot[];
  compliance: ComplianceSnapshot[];
  approvals: Approval[];
  runtime: Runtime;
  clock: { demoOffsetMs: number };
  meta: { seededAt: number; contoh?: boolean; adminDiperbarui?: number };
};
