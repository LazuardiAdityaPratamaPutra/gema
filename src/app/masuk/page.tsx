'use client';
import Link from 'next/link';
import { useLockNote } from '@/lib/vault/lock-note';
import { LoginForm } from './LoginForm';
import { useLogin } from './useLogin';
import { Ilustrasi } from '@/components/Ilustrasi';

export default function Masuk() {
  const locked = useLockNote();
  const login = useLogin();
  return (
    <div className="narrow">
      <header className="ph" data-tab="Brankas">
        <Ilustrasi motif="brankas" />
        <h1>Masuk ke brankas</h1>
        <p className="lede">Kode dan enam kata dari kartu catatanmu.</p>
      </header>
      {locked && (
        <p className="card tint small" role="status">
          Layar dikunci karena lama tidak aktif. Isianmu yang belum selesai sudah disimpan sebagai
          draf di perangkat ini. Masuk lagi untuk melanjutkan.
        </p>
      )}
      <LoginForm l={login} />
      <div className="alt-line">
        <span className="muted">Lupa kata sandi?</span>
        <Link href="/pulihkan" className="btn ghost sm">
          Pulihkan lewat orang tepercaya
        </Link>
      </div>
      <div className="alt-line">
        <span className="muted">Belum punya brankas?</span>
        <Link href="/mulai" className="btn ghost sm">
          Buat brankas tanpa nama
        </Link>
        <Link href="/demo" className="btn ghost sm">
          Coba demo
        </Link>
      </div>
    </div>
  );
}
