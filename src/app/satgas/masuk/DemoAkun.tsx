import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { SatgasLoginState } from './useSatgasLogin';

type DemoInfo = { members: { email: string; role: string }[]; password: string };

/** Hanya tampil bila Mode Demo aktif: akun contoh yang mengisi formulir masuk yang sama dengan akun sungguhan. */
export function DemoAkun({ l }: { l: SatgasLoginState }) {
  const [info, setInfo] = useState<DemoInfo | null>(null);
  useEffect(() => {
    api<DemoInfo>('demo/info')
      .then(setInfo)
      .catch(() => setInfo(null));
  }, []);
  if (!info) return null;
  return (
    <section className="card tint mt-lg" aria-labelledby="akun-demo">
      <h2 className="title-md" id="akun-demo">
        Akun demo
      </h2>
      <p className="small muted">
        Mode demo aktif. Pilih satu akun untuk mengisi formulir di atas, lalu tekan Masuk. Kata
        sandi semua akun: <code>{info.password}</code>.
      </p>
      {info.members.map((m) => (
        <div
          key={m.role}
          className="row"
          style={{ justifyContent: 'space-between', marginBottom: '.6rem' }}
        >
          <span>
            <strong>{m.role}</strong>
            <br />
            <span className="small muted">{m.email}</span>
          </span>
          <button
            type="button"
            className="btn ghost sm"
            onClick={() => {
              l.setEmail(m.email);
              l.setPw(info.password);
              // formulir ada di atas panel ini: bawa pengguna ke tombol Masuk begitu sudah aktif
              setTimeout(() => document.getElementById('masuk-satgas')?.focus(), 60);
            }}
          >
            Pakai akun ini
          </button>
        </div>
      ))}
      <Link href="/demo" className="small">
        Buka halaman Demo lengkap
      </Link>
    </section>
  );
}
