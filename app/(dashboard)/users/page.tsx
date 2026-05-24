'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/context/AuthContext';
import { useBranch } from '@/context/BranchContext';
import { useLanguage } from '@/context/LanguageContext';
import { usePermissions } from '@/context/PermissionsContext';

interface UserRecord {
  id: string; username: string; email?: string | null; phone?: string | null;
  role: string; photoUrl?: string | null; branchId?: string | null;
  branch?: { id: string; name: string; nameAr?: string | null } | null; createdAt: string;
}

interface RoleDefinition {
  id: string; name: string; label: string; labelAr: string;
  color: string; icon: string; isSystem: boolean; isAdmin: boolean; sortOrder: number;
}

const GRADIENTS = [
  'linear-gradient(135deg,#f9a8d4,#ec4899)',
  'linear-gradient(135deg,#c4b5fd,#8b5cf6)',
  'linear-gradient(135deg,#6ee7f7,#818cf8)',
  'linear-gradient(135deg,#fde68a,#f59e0b)',
  'linear-gradient(135deg,#a7f3d0,#10b981)',
  'linear-gradient(135deg,#fca5a5,#ef4444)',
  'linear-gradient(135deg,#bfdbfe,#3b82f6)',
  'linear-gradient(135deg,#d9f99d,#65a30d)',
  'linear-gradient(135deg,#fbcfe8,#db2777)',
  'linear-gradient(135deg,#e9d5ff,#9333ea)',
];
function nameToGradient(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) { h = ((h << 5) - h) + name.charCodeAt(i); h |= 0; }
  return GRADIENTS[Math.abs(h) % GRADIENTS.length];
}

