/** Sertifikat Bukti (PDF), Paket Bukti (HTML mandiri), dan Paket Pengungkapan. Semuanya dibuat di perangkat. */
import { CERT_STATEMENT, type DisclosurePackage, type EvidenceCertificate } from '@gema/merkle';
import type * as QRCode from 'qrcode';
import type { Color, PDFDocument, PDFFont, PDFPage } from 'pdf-lib';
import { api } from '@/lib/api';

export async function fetchCertificate(evidenceId: string): Promise<EvidenceCertificate> {
  const p = await api<Omit<EvidenceCertificate, 'statement'>>(`public/evidence/${evidenceId}`);
  return { ...p, statement: CERT_STATEMENT };
}

export function triggerDownload(
  name: string,
  data: Blob | Uint8Array | string,
  type = 'application/octet-stream',
) {
  const blob = data instanceof Blob ? data : new Blob([data as BlobPart], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Paket Bukti: satu berkas HTML yang berjalan offline (Verifier Mandiri) dengan bukti tertanam. */
export async function buildProofPackage(
  cert: EvidenceCertificate,
  disclosure?: DisclosurePackage,
): Promise<string> {
  const tpl = await (await fetch('/verifier-template.html', { cache: 'no-store' })).text();
  const payload = JSON.stringify({
    certificate: cert,
    disclosure: disclosure ?? null,
    createdAt: new Date().toISOString(),
  })
    .replace(/</g, '\\u003c')
    .replace(new RegExp(String.fromCharCode(0x2028) + '|' + String.fromCharCode(0x2029), 'g'), '');
  const marker = '<script type="application/json" id="gema-proof">null</script>';
  if (!tpl.includes(marker)) throw new Error('Templat Verifier Mandiri tidak valid');
  return tpl.replace(marker, `<script type="application/json" id="gema-proof">${payload}</script>`);
}

type PdfOpts = { namaBerkas: string; ukuran: string; origin: string };

type Sheet = {
  page: PDFPage;
  serif: PDFFont;
  serifB: PDFFont;
  mono: PDFFont;
  sans: PDFFont;
  ink: Color;
  muted: Color;
  teal: Color;
  y: number;
};

const LEFT = 56;
const RIGHT = 539;
const TEXT_WIDTH = 483;

/** Memecah teks menjadi baris yang muat di lebar halaman. Mono memecah per karakter, selain itu per kata. */
function breakLines(words: string[], font: PDFFont, size: number, mono: boolean): string[] {
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const t = mono ? line + w : line ? line + ' ' + w : w;
    if (font.widthOfTextAtSize(t, size) > TEXT_WIDTH) {
      lines.push(line);
      line = w;
    } else line = t;
  }
  lines.push(line);
  return lines;
}

function drawLines(s: Sheet, lines: string[], size: number, font: PDFFont, gapAfter: number) {
  lines.forEach((line, i) => {
    s.page.drawText(line, { x: LEFT, y: s.y, size, font, color: s.ink });
    s.y -= i === lines.length - 1 ? size + gapAfter : size + 4;
  });
}

/** Satu bidang bersampul label kecil dan nilai yang dibungkus. */
function drawRow(s: Sheet, label: string, value: string, mono = false) {
  s.page.drawText(label.toUpperCase(), { x: LEFT, y: s.y, size: 8, font: s.sans, color: s.muted });
  s.y -= 13;
  const font = mono ? s.mono : s.serif;
  const size = mono ? 9 : 12;
  drawLines(s, breakLines(value.split(mono ? '' : ' '), font, size, mono), size, font, 14);
}

/** Paragraf biasa; baris akhir yang kosong tidak digambar. */
function drawParagraph(s: Sheet, text: string, size: number) {
  const lines = breakLines(text.split(' '), s.serif, size, false);
  if (!lines[lines.length - 1]) lines.pop();
  drawLines(s, lines, size, s.serif, 4);
}

function drawHeader(s: Sheet) {
  const { page } = s;
  page.drawText('Sertifikat Bukti', { x: LEFT, y: s.y, size: 28, font: s.serifB, color: s.ink });
  s.y -= 24;
  page.drawText('Keutuhan berkas dan keberadaan pesan pada waktu pengunggahan', {
    x: LEFT,
    y: s.y,
    size: 11,
    font: s.serif,
    color: s.muted,
  });
  s.y -= 14;
  page.drawLine({
    start: { x: LEFT, y: s.y },
    end: { x: RIGHT, y: s.y },
    thickness: 0.6,
    color: s.ink,
  });
  s.y -= 30;
}

function drawAnchorRows(s: Sheet, anchor: EvidenceCertificate['anchor']) {
  if (!anchor) {
    drawRow(
      s,
      'Akar harian',
      'Belum terbit saat sertifikat ini dibuat. Unduh ulang setelah akar harian terbit untuk memuat jalur Merkle.',
    );
    return;
  }
  drawRow(s, 'Akar harian', `${anchor.root}`, true);
  drawRow(
    s,
    'Tanggal akar dan posisi',
    `${anchor.date}; posisi ${anchor.index + 1} dari ${anchor.size}`,
  );
  drawRow(
    s,
    'Rantai anchor / komit repositori',
    `${anchor.chainHash ?? '-'} / ${anchor.commitRef ?? 'belum dikomit'}`,
    true,
  );
}

function drawCertRows(s: Sheet, cert: EvidenceCertificate, o: PdfOpts) {
  drawRow(s, 'ID bukti', cert.evidenceId, true);
  drawRow(s, 'Berkas (nama dan ukuran)', `${o.namaBerkas}, ${o.ukuran}`);
  drawRow(s, 'SHA-256 berkas asli', cert.sha256, true);
  drawRow(s, 'Waktu pengunggahan (server)', cert.uploadedAt);
  if (cert.messageRoot) {
    drawRow(s, 'Akar Merkle pesan', cert.messageRoot, true);
    drawRow(s, 'Jumlah pesan tercatat', String(cert.messageCount ?? 0));
  }
  drawRow(s, 'Daun Merkle harian', cert.leaf, true);
  drawAnchorRows(s, cert.anchor);
}

async function drawQr(s: Sheet, pdf: PDFDocument, QR: typeof QRCode, verifyUrl: string) {
  const png = await QR.toDataURL(verifyUrl, {
    margin: 1,
    width: 240,
    errorCorrectionLevel: 'M',
    color: { dark: '#14223B', light: '#FFFFFF' },
  });
  const img = await pdf.embedPng(png);
  s.page.drawImage(img, { x: RIGHT - 110, y: 640, width: 110, height: 110 });
  s.page.drawText('Pindai untuk verifikasi', {
    x: RIGHT - 110,
    y: 628,
    size: 8,
    font: s.sans,
    color: s.muted,
  });
}

function drawStatement(s: Sheet) {
  s.y = Math.min(s.y, 330);
  s.page.drawText('Batas pernyataan', {
    x: LEFT,
    y: s.y,
    size: 12,
    font: s.serifB,
    color: s.teal,
  });
  s.y -= 16;
  drawParagraph(s, CERT_STATEMENT, 11);
  s.y -= 8;
  drawParagraph(
    s,
    'Verifikasi: hitung ulang SHA-256 berkas di perangkatmu lalu cocokkan dengan nilai di atas. Berkas Paket Bukti (HTML) dapat dibuka tanpa internet, bahkan bila layanan sudah tidak ada. Akar harian dapat dicocokkan dengan repositori publik anchor.',
    10,
  );
  s.page.drawText('Dibuat di perangkat pelapor. Server tidak pernah melihat isi berkas.', {
    x: LEFT,
    y: 40,
    size: 8,
    font: s.sans,
    color: s.muted,
  });
}

/** Sertifikat Bukti PDF dengan QR ke halaman verifikasi. Memakai huruf bawaan PDF (tanpa memuat font luar). */
export async function buildCertificatePdf(
  cert: EvidenceCertificate,
  o: PdfOpts,
): Promise<Uint8Array> {
  const [{ PDFDocument, StandardFonts, rgb }, QR] = await Promise.all([
    import('pdf-lib'),
    import('qrcode'),
  ]);
  const pdf = await PDFDocument.create();
  const s: Sheet = {
    page: pdf.addPage([595, 842]),
    serif: await pdf.embedFont(StandardFonts.TimesRoman),
    serifB: await pdf.embedFont(StandardFonts.TimesRomanBold),
    mono: await pdf.embedFont(StandardFonts.Courier),
    sans: await pdf.embedFont(StandardFonts.Helvetica),
    ink: rgb(0.078, 0.133, 0.231),
    muted: rgb(0.35, 0.41, 0.52),
    teal: rgb(0.09, 0.38, 0.37),
    y: 780,
  };
  drawHeader(s);
  drawCertRows(s, cert, o);
  await drawQr(s, pdf, QR, `${o.origin}/verifikasi?id=${encodeURIComponent(cert.evidenceId)}`);
  drawStatement(s);
  return pdf.save();
}

/** Kartu pemulihan: kode dan passphrase tercetak. Judul netral supaya aman bila ditemukan orang lain. */
export async function buildRecoveryCard(
  caseCode: string,
  passphrase: string,
  siteUrl?: string,
): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([420, 260]);
  const serifB = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const mono = await pdf.embedFont(StandardFonts.CourierBold);
  const sans = await pdf.embedFont(StandardFonts.Helvetica);
  const ink = rgb(0.078, 0.133, 0.231);
  page.drawRectangle({ x: 12, y: 12, width: 396, height: 236, borderColor: ink, borderWidth: 0.8 });
  page.drawText('Kartu catatan pribadi', { x: 30, y: 218, size: 18, font: serifB, color: ink });
  page.drawText('KODE', { x: 30, y: 190, size: 8, font: sans, color: rgb(0.35, 0.41, 0.52) });
  page.drawText(caseCode.replace(/(.{4})(?=.)/g, '$1-'), {
    x: 30,
    y: 170,
    size: 20,
    font: mono,
    color: ink,
  });
  page.drawText('KATA SANDI (6 KATA)', {
    x: 30,
    y: 144,
    size: 8,
    font: sans,
    color: rgb(0.35, 0.41, 0.52),
  });
  const words = passphrase.split(' ');
  words.forEach((w, i) =>
    page.drawText(`${i + 1}. ${w}`, {
      x: 30 + (i % 3) * 126,
      y: 122 - Math.floor(i / 3) * 24,
      size: 14,
      font: mono,
      color: ink,
    }),
  );
  page.drawText(
    'Simpan di tempat yang hanya kamu ketahui. Tanpa kata sandi ini, isi tidak dapat dipulihkan siapa pun.',
    { x: 30, y: 54, size: 7.5, font: sans, color: ink },
  );
  if (siteUrl)
    page.drawText(siteUrl, { x: 30, y: 36, size: 8, font: sans, color: rgb(0.35, 0.41, 0.52) });
  return pdf.save();
}
