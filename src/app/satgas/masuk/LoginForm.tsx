import { PasswordEye } from '@/components/PasswordEye';
import type { SatgasLoginState } from './useSatgasLogin';

export function LoginForm({ l }: { l: SatgasLoginState }) {
  return (
    <form onSubmit={l.go}>
      <div className="field">
        <label htmlFor="e">Email</label>
        <input
          id="e"
          type="email"
          value={l.email}
          onChange={(e) => l.setEmail(e.target.value)}
          autoComplete="username"
        />
      </div>
      <div className="field">
        <label htmlFor="p">Kata sandi</label>
        <div className="pw-row">
          <input
            id="p"
            type={l.show ? 'text' : 'password'}
            value={l.pw}
            onChange={(e) => l.setPw(e.target.value)}
            autoComplete="current-password"
          />
          <PasswordEye show={l.show} onToggle={l.toggleShow} />
        </div>
      </div>
      {l.err && (
        <p className="err" role="alert">
          {l.err}
        </p>
      )}
      <button className="btn teal" disabled={l.busy || !l.email || !l.pw} aria-busy={l.busy}>
        {l.busy ? 'Masuk…' : 'Masuk'}
      </button>
    </form>
  );
}
