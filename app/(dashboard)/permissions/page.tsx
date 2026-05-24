'use client';

import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { usePermissions } from '@/context/PermissionsContext';
import { type PermissionKey } from '@/lib/permissions';

// ─── Types ───────────────────────────────────────────────────────────────────

interface RoleDefinition {
  id: string;
  name: string;
  label: string;
  labelAr: string;
  color: string;
  icon: string;
  isSystem: boolean;
  isAdmin: boolean;
  permissions: Record<PermissionKey, boolean>;
  sortOrder: number;
}

type Draft = Record<string, Record<PermissionKey, boolean>>;

// ─── Permission groups (static — app capabilities) ───────────────────────────

type PermItem = { key: PermissionKey; label: string; labelAr: string; parentKey?: PermissionKey; icon: string };

const PERMISSION_GROUPS: { group: string; groupAr: string; icon: string; color: string; items: PermItem[] }[] = [
  {
    group: 'Customers', groupAr: 'العملاء', icon: '👥', color: '#C4788C',
    items: [
      { key: 'manageCustomers',  icon: '👥', label: 'View Customers Page',             labelAr: 'عرض صفحة العملاء' },
      { key: 'createCustomers',  icon: '➕', label: 'Add New Customers',               labelAr: 'إضافة عملاء جدد',                       parentKey: 'manageCustomers' },
      { key: 'editCustomers',    icon: '✏️', label: 'Edit Customer Details',           labelAr: 'تعديل بيانات العملاء',                  parentKey: 'manageCustomers' },
      { key: 'deleteCustomers',  icon: '🗑', label: 'Delete Customers',                labelAr: 'حذف العملاء',                           parentKey: 'manageCustomers' },
      { key: 'makePhoneCalls',   icon: '📞', label: 'Make Phone Calls',                labelAr: 'إجراء مكالمات هاتفية',                  parentKey: 'manageCustomers' },
      { key: 'viewCallLogs',     icon: '📋', label: 'View Call Logs',                  labelAr: 'عرض سجلات المكالمات',                   parentKey: 'manageCustomers' },
      { key: 'clearCallLogs',    icon: '🧹', label: 'Clear All Call Logs',             labelAr: 'مسح جميع سجلات المكالمات',             parentKey: 'manageCustomers' },
      { key: 'sendWhatsApp',     icon: '💬', label: 'Send WhatsApp Messages',          labelAr: 'إرسال رسائل واتساب',                    parentKey: 'manageCustomers' },
      { key: 'sendSMS',          icon: '📱', label: 'Send SMS Messages',               labelAr: 'إرسال رسائل نصية قصيرة',               parentKey: 'manageCustomers' },
      { key: 'sendEmail',        icon: '✉️', label: 'Send Email Messages',             labelAr: 'إرسال رسائل بريد إلكتروني',            parentKey: 'manageCustomers' },
      { key: 'sendBroadcasts',   icon: '📣', label: 'Send Broadcast to All Customers', labelAr: 'إرسال رسائل جماعية لجميع العملاء',    parentKey: 'manageCustomers' },
    ],
  },
  {
    group: 'Appointments', groupAr: 'المواعيد', icon: '📅', color: '#0891b2',
    items: [
      { key: 'manageAppointments',      icon: '📅', label: 'View Appointments Page',                      labelAr: 'عرض صفحة المواعيد' },
      { key: 'createAppointments',      icon: '➕', label: 'Create New Appointments',                     labelAr: 'إنشاء مواعيد جديدة',                        parentKey: 'manageAppointments' },
      { key: 'editAppointments',        icon: '✏️', label: 'Edit & Reschedule Appointments',              labelAr: 'تعديل وإعادة جدولة المواعيد',               parentKey: 'manageAppointments' },
      { key: 'updateAppointmentStatus', icon: '✅', label: 'Update Status (Complete / Cancel / No-Show)', labelAr: 'تحديث الحالة (إتمام / إلغاء / عدم حضور)',   parentKey: 'manageAppointments' },
      { key: 'deleteAppointments',      icon: '🗑', label: 'Delete Appointments',                         labelAr: 'حذف المواعيد',                               parentKey: 'manageAppointments' },
      { key: 'recordPayments',          icon: '💳', label: 'Record & Revert Payments',                    labelAr: 'تسجيل وإلغاء المدفوعات',                    parentKey: 'manageAppointments' },
    ],
  },
  {
    group: 'Reports', groupAr: 'التقارير', icon: '📊', color: '#10b981',
    items: [
      { key: 'viewReports',   icon: '📊', label: 'View Reports Page',       labelAr: 'عرض صفحة التقارير' },
      { key: 'exportReports', icon: '📤', label: 'Export & Print Reports',  labelAr: 'تصدير وطباعة التقارير', parentKey: 'viewReports' },
    ],
  },
  {
    group: 'Users', groupAr: 'المستخدمون', icon: '👤', color: '#f59e0b',
    items: [
      { key: 'viewUsers',    icon: '👤', label: 'View Users Page',         labelAr: 'عرض صفحة المستخدمين' },
      { key: 'createUsers',  icon: '➕', label: 'Create New Users',        labelAr: 'إنشاء مستخدمين جدد',        parentKey: 'viewUsers' },
      { key: 'editUsers',    icon: '✏️', label: 'Edit Users & Roles',      labelAr: 'تعديل المستخدمين والأدوار',  parentKey: 'viewUsers' },
      { key: 'deleteUsers',  icon: '🗑', label: 'Delete Users',            labelAr: 'حذف المستخدمين',             parentKey: 'viewUsers' },
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

// ─── Toggle component ─────────────────────────────────────────────────────────

function Toggle({ checked, onChange, color, disabled, locked }: {
  checked: boolean; onChange: () => void; color: string; disabled: boolean; locked?: boolean;
}) {
  if (locked) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 48, minHeight: 40 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: `${color}14`, border: `1px solid ${color}30`, borderRadius: 20, padding: '4px 10px' }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          <span style={{ fontSize: '0.67rem', fontWeight: 800, color, letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>Always</span>
        </div>
      </div>
    );
  }
  return (
    <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: disabled ? 'default' : 'pointer', margin: '0 auto', minWidth: 48, minHeight: 40 }}>
      <input type="checkbox" checked={checked} onChange={onChange} disabled={disabled} style={{ display: 'none' }} />
      <div style={{ width: 42, height: 24, borderRadius: 12, position: 'relative', flexShrink: 0, background: checked ? color : 'var(--bg-elevated)', border: `1.5px solid ${checked ? color : 'var(--border)'}`, transition: 'background 0.2s, border-color 0.2s', opacity: disabled ? 0.32 : 1 }}>
        <div style={{ width: 16, height: 16, borderRadius: '50%', background: checked ? '#fff' : 'var(--text-sub)', position: 'absolute', top: 2.5, left: checked ? 21 : 3, transition: 'left 0.18s cubic-bezier(.4,0,.2,1), background 0.18s', boxShadow: checked ? '0 1px 5px rgba(0,0,0,0.22)' : 'none' }} />
      </div>
    </label>
  );
}

