import { useState } from 'react';
import { api } from '../api.js';

const PASSWORD_HINT = 'At least 8 characters, including a letter and a number.';
// Mirrors backend/src/utils/passwordPolicy.js
const isStrong = (p) => p.length >= 8 && /[A-Za-z]/.test(p) && /[0-9]/.test(p);

export default function ChangePassword() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!isStrong(newPassword)) {
      setError(PASSWORD_HINT);
      return;
    }
    if (newPassword !== confirm) {
      setError('New password and confirmation do not match');
      return;
    }
    setBusy(true);
    try {
      const res = await api.post('/auth/change-password', { currentPassword, newPassword });
      setSuccess(res.message || 'Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirm('');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h2 className="page-title">Change Password</h2>
      <p className="page-sub">Update the password for your account</p>

      <form className="card" style={{ maxWidth: 420 }} onSubmit={onSubmit}>
        <div className="field">
          <label htmlFor="cur">Current password</label>
          <input id="cur" type="password" autoComplete="current-password"
            value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="new">New password</label>
          <input id="new" type="password" autoComplete="new-password"
            value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          <span className="muted">{PASSWORD_HINT}</span>
        </div>
        <div className="field">
          <label htmlFor="conf">Confirm new password</label>
          <input id="conf" type="password" autoComplete="new-password"
            value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </div>

        {error && <div className="error">{error}</div>}
        {success && <div className="success">{success}</div>}

        <button type="submit" disabled={busy} style={{ marginTop: 6 }}>
          {busy ? 'Saving…' : 'Change password'}
        </button>
      </form>
    </div>
  );
}
