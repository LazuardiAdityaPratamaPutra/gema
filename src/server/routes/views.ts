import { slaView, matchInfo, clusterCounts } from '../logic';
import type { DB, Escalation } from '../types';
import { memberName } from './helpers';

/** Ringkasan bukti yang dilihat pelapor pemiliknya. */
function reporterEvidence(db: DB, reportId: string) {
  return Object.values(db.evidence)
    .filter((e) => e.report_id === reportId)
    .map((e) => ({
      id: e.id,
      sha256: e.sha256_asli,
      messageRoot: e.message_root,
      messageCount: e.jumlah_pesan,
      ukuran: e.ukuran,
      tipe: e.tipe,
      uploadedAt: e.uploaded_at,
      blobReady: e.blob_ready,
      anchored: !!e.anchor_id,
    }));
}

function escalationForReporter(db: DB, esc: Escalation) {
  return {
    id: esc.id,
    alias: esc.alias,
    sumber: esc.sumber,
    escalatedAt: esc.escalated_at,
    opened: !!esc.opened_at,
    openedAt: esc.opened_at ?? null,
    wrapped: esc.dek_wrapped_satgas,
    sla: slaView(db, esc),
    events: db.events
      .filter((e) => e.escalation_id === esc.id && e.actor_role !== 'sistem')
      .map((e) => ({ at: e.at, label: e.label, actor: e.actor_role })),
    ladder: db.ladder
      .filter((l) => l.escalation_id === esc.id)
      .map((l) => ({ tingkat: l.tingkat, at: l.at })),
  };
}

/** Tampilan satu laporan untuk pelapor pemiliknya. */
export function reportView(db: DB, id: string) {
  const r = db.reports[id];
  const esc = Object.values(db.escalations).find((e) => e.report_id === id);
  return {
    id: r.id,
    institutionId: r.institution_id,
    institutionNama: db.institutions[r.institution_id]?.nama,
    demo: !!db.institutions[r.institution_id]?.demo,
    unitId: r.unit_id,
    unitNama: db.units.find((u) => u.id === r.unit_id)?.nama,
    status: r.status,
    k: r.k_threshold,
    includeWeak: r.include_weak,
    optIn: r.opt_in,
    hasOwnerKey: !!r.owner_pub,
    conditional: r.conditional
      ? { minSize: r.conditional.min_size, prioritas: r.conditional.prioritas }
      : null,
    createdAt: r.created_at,
    secrets: r.secrets,
    evidence: reporterEvidence(db, id),
    match: matchInfo(db, id),
    escalation: esc ? escalationForReporter(db, esc) : null,
  };
}

/** Satu baris daftar kasus. Pimpinan hanya melihat status, tenggat, dan penanggung jawab. */
export function caseListItem(db: DB, e: Escalation, role: string, memberId?: string) {
  const base = {
    id: e.id,
    alias: e.alias,
    sla: slaView(db, e),
    status: e.status,
    escalatedAt: e.escalated_at,
    prioritas: !!e.prioritas,
    penanggungJawab: memberName(db, e.assignee_id),
  };
  if (memberId && e.mundur?.includes(memberId)) return { ...base, mundur: true };
  if (role === 'Pimpinan') return base;
  return {
    ...base,
    sumber: e.sumber,
    unit: db.units.find((u) => u.id === db.reports[e.report_id]?.unit_id)?.nama ?? '',
    cluster: clusterCounts(db, e.report_id),
    opened: !!e.opened_at,
  };
}

/** Dosir satu kasus untuk Ketua atau Anggota yang sudah disetujui. */
export function dossierView(db: DB, e: Escalation, institutionId: string) {
  const rep = db.reports[e.report_id];
  return {
    escalation: {
      id: e.id,
      alias: e.alias,
      sumber: e.sumber,
      status: e.status,
      wrapped: e.dek_wrapped_satgas,
      institutionId,
      prioritas: !!e.prioritas,
      penanggungJawab: memberName(db, e.assignee_id),
      penanggungJawabId: e.assignee_id ?? null,
    },
    sla: slaView(db, e),
    report: {
      id: rep.id,
      unitNama: db.units.find((u) => u.id === rep.unit_id)?.nama,
      secrets: rep.secrets,
      createdAt: rep.created_at,
      flagFast: matchInfo(db, rep.id).flagFast,
    },
    evidence: Object.values(db.evidence)
      .filter((x) => x.report_id === rep.id)
      .map((x) => ({
        id: x.id,
        sha256: x.sha256_asli,
        messageRoot: x.message_root,
        messageCount: x.jumlah_pesan,
        ukuran: x.ukuran,
        tipe: x.tipe,
        uploadedAt: x.uploaded_at,
      })),
    events: db.events
      .filter((x) => x.escalation_id === e.id)
      .sort((x, y) => x.at - y.at)
      .map((x) => ({
        id: x.id,
        at: x.at,
        actor: x.actor_role,
        tipe: x.tipe,
        label: x.label,
        catatan: x.catatan_ciphertext,
      })),
    cluster: clusterCounts(db, rep.id),
  };
}
