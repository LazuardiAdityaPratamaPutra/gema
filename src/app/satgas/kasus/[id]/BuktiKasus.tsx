import { ChatSignals } from '@/components/ChatSignals';
import { aesGcmDecrypt } from '@gema/crypto';
import { api } from '@/lib/api';
import { fmtBytes, fmtDateTime } from '@/lib/format';
import { triggerDownload } from '@/lib/proof';
import { AAD, type BuktiMeta } from '@/lib/report-format';
import type { SatgasSession } from '@/lib/store';
import type { Detail } from './dosir';

type Props = {
  session: SatgasSession;
  d: Detail;
  meta: BuktiMeta | null;
  dek: Uint8Array | null;
  act: (fn: () => Promise<unknown>) => Promise<void>;
};

/** Daftar bukti kasus; unduhan didekripsi di perangkat Satgas. */
export function BuktiKasus({ session, d, meta, dek, act }: Props) {
  return (
    <section className="my-lg sensitive">
      <h2 className="title-md">Bukti</h2>
      {d.evidence.map((ev) => {
        const m = meta?.items.find((x) => x.sha256 === ev.sha256);
        return (
          <div
            key={ev.id}
            className="card row"
            style={{ justifyContent: 'space-between', marginBottom: '.6rem' }}
          >
            <span>
              <strong>{m?.nama ?? 'Berkas'}</strong>{' '}
              <span className="muted small">
                {fmtBytes(ev.ukuran)}, {fmtDateTime(ev.uploadedAt)}
              </span>
            </span>
            {dek && (
              <button
                className="btn ghost sm"
                onClick={() =>
                  void act(async () =>
                    triggerDownload(
                      m?.nama ?? 'bukti',
                      await aesGcmDecrypt(
                        dek,
                        await api<Uint8Array>(`evidence/${ev.id}/blob`, {
                          token: session.token,
                        }),
                        AAD.evidence,
                      ),
                    ),
                  )
                }
              >
                Unduh
              </button>
            )}
            {m?.messages?.length ? (
              <div style={{ flexBasis: '100%' }}>
                <ChatSignals messages={m.messages} />
              </div>
            ) : null}
          </div>
        );
      })}
    </section>
  );
}