// ─── Color palette for role creation ─────────────────────────────────────────

const ROLE_COLORS = ['#C4788C','#0891b2','#6366f1','#10b981','#f59e0b','#8b5cf6','#ef4444','#ec4899','#14b8a6','#f97316'];
const ROLE_ICONS  = ['👤','👨‍💼','👩‍💼','🧑‍⚕️','💼','🎯','🏥','✂️','💆','🎨','🧑‍🔧','📋'];

// ─── Main component ───────────────────────────────────────────────────────────

export default function PermissionsPage() {
  const { isRTL } = useLanguage();
  const { user }  = useAuth();
  const token     = user?.token;
  const { reload } = usePermissions();

  const isAdmin  = user?.role === 'ADMIN';
  const canEdit  = user?.role === 'ADMIN' || user?.role === 'MANAGER';

  // ── State ──────────────────────────────────────────────────────────────────
  const [roles,    setRoles]    = useState<RoleDefinition[]>([]);
  const [draft,    setDraft]    = useState<Draft>({});
  const [fetching, setFetching] = useState(true);
  const [dirty,    setDirty]    = useState(false);
  const [saving,   setSaving]   = useState(false);

  type Modal = 'editRole' | null;
  const [modal,        setModal]        = useState<Modal>(null);
  const [deleteTarget, setDeleteTarget] = useState<RoleDefinition | null>(null);
  const [deleting,     setDeleting]     = useState(false);

  // Edit-role form
  const [editTarget,  setEditTarget]  = useState<RoleDefinition | null>(null);
  const [editLabel,   setEditLabel]   = useState('');
  const [editLabelAr, setEditLabelAr] = useState('');
  const [editColor,   setEditColor]   = useState(ROLE_COLORS[0]);
  const [editIcon,    setEditIcon]    = useState('👤');
  const [editSaving,  setEditSaving]  = useState(false);

  const openEdit = (role: RoleDefinition) => {
    setEditTarget(role);
    setEditLabel(role.label);
    setEditLabelAr(role.labelAr);
    setEditColor(role.color);
    setEditIcon(role.icon);
    setModal('editRole');
  };

  // ── Fetch roles from API ───────────────────────────────────────────────────
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
        setDraft(d);
        setDirty(false);
      }
    } catch {}
    setFetching(false);
  };

  useEffect(() => { loadRoles(); }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Toggle a single permission ─────────────────────────────────────────────
  const toggle = (roleName: string, key: PermissionKey) => {
    const role = roles.find(r => r.name === roleName);
    if (!role || role.isAdmin) return;
    if (user?.role === 'MANAGER' && role.isSystem && roleName !== 'STAFF') return;

    const newVal = !draft[roleName][key];
    const childKeys = PERMISSION_GROUPS.flatMap(g => g.items).filter(i => i.parentKey === key).map(i => i.key);

    setDraft(prev => ({
      ...prev,
      [roleName]: {
        ...prev[roleName],
        [key]: newVal,
        ...(childKeys.length > 0 && !newVal ? Object.fromEntries(childKeys.map(k => [k, false])) : {}),
      },
    }));
    setDirty(true);
  };

  // ── Save ───────────────────────────────────────────────────────────────────
  const save = async () => {
    if (!token) return;
    setSaving(true);
    try {
      const res = await fetch('/api/permissions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(draft),
      });
      if (res.ok) {
        toast.success(isRTL ? 'تم حفظ الصلاحيات' : 'Permissions saved');
        setDirty(false);
        reload();
      } else {
        toast.error(isRTL ? 'فشل الحفظ' : 'Failed to save');
      }
    } catch {
      toast.error(isRTL ? 'خطأ في الاتصال' : 'Connection error');
    }
    setSaving(false);
  };

  const discard = () => loadRoles();

  // ── Edit role ──────────────────────────────────────────────────────────────
  const handleEditRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !editTarget) return;
    setEditSaving(true);
    try {
      const res = await fetch(`/api/roles/${editTarget.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ label: editLabel, labelAr: editLabelAr, color: editColor, icon: editIcon }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Role "${data.label}" updated`);
        setModal(null);
        setEditTarget(null);
        await loadRoles();
        reload();
      } else {
        toast.error(data.error ?? 'Failed to update role');
      }
    } catch {
      toast.error('Connection error');
    }
    setEditSaving(false);
  };

  // ── Delete role ────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!token || !deleteTarget) return;
    setDeleting(true);
    try {
      const res  = await fetch(`/api/roles/${deleteTarget.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Role "${deleteTarget.label}" deleted`);
        setDeleteTarget(null);
        await loadRoles();
        reload();
      } else {
        toast.error(data.error ?? 'Failed to delete');
      }
    } catch {
      toast.error('Connection error');
    }
    setDeleting(false);
  };

  // ── Helpers ────────────────────────────────────────────────────────────────
  const canToggleRole = (role: RoleDefinition) => {
    if (!canEdit) return false;
    if (role.isAdmin) return false;
    if (user?.role === 'MANAGER' && role.isSystem && role.name !== 'STAFF') return false;
    return true;
  };

  const enabledCount = (roleName: string) =>
    Object.values(draft[roleName] ?? {}).filter(Boolean).length;
  const totalCount = PERMISSION_GROUPS.flatMap(g => g.items).length;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <ProtectedRoute roles={['ADMIN', 'MANAGER']} permKey="managePermissions">
      <style dangerouslySetInnerHTML={{ __html: `
        .perm-table { width: 100%; border-collapse: collapse; }
        .perm-table thead th { padding: 14px 16px 12px; font-size: 0.73rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-sub); text-align: center; }
        .perm-table thead th:first-child { text-align: start; padding-left: 20px; }
        .perm-role-th { border-bottom: 2px solid var(--role-col-color, var(--border)); min-width: 110px; }
        .perm-group-row td { padding: 20px 20px 9px !important; border-bottom: 1px solid var(--border) !important; border-top: 2px solid var(--border) !important; background: var(--bg-elevated); }
        .perm-first-group td { border-top: none !important; }
        .perm-data-row { transition: background 0.1s; }
        .perm-data-row:last-child td { border-bottom: none; }
        .perm-parent-row td { padding: 13px 16px; border-bottom: 1px solid var(--border); background: var(--bg-surface); }
        .perm-parent-row:hover td { background: rgba(196,120,140,0.03) !important; }
        .perm-sub-row td { padding: 10px 16px; border-bottom: 1px solid rgba(255,255,255,0.04); background: var(--bg-surface); }
        .perm-sub-row:hover td { background: var(--bg-elevated) !important; }
        .perm-toggle-cell { text-align: center; }
        .perm-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); backdrop-filter: blur(4px); z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 20px; }
        .perm-modal { background: var(--bg-surface); border: 1px solid var(--border); border-radius: 20px; padding: 28px; width: 100%; max-width: 480px; box-shadow: 0 20px 60px rgba(0,0,0,0.3); }
        .perm-form-row { display: flex; flex-direction: column; gap: 5px; margin-bottom: 16px; }
        .perm-form-label { font-size: 0.78rem; font-weight: 700; color: var(--text-sub); text-transform: uppercase; letter-spacing: 0.05em; }
        .perm-form-input { background: var(--bg-elevated); border: 1px solid var(--border); border-radius: 10px; padding: 9px 13px; color: var(--text); font-family: var(--font); font-size: 0.9rem; outline: none; transition: border-color 0.15s; }
        .perm-form-input:focus { border-color: var(--rose); }
        @media (max-width: 640px) {
          .perm-matrix-wrap { overflow-x: auto; }
          .perm-modal { padding: 20px; }
        }
      `}} />

      <div>
        {/* ── Page header ── */}
        <div className="page-header" style={{ flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h1 className="page-title">{isRTL ? 'الأدوار والصلاحيات' : 'Roles & Permissions'}</h1>
            <p className="page-sub">
              {isAdmin
                ? (isRTL ? `${roles.length} أدوار — قم بإدارة وتخصيص الصلاحيات` : `${roles.length} roles — manage and customize access`)
                : (isRTL ? 'يمكنك تعديل صلاحيات دور الموظف' : 'You can toggle Staff permissions below')}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {canEdit && dirty && (
              <>
                <button onClick={discard} style={{ padding: '8px 16px', borderRadius: 10, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-sub)', fontWeight: 600, fontSize: '0.83rem', cursor: 'pointer' }}>
                  {isRTL ? 'إلغاء' : 'Discard'}
                </button>
                <button onClick={save} disabled={saving} style={{ padding: '8px 18px', borderRadius: 10, border: 'none', background: 'var(--rose)', color: '#fff', fontWeight: 700, fontSize: '0.83rem', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
                  {saving ? (isRTL ? 'جاري الحفظ…' : 'Saving…') : (isRTL ? 'حفظ التغييرات' : 'Save Changes')}
                </button>
              </>
            )}
          </div>
        </div>

        {/* ── Role overview cards ── */}
        {fetching ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14, marginBottom: 28 }}>
            {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 120, borderRadius: 16 }} />)}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14, marginBottom: 28 }}>
            {roles.map(role => {
              const isMe = user?.role === role.name;
              const cnt  = enabledCount(role.name);
              return (
                <div key={role.id} style={{ background: 'var(--bg-surface)', borderRadius: 16, padding: '16px 18px', border: isMe ? `1.5px solid ${role.color}50` : '1px solid var(--border)', boxShadow: isMe ? `0 4px 20px ${role.color}18` : 'var(--shadow)', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: role.color, opacity: isMe ? 1 : 0.35, borderRadius: '16px 16px 0 0' }} />
                  {isMe && (
                    <div style={{ position: 'absolute', top: 10, insetInlineEnd: 10, background: role.color, color: '#fff', borderRadius: 20, padding: '2px 9px', fontSize: '0.64rem', fontWeight: 800 }}>
                      {isRTL ? 'دورك' : 'You'}
                    </div>
                  )}
                  {isAdmin && (
                    <button onClick={() => openEdit(role)} title="Edit role" style={{ position: 'absolute', top: 10, insetInlineEnd: isMe ? 52 : (!role.isSystem ? 34 : 10), width: 22, height: 22, borderRadius: '50%', border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-sub)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', lineHeight: 1 }}>
                      ✏️
                    </button>
                  )}
                  {isAdmin && !role.isSystem && (
                    <button onClick={() => setDeleteTarget(role)} title="Delete role" style={{ position: 'absolute', top: 10, insetInlineEnd: isMe ? 76 : 10, width: 22, height: 22, borderRadius: '50%', border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-sub)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', lineHeight: 1 }}>
                      ×
                    </button>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 8 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: `${role.color}16`, border: `1.5px solid ${role.color}35`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>{role.icon}</div>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '0.9rem', color: role.color }}>{isRTL && role.labelAr ? role.labelAr : role.label}</div>
                      <div style={{ fontSize: '0.67rem', color: 'var(--text-sub)', fontWeight: 600 }}>{role.name}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ flex: 1, height: 4, borderRadius: 4, background: 'var(--border)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.round(cnt / totalCount * 100)}%`, background: role.color, borderRadius: 4, transition: 'width 0.3s' }} />
                    </div>
                    <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-sub)', whiteSpace: 'nowrap' }}>{cnt}/{totalCount}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Permissions matrix ── */}
        <div className="perm-matrix-wrap" style={{ background: 'var(--bg-surface)', borderRadius: 16, border: '1px solid var(--border)', boxShadow: 'var(--shadow)', overflow: 'hidden', opacity: fetching ? 0.5 : 1, pointerEvents: fetching ? 'none' : 'auto', transition: 'opacity 0.2s' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="perm-table" style={{ minWidth: 500 }}>
              <thead>
                <tr style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ width: '40%', paddingLeft: 20, textAlign: 'start', minWidth: 220 }}>
                    {isRTL ? 'الصلاحية' : 'Permission'}
                  </th>
                  {roles.map(role => (
                    <th key={role.name} className="perm-role-th" style={{ '--role-col-color': role.color } as React.CSSProperties}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 8, background: `${role.color}16`, border: `1.5px solid ${role.color}35`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem' }}>
                          {role.icon}
                        </div>
                        <span style={{ color: role.color, fontWeight: 800 }}>{isRTL && role.labelAr ? role.labelAr : role.label}</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERMISSION_GROUPS.map((group, gi) => (
                  <React.Fragment key={group.group}>
                    <tr className={`perm-group-row${gi === 0 ? ' perm-first-group' : ''}`}>
                      <td colSpan={roles.length + 1} style={{ borderLeft: `3px solid ${group.color}` }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 22, height: 22, borderRadius: 6, background: `${group.color}18`, border: `1px solid ${group.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.78rem', flexShrink: 0 }}>{group.icon}</div>
                          <span style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: group.color }}>{isRTL ? group.groupAr : group.group}</span>
                        </div>
                      </td>
                    </tr>
                    {group.items.map((item, idx) => {
                      const isSub = !!item.parentKey;
                      const isLastInGroup = idx === group.items.length - 1;
                      return (
                        <tr key={item.key} className={`perm-data-row ${isSub ? 'perm-sub-row' : 'perm-parent-row'}`}>
                          <td style={{ paddingLeft: isSub ? 44 : 20, position: 'relative', borderLeft: isSub ? `3px solid ${group.color}20` : '3px solid transparent' }}>
                            {isSub && (
                              <>
                                <div style={{ position: 'absolute', left: 19, top: 0, bottom: isLastInGroup ? '50%' : 0, width: 1.5, background: 'var(--border)' }} />
                                <div style={{ position: 'absolute', left: 19, top: '50%', width: 12, height: 1.5, background: 'var(--border)' }} />
                              </>
                            )}
                            <div style={{ display: 'flex', alignItems: 'center', gap: isSub ? 7 : 9 }}>
                              <span style={{ fontSize: isSub ? '0.82rem' : '0.9rem', flexShrink: 0, opacity: isSub ? 0.8 : 1 }}>{item.icon}</span>
                              <span style={{ fontSize: isSub ? '0.84rem' : '0.875rem', fontWeight: isSub ? 400 : 600, color: isSub ? 'var(--text-sub)' : 'var(--text)', lineHeight: 1.4 }}>
                                {isRTL ? item.labelAr : item.label}
                              </span>
                            </div>
                          </td>
                          {roles.map(role => {
                            const parentOff = isSub && draft[role.name] && !draft[role.name][item.parentKey as PermissionKey];
                            const editable  = canToggleRole(role) && !parentOff;
                            return (
                              <td key={role.name} className="perm-toggle-cell"
                                data-label={`${role.icon} ${isRTL && role.labelAr ? role.labelAr : role.label}`}
                                style={{ '--role-color': role.color } as React.CSSProperties}>
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

        {/* ── Info note ── */}
        <div style={{ marginTop: 16, padding: '12px 16px', background: canEdit ? 'rgba(196,120,140,0.05)' : 'rgba(255,180,0,0.05)', border: `1px solid ${canEdit ? 'rgba(196,120,140,0.15)' : 'rgba(255,180,0,0.15)'}`, borderRadius: 12, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <span style={{ fontSize: '0.95rem', flexShrink: 0, marginTop: 1 }}>ℹ️</span>
          <p style={{ fontSize: '0.81rem', color: 'var(--text-sub)', lineHeight: 1.6, margin: 0 }}>
            {isAdmin
              ? (isRTL ? 'يمكنك إدارة جميع الأدوار وصلاحياتها. دور مدير النظام لديه صلاحيات كاملة دائماً.' : 'Manage all roles and their permissions. Admin always has full access and cannot be restricted.')
              : (isRTL ? 'يمكنك تعديل صلاحيات دور الموظف فقط.' : 'You can only toggle Staff permissions. Admin and Manager columns are locked.')}
          </p>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          Edit Role Modal
      ═══════════════════════════════════════════════════════════════════════ */}
      {modal === 'editRole' && editTarget && (
        <div className="perm-modal-overlay" onClick={() => setModal(null)}>
          <div className="perm-modal" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 9, background: `${editColor}18`, border: `1.5px solid ${editColor}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>{editIcon}</div>
                <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>{isRTL ? 'تعديل الدور' : 'Edit Role'} — {editTarget.name}</h2>
              </div>
              <button onClick={() => setModal(null)} style={{ background: 'none', border: 'none', color: 'var(--text-sub)', cursor: 'pointer', fontSize: '1.2rem', lineHeight: 1 }}>×</button>
            </div>

            {editTarget.isSystem && (
              <div style={{ marginBottom: 16, padding: '8px 12px', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 8, fontSize: '0.78rem', color: 'var(--text-sub)' }}>
                🔒 {isRTL ? 'دور النظام — يمكن تعديل العرض فقط' : 'System role — display properties only can be changed'}
              </div>
            )}

            <form onSubmit={handleEditRole}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="perm-form-row">
                  <label className="perm-form-label">{isRTL ? 'الاسم المعروض' : 'Display Label'}</label>
                  <input className="perm-form-input" value={editLabel} onChange={e => setEditLabel(e.target.value)} required />
                </div>
                <div className="perm-form-row">
                  <label className="perm-form-label">{isRTL ? 'الاسم بالعربية' : 'Arabic Label'}</label>
                  <input className="perm-form-input" value={editLabelAr} onChange={e => setEditLabelAr(e.target.value)} dir="rtl" />
                </div>
              </div>

              <div className="perm-form-row">
                <label className="perm-form-label">{isRTL ? 'اللون' : 'Color'}</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {ROLE_COLORS.map(c => (
                    <button key={c} type="button" onClick={() => setEditColor(c)} style={{ width: 28, height: 28, borderRadius: 8, background: c, border: editColor === c ? '2px solid var(--text)' : '2px solid transparent', cursor: 'pointer', outline: 'none', transition: 'border-color 0.15s' }} />
                  ))}
                </div>
              </div>

              <div className="perm-form-row">
                <label className="perm-form-label">{isRTL ? 'الأيقونة' : 'Icon'}</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                  {ROLE_ICONS.map(ic => (
                    <button key={ic} type="button" onClick={() => setEditIcon(ic)} style={{ width: 34, height: 34, borderRadius: 8, border: editIcon === ic ? `2px solid ${editColor}` : '2px solid var(--border)', background: editIcon === ic ? `${editColor}15` : 'var(--bg-elevated)', cursor: 'pointer', fontSize: '1rem', transition: 'border-color 0.15s' }}>
                      {ic}
                    </button>
                  ))}
                  <input value={editIcon} onChange={e => setEditIcon(e.target.value)} maxLength={2} style={{ width: 40, textAlign: 'center', fontSize: '1rem', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: 4, color: 'var(--text)' }} />
                </div>
              </div>

              {/* Live preview */}
              <div style={{ marginBottom: 16, padding: '10px 14px', background: 'var(--bg-elevated)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: `${editColor}18`, border: `1.5px solid ${editColor}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem' }}>{editIcon}</div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '0.9rem', color: editColor }}>{editLabel || '—'}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-sub)' }}>{editTarget.name}</div>
                </div>
                <span style={{ marginLeft: 'auto', fontSize: '0.7rem', color: 'var(--text-sub)', fontWeight: 600 }}>Preview</span>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button type="button" onClick={() => setModal(null)} style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-sub)', fontWeight: 600, cursor: 'pointer' }}>
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

      {/* ═══════════════════════════════════════════════════════════════════════
          Delete Confirmation
      ═══════════════════════════════════════════════════════════════════════ */}
      {deleteTarget && (
        <div className="perm-modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="perm-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>{deleteTarget.icon}</div>
              <h2 style={{ margin: '0 0 8px', fontSize: '1rem', fontWeight: 800 }}>
                {isRTL ? `حذف دور "${deleteTarget.labelAr || deleteTarget.label}"` : `Delete "${deleteTarget.label}" role?`}
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
