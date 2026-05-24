'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { usePermissions } from '@/context/PermissionsContext';

interface RoleDefinition {
  id: string;
  name: string;
  label: string;
  labelAr: string;
  color: string;
  icon: string;
  isSystem: boolean;
  isAdmin: boolean;
  sortOrder: number;
}

interface User {
  id: string;
  username: string;
  email?: string | null;
  phone?: string | null;
  role: string;
  photoUrl?: string | null;
  branch?: { id: string; name: string; nameAr?: string | null } | null;
}

function nameToGradient(name: string) {
  const grads = [
    'linear-gradient(135deg,#f093fb,#f5576c)',
    'linear-gradient(135deg,#4facfe,#00f2fe)',
    'linear-gradient(135deg,#43e97b,#38f9d7)',
    'linear-gradient(135deg,#fa709a,#fee140)',
    'linear-gradient(135deg,#a18cd1,#fbc2eb)',
    'linear-gradient(135deg,#fccb90,#d57eeb)',
  ];
  return grads[name.charCodeAt(0) % grads.length];
}

const ROLE_COLORS = ['#C4788C','#0891b2','#6366f1','#10b981','#f59e0b','#8b5cf6','#ef4444','#ec4899','#14b8a6','#f97316'];
const ROLE_ICONS  = ['👤','👨‍💼','👩‍💼','🧑‍⚕️','💼','🎯','🏥','✂️','💆','🎨','🧑‍🔧','📋'];

