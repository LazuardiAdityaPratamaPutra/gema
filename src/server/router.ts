import { fromB64u } from '@gema/crypto';
import { DEMO_ACCOUNTS, DEMO_INSTITUTION_ID, DEMO_MEMBERS, DEMO_PASSWORD } from '@/lib/demo';
import { MAX_FILE } from '@/lib/report-format';
import { blobRead, blobWrite, getDb, persist, resetDb } from './db';
import {
  advanceStatus,
  anchorProof,
  audit,
  clusterCounts,
  createReport,
  deleteReport,
  endSession,
  clearConditional,
  escalate,
  setConditional,
  hmacFingerprints,
  ipHash,
  issueSession,
  limiters,
  loginReporter,
  matchInfo,
  nowFor,
  oprfEvaluate,
  readSession,
  registerReporter,
  sealAnchors,
  setDecoy,
  slaView,
  tick,
  withdrawEscalation,
  type Session,
} from './logic';
import {
  clearPasskey,
  clearRecovery,
  finishRecovery,
  loginWithPasskey,
  passkeyChallenge,
  passkeyStatus,
  recoveryStatus,
  setPasskey,
  setRecovery,
  startRecovery,
} from './logic-akun';
import {
  approvalsFor,
  approve,
  hasApproval,
  newChallenge,
  registerOwnerKey,
  requestApproval,
  setPanelMode,
  verifyOwner,
} from './logic-satgas';
import { checkPassword } from './seed';
import { CASE_STATUSES, type CaseStatus, type DB, type SatgasRole } from './types';
import { DAY, HttpError, uid } from './util';

type Ctx = { method: string; seg: string[]; req: Request; url: URL };

const json = (data: unknown, status = 200) =>
  Response.json(data, {
    status,
    headers: { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' },
  });

async function body<T = Record<string, unknown>>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new HttpError(400, 'Isi permintaan bukan JSON yang valid');
  }
}

function reporterSession(req: Request): Extract<Session, { kind: 'reporter' }> {
  const s = readSession(req.headers.get('authorization'));
  if (!s || s.kind !== 'reporter')
    throw new HttpError(401, 'Masuk dahulu dengan Kode Kasus dan passphrase.');
  return s;
}

function satgasSession(req: Request, roles?: SatgasRole[]): Extract<Session, { kind: 'satgas' }> {
  const s = readSession(req.headers.get('authorization'));
  if (!s || s.kind !== 'satgas') throw new HttpError(401, 'Masuk sebagai anggota Satgas dahulu.');
  if (roles && !roles.includes(s.role))
    throw new HttpError(403, 'Peranmu tidak memiliki akses ke bagian ini.');
  return s;
}

const clientIp = (req: Request) =>
  req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'lokal';

function memberOf(db: DB, s: Extract<Session, { kind: 'satgas' }>) {
  const m = db.members[s.member_id];
  if (!m) throw new HttpError(401, 'Sesi tidak valid');
  return m;
}

function reportView(db: DB, id: string) {
  const r = db.reports[id];
  const evidence = Object.values(db.evidence)
    .filter((e) => e.report_id === id)
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
    evidence,
    match: matchInfo(db, id),
    escalation: esc
      ? {
          id: esc.id,
          alias: esc.alias,
          sumber: esc.sumber,
          escalatedAt: esc.escalated_at,
          opened: !!esc.opened_at,
          wrapped: esc.dek_wrapped_satgas,
          sla: slaView(db, esc),
          events: db.events
            .filter((e) => e.escalation_id === esc.id && e.actor_role !== 'sistem')
            .map((e) => ({ at: e.at, label: e.label, actor: e.actor_role })),
          ladder: db.ladder
            .filter((l) => l.escalation_id === esc.id)
            .map((l) => ({ tingkat: l.tingkat, at: l.at })),
        }
      : null,
  };
}

