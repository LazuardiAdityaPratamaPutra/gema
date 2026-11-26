/**
 * Surel pemberitahuan keterlambatan penanganan. Isinya sengaja hanya jumlah kasus dan tingkatnya:
 * tanpa alias, isi laporan, atau identitas siapa pun. Tanpa `GEMA_SMTP_URL` dan `GEMA_EMAIL_DARI`
 * tidak ada surel yang dikirim, dan peringatan tetap muncul di aplikasi.
 */
import nodemailer from 'nodemailer';
import { audit } from './logic/audit';
import type { DB, SatgasRole } from './types';

export type Surel = { to: string; subject: string; text: string };
type Pengirim = (m: Surel) => Promise<void>;

let pengganti: Pengirim | null = null;
let transportKey = '';
let transport: ReturnType<typeof nodemailer.createTransport> | null = null;

/** Hanya untuk tes: ganti pengirim sungguhan. */
export function setPengirim(p: Pengirim | null) {
  pengganti = p;
}

function pengirim(): Pengirim | null {
  if (pengganti) return pengganti;
  const url = process.env.GEMA_SMTP_URL;
  const dari = process.env.GEMA_EMAIL_DARI;
  if (!url || !dari) return null;
  if (!transport || transportKey !== url) {
    transport = nodemailer.createTransport(url);
    transportKey = url;
  }
  const t = transport;
  return async (m) => {
    await t.sendMail({ from: dari, ...m });
  };
}

const PENERIMA: Record<1 | 2 | 3, SatgasRole> = { 1: 'Ketua', 2: 'Pimpinan', 3: 'Pengawas' };

export type Ringkasan = { institusi: string; tingkat: 1 | 2 | 3; jumlah: number };

/** Kirim satu surel per penerima per tingkat. Kegagalan hanya dicatat di audit dan tidak menggagalkan tick. */
export async function kabarkanTangga(db: DB, daftar: Ringkasan[]): Promise<boolean> {
  const kirim = pengirim();
  if (!kirim) return false;
  let gagal = false;
  for (const r of daftar) {
    const inst = db.institutions[r.institusi];
    if (!inst || inst.demo) continue;
    const peran = PENERIMA[r.tingkat];
    const alamat = process.env.GEMA_APP_URL
      ? `${process.env.GEMA_APP_URL.replace(/\/$/, '')}/satgas`
      : null;
    const text = [
      `Ada ${r.jumlah} kasus tereskalasi di ${inst.nama} yang melewati tenggat penanganan dan kini berada di tingkat T${r.tingkat}.`,
      alamat ? `Masuk untuk melihatnya: ${alamat}` : 'Masuk ke Gema untuk melihatnya.',
      'Surel ini sengaja tidak memuat isi atau alias kasus.',
    ].join('\n\n');
    for (const m of Object.values(db.members)) {
      if (m.institution_id !== inst.id || m.role !== peran) continue;
      try {
        await kirim({
          to: m.email,
          subject: `Gema: ${r.jumlah} kasus melewati tenggat (T${r.tingkat})`,
          text,
        });
        audit(db, 'sistem', `email-tangga-T${r.tingkat}`, peran);
      } catch {
        gagal = true;
        audit(db, 'sistem', `email-tangga-gagal-T${r.tingkat}`, peran);
      }
    }
  }
  return gagal || daftar.length > 0;
}
