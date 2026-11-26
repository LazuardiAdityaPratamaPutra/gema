'use client';
import { HeaderPhoto } from '@/components/HeaderPhoto';
import { useLockNote } from '@/lib/vault/lock-note';
import { DemoAkun } from './DemoAkun';
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
      <DemoAkun l={login} />
    </div>
  );
}
