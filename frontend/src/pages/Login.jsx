import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

// Landing page per role after a successful login.
const HOME_BY_ROLE = {
  admin: '/',
  admission_staff: '/admissions',
  staff: '/diary',
  chairperson: '/diary-approvals',
};

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      // Direct fetch (not the api wrapper) so a 401 shows an inline error
      // instead of triggering the global "session expired" redirect.
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');
      login(data.token, data.user);
      // Return to the deep link that bounced us here (App stores it as
      // state.from), otherwise land on the role's home page. A path the role
      // may not open is harmless: App's catch-all route redirects it home.
      const from = location.state?.from;
      const back = from && from.pathname !== '/login'
        ? `${from.pathname}${from.search || ''}`
        : null;
      navigate(back || HOME_BY_ROLE[data.user.role] || '/', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={onSubmit}>
        <h1 className="login-title">Academic Management System</h1>
        <p className="login-sub">Sign in to continue</p>

        <div className="field">
          <label htmlFor="username">Username</label>
          <input
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
            autoComplete="username"
          />
        </div>

        <div className="field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </div>

        {error && <div className="error">{error}</div>}

        <button type="submit" className="login-btn" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
