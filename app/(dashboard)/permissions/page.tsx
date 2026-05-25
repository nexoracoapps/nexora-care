'use client';

import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { usePermissions } from '@/context/PermissionsContext';
import { type PermissionKey } from '@/lib/permissions';

interface RoleDefinition {
  id: string; name: string; label: string; labelAr: string;
  color: string; icon: string; isSystem: boolean; isAdmin: boolean;
  permissions: Record<PermissionKey, boolean>; sortOrder: number;
}

type Draft = Record<string, Record<PermissionKey, boolean>>;
type PermItem = { key: PermissionKey; label: string; labelAr: string; parentKey?: PermissionKey; icon: string };

const PERMISSION_GROUPS: { group: string; groupAr: string; icon: string; color: string; items: PermItem[] }[] = [
  {
    group: 'Customers', groupAr: 'العملاء', icon: '👥', color: '#C4788C',
    items: [
      { key: 'manageCustomers',  icon: '👥', label: 'View Customers Page',              labelAr: 'عرض صفحة العملاء' },
      { key: 'createCustomers',  icon: '➕', label: 'Add New Customers',                labelAr: 'إضافة عملاء جدد',                    parentKey: 'manageCustomers' },
      { key: 'editCustomers',    icon: '✏️', label: 'Edit Customer Details',            labelAr: 'تعديل بيانات العملاء',               parentKey: 'manageCustomers' },
      { key: 'deleteCustomers',  icon: '🗑', label: 'Delete Customers',                 labelAr: 'حذف العملاء',                        parentKey: 'manageCustomers' },
      { key: 'makePhoneCalls',   icon: '📞', label: 'Make Phone Calls',                 labelAr: 'إجراء مكالمات هاتفية',               parentKey: 'manageCustomers' },
      { key: 'viewCallLogs',     icon: '📋', label: 'View Call Logs',                   labelAr: 'عرض سجلات المكالمات',                parentKey: 'manageCustomers' },
      { key: 'clearCallLogs',    icon: '🧹', label: 'Clear All Call Logs',              labelAr: 'مسح سجلات المكالمات',                parentKey: 'manageCustomers' },
      { key: 'sendWhatsApp',     icon: '💬', label: 'Send WhatsApp Messages',           labelAr: 'إرسال رسائل واتساب',                 parentKey: 'manageCustomers' },
      { key: 'sendSMS',          icon: '📱', label: 'Send SMS Messages',                labelAr: 'إرسال رسائل نصية',                   parentKey: 'manageCustomers' },
      { key: 'sendEmail',        icon: '✉️', label: 'Send Email Messages',              labelAr: 'إرسال رسائل بريد إلكتروني',         parentKey: 'manageCustomers' },
      { key: 'sendBroadcasts',   icon: '📣', label: 'Send Broadcast to All Customers',  labelAr: 'إرسال رسائل جماعية',                parentKey: 'manageCustomers' },
    ],
  },
  {
    group: 'Appointments', groupAr: 'المواعيد', icon: '📅', color: '#0891b2',
    items: [
      { key: 'manageAppointments',      icon: '📅', label: 'View Appointments Page',                      labelAr: 'عرض صفحة المواعيد' },
      { key: 'createAppointments',      icon: '➕', label: 'Create New Appointments',                     labelAr: 'إنشاء مواعيد جديدة',               parentKey: 'manageAppointments' },
      { key: 'editAppointments',        icon: '✏️', label: 'Edit & Reschedule Appointments',              labelAr: 'تعديل وإعادة جدولة المواعيد',       parentKey: 'manageAppointments' },
      { key: 'updateAppointmentStatus', icon: '✅', label: 'Update Status (Complete / Cancel / No-Show)', labelAr: 'تحديث الحالة',                      parentKey: 'manageAppointments' },
      { key: 'deleteAppointments',      icon: '🗑', label: 'Delete Appointments',                         labelAr: 'حذف المواعيد',                      parentKey: 'manageAppointments' },
      { key: 'recordPayments',          icon: '💳', label: 'Record & Revert Payments',                    labelAr: 'تسجيل وإلغاء المدفوعات',            parentKey: 'manageAppointments' },
    ],
  },
  {
    group: 'Reports', groupAr: 'التقارير', icon: '📊', color: '#10b981',
    items: [
      { key: 'viewReports',   icon: '📊', label: 'View Reports Page',      labelAr: 'عرض صفحة التقارير' },
      { key: 'exportReports', icon: '📤', label: 'Export & Print Reports',  labelAr: 'تصدير وطباعة التقارير', parentKey: 'viewReports' },
    ],
  },
  {
    group: 'Users', groupAr: 'المستخدمون', icon: '👤', color: '#f59e0b',
    items: [
      { key: 'viewUsers',   icon: '👤', label: 'View Users Page',        labelAr: 'عرض صفحة المستخدمين' },
      { key: 'createUsers', icon: '➕', label: 'Create New Users',       labelAr: 'إنشاء مستخدمين جدد',       parentKey: 'viewUsers' },
      { key: 'editUsers',   icon: '✏️', label: 'Edit Users & Roles',     labelAr: 'تعديل المستخدمين والأدوار', parentKey: 'viewUsers' },
      { key: 'deleteUsers', icon: '🗑', label: 'Delete Users',           labelAr: 'حذف المستخدمين',            parentKey: 'viewUsers' },
    ],
  },
  {
    group: 'Administration', groupAr: 'الإدارة', icon: '⚙️', color: '#8b5cf6',
    items: [
      { key: 'dashboard',          icon: '🏠', label: 'Dashboard & Analytics',       labelAr: 'لوحة التحكم والتحليلات' },
      { key: 'manageServices',     icon: '🛠', label: 'Manage Services & Providers', labelAr: 'إدارة الخدمات ومقدمي الخدمة' },
      { key: 'manageBranches',     icon: '🏢', label: 'Manage Branches',             labelAr: 'إدارة الفروع' },
      { key: 'manageStaffAbsence', icon: '📆', label: 'Manage Staff Absence',        labelAr: 'إدارة غيابات الموظفين' },
    ],
  },
  {
    group: 'System', groupAr: 'النظام', icon: '🔧', color: '#ef4444',
    items: [
      { key: 'systemBackup',      icon: '💾', label: 'System Backup',              labelAr: 'النسخ الاحتياطي للنظام' },
      { key: 'managePermissions', icon: '🔐', label: 'Manage Roles & Permissions', labelAr: 'إدارة الأدوار والصلاحيات' },
      { key: 'branchSwitching',   icon: '🔀', label: 'Branch Switching',           labelAr: 'التبديل بين الفروع' },
    ],
  },
];

