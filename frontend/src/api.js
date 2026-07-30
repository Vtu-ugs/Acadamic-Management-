// Thin fetch wrapper around the backend REST API.
import { readAuth } from './auth.jsx';

const BASE = '/api';

// Bearer token from persisted auth, if logged in.
function authHeader() {
  const token = readAuth()?.token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// Where Login looks for the page to return to after a re-login. Stashed in
// sessionStorage rather than router state because the bounce below is a full
// page load, which discards anything held in memory.
export const RETURN_TO_KEY = 'ams_return_to';

// Clear the session and bounce to login on an expired/invalid token.
function handleUnauthorized() {
  localStorage.removeItem('ams_auth');
  const { pathname, search, hash } = window.location;
  if (pathname === '/login') return;
  sessionStorage.setItem(RETURN_TO_KEY, `${pathname}${search}${hash}`);
  window.location.assign('/login');
}

async function request(path, options = {}) {
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json', ...authHeader(), ...(options.headers || {}) },
    ...options,
  });
  if (res.status === 401) {
    handleUnauthorized();
    throw new Error('Your session has expired. Please sign in again.');
  }
  if (!res.ok) {
    let detail;
    try { detail = (await res.json()).error; } catch { detail = res.statusText; }
    throw new Error(detail || `Request failed (${res.status})`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  get: (p) => request(p),
  post: (p, body) => request(p, { method: 'POST', body: JSON.stringify(body) }),
  put: (p, body) => request(p, { method: 'PUT', body: JSON.stringify(body) }),
  patch: (p, body) => request(p, { method: 'PATCH', body: JSON.stringify(body) }),
  del: (p) => request(p, { method: 'DELETE' }),
  // Multipart upload (CSV/Excel import)
  upload: async (p, file) => {
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch(BASE + p, { method: 'POST', body: fd, headers: { ...authHeader() } });
    if (res.status === 401) { handleUnauthorized(); throw new Error('Your session has expired. Please sign in again.'); }
    if (!res.ok) throw new Error((await res.json()).error || 'Upload failed');
    return res.json();
  },
};

// Absolute URL helper for PDF/Excel downloads opened in a new tab or <iframe>.
// The auth token is passed as a query param because the browser can't attach
// the Authorization header on these requests (see requireAuth in the backend).
export const fileUrl = (p) => {
  const token = readAuth()?.token;
  if (!token) return BASE + p;
  return `${BASE}${p}${p.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`;
};
