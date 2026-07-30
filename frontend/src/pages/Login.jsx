import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { RETURN_TO_KEY } from '../api';
import { HOME_BY_ROLE } from '../roles.js';

// The page to return to after signing in, or null to use the role's home.
// Two ways we can have been bounced here:
//   - App redirected an unauthenticated in-app navigation, passing router state
//   - the token expired mid-session, and api.js stashed the path before a
//     full page reload wiped that state
// A path the role may not open is harmless: App's catch-all redirects it home.
export function returnPath(routerState) {
  const stashed = sessionStorage.getItem(RETURN_TO_KEY);
  sessionStorage.removeItem(RETURN_TO_KEY); // one-shot, so it can't stick
  const from = routerState?.from;
  const fromRouter = from && from.pathname !== '/login'
    ? `${from.pathname}${from.search || ''}${from.hash || ''}`
    : null;
  const candidate = fromRouter || stashed;
  return candidate && !candidate.startsWith('/login') ? candidate : null;
}

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
      const back = returnPath(location.state);
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