const ROLE_COLORS = ['#C4788C','#0891b2','#6366f1','#10b981','#f59e0b','#8b5cf6','#ef4444','#ec4899','#14b8a6','#f97316'];
const ROLE_ICONS  = ['👤','👨‍💼','👩‍💼','🧑‍⚕️','💼','🎯','🏥','✂️','💆','🎨','🧑‍🔧','📋'];

function Toggle({ checked, onChange, color, disabled, locked }: {
  checked: boolean; onChange: () => void; color: string; disabled: boolean; locked?: boolean;
}) {
  if (locked) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center' }}>
        <div style={{ display:'inline-flex', alignItems:'center', gap:4, background:`${color}18`, border:`1px solid ${color}35`, borderRadius:20, padding:'3px 9px' }}>
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          <span style={{ fontSize:'0.62rem', fontWeight:800, color, letterSpacing:'0.04em', whiteSpace:'nowrap' }}>Always</span>
        </div>
      </div>
    );
  }
  return (
    <label style={{ display:'flex', alignItems:'center', justifyContent:'center', cursor: disabled ? 'default' : 'pointer' }}>
      <input type="checkbox" checked={checked} onChange={onChange} disabled={disabled} style={{ display:'none' }} />
      <div style={{ width:38, height:22, borderRadius:11, position:'relative', flexShrink:0, background: checked ? color : 'var(--bg-elevated)', border:`1.5px solid ${checked ? color : 'var(--border)'}`, transition:'background 0.2s, border-color 0.2s', opacity: disabled ? 0.3 : 1 }}>
        <div style={{ width:14, height:14, borderRadius:'50%', background: checked ? '#fff' : 'var(--text-sub)', position:'absolute', top:2.5, left: checked ? 19 : 3, transition:'left 0.18s cubic-bezier(.4,0,.2,1)', boxShadow: checked ? '0 1px 4px rgba(0,0,0,0.25)' : 'none' }} />
      </div>
    </label>
  );
}

