import { createContext, useContext, useState, useCallback } from 'react';
import { api } from './api.js';

const STORAGE_KEY = 'ams_auth';
const AuthContext = createContext(null);

// Read persisted { token, user } from localStorage (used at startup and by api.js).
export function readAuth() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(readAuth);

  const login = useCallback((token, user) => {
    const next = { token, user };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setAuth(next);
  }, []);

  const logout = useCallback(async () => {
    // Record the sign-out (best-effort) before discarding the token.
    try { await api.post('/auth/logout'); } catch { /* ignore */ }
    localStorage.removeItem(STORAGE_KEY);
    setAuth(null);
  }, []);

  const value = {
    token: auth?.token || null,
    user: auth?.user || null,
    isAuthenticated: !!auth?.token,
    login,
    logout,
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
