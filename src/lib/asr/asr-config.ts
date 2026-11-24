/** Konfigurasi pengenal suara di perangkat. Model dapat di-host sendiri oleh kampus. */
export const ASR_MODEL = process.env.NEXT_PUBLIC_GEMA_ASR_MODEL || 'onnx-community/whisper-base';
export const MODEL_HOST = process.env.NEXT_PUBLIC_GEMA_MODEL_HOST || 'https://huggingface.co/';
export const ORT_PATHS = {
  mjs: '/ort/ort-wasm-simd-threaded.asyncify.mjs',
  wasm: '/ort/ort-wasm-simd-threaded.asyncify.wasm',
};
// Penahan pengulangan: Whisper kadang terjebak mengulang kata pada audio yang tidak jelas.
export const ASR_OPTIONS = {
  language: 'indonesian',
  task: 'transcribe',
  chunk_length_s: 30,
  stride_length_s: 5,
  no_repeat_ngram_size: 3,
  repetition_penalty: 1.2,
} as const;

/** Membuang sisa pengulangan ("dua-dua-dua…") dan teks kosong. */
export function cleanTranscript(t: string): string {
  const out = t
    .replace(/\b([\p{L}\p{N}]{2,})(?:[\s-]+\1\b){2,}/giu, '$1')
    .replace(/\s+/g, ' ')
    .trim();
  // Halusinasi umum Whisper pada audio sunyi/tak jelas: dibuang agar tidak masuk ke laporan.
  return HALLUCINATION.test(out) ? '' : out;
}
const HALLUCINATION =
  /^[\s.,!]*(terima kasih( (sudah|telah) menonton)?|thank you( for watching)?|thanks for watching|subtitles? by.*|sampai jumpa( lagi)?|\[?musik\]?|\(?music\)?)[\s.,!]*$/i;

/** Pesan untuk pengguna saat dikte gagal. Teks pengecualian mentah tidak pernah ditampilkan. */
export function describeAsrError(message: string, online: boolean): string {
  const m = message.toLowerCase();
  const jaringan =
    !online ||
    /fetch|network|failed to load|load failed|could not locate|404|offline|timeout/.test(m);
  if (jaringan)
    return online
      ? 'Pengenal suara belum bisa diunduh dari jaringan ini. Coba lagi nanti, atau ketik ceritamu langsung.'
      : 'Tidak ada koneksi, dan pengenal suara belum pernah diunduh di perangkat ini. Sambungkan ke internet sekali untuk mengunduhnya, atau ketik ceritamu langsung.';
  if (/memory|alloc|oom/.test(m))
    return 'Perangkat ini kehabisan memori saat memproses suara. Coba rekaman yang lebih pendek, atau ketik langsung.';
  return 'Suara belum bisa diubah jadi teks. Rekamanmu tidak dikirim ke mana pun. Coba lagi, atau ketik langsung.';
}

/** Boleh mulai merekam? Bila offline dan model belum ada di perangkat, merekam hanya akan membuang waktu pengguna. */
export function canDictateNow(online: boolean, modelCached: boolean): boolean {
  return online || modelCached;
}
