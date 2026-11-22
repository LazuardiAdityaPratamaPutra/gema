// Menyalin runtime ONNX (WebAssembly) ke public/ort agar tidak dimuat dari CDN pihak ketiga.
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const dist = dirname(require.resolve('onnxruntime-web'));
mkdirSync('public/ort', { recursive: true });
for (const f of ['ort-wasm-simd-threaded.asyncify.mjs', 'ort-wasm-simd-threaded.asyncify.wasm'])
  copyFileSync(join(dist, f), join('public/ort', f));
console.log('ORT disalin ke public/ort');
