/// <reference lib="webworker" />
// Pengenal suara Whisper yang berjalan di peramban. Audio tidak pernah meninggalkan perangkat.
import { env, pipeline, type AutomaticSpeechRecognitionPipeline } from '@huggingface/transformers';
import { ASR_MODEL, ASR_OPTIONS, MODEL_HOST, ORT_PATHS, cleanTranscript } from '../lib/asr-config';

env.allowLocalModels = false;
// Muat runtime langsung dari /ort (bukan URL blob) agar CSP tidak perlu melonggarkan script-src.
env.useWasmCache = false;
env.remoteHost = MODEL_HOST;
if (env.backends.onnx.wasm) env.backends.onnx.wasm.wasmPaths = ORT_PATHS;

let asr: Promise<AutomaticSpeechRecognitionPipeline> | null = null;

function load() {
  asr ??= pipeline('automatic-speech-recognition', ASR_MODEL, {
    dtype: 'q8',
    device: 'wasm',
    progress_callback: (p: { status: string; file?: string; loaded?: number; total?: number }) => {
      if (p.status === 'progress' && p.total)
        self.postMessage({ type: 'progress', loaded: p.loaded ?? 0, total: p.total, file: p.file });
    },
  }) as Promise<AutomaticSpeechRecognitionPipeline>;
  return asr;
}

self.onmessage = async (
  e: MessageEvent<{ type: 'load' } | { type: 'run'; audio: Float32Array }>,
) => {
  try {
    const p = await load();
    if (e.data.type === 'load') {
      self.postMessage({ type: 'ready' });
      return;
    }
    self.postMessage({ type: 'working' });
    const out = await p(e.data.audio, { ...ASR_OPTIONS });
    const text = cleanTranscript(Array.isArray(out) ? out.map((o) => o.text).join(' ') : out.text);
    self.postMessage({ type: 'result', text });
  } catch (err) {
    asr = null;
    self.postMessage({ type: 'error', message: err instanceof Error ? err.message : String(err) });
  }
};
