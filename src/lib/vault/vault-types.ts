/** Bentuk data yang dipertukarkan antara klien pelapor dan API. */
export type InstitutionInfo = {
  id: string;
  nama: string;
  kota: string;
  demo: boolean;
  /** false pada kampus sungguhan yang Ketuanya belum membuat kunci; eskalasi belum bisa */
  kunciSiap?: boolean;
  fpMode: 'oprf' | 'hmac';
  slaHari: number;
  publicKey: { suite: string; ecdh: string; mlkem: string };
  units: { id: string; nama: string; tipe: string }[];
  rujukan?: {
    nama: string;
    jenis: 'psikolog' | 'hukum' | 'medis' | 'pendamping' | 'lainnya';
    kontak: string;
    catatan?: string;
  }[];
};

type EvidenceView = {
  id: string;
  sha256: string;
  messageRoot: string | null;
  messageCount: number | null;
  ukuran: number;
  tipe: string;
  uploadedAt: number;
  blobReady: boolean;
  anchored: boolean;
};
export type SlaView = {
  status: string;
  due: number;
  escalated: number;
  hariSisa: number | null;
  hariTerlambat: number;
  tingkat: number;
  terlambat: boolean;
  h2: boolean;
};
export type ReportView = {
  id: string;
  institutionId: string;
  institutionNama: string;
  demo: boolean;
  unitId: string;
  unitNama: string;
  status: 'tersimpan' | 'tereskalasi';
  k: number;
  includeWeak: boolean;
  optIn: boolean;
  hasOwnerKey: boolean;
  conditional: null | { minSize: number; prioritas: boolean };
  createdAt: number;
  secrets: { narasi_ciphertext: string; dek_wrapped_klien: string; bukti_meta_ciphertext: string };
  evidence: EvidenceView[];
  match: {
    notify: boolean;
    size: number | null;
    confidence: 'rendah' | 'sedang' | 'tinggi' | null;
    weak: number | null;
    optedIn: number;
    flagFast: boolean;
  };
  escalation: null | {
    id: string;
    alias: string;
    sumber: string;
    escalatedAt: number;
    opened: boolean;
    openedAt: number | null;
    sla: SlaView;
    events: { at: number; label: string; actor: string }[];
    ladder: { tingkat: number; at: number }[];
  };
};
