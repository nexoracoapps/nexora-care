'use client';

import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { usePermissions } from '@/context/PermissionsContext';
import type { StaffAbsence, ServiceProvider } from '@/types';

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

export default function StaffAbsencePage() {
  const { user } = useAuth();
  const { t, lang } = useLanguage();
  const { canDo } = usePermissions();
  const [absences, setAbsences] = useState<StaffAbsence[]>([]);
  const [providers, setProviders] = useState<ServiceProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState({ providerId: '', startDate: '', endDate: '', reason: '' });

  const headers = { Authorization: `Bearer ${user?.token}`, 'Content-Type': 'application/json' };

  const load = useCallback(async () => {
    if (!user?.token) return;
    setLoading(true);
    const [absRes, provRes] = await Promise.all([
      fetch('/api/staff-absence', { headers: { Authorization: `Bearer ${user.token}` } }),
      fetch('/api/providers', { headers: { Authorization: `Bearer ${user.token}` } }),
    ]);
    if (absRes.ok) setAbsences(await absRes.json());
    if (provRes.ok) setProviders(await provRes.json());
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const defaultProviderId = (provs: ServiceProvider[]) => {
    if (!user) return '';
    const match = provs.find(p =>
      p.name.toLowerCase() === user.username?.toLowerCase() ||
      (p as any).userId === user.id
    );
    return match?.id || '';
  };

  const toDateInput = (iso: string) => iso ? iso.slice(0, 10) : '';

  const openCreate = () => {
    setEditId(null);
    setForm({ providerId: defaultProviderId(providers), startDate: '', endDate: '', reason: '' });
    setModalOpen(true);
  };

  const openEdit = (a: StaffAbsence) => {
    setEditId(a.id);
    setForm({
      providerId: (a as any).providerId || '',
      startDate: toDateInput(a.startDate as unknown as string),
      endDate: toDateInput(a.endDate as unknown as string),
      reason: a.reason || '',
    });
    setModalOpen(true);
  };

  const save = async () => {
    if (!form.startDate || !form.endDate) return toast.error(t('datesRequired'));
    const url = editId ? `/api/staff-absence/${editId}` : '/api/staff-absence';
    const method = editId ? 'PUT' : 'POST';
    const res = await fetch(url, { method, headers, body: JSON.stringify(form) });
    if (!res.ok) return toast.error(t('failedToSave'));
    toast.success(editId ? t('absenceUpdated') : t('absenceRecorded'));
    setModalOpen(false);
    load();
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const res = await fetch(`/api/staff-absence/${deleteTarget}`, { method: 'DELETE', headers });
    setDeleting(false);
    if (res.ok) { toast.success(t('deleted')); setDeleteTarget(null); load(); }
    else toast.error(t('failedToDelete'));
  };

  const locale = lang === 'ar' ? 'ar-SA' : 'en-US';

  const formatDate = (d: string | Date) =>
    new Date(d).toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <ProtectedRoute roles={['ADMIN','MANAGER']} permKey="manageStaffAbsence">
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes del-pop { from { opacity:0; transform:scale(0.88) translateY(16px); } to { opacity:1; transform:scale(1) translateY(0); } }
        @keyframes modal-pop { from { opacity:0; transform:scale(0.92) translateY(18px); } to { opacity:1; transform:scale(1) translateY(0); } }
        .abs-card { transition: transform 0.18s, box-shadow 0.18s; }
        .abs-card:hover { transform: translateY(-3px); box-shadow: 0 12px 40px rgba(0,0,0,0.13); }
        .abs-action-btn { flex:1; padding:10px; border:none; background:transparent; cursor:pointer; font-size:13px; font-weight:600; display:flex; align-items:center; justify-content:center; gap:5px; transition:background 0.15s, color 0.15s; font-family:var(--font); }
        .abs-action-edit { color: var(--text-sub); }
        .abs-action-edit:hover { background: var(--bg-elevated); color: var(--text); }
        .abs-action-del { color: #e53e5a; }
        .abs-action-del:hover { background: rgba(229,62,90,0.06); }
      `}} />
      <div>
        <div className="page-header">
          <div>
            <h1 className="page-title">{t('staffAbsence')}</h1>
            <p className="page-sub">{absences.length} {t('vacationManagement')}</p>
          </div>
          {canDo('createStaffAbsence') && <button className="btn btn-primary" onClick={openCreate}>
            + {t('recordVacation')}
          </button>}
        </div>

        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(255px, 1fr))', gap: 18 }}>
            {[...Array(4)].map((_, i) => <div key={i} className="skeleton" style={{ height: 220 }} />)}
          </div>
        ) : absences.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📆</div>
            <div className="empty-state-title">{t('noAbsenceRecords')}</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(255px, 1fr))', gap: 18 }}>
            {absences.map(a => {
              const name = a.provider?.name || a.user?.username || '?';
              const days = Math.ceil((new Date(a.endDate).getTime() - new Date(a.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1;
              const grad = nameToGradient(name);
              return (
                <div key={a.id} className="glass-card abs-card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                  {/* Banner */}
                  <div style={{ position: 'relative', height: 90, background: grad, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <div style={{
                      width: 58, height: 58, borderRadius: '50%',
                      background: 'rgba(255,255,255,0.28)', backdropFilter: 'blur(6px)',
                      border: '2.5px solid rgba(255,255,255,0.6)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '1.5rem', fontWeight: 900, color: '#fff',
                      boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                      textShadow: '0 1px 4px rgba(0,0,0,0.18)',
                    }}>
                      {name[0]?.toUpperCase()}
                    </div>
                    {/* Duration badge */}
                    <div style={{ position: 'absolute', top: 10, insetInlineEnd: 12, background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(6px)', color: '#fff', borderRadius: 20, padding: '3px 10px', fontSize: '0.72rem', fontWeight: 800 }}>
                      {days} {days !== 1 ? t('days') : t('day')}
                    </div>
                  </div>

                  {/* Body */}
                  <div style={{ padding: '14px 17px 10px', flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <h3 style={{ fontWeight: 700, fontSize: '0.96rem', color: 'var(--text)', margin: 0 }}>{name}</h3>

                    {/* Date range */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: 'var(--text-sub)' }}>
                      <span style={{ opacity: 0.7 }}>📅</span>
                      <span>{formatDate(a.startDate)}</span>
                      <span style={{ opacity: 0.45 }}>→</span>
                      <span>{formatDate(a.endDate)}</span>
                    </div>

                    {/* Reason */}
                    {a.reason && (
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 5, fontSize: '0.78rem', color: 'var(--text-sub)', marginTop: 2 }}>
                        <span style={{ opacity: 0.7, flexShrink: 0 }}>📝</span>
                        <span style={{ lineHeight: 1.45, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' } as React.CSSProperties}>{a.reason}</span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', borderTop: '1px solid var(--border)', overflow: 'hidden' }}>
                    {canDo('editStaffAbsence') && <button className="abs-action-btn abs-action-edit" onClick={() => openEdit(a)}>
                      ✏️ {t('edit')}
                    </button>}
                    {canDo('deleteStaffAbsence') && <>
                      {canDo('editStaffAbsence') && <div style={{ width: 1, background: 'var(--border)' }} />}
                      <button className="abs-action-btn abs-action-del" onClick={() => setDeleteTarget(a.id)}>
                        🗑 {t('delete')}
                      </button>
                    </>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Record / Edit Modal */}
        {modalOpen && (
          <div className="modal-overlay" style={{ backdropFilter: 'blur(8px)' }}>
            <div style={{
              background: 'var(--bg-surface)', borderRadius: 24, width: '100%', maxWidth: 430,
              boxShadow: '0 28px 80px rgba(0,0,0,0.22)', overflow: 'hidden',
              animation: 'modal-pop 0.24s cubic-bezier(.34,1.56,.64,1)',
            }}>
              <div style={{ height: 5, background: 'linear-gradient(90deg,var(--rose),#a855f7,#3b82f6)' }} />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 22px 10px' }}>
                <div style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--text)' }}>
                  {editId ? `✏️ ${t('editAbsence')}` : `📅 ${t('recordVacation')}`}
                </div>
                <button onClick={() => setModalOpen(false)} style={{ background: 'var(--bg-elevated)', border: 'none', cursor: 'pointer', color: 'var(--text-sub)', fontSize: 14, width: 30, height: 30, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
              </div>

              <div style={{ padding: '8px 22px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: 11.5, color: 'var(--text-sub)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {t('specialist')}
                  </label>
                  <select className="form-select" value={form.providerId} onChange={e => setForm(f => ({ ...f, providerId: e.target.value }))}>
                    <option value="">{t('selectSpecialist')}</option>
                    {providers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>

                <div className="form-grid-2">
                  <div>
                    <label style={{ display: 'block', fontWeight: 600, fontSize: 11.5, color: 'var(--text-sub)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      {t('startDate')} <span style={{ color: 'var(--rose)' }}>*</span>
                    </label>
                    <input className="form-input" type="date" value={form.startDate}
                      onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontWeight: 600, fontSize: 11.5, color: 'var(--text-sub)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      {t('endDate')} <span style={{ color: 'var(--rose)' }}>*</span>
                    </label>
                    <input className="form-input" type="date" value={form.endDate}
                      onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: 11.5, color: 'var(--text-sub)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {t('reason')}
                  </label>
                  <textarea className="form-textarea" placeholder="…" value={form.reason}
                    onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                    style={{ minHeight: 64, resize: 'vertical' }} />
                </div>

                <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
                  <button onClick={() => setModalOpen(false)} style={{ flex: 1, padding: '11px', border: '1.5px solid var(--border)', borderRadius: 12, background: 'transparent', color: 'var(--text-muted)', fontFamily: 'var(--font)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                    {t('cancel')}
                  </button>
                  <button onClick={save} style={{ flex: 1, padding: '11px', border: 'none', borderRadius: 12, background: 'linear-gradient(135deg,var(--rose),#c0392b)', color: '#fff', fontFamily: 'var(--font)', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                    {editId ? t('saveChanges') : t('recordVacation')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation */}
        {deleteTarget && (
          <div className="modal-overlay" style={{ backdropFilter: 'blur(6px)' }}>
            <div style={{ background: 'var(--bg-surface)', borderRadius: 24, width: '100%', maxWidth: 380, boxShadow: '0 24px 80px rgba(0,0,0,0.18)', overflow: 'hidden', animation: 'del-pop 0.22s cubic-bezier(.34,1.56,.64,1)' }}>
              <div style={{ height: 5, background: 'linear-gradient(90deg,#e53e5a,#ff6b81)' }} />
              <div style={{ padding: '28px 28px 24px', textAlign: 'center' }}>
                <div style={{ width: 58, height: 58, borderRadius: '50%', margin: '0 auto 14px', background: 'rgba(229,62,90,0.10)', border: '1.5px solid rgba(229,62,90,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#e53e5a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                  </svg>
                </div>
                <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 6 }}>{t('deleteRecord')}</div>
                <div style={{ fontSize: 13.5, color: 'var(--text-sub)', marginBottom: 20, lineHeight: 1.6 }}>{t('deleteAbsenceConfirm')}</div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => setDeleteTarget(null)} disabled={deleting} style={{ flex: 1, padding: '11px', border: '1.5px solid var(--border)', borderRadius: 12, background: 'transparent', color: 'var(--text-muted)', fontFamily: 'var(--font)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>{t('cancel')}</button>
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