export default function PermissionsPage() {
  const { isRTL } = useLanguage();
  const { user }  = useAuth();
  const token     = user?.token;
  const { reload } = usePermissions();
  const isAdmin  = user?.role === 'ADMIN';
  const canEdit  = user?.role === 'ADMIN' || user?.role === 'MANAGER';

  const [roles,    setRoles]    = useState<RoleDefinition[]>([]);
  const [draft,    setDraft]    = useState<Draft>({});
  const [fetching, setFetching] = useState(true);
  const [dirty,    setDirty]    = useState(false);
  const [saving,   setSaving]   = useState(false);

  type Modal = 'editRole' | null;
  const [modal,        setModal]        = useState<Modal>(null);
  const [deleteTarget, setDeleteTarget] = useState<RoleDefinition | null>(null);
  const [deleting,     setDeleting]     = useState(false);
  const [editTarget,   setEditTarget]   = useState<RoleDefinition | null>(null);
  const [editLabel,    setEditLabel]    = useState('');
  const [editLabelAr,  setEditLabelAr]  = useState('');
  const [editColor,    setEditColor]    = useState(ROLE_COLORS[0]);
  const [editIcon,     setEditIcon]     = useState('👤');
  const [editSaving,   setEditSaving]   = useState(false);

  const openEdit = (role: RoleDefinition) => {
    setEditTarget(role); setEditLabel(role.label); setEditLabelAr(role.labelAr);
    setEditColor(role.color); setEditIcon(role.icon); setModal('editRole');
  };

  const loadRoles = async () => {
    if (!token) return;
    setFetching(true);
    try {
      const res = await fetch('/api/roles', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data: RoleDefinition[] = await res.json();
        setRoles(data);
        const d: Draft = {};
        for (const r of data) d[r.name] = { ...r.permissions };
        setDraft(d); setDirty(false);
      }
    } catch {}
    setFetching(false);
  };

  useEffect(() => { loadRoles(); }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (roleName: string, key: PermissionKey) => {
    const role = roles.find(r => r.name === roleName);
    if (!role || role.isAdmin) return;
    if (user?.role === 'MANAGER' && role.isSystem && roleName !== 'STAFF') return;
    const newVal = !draft[roleName][key];
    const childKeys = PERMISSION_GROUPS.flatMap(g => g.items).filter(i => i.parentKey === key).map(i => i.key);
    setDraft(prev => ({
      ...prev,
      [roleName]: { ...prev[roleName], [key]: newVal, ...(childKeys.length > 0 && !newVal ? Object.fromEntries(childKeys.map(k => [k, false])) : {}) },
    }));
    setDirty(true);
  };

  const save = async () => {
    if (!token) return;
    setSaving(true);
    try {
      const res = await fetch('/api/permissions', { method:'PUT', headers:{'Content-Type':'application/json', Authorization:`Bearer ${token}`}, body:JSON.stringify(draft) });
      if (res.ok) { toast.success(isRTL ? 'تم حفظ الصلاحيات' : 'Permissions saved'); setDirty(false); reload(); }
      else toast.error(isRTL ? 'فشل الحفظ' : 'Failed to save');
    } catch { toast.error(isRTL ? 'خطأ في الاتصال' : 'Connection error'); }
    setSaving(false);
  };

  const handleEditRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !editTarget) return;
    setEditSaving(true);
    try {
      const res = await fetch(`/api/roles/${editTarget.id}`, { method:'PUT', headers:{'Content-Type':'application/json', Authorization:`Bearer ${token}`}, body:JSON.stringify({ label:editLabel, labelAr:editLabelAr, color:editColor, icon:editIcon }) });
      const data = await res.json();
      if (res.ok) { toast.success(`Role "${data.label}" updated`); setModal(null); setEditTarget(null); await loadRoles(); reload(); }
      else toast.error(data.error ?? 'Failed to update role');
    } catch { toast.error('Connection error'); }
    setEditSaving(false);
  };

  const handleDelete = async () => {
    if (!token || !deleteTarget) return;
    setDeleting(true);
    try {
      const res  = await fetch(`/api/roles/${deleteTarget.id}`, { method:'DELETE', headers:{ Authorization:`Bearer ${token}` } });
      const data = await res.json();
      if (res.ok) { toast.success(`Role "${deleteTarget.label}" deleted`); setDeleteTarget(null); await loadRoles(); reload(); }
      else toast.error(data.error ?? 'Failed to delete');
    } catch { toast.error('Connection error'); }
    setDeleting(false);
  };

  const canToggleRole = (role: RoleDefinition) => {
    if (!canEdit || role.isAdmin) return false;
    if (user?.role === 'MANAGER' && role.isSystem && role.name !== 'STAFF') return false;
    return true;
  };

  const enabledCount = (roleName: string) => Object.values(draft[roleName] ?? {}).filter(Boolean).length;
  const totalCount   = PERMISSION_GROUPS.flatMap(g => g.items).length;

  return (
    <ProtectedRoute roles={['ADMIN', 'MANAGER']} permKey="managePermissions">
      <style dangerouslySetInnerHTML={{ __html: `
        .pm-modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.55); backdrop-filter:blur(6px); z-index:1000; display:flex; align-items:center; justify-content:center; padding:20px; }
        .pm-modal { background:var(--bg-surface); border:1px solid var(--border); border-radius:20px; padding:28px; width:100%; max-width:480px; box-shadow:0 24px 64px rgba(0,0,0,0.35); }
        .pm-input { background:var(--bg-elevated); border:1px solid var(--border); border-radius:10px; padding:9px 13px; color:var(--text); font-family:var(--font); font-size:0.9rem; outline:none; width:100%; box-sizing:border-box; transition:border-color 0.15s; }
        .pm-input:focus { border-color:var(--rose); }
        .pm-label { font-size:0.72rem; font-weight:700; color:var(--text-sub); text-transform:uppercase; letter-spacing:0.06em; margin-bottom:5px; display:block; }
        .perm-table { width:100%; border-collapse:collapse; }
        .perm-table th, .perm-table td { vertical-align:middle; }
        .perm-group-hdr td { padding:14px 20px 10px; background:var(--bg-elevated); }
        .perm-parent-row:hover td { background:rgba(255,255,255,0.015) !important; }
        .perm-sub-row:hover td { background:rgba(255,255,255,0.01) !important; }
        @media(max-width:640px){ .pm-modal{padding:20px;} }
      `}} />

      <div style={{ paddingBottom: dirty ? 80 : 0, transition: 'padding-bottom 0.3s' }}>

        {/* Page header */}
        <div className="page-header">
          <div>
            <h1 className="page-title">{isRTL ? 'الأدوار والصلاحيات' : 'Roles & Permissions'}</h1>
            <p className="page-sub">
              {isAdmin
                ? (isRTL ? `${roles.length} أدوار — قم بإدارة وتخصيص الصلاحيات` : `${roles.length} roles — manage and customize access`)
                : (isRTL ? 'يمكنك تعديل صلاحيات دور الموظف' : 'You can toggle Staff permissions below')}
            </p>
          </div>
        </div>

        {/* Role summary cards */}
        {fetching ? (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(180px, 1fr))', gap:14, marginBottom:24 }}>
            {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height:110, borderRadius:16 }} />)}
          </div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(180px, 1fr))', gap:14, marginBottom:24 }}>
            {roles.map(role => {
              const cnt = enabledCount(role.name);
              const pct = Math.round(cnt / totalCount * 100);
              const isMe = user?.role === role.name;
              return (
                <div key={role.id} className="glass-card" style={{ padding:0, overflow:'hidden', border: isMe ? `1.5px solid ${role.color}50` : undefined, boxShadow: isMe ? `0 4px 24px ${role.color}18` : undefined }}>
                  {/* Gradient banner */}
                  <div style={{ height:6, background:`linear-gradient(90deg, ${role.color}, ${role.color}60)`, borderRadius:'16px 16px 0 0' }} />
                  <div style={{ padding:'14px 16px 16px' }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:9 }}>
                        <div style={{ width:34, height:34, borderRadius:10, background:`${role.color}18`, border:`1.5px solid ${role.color}35`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1rem' }}>{role.icon}</div>
                        <div>
                          <div style={{ fontWeight:800, fontSize:'0.88rem', color:role.color, lineHeight:1.2 }}>{isRTL && role.labelAr ? role.labelAr : role.label}</div>
                          <div style={{ fontSize:'0.63rem', color:'var(--text-sub)', fontWeight:600 }}>{role.name}</div>
                        </div>
                      </div>
                      {isMe && <div style={{ background:role.color, color:'#fff', borderRadius:20, padding:'2px 8px', fontSize:'0.6rem', fontWeight:800 }}>{isRTL?'أنت':'You'}</div>}
                    </div>
                    {/* Progress bar */}
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
                      <div style={{ flex:1, height:5, borderRadius:3, background:'var(--border)', overflow:'hidden' }}>
                        <div style={{ height:'100%', width:`${pct}%`, background:role.color, borderRadius:3, transition:'width 0.4s' }} />
                      </div>
                      <span style={{ fontSize:'0.65rem', fontWeight:700, color:'var(--text-sub)', whiteSpace:'nowrap' }}>{cnt}/{totalCount}</span>
                    </div>
                    {/* Action buttons */}
                    {isAdmin && (
                      <div style={{ display:'flex', gap:6 }}>
                        <button onClick={() => openEdit(role)} style={{ flex:1, padding:'5px 0', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg-elevated)', color:'var(--text-sub)', fontSize:'0.72rem', fontWeight:700, cursor:'pointer' }}>
                          ✏️ {isRTL?'تعديل':'Edit'}
                        </button>
                        {!role.isAdmin && (
                          <button onClick={() => setDeleteTarget(role)} style={{ width:30, borderRadius:8, border:'1px solid rgba(239,68,68,0.2)', background:'rgba(239,68,68,0.06)', color:'#ef4444', fontSize:'0.85rem', cursor:'pointer' }}>
                            🗑
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Permissions matrix */}
        <div className="glass-card" style={{ padding:0, overflow:'hidden', opacity: fetching ? 0.5 : 1, pointerEvents: fetching ? 'none' : 'auto', transition:'opacity 0.2s' }}>
          <div style={{ overflowX:'auto' }}>
            <table className="perm-table" style={{ minWidth:520 }}>
              <thead>
                <tr style={{ borderBottom:'2px solid var(--border)' }}>
                  <th style={{ padding:'16px 20px', textAlign:'start', width:'38%', minWidth:220 }}>
                    <span style={{ fontSize:'0.72rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', color:'var(--text-sub)' }}>
                      {isRTL ? 'الصلاحية' : 'Permission'}
                    </span>
                  </th>
                  {roles.map(role => (
                    <th key={role.name} style={{ padding:'12px 10px', minWidth:100, borderBottom:`3px solid ${role.color}` }}>
                      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:5 }}>
                        <div style={{ width:32, height:32, borderRadius:10, background:`${role.color}18`, border:`1.5px solid ${role.color}40`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.95rem' }}>
                          {role.icon}
                        </div>
                        <span style={{ fontSize:'0.72rem', fontWeight:800, color:role.color, whiteSpace:'nowrap' }}>
                          {isRTL && role.labelAr ? role.labelAr : role.label}
                        </span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERMISSION_GROUPS.map((group, gi) => (
                  <React.Fragment key={group.group}>
                    {/* Group header */}
                    <tr className="perm-group-hdr">
                      <td colSpan={roles.length + 1} style={{ borderLeft:`3px solid ${group.color}`, borderTop: gi > 0 ? '1px solid var(--border)' : 'none' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <div style={{ width:24, height:24, borderRadius:7, background:`${group.color}20`, border:`1px solid ${group.color}35`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.82rem' }}>
                            {group.icon}
                          </div>
                          <span style={{ fontSize:'0.7rem', fontWeight:800, textTransform:'uppercase', letterSpacing:'0.08em', color:group.color }}>
                            {isRTL ? group.groupAr : group.group}
                          </span>
                          <span style={{ fontSize:'0.65rem', color:'var(--text-sub)', fontWeight:500, marginInlineStart:4 }}>
                            {group.items.length} {isRTL ? 'صلاحيات' : 'permissions'}
                          </span>
                        </div>
                      </td>
                    </tr>

                    {/* Permission rows */}
                    {group.items.map((item, idx) => {
                      const isSub = !!item.parentKey;
                      const isLast = idx === group.items.length - 1;
                      return (
                        <tr key={item.key} className={isSub ? 'perm-sub-row' : 'perm-parent-row'} style={{ borderBottom: isLast ? 'none' : '1px solid rgba(255,255,255,0.04)' }}>
                          <td style={{ padding: isSub ? '10px 16px 10px 44px' : '13px 16px 13px 20px', position:'relative', borderLeft:`2px solid ${isSub ? group.color+'22' : 'transparent'}` }}>
                            {isSub && (
                              <>
                                <div style={{ position:'absolute', left:18, top:0, bottom: isLast ? '50%' : 0, width:1.5, background:'var(--border)' }} />
                                <div style={{ position:'absolute', left:18, top:'50%', width:12, height:1.5, background:'var(--border)' }} />
                              </>
                            )}
                            <div style={{ display:'flex', alignItems:'center', gap: isSub ? 7 : 9 }}>
                              <span style={{ fontSize: isSub ? '0.8rem' : '0.9rem', opacity: isSub ? 0.75 : 1 }}>{item.icon}</span>
                              <span style={{ fontSize: isSub ? '0.83rem' : '0.87rem', fontWeight: isSub ? 400 : 600, color: isSub ? 'var(--text-sub)' : 'var(--text)', lineHeight:1.4 }}>
                                {isRTL ? item.labelAr : item.label}
                              </span>
                            </div>
                          </td>
                          {roles.map(role => {
                            const parentOff = isSub && draft[role.name] && !draft[role.name][item.parentKey as PermissionKey];
                            const editable  = canToggleRole(role) && !parentOff;
                            return (
                              <td key={role.name} style={{ textAlign:'center', padding:'8px 10px' }}>
                                <Toggle
                                  checked={draft[role.name]?.[item.key] ?? false}
                                  onChange={() => toggle(role.name, item.key)}
                                  color={role.color}
                                  disabled={!editable}
                                  locked={role.isAdmin}
                                />
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Info note */}
        <div style={{ marginTop:16, padding:'12px 16px', background:'rgba(196,120,140,0.05)', border:'1px solid rgba(196,120,140,0.12)', borderRadius:12, display:'flex', alignItems:'flex-start', gap:10 }}>
          <span style={{ fontSize:'0.9rem', flexShrink:0 }}>ℹ️</span>
          <p style={{ fontSize:'0.81rem', color:'var(--text-sub)', lineHeight:1.6, margin:0 }}>
            {isAdmin
              ? (isRTL ? 'يمكنك إدارة جميع الأدوار وصلاحياتها. دور مدير النظام لديه صلاحيات كاملة دائماً.' : 'Manage all roles and their permissions. Admin always has full access and cannot be restricted.')
              : (isRTL ? 'يمكنك تعديل صلاحيات دور الموظف فقط.' : 'You can only toggle Staff permissions. Admin and Manager columns are locked.')}
          </p>
        </div>
      </div>

      {/* Floating save bar */}
      {canEdit && dirty && (
        <div style={{ position:'fixed', bottom:24, left:'50%', transform:'translateX(-50%)', zIndex:200, display:'flex', alignItems:'center', gap:10, background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:16, padding:'12px 20px', boxShadow:'0 8px 40px rgba(0,0,0,0.35)', backdropFilter:'blur(12px)', animation:'slideUp 0.25s ease' }}>
          <span style={{ fontSize:'0.83rem', color:'var(--text-sub)', fontWeight:500, marginInlineEnd:4 }}>
            {isRTL ? 'لديك تغييرات غير محفوظة' : 'You have unsaved changes'}
          </span>
          <button onClick={() => loadRoles()} style={{ padding:'8px 16px', borderRadius:10, border:'1px solid var(--border)', background:'transparent', color:'var(--text-sub)', fontWeight:600, fontSize:'0.83rem', cursor:'pointer' }}>
            {isRTL ? 'إلغاء' : 'Discard'}
          </button>
          <button onClick={save} disabled={saving} className="btn btn-primary" style={{ padding:'8px 20px', fontSize:'0.83rem' }}>
            {saving ? (isRTL ? 'جاري الحفظ…' : 'Saving…') : (isRTL ? 'حفظ التغييرات' : 'Save Changes')}
          </button>
        </div>
      )}

      {/* Edit Role Modal */}
      {modal === 'editRole' && editTarget && (
        <div className="pm-modal-overlay">
          <div className="pm-modal">
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:22 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <div style={{ width:34, height:34, borderRadius:10, background:`${editColor}18`, border:`1.5px solid ${editColor}40`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.1rem' }}>{editIcon}</div>
                <h2 style={{ margin:0, fontSize:'1.05rem', fontWeight:800 }}>{isRTL ? 'تعديل الدور' : 'Edit Role'}</h2>
              </div>
              <button onClick={() => setModal(null)} style={{ background:'none', border:'none', color:'var(--text-sub)', cursor:'pointer', fontSize:'1.3rem', lineHeight:1, padding:'4px 8px' }}>×</button>
            </div>

            {editTarget.isSystem && (
              <div style={{ marginBottom:16, padding:'8px 12px', background:'rgba(99,102,241,0.08)', border:'1px solid rgba(99,102,241,0.2)', borderRadius:8, fontSize:'0.78rem', color:'var(--text-sub)' }}>
                🔒 {isRTL ? 'دور النظام — يمكن تعديل العرض فقط' : 'System role — only display properties can be changed'}
              </div>
            )}

            <form onSubmit={handleEditRole}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:14 }}>
                <div><label className="pm-label">{isRTL ? 'الاسم المعروض' : 'Display Label'}</label><input className="pm-input" value={editLabel} onChange={e => setEditLabel(e.target.value)} required /></div>
                <div><label className="pm-label">{isRTL ? 'الاسم بالعربية' : 'Arabic Label'}</label><input className="pm-input" value={editLabelAr} onChange={e => setEditLabelAr(e.target.value)} dir="rtl" /></div>
              </div>
              <div style={{ marginBottom:14 }}>
                <label className="pm-label">{isRTL ? 'اللون' : 'Color'}</label>
                <div style={{ display:'flex', gap:7, flexWrap:'wrap' }}>
                  {ROLE_COLORS.map(c => <button key={c} type="button" onClick={() => setEditColor(c)} style={{ width:28, height:28, borderRadius:8, background:c, border: editColor===c ? '2.5px solid var(--text)' : '2px solid transparent', cursor:'pointer', outline:'none' }} />)}
                </div>
              </div>
              <div style={{ marginBottom:16 }}>
                <label className="pm-label">{isRTL ? 'الأيقونة' : 'Icon'}</label>
                <div style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center' }}>
                  {ROLE_ICONS.map(ic => <button key={ic} type="button" onClick={() => setEditIcon(ic)} style={{ width:34, height:34, borderRadius:8, border: editIcon===ic ? `2px solid ${editColor}` : '2px solid var(--border)', background: editIcon===ic ? `${editColor}15` : 'var(--bg-elevated)', cursor:'pointer', fontSize:'1rem' }}>{ic}</button>)}
                  <input value={editIcon} onChange={e => setEditIcon(e.target.value)} maxLength={2} style={{ width:38, textAlign:'center', fontSize:'1rem', background:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:8, padding:4, color:'var(--text)' }} />
                </div>
              </div>
              <div style={{ marginBottom:18, padding:'10px 14px', background:'var(--bg-elevated)', borderRadius:10, display:'flex', alignItems:'center', gap:10 }}>
                <div style={{ width:34, height:34, borderRadius:10, background:`${editColor}18`, border:`1.5px solid ${editColor}40`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.1rem' }}>{editIcon}</div>
                <div><div style={{ fontWeight:800, fontSize:'0.9rem', color:editColor }}>{editLabel || '—'}</div><div style={{ fontSize:'0.68rem', color:'var(--text-sub)' }}>{editTarget.name}</div></div>
                <span style={{ marginInlineStart:'auto', fontSize:'0.68rem', color:'var(--text-sub)', fontWeight:600 }}>Preview</span>
              </div>
              <div style={{ display:'flex', gap:10 }}>
                <button type="button" onClick={() => setModal(null)} style={{ flex:1, padding:'10px', borderRadius:10, border:'1px solid var(--border)', background:'transparent', color:'var(--text-sub)', fontWeight:600, cursor:'pointer', fontFamily:'var(--font)' }}>{isRTL ? 'إلغاء' : 'Cancel'}</button>
                <button type="submit" disabled={editSaving} className="btn btn-primary" style={{ flex:1, padding:'10px' }}>{editSaving ? '…' : (isRTL ? 'حفظ' : 'Save Changes')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteTarget && (
        <div className="pm-modal-overlay">
          <div className="pm-modal" style={{ maxWidth:400, textAlign:'center' }}>
            <div style={{ fontSize:'3rem', marginBottom:12 }}>{deleteTarget.icon}</div>
            <h2 style={{ margin:'0 0 8px', fontSize:'1rem', fontWeight:800 }}>
              {isRTL ? `حذف دور "${deleteTarget.labelAr || deleteTarget.label}"؟` : `Delete "${deleteTarget.label}" role?`}
            </h2>
            <p style={{ margin:'0 0 22px', fontSize:'0.83rem', color:'var(--text-sub)', lineHeight:1.6 }}>
              {isRTL ? 'سيتم حذف هذا الدور نهائياً. يجب إعادة تعيين المستخدمين أولاً.' : 'This role will be permanently deleted. Reassign any users first.'}
            </p>
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={() => setDeleteTarget(null)} style={{ flex:1, padding:'10px', borderRadius:10, border:'1px solid var(--border)', background:'transparent', color:'var(--text-sub)', fontWeight:600, cursor:'pointer', fontFamily:'var(--font)' }}>{isRTL ? 'إلغاء' : 'Cancel'}</button>
              <button onClick={handleDelete} disabled={deleting} style={{ flex:1, padding:'10px', borderRadius:10, border:'none', background:'#ef4444', color:'#fff', fontWeight:700, cursor: deleting ? 'not-allowed' : 'pointer', opacity: deleting ? 0.7 : 1, fontFamily:'var(--font)' }}>
                {deleting ? '…' : (isRTL ? 'حذف' : 'Delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </ProtectedRoute>
  );
}
