'use client';
/** Merekam suara dan mengubahnya menjadi teks sepenuhnya di perangkat (Whisper di Web Worker). */

export type AsrEvent =
  | { type: 'progress'; loaded: number; total: number }
  | { type: 'ready' }
  | { type: 'working' }
  | { type: 'result'; text: string }
  | { type: 'error'; message: string };

let worker: Worker | null = null;
function getWorker() {
  worker ??= new Worker(new URL('../workers/asr.worker.ts', import.meta.url), { type: 'module' });
  return worker;
}

/** Mengubah rekaman (webm/ogg/wav) menjadi PCM mono 16 kHz, format yang dibutuhkan Whisper. */
export async function toPcm16k(blob: Blob): Promise<Float32Array> {
  const buf = await blob.arrayBuffer();
  const tmp = new AudioContext();
  const decoded = await tmp.decodeAudioData(buf);
  await tmp.close();
  const frames = Math.ceil(decoded.duration * 16000);
  const off = new OfflineAudioContext(1, Math.max(frames, 1), 16000);
  const src = off.createBufferSource();
  src.buffer = decoded;
  src.connect(off.destination);
  src.start();
  const out = await off.startRendering();
  return out.getChannelData(0);
}

export function transcribe(audio: Float32Array, on: (e: AsrEvent) => void): Promise<string> {
  const w = getWorker();
  return new Promise((resolve, reject) => {
    const h = (e: MessageEvent<AsrEvent>) => {
      on(e.data);
      if (e.data.type === 'result') {
        w.removeEventListener('message', h);
        resolve(e.data.text);
      }
      if (e.data.type === 'error') {
        w.removeEventListener('message', h);
        reject(new Error(e.data.message));
      }
    };
    w.addEventListener('message', h);
    w.postMessage({ type: 'run', audio }, [audio.buffer]);
  });
}

export type Recorder = { stop: () => Promise<Blob>; cancel: () => void };

export async function startRecording(): Promise<Recorder> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
  });
  const rec = new MediaRecorder(stream);
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data);
  };
  rec.start();
  const end = () => stream.getTracks().forEach((t) => t.stop());
  return {
    stop: () =>
      new Promise((resolve) => {
        rec.onstop = () => {
          end();
          resolve(new Blob(chunks, { type: rec.mimeType }));
        };
        rec.stop();
      }),
    cancel: () => {
      rec.onstop = end;
      if (rec.state !== 'inactive') rec.stop();
      else end();
    },
  };
}

export const asrSupported = () =>
  typeof window !== 'undefined' &&
  !!navigator.mediaDevices?.getUserMedia &&
  typeof MediaRecorder !== 'undefined' &&
  typeof Worker !== 'undefined';
