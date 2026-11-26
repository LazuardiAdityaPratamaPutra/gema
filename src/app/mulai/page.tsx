'use client';
import { useState } from 'react';
import { CredentialActions, CredentialCard } from './CredentialParts';
import { useNewVault } from './useNewVault';
import { Ilustrasi } from '@/components/Ilustrasi';

export default function Mulai() {
  const { cred, busy, error, go } = useNewVault();
  const [saved, setSaved] = useState(false);

  return (
    <div className="narrow">
      <header className="ph" data-tab="Brankas baru">
        <Ilustrasi motif="brankas" />
        <h1>Kode dan kata sandimu</h1>
        <p className="lede">
          Ini satu-satunya cara masuk ke brankasmu. Simpan sekarang, karena bila hilang kami tidak
          bisa memulihkannya. Keduanya dibuat di perangkat ini dan tidak dikirim ke mana pun.
        </p>
      </header>
      <CredentialCard cred={cred} />
      <CredentialActions cred={cred} />
      <p className="small muted">
        Cara menyimpannya: unduh kartu cetak, atau tulis di kertas yang hanya kamu tahu tempatnya.
        Tanpa keduanya kamu tidak bisa masuk lagi ke brankasmu.
      </p>

      <label className="check mt-lg">
        <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} />
        <span>
          Saya sudah menyimpan kode dan kata sandi ini di tempat yang aman. Saya paham tidak ada
          pemulihan bila keduanya hilang.
        </span>
      </label>
      {error && (
        <p className="err" role="alert">
          {error}
        </p>
      )}
      <p className="small muted mulai-next">
        Berikutnya: tiga langkah singkat untuk menulis laporan (siapa dan di mana, kejadian dan
        bukti, tinjau dan kunci). Isianmu disimpan sebagai draf di perangkat ini, jadi boleh
        berhenti kapan saja. Pemulihan lewat dua orang tepercaya bisa kamu siapkan di Pengaturan
        setelah masuk.
      </p>
      <button
        className="btn teal"
        type="button"
        disabled={!saved || busy || !cred}
        aria-busy={busy}
        onClick={go}
      >
        {busy ? 'Membuat brankas…' : 'Buat brankas'}
      </button>
      {busy && (
        <p className="small muted" role="status">
          Mengolah kunci. Ini sengaja dibuat lambat dan bisa memakan beberapa detik.
        </p>
      )}
    </div>
  );
}
