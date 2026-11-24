'use client';
import { HeaderPhoto } from '@/components/HeaderPhoto';
import Link from 'next/link';
import { useLockNote } from '@/lib/vault/lock-note';
import { LoginForm } from './LoginForm';
import { useSatgasLogin } from './useSatgasLogin';

export default function SatgasMasuk() {
  const locked = useLockNote();
  const login = useSatgasLogin();
  return (
    <div className="narrow">
      <header className="ph ph-foto" data-tab="Untuk Satgas PPKPT">
        <HeaderPhoto />
        <h1>Masuk Satgas</h1>
        <p className="lede">Dosir hanya terbuka setelah penyintas memilih eskalasi.</p>
      </header>
      {locked && (
        <p className="card tint small" role="status">
          Layar dikunci karena lama tidak aktif. Masuk lagi untuk melanjutkan.
        </p>
      )}
      <LoginForm l={login} />
      <div className="alt-line">
        <span className="muted">Ingin mencoba tanpa akun?</span>
        <Link href="/demo" className="btn ghost sm">
          Masuk lewat halaman Demo
        </Link>
      </div>
    </div>
  );
}