const PW_COLORS = ['', '#ef4444', '#f59e0b', '#10b981', '#10b981'];
function pwStrength(pw: string) {
  if (!pw) return 0;
  let s = 0;
  if (pw.length >= 6) s++; if (pw.length >= 10) s++;
  if (/[A-Z]/.test(pw)) s++; if (/[0-9]/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return Math.min(s, 4);
}

export default function UsersPage() {
  const { user: me } = useAuth();
  const { branches } = useBranch();
  const { t, isRTL } = useLanguage();
  const { canDo } = usePermissions();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [users, setUsers] = useState<UserRecord[]>([]);
  const [roles, setRoles] = useState<RoleDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UserRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [selected, setSelected] = useState<UserRecord | null>(null);
  const [showPw, setShowPw] = useState(false);
  const [form, setForm] = useState({ username: '', password: '', email: '', phone: '', role: 'STAFF', branchId: '', photoUrl: '' });

  const headers = { Authorization: `Bearer ${me?.token}`, 'Content-Type': 'application/json' };

  const load = useCallback(async () => {
    if (!me?.token) return;
    setLoading(true);
    const [usersRes, rolesRes] = await Promise.all([
      fetch('/api/users', { headers: { Authorization: `Bearer ${me.token}` } }),
      fetch('/api/roles', { headers: { Authorization: `Bearer ${me.token}` } }),
    ]);
    if (usersRes.ok) setUsers(await usersRes.json());
    if (rolesRes.ok) setRoles(await rolesRes.json());
    setLoading(false);
  }, [me]);

  const roleMeta = (roleName: string) => roles.find(r => r.name === roleName);

  useEffect(() => { load(); }, [load]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) return toast.error('Image must be under 3 MB');
    const reader = new FileReader();
    reader.onload = ev => setForm(f => ({ ...f, photoUrl: ev.target?.result as string }));
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const openCreate = () => {
    setSelected(null);
    setForm({ username: '', password: '', email: '', phone: '', role: 'STAFF', branchId: '', photoUrl: '' });
    setShowPw(false);
    setModalOpen(true);
  };

  const openEdit = (u: UserRecord) => {
    setSelected(u);
    setForm({ username: u.username, password: '', email: u.email || '', phone: u.phone || '', role: u.role, branchId: u.branchId || '', photoUrl: u.photoUrl || '' });
    setShowPw(false);
    setModalOpen(true);
  };

  const save = async () => {
    if (!form.username.trim()) return toast.error(t('required'));
    if (!selected && !form.password) return toast.error(t('passwordRequired'));
    if (form.password && form.password.length < 6) return toast.error(t('passwordMinLength'));
    try {
      const body: Record<string, unknown> = { username: form.username.trim(), email: form.email || null, phone: form.phone || null, role: form.role, branchId: form.branchId || null, photoUrl: form.photoUrl || null };
      if (form.password) body.password = form.password;
      const url = selected ? `/api/users/${selected.id}` : '/api/users';
      const method = selected ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers, body: JSON.stringify(body) });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed to save'); }
      toast.success(selected ? t('userUpdated') : t('userCreated'));
      setModalOpen(false);
      load();
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Error'); }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/users/${deleteTarget.id}`, { method: 'DELETE', headers });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed to delete'); }
      toast.success(t('userDeleted'));
      setDeleteTarget(null);
      load();
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Error'); }
    finally { setDeleting(false); }
  };

  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    return (!q || u.username.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q) || u.phone?.includes(q))
      && (roleFilter === 'ALL' || u.role === roleFilter);
  });

  const str = pwStrength(form.password);

  return (
    <ProtectedRoute roles={['ADMIN','MANAGER']} permKey="viewUsers">
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes svc-pop { from { opacity:0; transform:scale(0.92) translateY(18px); } to { opacity:1; transform:scale(1) translateY(0); } }
        @keyframes del-pop { from { opacity:0; transform:scale(0.88) translateY(16px); } to { opacity:1; transform:scale(1) translateY(0); } }
        .usr-card { transition: transform 0.18s, box-shadow 0.18s; }
        .usr-card:hover { transform: translateY(-3px); box-shadow: 0 12px 40px rgba(0,0,0,0.13); }
        .usr-action-btn { flex:1; padding:10px; border:none; background:transparent; cursor:pointer; font-size:13px; font-weight:600; display:flex; align-items:center; justify-content:center; gap:5px; transition:background 0.15s, color 0.15s; font-family:var(--font); }
        .usr-action-edit { color: var(--text-sub); }
        .usr-action-edit:hover { background: var(--bg-elevated); color: var(--text); }
        .usr-action-del { color: #e53e5a; }
        .usr-action-del:hover { background: rgba(229,62,90,0.06); }
        .usr-photo-avatar:hover .usr-photo-overlay { opacity: 1; }
      `}} />
      <div>
        <div className="page-header">
          <div>
            <h1 className="page-title">{t('users')}</h1>
            <p className="page-sub">{filtered.length} {t('users').toLowerCase()}</p>
          </div>
          {canDo('createUsers') && <button className="btn btn-primary" onClick={openCreate}>+ {t('addUser')}</button>}
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
          <div className="search-wrap">
            <span className="search-icon">🔍</span>
            <input className="search-input" placeholder={t('searchUsers')} value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="form-select" value={roleFilter} onChange={e => setRoleFilter(e.target.value)} style={{ width: 'auto' }}>
            <option value="ALL">{t('allRoles')}</option>
            {roles.map(r => (
              <option key={r.name} value={r.name}>
                {r.icon} {isRTL && r.labelAr ? r.labelAr : r.label}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(255px, 1fr))', gap: 18 }}>
            {[...Array(6)].map((_, i) => <div key={i} className="skeleton" style={{ height: 220 }} />)}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(255px, 1fr))', gap: 18 }}>
            {filtered.length === 0 ? (
              <div className="empty-state" style={{ gridColumn: '1/-1' }}>
                <div className="empty-state-icon">👤</div>
                <div className="empty-state-title">{t('noUsers')}</div>
              </div>
            ) : filtered.map(u => {
              const grad = nameToGradient(u.username);
              return (
                <div key={u.id} className="glass-card usr-card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                  {/* Banner */}
                  <div style={{ position: 'relative', height: 110, background: grad, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {u.photoUrl ? (
                      <img src={u.photoUrl} alt={u.username}
                        style={{ width: 74, height: 74, borderRadius: '50%', objectFit: 'cover', border: '3px solid rgba(255,255,255,0.75)', boxShadow: '0 4px 18px rgba(0,0,0,0.2)' }} />
                    ) : (
                      <div style={{
                        width: 74, height: 74, borderRadius: '50%',
                        background: 'rgba(255,255,255,0.25)', backdropFilter: 'blur(6px)',
                        border: '2.5px solid rgba(255,255,255,0.6)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '1.6rem', fontWeight: 800, color: '#fff',
                        boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                        letterSpacing: '-1px',
                      }}>
                        {u.username.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    {/* Role badge */}
                    {(() => { const rm = roleMeta(u.role); return (
                      <div style={{
                        position: 'absolute', top: 10, insetInlineEnd: 10,
                        background: 'rgba(0,0,0,0.22)', backdropFilter: 'blur(6px)',
                        borderRadius: 20, padding: '4px 10px',
                        fontSize: 11.5, fontWeight: 700, color: '#fff',
                      }}>
                        {rm?.icon ?? '👤'} {isRTL && rm?.labelAr ? rm.labelAr : (rm?.label ?? u.role)}
                      </div>
                    ); })()}
                    {/* "You" badge */}
                    {u.id === me?.id && (
                      <div style={{
                        position: 'absolute', top: 10, insetInlineStart: 10,
                        background: 'rgba(255,255,255,0.28)', backdropFilter: 'blur(6px)',
                        borderRadius: 20, padding: '4px 10px',
                        fontSize: 11, fontWeight: 700, color: '#fff',
                      }}>
                        ✦ {isRTL ? 'أنت' : 'You'}
                      </div>
                    )}
                  </div>

                  {/* Body */}
                  <div style={{ padding: '15px 17px 12px', flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <h3 style={{ fontWeight: 700, fontSize: '0.96rem', color: 'var(--text)', margin: 0, lineHeight: 1.3 }}>{u.username}</h3>
                    {u.email && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: 'var(--text-sub)' }}>
                        <span style={{ opacity: 0.7 }}>✉</span>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</span>
                      </div>
                    )}
                    {u.phone && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: 'var(--text-sub)' }}>
                        <span style={{ opacity: 0.7 }}>📞</span>{u.phone}
                      </div>
                    )}
                    {u.branch && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: 'var(--text-sub)' }}>
                        <span style={{ opacity: 0.7 }}>🏢</span>{isRTL && u.branch.nameAr ? u.branch.nameAr : u.branch.name}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  {(canDo('editUsers') || canDo('deleteUsers')) && (
                    <div style={{ display: 'flex', borderTop: '1px solid var(--border)', overflow: 'hidden' }}>
                      {canDo('editUsers') && <button className="usr-action-btn usr-action-edit" onClick={() => openEdit(u)}>
                        ✏️ {t('edit')}
                      </button>}
                      {canDo('deleteUsers') && u.id !== me?.id && (
                        <>
                          {canDo('editUsers') && <div style={{ width: 1, background: 'var(--border)' }} />}
                          <button className="usr-action-btn usr-action-del" onClick={() => setDeleteTarget(u)}>
                            🗑 {t('delete')}
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Hidden file input */}
        <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />

        {/* Create / Edit Modal */}
        {modalOpen && (
          <div className="modal-overlay" style={{ backdropFilter: 'blur(8px)' }}>
            <div style={{
              background: 'var(--bg-surface)', borderRadius: 24, width: '100%', maxWidth: 460,
              boxShadow: '0 28px 80px rgba(0,0,0,0.22)', overflow: 'hidden',
              animation: 'svc-pop 0.24s cubic-bezier(.34,1.56,.64,1)',
            }}>
              <div style={{ height: 5, background: 'linear-gradient(90deg,var(--rose),#a855f7,#3b82f6)' }} />

              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 22px 10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {/* Clickable avatar */}
                  <div className="usr-photo-avatar" onClick={() => fileInputRef.current?.click()}
                    style={{
                      position: 'relative', width: 56, height: 56, borderRadius: '50%', flexShrink: 0,
                      cursor: 'pointer', overflow: 'hidden',
                      background: nameToGradient(form.username || 'user'),
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: '0 4px 14px rgba(0,0,0,0.15)',
                      border: '2.5px solid var(--border)',
                    }}>
                    {form.photoUrl ? (
                      <img src={form.photoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <span style={{ fontSize: '1.3rem', fontWeight: 800, color: '#fff', letterSpacing: '-0.5px' }}>
                        {form.username ? form.username.slice(0, 2).toUpperCase() : '?'}
                      </span>
                    )}
                    <div className="usr-photo-overlay" style={{
                      position: 'absolute', inset: 0,
                      background: 'rgba(0,0,0,0.45)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      opacity: 0, transition: 'opacity 0.15s',
                      fontSize: '1.1rem',
                    }}>📷</div>
                  </div>
                  <div style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--text)' }}>
                    {selected ? t('editUser') : t('newUser')}
                  </div>
                </div>
                <button onClick={() => setModalOpen(false)} style={{
                  background: 'var(--bg-elevated)', border: 'none', cursor: 'pointer',
                  color: 'var(--text-sub)', fontSize: 14, width: 30, height: 30,
                  borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>✕</button>
              </div>

              <div style={{ padding: '4px 22px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>

                {/* Photo upload */}
                <div>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: 11.5, color: 'var(--text-sub)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {t('photo')}
                  </label>
                  {form.photoUrl ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <img src={form.photoUrl} alt="" style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--border)', flexShrink: 0 }} />
                      <button onClick={() => fileInputRef.current?.click()} style={{ padding: '7px 14px', border: '1.5px solid var(--border)', borderRadius: 10, background: 'var(--bg-elevated)', cursor: 'pointer', fontFamily: 'var(--font)', fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                        📷 {t('changePhoto')}
                      </button>
                      <button onClick={() => setForm(f => ({ ...f, photoUrl: '' }))} style={{ padding: '7px 14px', border: '1.5px solid rgba(229,62,90,0.3)', borderRadius: 10, background: 'transparent', cursor: 'pointer', fontFamily: 'var(--font)', fontSize: 13, fontWeight: 600, color: '#e53e5a' }}>
                        {t('removePhoto')}
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => fileInputRef.current?.click()} style={{ width: '100%', padding: '18px', border: '2px dashed var(--border)', borderRadius: 12, background: 'var(--bg-elevated)', cursor: 'pointer', fontFamily: 'var(--font)', fontSize: 13, fontWeight: 600, color: 'var(--text-sub)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--rose)'; (e.currentTarget as HTMLElement).style.color = 'var(--text)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-sub)'; }}>
                      <span style={{ fontSize: '1.3rem' }}>📷</span> {t('choosePhoto')}
                    </button>
                  )}
                </div>

                {/* Username */}
                <div>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: 11.5, color: 'var(--text-sub)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {t('username')} <span style={{ color: 'var(--rose)' }}>*</span>
                  </label>
                  <input className="form-input" placeholder="e.g. john_doe" value={form.username}
                    onChange={e => setForm(f => ({ ...f, username: e.target.value }))} autoComplete="off" />
                </div>

                {/* Role */}
                <div>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: 11.5, color: 'var(--text-sub)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {t('role')}
                  </label>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {roles.map(r => (
                      <button key={r.name} type="button" onClick={() => setForm(f => ({ ...f, role: r.name }))} style={{
                        padding: '9px 12px', border: '2px solid',
                        borderColor: form.role === r.name ? r.color : 'var(--border)',
                        borderRadius: 10, cursor: 'pointer',
                        background: form.role === r.name ? `${r.color}18` : 'var(--bg-elevated)',
                        fontFamily: 'var(--font)', fontSize: 12, fontWeight: 700,
                        color: form.role === r.name ? r.color : 'var(--text-sub)',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                        transition: 'all 0.12s', minWidth: 64,
                      }}>
                        <span style={{ fontSize: '1.1rem' }}>{r.icon}</span>
                        <span>{isRTL && r.labelAr ? r.labelAr : r.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: 11.5, color: 'var(--text-sub)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {selected ? t('keepPasswordBlank') : `${t('password')} *`}
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input className="form-input" type={showPw ? 'text' : 'password'}
                      placeholder={selected ? '••••••••' : t('passwordMin6Placeholder')}
                      value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                      autoComplete="new-password" style={{ paddingRight: 44 }} />
                    <button type="button" onClick={() => setShowPw(v => !v)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-sub)', display: 'flex', alignItems: 'center' }}>
                      {showPw
                        ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24M1 1l22 22"/></svg>
                        : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>}
                    </button>
                  </div>
                  {form.password && (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                        {[1,2,3,4].map(n => <div key={n} style={{ flex: 1, height: 4, borderRadius: 4, background: str >= n ? PW_COLORS[str] : 'var(--border)', transition: 'background 0.2s' }} />)}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: PW_COLORS[str], fontWeight: 600 }}>{t('strengthLabels')[str]}</div>
                    </div>
                  )}
                </div>

                {/* Email + Phone row */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontWeight: 600, fontSize: 11.5, color: 'var(--text-sub)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('email')}</label>
                    <input className="form-input" type="email" placeholder="user@example.com" value={form.email}
                      onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontWeight: 600, fontSize: 11.5, color: 'var(--text-sub)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('phone')}</label>
                    <input className="form-input" type="tel" placeholder="+962 …" value={form.phone}
                      onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                  </div>
                </div>

                {/* Branch */}
                <div>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: 11.5, color: 'var(--text-sub)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('branch')}</label>
                  <select className="form-select" value={form.branchId} onChange={e => setForm(f => ({ ...f, branchId: e.target.value }))}>
                    <option value="">{t('noBranchAssigned')}</option>
                    {branches.map(b => <option key={b.id} value={b.id}>{isRTL && b.nameAr ? b.nameAr : b.name}</option>)}
                  </select>
                </div>

                {/* Footer */}
                <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
                  <button onClick={() => setModalOpen(false)} style={{ flex: 1, padding: '11px', border: '1.5px solid var(--border)', borderRadius: 12, background: 'transparent', color: 'var(--text-muted)', fontFamily: 'var(--font)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                    {t('cancel')}
                  </button>
                  <button onClick={save} style={{ flex: 1, padding: '11px', border: 'none', borderRadius: 12, background: 'linear-gradient(135deg,var(--rose),#c0392b)', color: '#fff', fontFamily: 'var(--font)', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                    {selected ? t('saveChanges') : t('createUser')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation */}
        {deleteTarget && (
          <div className="modal-overlay" style={{ backdropFilter: 'blur(6px)' }}>
            <div style={{ background: 'var(--bg-surface)', borderRadius: 24, width: '100%', maxWidth: 370, boxShadow: '0 24px 80px rgba(0,0,0,0.18)', overflow: 'hidden', animation: 'del-pop 0.22s cubic-bezier(.34,1.56,.64,1)' }}>
              <div style={{ height: 5, background: 'linear-gradient(90deg,#e53e5a,#ff6b81)' }} />
              <div style={{ padding: '26px 26px 22px', textAlign: 'center' }}>
                <div style={{ width: 58, height: 58, borderRadius: '50%', margin: '0 auto 14px', background: nameToGradient(deleteTarget.username), display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', border: '2px solid var(--border)' }}>
                  {deleteTarget.photoUrl
                    ? <img src={deleteTarget.photoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <span style={{ fontSize: '1.3rem', fontWeight: 800, color: '#fff' }}>{deleteTarget.username.slice(0,2).toUpperCase()}</span>}
                </div>
                <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 6 }}>{t('deleteUser')}</div>
                <div style={{ fontSize: 13.5, color: 'var(--text-sub)', marginBottom: 20, lineHeight: 1.6 }}>
                  <strong style={{ color: 'var(--text)' }}>{deleteTarget.username}</strong> — {t('deleteApptConfirm')}
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => setDeleteTarget(null)} disabled={deleting} style={{ flex: 1, padding: '11px', border: '1.5px solid var(--border)', borderRadius: 12, background: 'transparent', color: 'var(--text-muted)', fontFamily: 'var(--font)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                    {t('cancel')}
                  </button>
                  <button onClick={confirmDelete} disabled={deleting} style={{ flex: 1, padding: '11px', border: 'none', borderRadius: 12, background: 'linear-gradient(135deg,#e53e5a,#c0392b)', color: '#fff', fontFamily: 'var(--font)', fontSize: 14, fontWeight: 700, cursor: deleting ? 'not-allowed' : 'pointer', opacity: deleting ? 0.7 : 1 }}>
                    {deleting ? t('deleting') : t('delete')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
