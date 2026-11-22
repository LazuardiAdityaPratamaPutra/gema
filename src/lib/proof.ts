/** Sertifikat Bukti (PDF), Paket Bukti (HTML mandiri), dan Paket Pengungkapan. Semuanya dibuat di perangkat. */
import {
  CERT_STATEMENT,
  DISCLOSURE_NOTE,
  buildDisclosure,
  type CanonicalMessage,
  type DisclosurePackage,
  type EvidenceCertificate,
} from '@gema/merkle';
import { fromB64u } from '@gema/crypto';
import { api } from './api';

export async function fetchCertificate(evidenceId: string): Promise<EvidenceCertificate> {
  const p = await api<Omit<EvidenceCertificate, 'statement'>>(`public/evidence/${evidenceId}`);
  return { ...p, statement: CERT_STATEMENT };
}

export function buildDisclosurePackage(
  evidenceId: string,
  messages: CanonicalMessage[],
  saltsB64: string[],
  selected: number[],
): DisclosurePackage {
  return buildDisclosure(evidenceId, messages, saltsB64.map(fromB64u), selected);
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
  const page = pdf.addPage([595, 842]);
  const serif = await pdf.embedFont(StandardFonts.TimesRoman);
  const serifB = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const mono = await pdf.embedFont(StandardFonts.Courier);
  const sans = await pdf.embedFont(StandardFonts.Helvetica);
  const ink = rgb(0.078, 0.133, 0.231);
  const muted = rgb(0.35, 0.41, 0.52);
  const teal = rgb(0.09, 0.38, 0.37);
  let y = 780;
  const left = 56;

  page.drawText('Sertifikat Bukti', { x: left, y, size: 28, font: serifB, color: ink });
  y -= 24;
  page.drawText('Keutuhan berkas dan keberadaan pesan pada waktu pengunggahan', {
    x: left,
    y,
    size: 11,
    font: serif,
    color: muted,
  });
  y -= 14;
  page.drawLine({ start: { x: left, y }, end: { x: 539, y }, thickness: 0.6, color: ink });
  y -= 30;

  const row = (label: string, value: string, monoFont = false) => {
    page.drawText(label.toUpperCase(), { x: left, y, size: 8, font: sans, color: muted });
    y -= 13;
    const f = monoFont ? mono : serif;
    const size = monoFont ? 9 : 12;
    const width = 483;
    const words = value.split(monoFont ? '' : ' ');
    let line = '';
    for (const w of words) {
      const t = monoFont ? line + w : line ? line + ' ' + w : w;
      if (f.widthOfTextAtSize(t, size) > width) {
        page.drawText(line, { x: left, y, size, font: f, color: ink });
        y -= size + 4;
        line = w;
      } else line = t;
    }
    page.drawText(line, { x: left, y, size, font: f, color: ink });
    y -= size + 14;
  };

  row('ID bukti', cert.evidenceId, true);
  row('Berkas (nama dan ukuran)', `${o.namaBerkas}, ${o.ukuran}`);
  row('SHA-256 berkas asli', cert.sha256, true);
  row('Waktu pengunggahan (server)', cert.uploadedAt);
  if (cert.messageRoot) {
    row('Akar Merkle pesan', cert.messageRoot, true);
    row('Jumlah pesan tercatat', String(cert.messageCount ?? 0));
  }
  row('Daun Merkle harian', cert.leaf, true);
  if (cert.anchor) {
    row('Akar harian', `${cert.anchor.root}`, true);
    row(
      'Tanggal akar dan posisi',
      `${cert.anchor.date}; posisi ${cert.anchor.index + 1} dari ${cert.anchor.size}`,
    );
    row(
      'Rantai anchor / komit repositori',
      `${cert.anchor.chainHash ?? '-'} / ${cert.anchor.commitRef ?? 'belum dikomit'}`,
      true,
    );
  } else {
    row(
      'Akar harian',
      'Belum terbit saat sertifikat ini dibuat. Unduh ulang setelah akar harian terbit untuk memuat jalur Merkle.',
    );
  }

  const verifyUrl = `${o.origin}/verifikasi?id=${encodeURIComponent(cert.evidenceId)}`;
  const png = await QR.toDataURL(verifyUrl, {
    margin: 1,
    width: 240,
    errorCorrectionLevel: 'M',
    color: { dark: '#14223B', light: '#FFFFFF' },
  });
  const img = await pdf.embedPng(png);
  page.drawImage(img, { x: 539 - 110, y: 640, width: 110, height: 110 });
  page.drawText('Pindai untuk verifikasi', {
    x: 539 - 110,
    y: 628,
    size: 8,
    font: sans,
    color: muted,
  });

  y = Math.min(y, 330);
  page.drawText('Batas pernyataan', { x: left, y, size: 12, font: serifB, color: teal });
  y -= 16;
  const wrap = (txt: string, size: number, f = serif, width = 483) => {
    const words = txt.split(' ');
    let line = '';
    for (const w of words) {
      const t = line ? line + ' ' + w : w;
      if (f.widthOfTextAtSize(t, size) > width) {
        page.drawText(line, { x: left, y, size, font: f, color: ink });
        y -= size + 4;
        line = w;
      } else line = t;
    }
    if (line) {
      page.drawText(line, { x: left, y, size, font: f, color: ink });
      y -= size + 4;
    }
  };
  wrap(CERT_STATEMENT, 11);
  y -= 8;
  wrap(
    'Verifikasi: hitung ulang SHA-256 berkas di perangkatmu lalu cocokkan dengan nilai di atas. Berkas Paket Bukti (HTML) dapat dibuka tanpa internet, bahkan bila layanan sudah tidak ada. Akar harian dapat dicocokkan dengan repositori publik anchor.',
    10,
    serif,
  );
  page.drawText('Dibuat di perangkat pelapor. Server tidak pernah melihat isi berkas.', {
    x: left,
    y: 40,
    size: 8,
    font: sans,
    color: muted,
  });
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

export { DISCLOSURE_NOTE };
