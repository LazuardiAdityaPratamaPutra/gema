'use client';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { asrSupported, startRecording, toPcm16k, transcribe, type Recorder } from '@/lib/asr';
import { island } from '@/lib/island-bus';

type St = 'idle' | 'rec' | 'load' | 'work' | 'err';

/** Tombol "Bicara saja": merekam, lalu mengubah suara menjadi teks di perangkat. Teks ditambahkan ke kolom, bisa disunting. */
export function Dictate({
  onText,
  label = 'Bicara saja',
}: {
  onText: (t: string) => void;
  label?: string;
}) {
  const [st, setSt] = useState<St>('idle');
  const [msg, setMsg] = useState('');
  const [secs, setSecs] = useState(0);
  const rec = useRef<Recorder | null>(null);
  // Dukungan perekaman hanya diketahui di peramban; di server dianggap tidak ada.
  const ok = useSyncExternalStore(
    () => () => undefined,
    asrSupported,
    () => false,
  );
  useEffect(() => () => rec.current?.cancel(), []);
  useEffect(() => {
    if (st !== 'rec') return;
    const t = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [st]);
  if (!ok) return null;

  async function start() {
    setMsg('');
    try {
      rec.current = await startRecording();
      setSecs(0);
      setSt('rec');
    } catch {
      setSt('err');
      setMsg('Mikrofon tidak bisa dipakai. Periksa izin mikrofon di peramban.');
    }
  }
  async function stop() {
    const r = rec.current;
    if (!r) return;
    rec.current = null;
    setSt('load');
    try {
      const pcm = await toPcm16k(await r.stop());
      const text = await transcribe(pcm, (e) => {
        if (e.type === 'progress') {
          const pct = Math.round((e.loaded / e.total) * 100);
          setMsg(`Menyiapkan pengenal suara ${pct}%. Hanya sekali.`);
          island.progress('Menyiapkan pengenal suara', pct, 100);
        }
        if (e.type === 'working') {
          setSt('work');
          setMsg('Mengubah suara menjadi teks di perangkatmu…');
          island.progress('Mengubah suara jadi teks');
        }
      });
      island.clear();
      if (text && !/^[.\s]*$/.test(text)) {
        onText(text);
        setMsg('Teks ditambahkan. Periksa dan perbaiki bila ada yang keliru.');
        island.toast('Teks dari suara ditambahkan');
      } else setMsg('Suara tidak terdengar jelas. Coba lagi lebih dekat ke mikrofon.');
      setSt('idle');
    } catch (e) {
      island.clear();
      setSt('err');
      setMsg(
        `Pengenal suara gagal dimuat${e instanceof Error && e.message ? ` (${e.message.slice(0, 80)})` : ''}. Kamu tetap bisa mengetik.`,
      );
    }
  }
  const busy = st === 'load' || st === 'work';
  return (
    <div className="dictate">
      {st !== 'rec' ? (
        <button type="button" className="btn ghost sm mic" onClick={start} disabled={busy}>
          <span className="mic-dot" aria-hidden="true" />
          {busy ? 'Memproses…' : label}
        </button>
      ) : (
        <button type="button" className="btn sm mic rec" onClick={stop}>
          <span className="mic-dot" aria-hidden="true" />
          Selesai bicara ({Math.floor(secs / 60)}:{String(secs % 60).padStart(2, '0')})
        </button>
      )}
      <p className="small muted m-0" role="status" aria-live="polite">
        {msg ||
          'Suaramu diubah jadi teks di perangkat ini dan tidak dikirim ke mana pun. Pertama kali, model sekitar 80 MB diunduh sekali.'}
      </p>
    </div>
  );
}
