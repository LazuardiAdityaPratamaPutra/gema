/** Catatan Penanganan: ringkasan kronologi kasus yang bisa dibawa pelapor ke pihak luar. Dibuat di perangkat. */
import { toHex, sha256Async, utf8 } from '@gema/crypto';
import type { ReportView } from '@/lib/vault/vault-client';

const TINGKAT = ['', 'Ketua Satgas', 'Pimpinan kampus', 'Pengawas kementerian (hanya angka)'];

const WIB = new Intl.DateTimeFormat('id-ID', {
  dateStyle: 'long',
  timeStyle: 'short',
  timeZone: 'Asia/Jakarta',
});
const wib = (ts: number) => `${WIB.format(ts)} WIB`;

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** Isi catatan dalam bentuk data. Urutan kunci tetap, sehingga sidiknya stabil. */
export function dataCatatan(r: ReportView) {
  const e = r.escalation;
  if (!e) throw new Error('Laporan ini belum dikirim ke Satgas, jadi belum ada yang dicatat.');
  return {
    v: 1,
    kampus: r.institutionNama ?? '',
    kasusDiSatgas: e.alias,
    laporanDibuat: new Date(r.createdAt).toISOString(),
    dikirimKeSatgas: new Date(e.escalatedAt).toISOString(),
    tenggat: new Date(e.sla.due).toISOString(),
    terlambat: e.sla.terlambat,
    hariKerjaTerlambat: e.sla.hariTerlambat,
    tingkatSaatIni: e.sla.tingkat,
    dibukaSatgas: e.opened,
    dibukaSatgasPada: e.openedAt ? new Date(e.openedAt).toISOString() : null,
    riwayatStatus: e.events.map((x) => ({
      waktu: new Date(x.at).toISOString(),
      kejadian: x.label,
      oleh: x.actor,
    })),
    peringatanNaik: e.ladder.map((x) => ({
      waktu: new Date(x.at).toISOString(),
      tingkat: x.tingkat,
      kepada: TINGKAT[x.tingkat] ?? '',
    })),
    bukti: r.evidence.map((x) => ({
      sha256: x.sha256,
      diunggah: new Date(x.uploadedAt).toISOString(),
      akarHarianTerbit: x.anchored,
    })),
  };
}

export async function sidikCatatan(data: ReturnType<typeof dataCatatan>): Promise<string> {
  return toHex(await sha256Async(utf8(JSON.stringify(data))));
}

const baris = (rows: [string, string][]) =>
  rows.map(([k, v]) => `<tr><th scope="row">${esc(k)}</th><td>${esc(v)}</td></tr>`).join('');

/** HTML mandiri yang bisa dicetak. Tanpa skrip dan tanpa permintaan jaringan. */
export async function buildCatatanPenanganan(r: ReportView, now = Date.now()): Promise<string> {
  const data = dataCatatan(r);
  const sidik = await sidikCatatan(data);
  const e = r.escalation!;
  const status = e.events.length
    ? e.events.map(
        (x) => `<li>${esc(wib(x.at))}: ${esc(x.label)} <small>(${esc(x.actor)})</small></li>`,
      )
    : ['<li>Belum ada perubahan status yang dicatat.</li>'];
  const naik = e.ladder.length
    ? e.ladder.map(
        (x) =>
          `<li>${esc(wib(x.at))}: peringatan naik ke tingkat ${x.tingkat}, ${esc(TINGKAT[x.tingkat] ?? '')}.</li>`,
      )
    : ['<li>Belum ada peringatan keterlambatan.</li>'];
  const bukti = r.evidence.length
    ? r.evidence.map(
        (x) =>
          `<li><code>${esc(x.sha256)}</code>, diunggah ${esc(wib(x.uploadedAt))}, ${
            x.anchored ? 'akar harian sudah terbit' : 'menunggu akar harian'
          }</li>`,
      )
    : ['<li>Tidak ada berkas bukti.</li>'];

  return `<!doctype html>
<html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Catatan penanganan kasus ${esc(e.alias)}</title>
<style>
body{font:16px/1.6 system-ui,sans-serif;max-width:46rem;margin:2rem auto;padding:0 1rem;color:#1b1b1b}
h1{font-size:1.5rem;margin:0 0 .3rem}h2{font-size:1.1rem;margin:1.6rem 0 .4rem}
table{border-collapse:collapse;width:100%}th,td{text-align:left;padding:.35rem .5rem;border-bottom:1px solid #ddd;vertical-align:top}
th{width:34%;font-weight:600}code{word-break:break-all;font-size:.85em}small{color:#555}
.catatan{border:1px solid #bbb;padding:.7rem 1rem;margin-top:1.5rem;font-size:.92rem}
@media print{body{margin:0}}
</style></head><body>
<h1>Catatan penanganan kasus</h1>
<p>Dibuat di perangkat pelapor pada ${esc(wib(now))}. Tidak memuat nama, Kode Kasus, isi laporan, atau identitas anggota Satgas.</p>
<h2>Ringkasan</h2>
<table>${baris([
    ['Kampus', r.institutionNama ?? '-'],
    ['Nama kasus di Satgas', e.alias],
    ['Laporan dibuat', wib(r.createdAt)],
    ['Dikirim ke Satgas', wib(e.escalatedAt)],
    ['Tenggat tindak lanjut', wib(e.sla.due)],
    [
      'Keterlambatan',
      e.sla.terlambat
        ? `${e.sla.hariTerlambat} hari kerja, tingkat ${e.sla.tingkat}`
        : 'Belum terlambat',
    ],
    ['Dibuka oleh Satgas', e.opened && e.openedAt ? wib(e.openedAt) : e.opened ? 'Sudah' : 'Belum'],
  ])}</table>
<h2>Riwayat penanganan</h2><ol>${status.join('')}</ol>
<h2>Peringatan keterlambatan</h2><ol>${naik.join('')}</ol>
<h2>Berkas bukti</h2><ul>${bukti.join('')}</ul>
<p><small>Setiap berkas punya Sertifikat Bukti sendiri di aplikasi. Sertifikat itulah yang membuktikan berkas tidak berubah sejak diunggah.</small></p>
<h2>Sidik catatan</h2>
<p><code>${sidik}</code></p>
<div class="catatan"><strong>Batas catatan ini.</strong> Sidik di atas menunjukkan isi catatan tidak diubah sejak diunduh. Catatan ini disusun dari data aplikasi, bukan dokumen resmi kampus, dan tidak membuktikan bahwa isi laporan benar. Pihak lain dapat meminta Satgas mencocokkan nama kasus dan tanggal di atas dengan catatan mereka.</div>
</body></html>`;
}
