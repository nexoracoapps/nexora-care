'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/context/AuthContext';

export default function ProfilePage() {
  const { user, updateUser, logout } = useAuth();
  const [form, setForm] = useState({ email: user?.email || '', phone: '' });
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [saving, setSaving] = useState(false);
  const [savingPw, setSavingPw] = useState(false);

  const headers = { Authorization: `Bearer ${user?.token}`, 'Content-Type': 'application/json' };

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PUT', headers,
        body: JSON.stringify({ email: form.email, phone: form.phone }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      updateUser({ email: form.email });
      toast.success('Profile updated');
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Error'); }
    setSaving(false);
  };

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwForm.newPassword !== pwForm.confirmPassword) return toast.error('Passwords do not match');
    if (pwForm.newPassword.length < 8) return toast.error('Password must be at least 8 characters');
    setSavingPw(true);
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PUT', headers,
        body: JSON.stringify({ currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success('Password changed successfully');
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Error'); }
    setSavingPw(false);
  };

  return (
    <ProtectedRoute>
      <div>
        <div className="page-header">
          <h1 className="page-title">My Profile</h1>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '24px' }}>
          {/* Profile Info */}
          <div className="glass-card" style={{ padding: '28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
              <div className="avatar avatar-lg" style={{ width: 64, height: 64, fontSize: '1.5rem' }}>
                {user?.username?.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <h2 style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--text)' }}>{user?.username}</h2>
                <div style={{
                  display: 'inline-block',
                  background: 'var(--grad-soft)', color: 'var(--rose)',
                  padding: '2px 10px', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 600, marginTop: '4px',
                }}>
                  {user?.role}
                </div>
              </div>
            </div>

            <form onSubmit={saveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Username</label>
                <input className="form-input" value={user?.username || ''} disabled
                  style={{ opacity: 0.6, cursor: 'not-allowed' }} />
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input className="form-input" type="email" placeholder="your@email.com"
                  value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Phone</label>
                <input className="form-input" type="tel" placeholder="+1 (555) 000-0000"
                  value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
              <button type="submit" className="btn btn-primary" disabled={saving} style={{ alignSelf: 'flex-start' }}>
                {saving ? <><span className="spin">⟳</span> Saving...</> : 'Save Profile'}
              </button>
            </form>
          </div>

          {/* Change Password */}
          <div className="glass-card" style={{ padding: '28px' }}>
            <h2 style={{ fontFamily: 'var(--font)', fontSize: '1.15rem', marginBottom: '20px', color: 'var(--text)' }}>
              🔑 Change Password
            </h2>

            <form onSubmit={savePassword} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Current Password</label>
                <input className="form-input" type="password" placeholder="••••••••"
                  value={pwForm.currentPassword}
                  onChange={e => setPwForm(f => ({ ...f, currentPassword: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">New Password</label>
                <input className="form-input" type="password" placeholder="Minimum 8 characters"
                  value={pwForm.newPassword}
                  onChange={e => setPwForm(f => ({ ...f, newPassword: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Confirm New Password</label>
                <input className="form-input" type="password" placeholder="Repeat new password"
                  value={pwForm.confirmPassword}
                  onChange={e => setPwForm(f => ({ ...f, confirmPassword: e.target.value }))} />
              </div>
              <button type="submit" className="btn btn-primary" disabled={savingPw} style={{ alignSelf: 'flex-start' }}>
                {savingPw ? <><span className="spin">⟳</span> Saving...</> : 'Change Password'}
              </button>
            </form>

            <hr className="divider" style={{ margin: '28px 0 20px' }} />

            <button
              className="btn btn-danger"
              onClick={() => { if (confirm('Are you sure you want to sign out?')) logout(); }}
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
