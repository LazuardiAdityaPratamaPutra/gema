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
