import { island } from '@/lib/ui/island-bus';

/** Menyalin teks ke clipboard; bila API clipboard tidak tersedia atau ditolak, memberi tahu pengguna. */
export async function salin(teks: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(teks);
    return true;
  } catch {
    island.toast('Gagal menyalin, pilih teksnya lalu salin manual');
    return false;
  }
}
