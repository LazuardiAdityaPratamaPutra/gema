import { useState } from 'react';
import { api } from '@/lib/api';
import { b64u, encryptJson } from '@gema/crypto';
import { AAD_CATATAN } from '@/lib/report-format';
import type { SatgasSession } from '@/lib/store';

type Props = {
  session: SatgasSession;
  caseId: string;
  dek: Uint8Array;
  act: (fn: () => Promise<unknown>) => Promise<void>;
};

/** Catatan internal Satgas, dienkripsi dengan kunci kasus. */
export function CatatanInternal({ session, caseId: id, dek, act }: Props) {
  const [note, setNote] = useState('');
  return (
    <section className="card">
      <h2 className="title-sm">Catatan internal</h2>
      <p className="hint">Dienkripsi dengan kunci kasus; server tidak membacanya.</p>
      <textarea value={note} onChange={(e) => setNote(e.target.value)} aria-label="Catatan" />
      <button
        className="btn teal sm mt-sm"
        disabled={!note.trim()}
        onClick={() =>
          void act(async () => {
            const ct = await encryptJson(
              dek,
              { teks: note.trim(), penulis: session.member.nama },
              AAD_CATATAN,
            );
            await api(`satgas/cases/${id}/notes`, {
              token: session.token,
              body: { catatan_ciphertext: b64u(ct) },
            });
            setNote('');
          })
        }
      >
        Simpan catatan
      </button>
    </section>
  );
}
