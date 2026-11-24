import { fmtBytes } from '@/lib/ui/format';
import { MAX_FILE, MAX_FILES } from '@/lib/laporan/report-format';
import type { FileInput } from '@/lib/laporan/report-build';

/** Membaca berkas pilihan pengguna; ekspor chat WhatsApp (.txt) ikut diurai per pesan. */
export async function readEvidenceFiles(
  list: FileList,
  current: FileInput[],
): Promise<{ files: FileInput[]; error: string }> {
  let error = '';
  const next = [...current];
  for (const f of Array.from(list)) {
    if (next.length >= MAX_FILES) {
      error = `Maksimum ${MAX_FILES} berkas.`;
      break;
    }
    if (f.size > MAX_FILE) {
      error = `${f.name} melebihi ${fmtBytes(MAX_FILE)}.`;
      continue;
    }
    const bytes = new Uint8Array(await f.arrayBuffer());
    const item: FileInput = { nama: f.name, tipe: f.type || 'application/octet-stream', bytes };
    if (/\.txt$/i.test(f.name)) {
      const text = new TextDecoder().decode(bytes);
      const { looksLikeWhatsApp, parseWhatsApp } = await import('@gema/chat-parser');
      if (looksLikeWhatsApp(text))
        item.messages = parseWhatsApp(text)
          .messages.filter((m) => !m.system)
          .map(({ ts, sender, text: t, attachment }) => ({ ts, sender, text: t, attachment }));
    }
    next.push(item);
  }
  return { files: next, error };
}
