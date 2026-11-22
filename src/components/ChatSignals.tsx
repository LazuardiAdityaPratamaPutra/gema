'use client';
import { useMemo, useState } from 'react';
import { readChat, SIGNAL_LABEL, type ChatMessage } from '@gema/pendamping';

/** Garis waktu pesan penting dari ekspor chat. Dibaca di perangkat; tidak ada yang dikirim. */
export function ChatSignals({
  messages,
  title = 'Pesan yang perlu diperhatikan',
}: {
  messages: ChatMessage[];
  title?: string;
}) {
  const r = useMemo(() => readChat(messages), [messages]);
  const [all, setAll] = useState(false);
  if (!r.total) return null;
  const list = all ? r.flagged : r.flagged.slice(0, 5);
  return (
    <section className="chatsig" aria-label={title}>
      <div className="cs-head">
        <p className="cs-title">{title}</p>
        <p className="small muted m-0">
          {r.flagged.length} dari {r.total} pesan ditandai otomatis di perangkat ini. Periksa
          sendiri, penanda bisa keliru.
        </p>
      </div>
      {r.flagged.length === 0 ? (
        <p className="small m-0">
          Tidak ada pesan yang cocok dengan pola umum. Itu tidak berarti chat ini tidak penting.
        </p>
      ) : (
        <>
          <ul className="cs-chips" aria-label="Ringkasan penanda">
            {Object.entries(r.counts).map(([k, n]) => (
              <li key={k} data-k={k}>
                {SIGNAL_LABEL[k as keyof typeof SIGNAL_LABEL]} <b>{n}</b>
              </li>
            ))}
          </ul>
          <ol className="cs-list">
            {list.map((m) => (
              <li key={m.i}>
                <span className="cs-ts">{m.ts}</span>
                <p>
                  <b>{m.sender}:</b> {m.text}
                </p>
                <span className="cs-kinds">
                  {m.kinds.map((k) => (
                    <span key={k} data-k={k}>
                      {SIGNAL_LABEL[k]}
                    </span>
                  ))}
                </span>
              </li>
            ))}
          </ol>
          {r.flagged.length > 5 && (
            <button type="button" className="btn ghost sm" onClick={() => setAll((v) => !v)}>
              {all ? 'Ringkas' : `Tampilkan semua (${r.flagged.length})`}
            </button>
          )}
        </>
      )}
    </section>
  );
}