export default function RolesPage() {
  const { user } = useAuth();
  const { t, isRTL, lang } = useLanguage();
  const { canDo } = usePermissions();

  const [roles,    setRoles]    = useState<RoleDefinition[]>([]);
  const [users,    setUsers]    = useState<User[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [changing, setChanging] = useState<string | null>(null);

  // Add Role modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName,      setNewName]      = useState('');
  const [newLabel,     setNewLabel]     = useState('');
  const [newLabelAr,   setNewLabelAr]   = useState('');
  const [newColor,     setNewColor]     = useState(ROLE_COLORS[3]);
  const [newIcon,      setNewIcon]      = useState('👤');
  const [newCopyFrom,  setNewCopyFrom]  = useState('STAFF');
  const [creating,     setCreating]     = useState(false);

  // Edit Role modal state
  const [editTarget,  setEditTarget]  = useState<RoleDefinition | null>(null);
  const [editLabel,   setEditLabel]   = useState('');
  const [editLabelAr, setEditLabelAr] = useState('');
  const [editColor,   setEditColor]   = useState(ROLE_COLORS[0]);
  const [editIcon,    setEditIcon]    = useState('👤');
  const [editSaving,  setEditSaving]  = useState(false);

  // Delete Role state
  const [deleteTarget, setDeleteTarget] = useState<RoleDefinition | null>(null);
  const [deleting,     setDeleting]     = useState(false);

  const openEdit = (role: RoleDefinition) => {
    setEditTarget(role);
    setEditLabel(role.label);
    setEditLabelAr(role.labelAr);
    setEditColor(role.color);
    setEditIcon(role.icon);
  };

  const load = useCallback(async () => {
    if (!user?.token) return;
    setLoading(true);
    const [rolesRes, usersRes] = await Promise.all([
      fetch('/api/roles', { headers: { Authorization: `Bearer ${user.token}` } }),
      fetch('/api/users', { headers: { Authorization: `Bearer ${user.token}` } }),
    ]);
    if (rolesRes.ok) setRoles(await rolesRes.json());
    if (usersRes.ok) {
      const data = await usersRes.json();
      setUsers(Array.isArray(data) ? data : (data.data ?? []));
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const changeRole = async (userId: string, newRole: string) => {
    if (!user?.token || !canDo('editUsers')) return;
    if (userId === user.id && newRole !== user.role) {
      if (!confirm(isRTL
        ? 'هذا حسابك الخاص. هل أنت متأكد من تغيير دورك؟'
        : 'This is your own account. Are you sure you want to change your role?'))
        return;
    }
    setChanging(userId);
    const target = users.find(u => u.id === userId);
    if (!target) { setChanging(null); return; }

    const res = await fetch(`/api/users/${userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.token}` },
      body: JSON.stringify({
        username: target.username, email: target.email, phone: target.phone,
        role: newRole, branchId: target.branch?.id ?? null, photoUrl: target.photoUrl ?? null,
      }),
    });
    if (res.ok) {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
      toast.success(isRTL ? t('roleChanged') : 'Role updated');
    } else {
      toast.error(isRTL ? t('roleChangeFailed') : 'Failed to update role');
    }
    setChanging(null);
  };

  const handleAddRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.token || !newName || !newLabel) return;
    setCreating(true);
    try {
      const res = await fetch('/api/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.token}` },
        body: JSON.stringify({ name: newName, label: newLabel, labelAr: newLabelAr, color: newColor, icon: newIcon, copyFromRole: newCopyFrom }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Role "${data.label}" created`);
        setShowAddModal(false);
        setNewName(''); setNewLabel(''); setNewLabelAr(''); setNewCopyFrom('STAFF');
        await load();
      } else {
        toast.error(data.error ?? 'Failed to create role');
      }
    } catch {
      toast.error('Connection error');
    }
    setCreating(false);
  };

  const handleEditRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.token || !editTarget) return;
    setEditSaving(true);
    try {
      const res = await fetch(`/api/roles/${editTarget.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.token}` },
        body: JSON.stringify({ label: editLabel, labelAr: editLabelAr, color: editColor, icon: editIcon }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Role "${data.label}" updated`);
        setEditTarget(null);
        await load();
      } else {
        toast.error(data.error ?? 'Failed to update role');
      }
    } catch {
      toast.error('Connection error');
    }
    setEditSaving(false);
  };

  const handleDelete = async () => {
    if (!user?.token || !deleteTarget) return;
    setDeleting(true);
    try {
      const res  = await fetch(`/api/roles/${deleteTarget.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${user.token}` } });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Role "${deleteTarget.label}" deleted`);
        setDeleteTarget(null);
        await load();
      } else {
        toast.error(data.error ?? 'Failed to delete');
      }
    } catch {
      toast.error('Connection error');
    }
    setDeleting(false);
  };

  // Group users by role
  const knownRoleNames = new Set(roles.map(r => r.name));
  const grouped: Record<string, User[]> = {};
  const unknown: User[] = [];
  for (const r of roles) grouped[r.name] = [];
  for (const u of users) {
    if (knownRoleNames.has(u.role)) grouped[u.role].push(u);
    else unknown.push(u);
  }

  const roleMeta = (roleName: string): RoleDefinition | undefined =>
    roles.find(r => r.name === roleName);

  const colCount = roles.length + (unknown.length > 0 ? 1 : 0);

  return (
    <ProtectedRoute roles={['ADMIN', 'MANAGER']} permKey="createUsers">
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes role-card-pop { from { opacity:0; transform:scale(0.94) translateY(14px); } to { opacity:1; transform:scale(1) translateY(0); } }
        .role-card { transition: transform 0.18s, box-shadow 0.18s; animation: role-card-pop 0.22s cubic-bezier(.34,1.56,.64,1); }
        .role-card:hover { transform: translateY(-3px); box-shadow: 0 12px 40px rgba(0,0,0,0.13); }
        .role-user-row { display: flex; align-items: center; gap: 10px; padding: 8px 12px; border-radius: 10px; background: var(--bg-elevated); border: 1px solid var(--border); transition: border-color 0.15s; }
        .role-user-row:hover { border-color: rgba(196,120,140,0.25); }
        .role-select { background: var(--bg-surface); border: 1px solid var(--border); border-radius: 8px; padding: 4px 8px; color: var(--text); font-size: 0.76rem; font-weight: 600; cursor: pointer; font-family: var(--font); outline: none; transition: border-color 0.15s; max-width: 120px; }
        .role-select:hover, .role-select:focus { border-color: var(--rose); }
        .roles-dyn-grid { display: grid; gap: 18px; }
        .role-action-btn { flex:1; padding:10px; border:none; background:transparent; cursor:pointer; font-size:13px; font-weight:600; display:flex; align-items:center; justify-content:center; gap:5px; transition:background 0.15s, color 0.15s; font-family:var(--font); }
        .role-action-edit { color: var(--text-sub); }
        .role-action-edit:hover { background: var(--bg-elevated); color: var(--text); }
        .role-action-del { color: #e53e5a; }
        .role-action-del:hover { background: rgba(229,62,90,0.06); }
        .role-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); backdrop-filter: blur(4px); z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 20px; }
        .role-modal { background: var(--bg-surface); border: 1px solid var(--border); border-radius: 20px; padding: 28px; width: 100%; max-width: 480px; box-shadow: 0 20px 60px rgba(0,0,0,0.3); }
        .role-form-row { display: flex; flex-direction: column; gap: 5px; margin-bottom: 16px; }
        .role-form-label { font-size: 0.78rem; font-weight: 700; color: var(--text-sub); text-transform: uppercase; letter-spacing: 0.05em; }
        .role-form-input { background: var(--bg-elevated); border: 1px solid var(--border); border-radius: 10px; padding: 9px 13px; color: var(--text); font-family: var(--font); font-size: 0.9rem; outline: none; transition: border-color 0.15s; }
        .role-form-input:focus { border-color: var(--rose); }
      `}} />

      <div>
        {/* Header */}
        <div className="page-header">
          <div>
            <h1 className="page-title">{isRTL ? t('rolesTitle') : 'Role Management'}</h1>
            <p className="page-sub">{isRTL ? t('rolesSub') : 'Assign roles to users to control their access level'}</p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {user?.role === 'ADMIN' && (
              <>
                <button
                  onClick={() => setShowAddModal(true)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 18px', borderRadius: 10, border: 'none', background: 'var(--rose)', color: '#fff', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}
                >
                  + {isRTL ? 'دور جديد' : 'Add Role'}
                </button>
                <Link href="/permissions" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 18px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text)', fontWeight: 600, fontSize: '0.85rem', textDecoration: 'none', transition: 'border-color 0.15s' }}>
                  🔐 {isRTL ? 'إدارة الصلاحيات' : 'Manage Permissions'}
                </Link>
              </>
            )}
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 18 }}>
            {[0, 1, 2].map(i => <div key={i} className="skeleton" style={{ height: 300 }} />)}
          </div>
        ) : (
          <div
            className="roles-dyn-grid"
            style={{ gridTemplateColumns: `repeat(${Math.min(colCount, 3)}, 1fr)` }}
          >
            {roles.map(role => {
              const roleUsers = grouped[role.name] ?? [];
              return (
                <div key={role.id} className="glass-card role-card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                  {/* Banner */}
                  <div style={{ position: 'relative', height: 100, background: `linear-gradient(135deg, ${role.color}dd, ${role.color}66)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <div style={{ width: 62, height: 62, borderRadius: '50%', background: 'rgba(255,255,255,0.22)', backdropFilter: 'blur(6px)', border: '2.5px solid rgba(255,255,255,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.7rem', boxShadow: '0 4px 16px rgba(0,0,0,0.14)' }}>
                      {role.icon}
                    </div>
                    {/* User count badge */}
                    <div style={{ position: 'absolute', top: 10, insetInlineEnd: 10, background: 'rgba(0,0,0,0.22)', backdropFilter: 'blur(6px)', borderRadius: 20, padding: '4px 10px', fontSize: 11.5, fontWeight: 700, color: '#fff' }}>
                      {roleUsers.length} {isRTL ? t('usersInRole') : roleUsers.length === 1 ? 'user' : 'users'}
                    </div>
                    {/* System badge */}
                    {role.isSystem && (
                      <div style={{ position: 'absolute', top: 10, insetInlineStart: 10, background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(6px)', borderRadius: 20, padding: '4px 10px', fontSize: 11, fontWeight: 700, color: '#fff' }}>
                        🔒 {isRTL ? 'نظام' : 'System'}
                      </div>
                    )}
                  </div>

                  {/* Role info */}
                  <div style={{ padding: '13px 16px 10px', borderBottom: '1px solid var(--border)' }}>
                    <h3 style={{ fontWeight: 800, fontSize: '1rem', color: role.color, margin: '0 0 2px', lineHeight: 1.3 }}>
                      {isRTL && role.labelAr ? role.labelAr : role.label}
                    </h3>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-sub)', fontWeight: 600 }}>{role.name}</div>
                  </div>

                  {/* Users list */}
                  <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 7, flex: 1, minHeight: 50 }}>
                    {roleUsers.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '16px 12px', color: 'var(--text-sub)', fontSize: '0.82rem' }}>
                        {isRTL ? t('noUsersInRole') : 'No users assigned'}
                      </div>
                    ) : roleUsers.map(u => {
                      const isMe = u.id === user?.id;
                      return (
                        <div key={u.id} className="role-user-row" style={{ opacity: changing === u.id ? 0.6 : 1 }}>
                          {u.photoUrl ? (
                            <img src={u.photoUrl} alt={u.username} style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '2px solid var(--border)' }} />
                          ) : (
                            <div style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0, background: nameToGradient(u.username), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 800, color: '#fff' }}>
                              {u.username.slice(0, 2).toUpperCase()}
                            </div>
                          )}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                              <span style={{ fontWeight: 700, fontSize: '0.83rem', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.username}</span>
                              {isMe && (
                                <span style={{ fontSize: '0.6rem', fontWeight: 800, background: `${role.color}20`, color: role.color, border: `1px solid ${role.color}40`, borderRadius: 20, padding: '1px 6px', flexShrink: 0 }}>
                                  {isRTL ? 'أنت' : 'You'}
                                </span>
                              )}
                            </div>
                            {u.branch && (
                              <div style={{ fontSize: '0.68rem', color: 'var(--text-sub)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                🏢 {lang === 'ar' && u.branch.nameAr ? u.branch.nameAr : u.branch.name}
                              </div>
                            )}
                          </div>
                          {canDo('editUsers') && (
                            <select className="role-select" value={u.role} disabled={changing === u.id} onChange={e => changeRole(u.id, e.target.value)} style={{ color: roleMeta(u.role)?.color ?? 'var(--text)' }}>
                              {roles.map(r => (
                                <option key={r.name} value={r.name} style={{ color: r.color }}>
                                  {r.icon} {isRTL && r.labelAr ? r.labelAr : r.label}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Action buttons */}
                  {user?.role === 'ADMIN' && (
                    <div style={{ display: 'flex', borderTop: '1px solid var(--border)', overflow: 'hidden', flexShrink: 0 }}>
                      <button className="role-action-btn role-action-edit" onClick={() => openEdit(role)}>
                        ✏️ {isRTL ? 'تعديل' : 'Edit'}
                      </button>
                      {!role.isAdmin && (
                        <>
                          <div style={{ width: 1, background: 'var(--border)' }} />
                          <button className="role-action-btn role-action-del" onClick={() => setDeleteTarget(role)}>
                            🗑 {isRTL ? 'حذف' : 'Delete'}
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Unknown roles bucket */}
            {unknown.length > 0 && (
              <div className="glass-card role-card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div style={{ position: 'relative', height: 100, background: 'linear-gradient(135deg, #f59e0bdd, #f59e0b66)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <div style={{ width: 62, height: 62, borderRadius: '50%', background: 'rgba(255,255,255,0.22)', backdropFilter: 'blur(6px)', border: '2.5px solid rgba(255,255,255,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.7rem', boxShadow: '0 4px 16px rgba(0,0,0,0.14)' }}>⚠️</div>
                  <div style={{ position: 'absolute', top: 10, insetInlineEnd: 10, background: 'rgba(0,0,0,0.22)', backdropFilter: 'blur(6px)', borderRadius: 20, padding: '4px 10px', fontSize: 11.5, fontWeight: 700, color: '#fff' }}>
                    {unknown.length} {isRTL ? 'مستخدم' : unknown.length === 1 ? 'user' : 'users'}
                  </div>
                </div>
                <div style={{ padding: '13px 16px 10px', borderBottom: '1px solid var(--border)' }}>
                  <h3 style={{ fontWeight: 800, fontSize: '1rem', color: '#f59e0b', margin: '0 0 2px' }}>{isRTL ? 'أدوار غير معروفة' : 'Unknown Roles'}</h3>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-sub)', fontWeight: 600 }}>{isRTL ? 'الأدوار غير موجودة في النظام' : 'roles not found in system'}</div>
                </div>
                <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 7, flex: 1 }}>
                  {unknown.map(u => (
                    <div key={u.id} className="role-user-row">
                      <div style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0, background: nameToGradient(u.username), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 800, color: '#fff' }}>
                        {u.username.slice(0, 2).toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: '0.83rem', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.username}</div>
                        <div style={{ fontSize: '0.68rem', color: '#f59e0b', fontWeight: 600 }}>{u.role}</div>
                      </div>
                      {canDo('editUsers') && (
                        <select className="role-select" value={u.role} onChange={e => changeRole(u.id, e.target.value)}>
                          <option value={u.role}>{u.role}</option>
                          {roles.map(r => (
                            <option key={r.name} value={r.name}>{r.icon} {isRTL && r.labelAr ? r.labelAr : r.label}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Info note */}
        <div style={{ marginTop: 20, padding: '12px 16px', background: 'rgba(196,120,140,0.06)', border: '1px solid rgba(196,120,140,0.15)', borderRadius: 12, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <span style={{ fontSize: '1rem', flexShrink: 0 }}>ℹ️</span>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-sub)', lineHeight: 1.6, margin: 0 }}>
            {isRTL
              ? 'تغيير الدور يؤثر فوراً على ما يمكن للمستخدم رؤيته. يمكن تعديل الصلاحيات من صفحة إدارة الصلاحيات.'
              : 'Changing a role immediately affects access. Configure permissions for each role from the Manage Permissions page.'}
          </p>
        </div>
      </div>

      {/* ── Add Role Modal ── */}
      {showAddModal && (
        <div className="role-modal-overlay">
          <div className="role-modal">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
              <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>{isRTL ? 'إضافة دور جديد' : 'Add New Role'}</h2>
              <button onClick={() => setShowAddModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-sub)', cursor: 'pointer', fontSize: '1.2rem', lineHeight: 1 }}>×</button>
            </div>
            <form onSubmit={handleAddRole}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="role-form-row" style={{ gridColumn: '1/-1' }}>
                  <label className="role-form-label">{isRTL ? 'الاسم الداخلي (بالأحرف الكبيرة)' : 'Internal Name (UPPERCASE)'}</label>
                  <input className="role-form-input" value={newName} onChange={e => setNewName(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '_'))} placeholder="e.g. RECEPTIONIST" required />
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-sub)' }}>Letters and underscores only</span>
                </div>
                <div className="role-form-row">
                  <label className="role-form-label">{isRTL ? 'الاسم المعروض' : 'Display Label'}</label>
                  <input className="role-form-input" value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="Receptionist" required />
                </div>
                <div className="role-form-row">
                  <label className="role-form-label">{isRTL ? 'الاسم بالعربية' : 'Arabic Label'}</label>
                  <input className="role-form-input" value={newLabelAr} onChange={e => setNewLabelAr(e.target.value)} placeholder="موظف استقبال" dir="rtl" />
                </div>
              </div>

              <div className="role-form-row">
                <label className="role-form-label">{isRTL ? 'اللون' : 'Color'}</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {ROLE_COLORS.map(c => (
                    <button key={c} type="button" onClick={() => setNewColor(c)} style={{ width: 28, height: 28, borderRadius: 8, background: c, border: newColor === c ? '2px solid var(--text)' : '2px solid transparent', cursor: 'pointer', outline: 'none', transition: 'border-color 0.15s' }} />
                  ))}
                </div>
              </div>

              <div className="role-form-row">
                <label className="role-form-label">{isRTL ? 'الأيقونة' : 'Icon'}</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                  {ROLE_ICONS.map(ic => (
                    <button key={ic} type="button" onClick={() => setNewIcon(ic)} style={{ width: 34, height: 34, borderRadius: 8, border: newIcon === ic ? `2px solid ${newColor}` : '2px solid var(--border)', background: newIcon === ic ? `${newColor}15` : 'var(--bg-elevated)', cursor: 'pointer', fontSize: '1rem', transition: 'border-color 0.15s' }}>
                      {ic}
                    </button>
                  ))}
                  <input value={newIcon} onChange={e => setNewIcon(e.target.value)} maxLength={2} style={{ width: 40, textAlign: 'center', fontSize: '1rem', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: 4, color: 'var(--text)' }} placeholder="✏️" />
                </div>
              </div>

              <div className="role-form-row">
                <label className="role-form-label">{isRTL ? 'نسخ الصلاحيات من' : 'Copy Permissions From'}</label>
                <select className="role-form-input" value={newCopyFrom} onChange={e => setNewCopyFrom(e.target.value)}>
                  {roles.map(r => <option key={r.name} value={r.name}>{isRTL && r.labelAr ? r.labelAr : r.label}</option>)}
                </select>
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button type="button" onClick={() => setShowAddModal(false)} style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-sub)', fontWeight: 600, cursor: 'pointer' }}>
                  {isRTL ? 'إلغاء' : 'Cancel'}
                </button>
                <button type="submit" disabled={creating} style={{ flex: 1, padding: '10px', borderRadius: 10, border: 'none', background: newColor, color: '#fff', fontWeight: 700, cursor: creating ? 'not-allowed' : 'pointer', opacity: creating ? 0.7 : 1 }}>
                  {creating ? '…' : (isRTL ? 'إنشاء الدور' : 'Create Role')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Edit Role Modal ── */}
      {editTarget && (
        <div className="role-modal-overlay">
          <div className="role-modal">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 9, background: `${editColor}18`, border: `1.5px solid ${editColor}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>{editIcon}</div>
                <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>{isRTL ? 'تعديل الدور' : 'Edit Role'} — {editTarget.name}</h2>
              </div>
              <button onClick={() => setEditTarget(null)} style={{ background: 'none', border: 'none', color: 'var(--text-sub)', cursor: 'pointer', fontSize: '1.2rem', lineHeight: 1 }}>×</button>
            </div>

            {editTarget.isSystem && (
              <div style={{ marginBottom: 14, padding: '8px 12px', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 8, fontSize: '0.78rem', color: 'var(--text-sub)' }}>
                🔒 {isRTL ? 'دور النظام — يمكن تعديل العرض فقط' : 'System role — only display properties can be changed'}
              </div>
            )}

            <form onSubmit={handleEditRole}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="role-form-row">
                  <label className="role-form-label">{isRTL ? 'الاسم المعروض' : 'Display Label'}</label>
                  <input className="role-form-input" value={editLabel} onChange={e => setEditLabel(e.target.value)} required />
                </div>
                <div className="role-form-row">
                  <label className="role-form-label">{isRTL ? 'الاسم بالعربية' : 'Arabic Label'}</label>
                  <input className="role-form-input" value={editLabelAr} onChange={e => setEditLabelAr(e.target.value)} dir="rtl" />
                </div>
              </div>

              <div className="role-form-row">
                <label className="role-form-label">{isRTL ? 'اللون' : 'Color'}</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {ROLE_COLORS.map(c => (
                    <button key={c} type="button" onClick={() => setEditColor(c)} style={{ width: 28, height: 28, borderRadius: 8, background: c, border: editColor === c ? '2px solid var(--text)' : '2px solid transparent', cursor: 'pointer', outline: 'none' }} />
                  ))}
                </div>
              </div>

              <div className="role-form-row">
                <label className="role-form-label">{isRTL ? 'الأيقونة' : 'Icon'}</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                  {ROLE_ICONS.map(ic => (
                    <button key={ic} type="button" onClick={() => setEditIcon(ic)} style={{ width: 34, height: 34, borderRadius: 8, border: editIcon === ic ? `2px solid ${editColor}` : '2px solid var(--border)', background: editIcon === ic ? `${editColor}15` : 'var(--bg-elevated)', cursor: 'pointer', fontSize: '1rem' }}>
                      {ic}
                    </button>
                  ))}
                  <input value={editIcon} onChange={e => setEditIcon(e.target.value)} maxLength={2} style={{ width: 40, textAlign: 'center', fontSize: '1rem', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: 4, color: 'var(--text)' }} />
                </div>
              </div>

              {/* Preview */}
              <div style={{ marginBottom: 16, padding: '10px 14px', background: 'var(--bg-elevated)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: `${editColor}18`, border: `1.5px solid ${editColor}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem' }}>{editIcon}</div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '0.9rem', color: editColor }}>{editLabel || '—'}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-sub)' }}>{editTarget.name}</div>
                </div>
                <span style={{ marginInlineStart: 'auto', fontSize: '0.7rem', color: 'var(--text-sub)', fontWeight: 600 }}>{isRTL ? 'معاينة' : 'Preview'}</span>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button type="button" onClick={() => setEditTarget(null)} style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-sub)', fontWeight: 600, cursor: 'pointer' }}>
                  {isRTL ? 'إلغاء' : 'Cancel'}
                </button>
                <button type="submit" disabled={editSaving} style={{ flex: 1, padding: '10px', borderRadius: 10, border: 'none', background: editColor, color: '#fff', fontWeight: 700, cursor: editSaving ? 'not-allowed' : 'pointer', opacity: editSaving ? 0.7 : 1 }}>
                  {editSaving ? '…' : (isRTL ? 'حفظ التغييرات' : 'Save Changes')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation ── */}
      {deleteTarget && (
        <div className="role-modal-overlay">
          <div className="role-modal" style={{ maxWidth: 400 }}>
            <div style={{ textAlign: 'center', padding: '8px 0 16px' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>{deleteTarget.icon}</div>
              <h2 style={{ margin: '0 0 8px', fontSize: '1rem', fontWeight: 800 }}>
                {isRTL ? `حذف دور "${deleteTarget.labelAr || deleteTarget.label}"؟` : `Delete "${deleteTarget.label}" role?`}
              </h2>
              <p style={{ margin: 0, fontSize: '0.83rem', color: 'var(--text-sub)', lineHeight: 1.6 }}>
                {isRTL
                  ? 'سيتم حذف هذا الدور نهائياً. يجب إعادة تعيين المستخدمين الذين لديهم هذا الدور أولاً.'
                  : 'This role will be permanently deleted. Users assigned to it must be reassigned first.'}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setDeleteTarget(null)} style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-sub)', fontWeight: 600, cursor: 'pointer' }}>
                {isRTL ? 'إلغاء' : 'Cancel'}
              </button>
              <button onClick={handleDelete} disabled={deleting} style={{ flex: 1, padding: '10px', borderRadius: 10, border: 'none', background: '#ef4444', color: '#fff', fontWeight: 700, cursor: deleting ? 'not-allowed' : 'pointer', opacity: deleting ? 0.7 : 1 }}>
                {deleting ? '…' : (isRTL ? 'حذف' : 'Delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </ProtectedRoute>
  );
}