export async function route({ method, seg, req, url }: Ctx): Promise<Response> {
  const db = await getDb();
  const [a, b, c, d] = seg;

  /* ---------- publik ---------- */
  if (a === 'public') {
    if (b === 'health') return json({ ok: true, at: new Date().toISOString() });
    if (b === 'institutions' && method === 'GET')
      return json(
        Object.values(db.institutions)
          .filter((i) => db.units.some((u) => u.institution_id === i.id))
          .map((i) => ({
            id: i.id,
            nama: i.nama,
            kota: i.kota,
            demo: i.demo,
            fpMode: i.fp_mode,
            slaHari: i.sla_hari,
            publicKey: i.public_key_satgas,
            rujukan: i.rujukan ?? [],
            units: db.units.filter((u) => u.institution_id === i.id),
          })),
      );
    if (b === 'anchors' && method === 'GET')
      return json(
        db.anchors
          .slice(-30)
          .reverse()
          .map((x) => ({
            date: x.tanggal,
            root: x.merkle_root,
            size: x.jumlah_hash,
            chainHash: x.chain_hash,
            commitRef: x.commit_ref,
            createdAt: x.created_at,
          })),
      );
    if (b === 'evidence' && c && method === 'GET') {
      const p = anchorProof(db, c);
      if (!p) throw new HttpError(404, 'Bukti tidak ditemukan');
      return json(p);
    }
    if (b === 'lookup' && c && method === 'GET') {
      if (!/^[0-9a-f]{64}$/.test(c)) throw new HttpError(400, 'Hash tidak valid');
      const hits = Object.values(db.evidence)
        .filter((e) => e.sha256_asli === c)
        .sort((x, y) => y.uploaded_at - x.uploaded_at);
      if (!hits.length) return json({ found: false });
      return json({ found: true, proof: anchorProof(db, hits[0].id) });
    }
    if (b === 'compliance' && method === 'GET') {
      const out = Object.values(db.institutions)
        .filter((i) => i.papan_publik)
        .map((i) => ({
          id: i.id,
          nama: i.nama,
          kota: i.kota,
          fiktif: i.demo,
          epsilon: i.dp_epsilon,
          kuartal: db.compliance
            .filter((x) => x.institution_id === i.id)
            .sort((x, y) => (x.kuartal < y.kuartal ? 1 : -1))
            .map((x) => ({
              kuartal: x.kuartal,
              enough: x.enough,
              persen: x.persen,
              median: x.median_bucket,
              jumlah: x.jumlah_bucket,
            })),
        }));
      return json(out);
    }
  }

  /* ---------- akun anonim ---------- */
  if (a === 'auth') {
    if (b === 'register' && method === 'POST')
      return json(registerReporter(db, (await body(req)) as never, clientIp(req)), 201);
    if (b === 'login' && method === 'POST')
      return json(loginReporter(db, (await body(req)) as never));
    if (b === 'logout' && method === 'POST') {
      endSession(req.headers.get('authorization'));
      return json({ ok: true });
    }
    if (b === 'decoy' && method === 'POST')
      return json(setDecoy(db, reporterSession(req), (await body(req)) as never));
    if (b === 'passkey' && !c && method === 'GET')
      return json(passkeyStatus(db, reporterSession(req)));
    if (b === 'passkey' && !c && method === 'POST')
      return json(setPasskey(db, reporterSession(req), (await body(req)) as never), 201);
    if (b === 'passkey' && !c && method === 'DELETE') {
      clearPasskey(db, reporterSession(req));
      return json({ ok: true });
    }
    if (b === 'passkey' && c === 'challenge' && method === 'POST')
      return json(passkeyChallenge(db, (await body(req)) as never));
    if (b === 'passkey' && c === 'login' && method === 'POST')
      return json(loginWithPasskey(db, (await body(req)) as never));
    if (b === 'recovery' && method === 'GET') return json(recoveryStatus(db, reporterSession(req)));
    if (b === 'recovery' && method === 'POST')
      return json(setRecovery(db, reporterSession(req), (await body(req)) as never), 201);
    if (b === 'recovery' && method === 'DELETE') {
      clearRecovery(db, reporterSession(req));
      return json({ ok: true });
    }
    if (b === 'recover' && !c && method === 'POST')
      return json(startRecovery(db, (await body(req)) as never));
    if (b === 'recover' && c === 'finish' && method === 'POST')
      return json(finishRecovery(db, reporterSession(req), (await body(req)) as never));
  }

  /* ---------- pelapor ---------- */
  if (a === 'me' && b === 'reports' && method === 'GET') {
    const s = reporterSession(req);
    return json({
      reports: Object.values(db.reports)
        .filter((r) => r.scope_id === s.scope_id)
        .sort((x, y) => y.created_at - x.created_at)
        .map((r) => reportView(db, r.id)),
    });
  }

  if (a === 'oprf' && b === 'evaluate' && method === 'POST')
    return json(oprfEvaluate(db, reporterSession(req), (await body(req)) as never, clientIp(req)));
  if (a === 'fp' && b === 'hmac' && method === 'POST')
    return json(
      hmacFingerprints(db, reporterSession(req), (await body(req)) as never, clientIp(req)),
    );

  if (a === 'reports' && !b && method === 'POST')
    return json(createReport(db, reporterSession(req), (await body(req)) as never), 201);

  if (a === 'evidence' && b && c === 'blob') {
    if (method === 'PUT') {
      const s = reporterSession(req);
      const ev = db.evidence[b];
      const rep = ev && db.reports[ev.report_id];
      if (!ev || !rep || rep.scope_id !== s.scope_id)
        throw new HttpError(404, 'Bukti tidak ditemukan');
      const buf = new Uint8Array(await req.arrayBuffer());
      if (buf.length > MAX_FILE + 1024) throw new HttpError(413, 'Berkas melebihi 20 MB');
      if (buf.length < 28) throw new HttpError(400, 'Berkas terenkripsi tidak valid');
      await blobWrite(ev.id, buf);
      ev.ukuran = buf.length;
      ev.blob_ready = true;
      persist(db);
      return json({ ok: true });
    }
    if (method === 'GET') {
      const ev = db.evidence[b];
      if (!ev) throw new HttpError(404, 'Bukti tidak ditemukan');
      const rep = db.reports[ev.report_id];
      const sess = readSession(req.headers.get('authorization'));
      let allowed = false;
      if (sess?.kind === 'reporter' && rep.scope_id === sess.scope_id) allowed = true;
      if (
        sess?.kind === 'satgas' &&
        ['Ketua', 'Anggota'].includes(sess.role) &&
        rep.institution_id === sess.institution_id &&
        rep.status === 'tereskalasi' &&
        hasApproval(
          db,
          sess,
          Object.values(db.escalations).find((x) => x.report_id === rep.id)?.id ?? '',
        )
      ) {
        allowed = true;
        audit(db, `${sess.role}:${memberOf(db, sess).nama}`, 'unduh-bukti', ev.id.slice(0, 6));
        persist(db);
      }
      if (!allowed) throw new HttpError(403, 'Tidak ada akses');
      const data = await blobRead(ev.id);
      if (!data) throw new HttpError(404, 'Berkas belum diunggah');
      return new Response(data as unknown as BodyInit, {
        headers: { 'content-type': 'application/octet-stream', 'cache-control': 'no-store' },
      });
    }
  }

  if (a === 'reports' && b) {
    const s = reporterSession(req);
    const r = db.reports[b];
    if (!r || r.scope_id !== s.scope_id) throw new HttpError(404, 'Laporan tidak ditemukan');
    if (c === 'settings' && method === 'POST') {
      const x = await body<{ k?: number; includeWeak?: boolean; optIn?: boolean }>(req);
      if (typeof x.k === 'number') r.k_threshold = Math.min(4, Math.max(2, Math.round(x.k)));
      if (typeof x.includeWeak === 'boolean') r.include_weak = x.includeWeak;
      if (typeof x.optIn === 'boolean') r.opt_in = x.optIn;
      persist(db);
      return json(reportView(db, r.id));
    }
    if (c === 'escalate' && method === 'POST') {
      const esc = escalate(db, s, b, (await body(req)) as never);
      return json({ ok: true, alias: esc.alias, due: esc.sla_due_at }, 201);
    }
    if (c === 'owner' && method === 'POST') {
      registerOwnerKey(db, s, b, String((await body<{ ownerPub?: string }>(req)).ownerPub ?? ''));
      return json({ ok: true }, 201);
    }
    if (c === 'bersyarat' && method === 'POST') {
      return json(setConditional(db, s, b, (await body(req)) as never), 201);
    }
    if (c === 'bersyarat' && method === 'DELETE') {
      clearConditional(db, s, b);
      return json({ ok: true });
    }
    if (c === 'withdraw' && method === 'POST') {
      withdrawEscalation(db, s, b);
      return json({ ok: true });
    }
    if (!c && method === 'DELETE') {
      await deleteReport(db, b);
      audit(db, 'pelapor-anonim', 'hapus-laporan', 'crypto-shredding');
      return json({ ok: true });
    }
  }

  /* ---------- Satgas ---------- */
  if (a === 'satgas') {
    if (b === 'login' && method === 'POST') {
      if (!limiters.misc.check('sl:' + ipHash(clientIp(req)), 20, 15 * 60_000))
        throw new HttpError(429, 'Terlalu banyak percobaan.');
      const x = await body<{ email?: string; password?: string; demoRole?: string }>(req);
      let m =
        x.demoRole && process.env.GEMA_DEMO !== 'off'
          ? Object.values(db.members).find(
              (mm) => mm.institution_id === DEMO_INSTITUTION_ID && mm.role === x.demoRole,
            )
          : undefined;
      if (!m)
        m = Object.values(db.members).find(
          (mm) => mm.email === String(x.email ?? '').toLowerCase(),
        );
      if (!m || (!x.demoRole && !checkPassword(String(x.password ?? ''), m.pass_hash)))
        throw new HttpError(401, 'Email atau kata sandi tidak cocok.');
      const token = issueSession({
        kind: 'satgas',
        member_id: m.id,
        institution_id: m.institution_id,
        role: m.role,
      });
      audit(db, `${m.role}:${m.nama}`, 'masuk', 'dashboard');
      persist(db);
      return json({
        token,
        member: { nama: m.nama, role: m.role, email: m.email },
        institution: {
          id: m.institution_id,
          nama: db.institutions[m.institution_id].nama,
          demo: db.institutions[m.institution_id].demo,
        },
      });
    }
    const s = satgasSession(req);
    const me = memberOf(db, s);
    const inst = db.institutions[s.institution_id];

    if (b === 'me')
      return json({
        member: { nama: me.nama, role: me.role, email: me.email },
        institution: {
          id: inst.id,
          nama: inst.nama,
          demo: inst.demo,
          slaHari: inst.sla_hari,
          publicKey: inst.public_key_satgas,
          panelMode: inst.panel_mode,
        },
        now: nowFor(db, inst.id),
      });

    if (b === 'cases' && !c && method === 'GET') {
      if (!['Ketua', 'Anggota', 'Pimpinan'].includes(s.role))
        throw new HttpError(403, 'Peranmu tidak memiliki akses ke daftar kasus.');
      await tick(db);
      const list = Object.values(db.escalations)
        .filter((e) => e.institution_id === inst.id)
        .sort(
          (x, y) =>
            Number(!!y.prioritas && y.status !== 'Selesai') -
              Number(!!x.prioritas && x.status !== 'Selesai') || x.sla_due_at - y.sla_due_at,
        )
        .map((e) => {
          const sla = slaView(db, e);
          const base = {
            id: e.id,
            alias: e.alias,
            sla,
            status: e.status,
            escalatedAt: e.escalated_at,
            prioritas: !!e.prioritas,
          };
          if (s.role === 'Pimpinan') return base; // hanya status dan SLA
          return {
            ...base,
            sumber: e.sumber,
            unit: db.units.find((u) => u.id === db.reports[e.report_id]?.unit_id)?.nama ?? '',
            cluster: clusterCounts(db, e.report_id),
            opened: !!e.opened_at,
          };
        });
      return json({ cases: list, now: nowFor(db, inst.id) });
    }

    if (b === 'cases' && c) {
      const e = db.escalations[c];
      if (!e || e.institution_id !== inst.id) throw new HttpError(404, 'Kasus tidak ditemukan');
      if (d === 'status' && method === 'POST') {
        satgasSession(req, ['Ketua', 'Anggota', 'Pimpinan']);
        const x = await body<{ to: CaseStatus }>(req);
        if (!CASE_STATUSES.includes(x.to)) throw new HttpError(400, 'Status tidak dikenal');
        if (x.to === 'Selesai' && !['Ketua', 'Pimpinan'].includes(s.role))
          throw new HttpError(403, 'Hanya Ketua atau Pimpinan yang dapat menyelesaikan kasus.');
        if (s.role === 'Pimpinan' && x.to !== 'Selesai')
          throw new HttpError(403, 'Pimpinan hanya dapat menyelesaikan kasus.');
        advanceStatus(db, e, x.to, { role: s.role, name: me.nama });
        return json({ ok: true });
      }
      satgasSession(req, ['Ketua', 'Anggota']);
      if (d === 'challenge' && method === 'POST') return json(newChallenge(db, s, e.id), 201);
      if (d === 'verify-owner' && method === 'POST')
        return json(verifyOwner(db, s, e.id, (await body(req)) as never));
      if (d === 'approval' && method === 'POST')
        return json({ ok: true, approval: requestApproval(db, s, e.id) }, 201);
      if (d === 'notes' && method === 'POST') {
        const x = await body<{ catatan_ciphertext: string }>(req);
        fromB64u(x.catatan_ciphertext);
        db.events.push({
          id: uid(8),
          escalation_id: e.id,
          actor_role: s.role,
          tipe: 'catatan',
          label: 'Catatan internal ditambahkan.',
          catatan_ciphertext: x.catatan_ciphertext,
          at: nowFor(db, inst.id),
        });
        audit(db, `${s.role}:${me.nama}`, 'tambah-catatan', e.alias);
        persist(db);
        return json({ ok: true });
      }
      if (!d && method === 'GET') {
        if (!hasApproval(db, s, e.id))
          return json(
            { error: 'Mode Empat Mata: butuh persetujuan anggota lain.', needApproval: true },
            403,
          );
        const rep = db.reports[e.report_id];
        if (!e.opened_at) {
          e.opened_at = nowFor(db, inst.id);
          audit(db, `${s.role}:${me.nama}`, 'buka-dosir', e.alias);
          persist(db);
        }
        return json({
          escalation: {
            id: e.id,
            alias: e.alias,
            sumber: e.sumber,
            status: e.status,
            wrapped: e.dek_wrapped_satgas,
            institutionId: inst.id,
            prioritas: !!e.prioritas,
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
        });
      }
    }

    if (b === 'panel' && method === 'POST') {
      const x = await body<{ mode?: string }>(req);
      setPanelMode(db, s, x.mode as never);
      return json({ ok: true, panelMode: inst.panel_mode });
    }
    if (b === 'approvals' && !c && method === 'GET') {
      satgasSession(req, ['Ketua', 'Anggota', 'Pimpinan']);
      return json(approvalsFor(db, s));
    }
    if (b === 'approvals' && c && d === 'approve' && method === 'POST') {
      approve(db, s, c);
      return json({ ok: true });
    }
    if (b === 'key' && method === 'POST') {
      satgasSession(req, ['Ketua']);
      const x = await body<{ publicKey?: { suite?: string; ecdh?: string; mlkem?: string } }>(req);
      const k = x.publicKey;
      if (
        !k ||
        k.suite !== 'ecdh-p256+mlkem768-v1' ||
        !k.ecdh ||
        !k.mlkem ||
        fromB64u(k.ecdh).length !== 33 ||
        fromB64u(k.mlkem).length !== 1184
      )
        throw new HttpError(400, 'Kunci publik tidak valid');
      inst.public_key_satgas = { suite: k.suite, ecdh: k.ecdh, mlkem: k.mlkem };
      audit(db, `${s.role}:${me.nama}`, 'ganti-kunci-satgas', 'kunci publik institusi');
      persist(db);
      return json({ ok: true });
    }
    if (b === 'audit' && method === 'GET') {
      satgasSession(req, ['Auditor', 'Ketua']);
      return json({ entries: db.audit.slice(-200).reverse(), total: db.audit.length });
    }
    if (b === 'radar' && method === 'GET') {
      satgasSession(req, ['Pimpinan']);
      return json({
        snapshots: db.radar
          .filter((x) => x.institution_id === inst.id)
          .map((x) => ({
            unit: x.unit_nama,
            periode: x.periode,
            bucket: x.bucket,
            polaBerulang: x.pola_berulang,
            epsilon: x.epsilon,
          })),
      });
    }
    if (b === 'ladder' && method === 'GET') {
      await tick(db);
      const mine = db.ladder.filter(
        (l) => db.escalations[l.escalation_id]?.institution_id === inst.id,
      );
      if (s.role === 'Ketua')
        return json({
          events: mine
            .filter((l) => l.tingkat >= 1)
            .map((l) => ({
              alias: l.alias,
              tingkat: l.tingkat,
              hariTerlambat: l.hari_terlambat,
              at: l.at,
              ke: l.notified_role,
            })),
        });
      if (s.role === 'Pimpinan')
        return json({
          events: mine
            .filter((l) => l.tingkat >= 2)
            .map((l) => ({
              alias: l.alias,
              tingkat: l.tingkat,
              hariTerlambat: l.hari_terlambat,
              at: l.at,
              ke: l.notified_role,
            })),
        });
      if (s.role === 'Pengawas')
        return json({
          agregat: {
            kasusTerlambatT3: Object.values(db.escalations).filter(
              (e) =>
                e.institution_id === inst.id && e.tingkat_tangga === 3 && e.status !== 'Selesai',
            ).length,
          },
        });
      throw new HttpError(403, 'Peranmu tidak menerima notifikasi tangga.');
    }
  }

  /* ---------- demo ---------- */
  if (a === 'demo') {
    if (process.env.GEMA_DEMO === 'off') throw new HttpError(404, 'Mode Demo dinonaktifkan');
    if (!limiters.misc.check('demo:' + ipHash(clientIp(req)), 60, 60_000))
      throw new HttpError(429, 'Terlalu cepat.');
    if (b === 'info' && method === 'GET')
      return json({
        institutionId: DEMO_INSTITUTION_ID,
        accounts: DEMO_ACCOUNTS,
        members: DEMO_MEMBERS,
        password: DEMO_PASSWORD,
        offsetDays: Math.round(db.clock.demoOffsetMs / DAY),
        now: nowFor(db, DEMO_INSTITUTION_ID),
        pendingAnchors: Object.values(db.evidence).filter((e) => !e.anchor_id && e.blob_ready)
          .length,
      });
    if (b === 'advance' && method === 'POST') {
      const x = await body<{ days?: number }>(req);
      const days = Math.min(30, Math.max(1, Math.round(Number(x.days) || 1)));
      db.clock.demoOffsetMs += days * DAY;
      audit(db, 'demo', 'jam-demo-maju', `+${days} hari`);
      await tick(db);
      persist(db);
      return json({ offsetDays: Math.round(db.clock.demoOffsetMs / DAY) });
    }
    if (b === 'anchor-now' && method === 'POST') {
      const a2 = sealAnchors(db, true);
      return json({ sealed: !!a2, root: a2?.merkle_root ?? null, size: a2?.jumlah_hash ?? 0 });
    }
    if (b === 'reset' && method === 'POST') {
      await resetDb();
      return json({ ok: true });
    }
  }

  if (a === 'cron' && b === 'tick') {
    const secret = process.env.GEMA_CRON_SECRET;
    if (secret && req.headers.get('authorization') !== `Bearer ${secret}`)
      throw new HttpError(401, 'Tidak diizinkan');
    return json(await tick(db));
  }

  if (a === 'cron' && b === 'commit-ref' && method === 'POST') {
    const secret = process.env.GEMA_CRON_SECRET;
    if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`)
      throw new HttpError(401, 'Tidak diizinkan');
    const x = await body<{ date?: string; commitRef?: string }>(req);
    const an = db.anchors.find((q) => q.tanggal === x.date);
    if (!an || !/^[0-9a-f]{7,64}$/.test(String(x.commitRef)))
      throw new HttpError(400, 'Data tidak valid');
    if (an.commit_ref) throw new HttpError(409, 'Komit sudah tercatat');
    an.commit_ref = String(x.commitRef);
    persist(db);
    return json({ ok: true });
  }

  void url;
  throw new HttpError(404, 'Rute tidak ditemukan');
}

export async function handle(req: Request, method: string, seg: string[]): Promise<Response> {
  try {
    return await route({ method, seg, req, url: new URL(req.url) });
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    console.error('[api]', e);
    return json({ error: 'Terjadi kesalahan di server.' }, 500);
  }
}
