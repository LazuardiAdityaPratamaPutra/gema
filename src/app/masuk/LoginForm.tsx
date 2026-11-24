import { PasswordEye } from '@/components/PasswordEye';
import { Term } from '@/components/Term';
import type { LoginState } from './useLogin';

export function LoginForm({ l }: { l: LoginState }) {
  return (
    <form onSubmit={l.submit} noValidate>
      <div className="field">
        <label htmlFor="kode">Kode</label>
        <input
          id="kode"
          value={l.code}
          onChange={(e) => l.setCode(e.target.value)}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          className="mono"
          required
        />
      </div>
      <div className="field">
        <label htmlFor="sandi">Kata sandi (6 kata)</label>
        <div className="pw-row">
          <input
            id="sandi"
            type={l.show ? 'text' : 'password'}
            value={l.pass}
            onChange={(e) => l.setPass(e.target.value)}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            required
          />
          <PasswordEye show={l.show} onToggle={l.toggleShow} />
        </div>
        <p className="hint">Pisahkan dengan spasi.</p>
      </div>
      {l.error && (
        <p className="err" role="alert">
          {l.error}
        </p>
      )}
      <button className="btn teal" disabled={l.busy || !l.code || !l.pass} aria-busy={l.busy}>
        {l.busy ? 'Membuka…' : 'Masuk'}
      </button>
      {l.pkOk && (
        <button
          type="button"
          className="btn ghost mt-sm"
          disabled={l.busy || !l.code}
          aria-busy={l.busy}
          onClick={() => void l.withPasskey()}
        >
          Masuk dengan passkey
        </button>
      )}
      {l.pkOk && (
        <p className="hint mt-sm">
          <Term k="passkey" question>
            Apa itu passkey?
          </Term>
        </p>
      )}
    </form>
  );
}
