'use client';

import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/context/AuthContext';
import { useBranch } from '@/context/BranchContext';
import { useLanguage } from '@/context/LanguageContext';
import { usePermissions } from '@/context/PermissionsContext';

interface BranchWithCount {
  id: string; name: string; nameAr?: string | null; address?: string | null; phone?: string | null; createdAt: string;
  _count?: { users: number; customers: number; appointments: number };
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

export default function BranchesPage() {
  const { user } = useAuth();
  const { refreshBranches } = useBranch();
  const { t, lang, isRTL } = useLanguage();
  const { canDo } = usePermissions();
  const [branches, setBranches] = useState<BranchWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<BranchWithCount | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [selected, setSelected] = useState<BranchWithCount | null>(null);
  const [form, setForm] = useState({ name: '', nameAr: '', address: '', phone: '' });

  const headers = { Authorization: `Bearer ${user?.token}`, 'Content-Type': 'application/json' };

  const load = useCallback(async () => {
    if (!user?.token) return;
    setLoading(true);
    const res = await fetch('/api/branches', { headers: { Authorization: `Bearer ${user.token}` } });
    if (res.ok) setBranches(await res.json());
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setSelected(null); setForm({ name: '', nameAr: '', address: '', phone: '' }); setModalOpen(true); };
  const openEdit = (b: BranchWithCount) => { setSelected(b); setForm({ name: b.name, nameAr: b.nameAr || '', address: b.address || '', phone: b.phone || '' }); setModalOpen(true); };

  const save = async () => {
    if (!form.name) return toast.error(t('branchNameRequired'));
    const url = selected ? `/api/branches/${selected.id}` : '/api/branches';
    const method = selected ? 'PUT' : 'POST';
    const res = await fetch(url, { method, headers, body: JSON.stringify(form) });
    if (!res.ok) return toast.error(t('failedToSave'));
    toast.success(selected ? t('branchUpdated') : t('branchCreated'));
    setModalOpen(false);
    load();
    refreshBranches();
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const res = await fetch(`/api/branches/${deleteTarget.id}`, { method: 'DELETE', headers });
    setDeleting(false);
    if (res.ok) { toast.success(t('deleted')); setDeleteTarget(null); load(); refreshBranches(); }
    else toast.error(t('failedToDelete'));
  };

  return (
    <ProtectedRoute roles={['ADMIN','MANAGER']} permKey="manageBranches">
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes svc-pop { from { opacity:0; transform:scale(0.92) translateY(18px); } to { opacity:1; transform:scale(1) translateY(0); } }
        @keyframes del-pop { from { opacity:0; transform:scale(0.88) translateY(16px); } to { opacity:1; transform:scale(1) translateY(0); } }
        .br-card { transition: transform 0.18s, box-shadow 0.18s; }
        .br-card:hover { transform: translateY(-3px); box-shadow: 0 12px 40px rgba(0,0,0,0.13); }
        .br-action-btn { flex:1; padding:10px; border:none; background:transparent; cursor:pointer; font-size:13px; font-weight:600; display:flex; align-items:center; justify-content:center; gap:5px; transition:background 0.15s, color 0.15s; font-family:var(--font); }
        .br-action-edit { color: var(--text-sub); }
        .br-action-edit:hover { background: var(--bg-elevated); color: var(--text); }
        .br-action-del { color: #e53e5a; }
        .br-action-del:hover { background: rgba(229,62,90,0.06); }
      `}} />
      <div>
        <div className="page-header">
          <div>
            <h1 className="page-title">{t('branches')}</h1>
            <p className="page-sub">{branches.length} {t('branches').toLowerCase()}</p>
          </div>
          {canDo('manageBranches') && <button className="btn btn-primary" onClick={openCreate}>+ {t('addBranch')}</button>}
        </div>

        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(255px, 1fr))', gap: 18 }}>
            {[...Array(4)].map((_, i) => <div key={i} className="skeleton" style={{ height: 220 }} />)}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(255px, 1fr))', gap: 18 }}>
            {branches.length === 0 ? (
              <div className="empty-state" style={{ gridColumn: '1/-1' }}>
                <div className="empty-state-icon">🏢</div>
                <div className="empty-state-title">{t('noBranches')}</div>
              </div>
            ) : branches.map(b => {
              const grad = nameToGradient(b.name);
              const displayName = isRTL && b.nameAr ? b.nameAr : b.name;
              const altName = isRTL ? b.name : b.nameAr;
              return (
                <div key={b.id} className="glass-card br-card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                  {/* Banner */}
                  <div style={{ position: 'relative', height: 100, background: grad, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <div style={{
                      width: 64, height: 64, borderRadius: '50%',
                      background: 'rgba(255,255,255,0.25)', backdropFilter: 'blur(6px)',
                      border: '2.5px solid rgba(255,255,255,0.6)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '1.8rem', boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                    }}>
                      🏢
                    </div>
                  </div>

                  {/* Body */}
                  <div style={{ padding: '14px 17px 10px', flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <h3 style={{ fontWeight: 700, fontSize: '0.96rem', color: 'var(--text)', margin: 0, lineHeight: 1.3 }}>{displayName}</h3>
                    {altName && <p style={{ fontSize: '0.76rem', color: 'var(--text-sub)', margin: 0 }}>{altName}</p>}
                    {b.address && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.78rem', color: 'var(--text-sub)' }}>
                        <span style={{ opacity: 0.7 }}>📍</span>{b.address}
                      </div>
                    )}
                    {b.phone && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.78rem', color: 'var(--text-sub)' }}>
                        <span style={{ opacity: 0.7 }}>📞</span>{b.phone}
                      </div>
                    )}
                    {/* Stats row */}
                    {b._count && (
                      <div style={{ display: 'flex', gap: 6, marginTop: 'auto', paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                        {([[b._count.users, t('staff')], [b._count.customers, t('customers')], [b._count.appointments, t('appts')]] as [number, string][]).map(([val, label]) => (
                          <div key={label} style={{ flex: 1, textAlign: 'center', background: 'var(--bg-elevated)', borderRadius: 10, padding: '7px 4px' }}>
                            <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--rose)' }}>{val}</div>
                            <div style={{ fontSize: '0.62rem', color: 'var(--text-sub)', marginTop: 1 }}>{label}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', borderTop: '1px solid var(--border)', overflow: 'hidden' }}>
                    {canDo('manageBranches') && <button className="br-action-btn br-action-edit" onClick={() => openEdit(b)}>
                      ✏️ {t('edit')}
                    </button>}
                    {canDo('manageBranches') && <>
                      <div style={{ width: 1, background: 'var(--border)' }} />
                      <button className="br-action-btn br-action-del" onClick={() => setDeleteTarget(b)}>
                        🗑 {t('delete')}
                      </button>
                    </>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Create / Edit Modal */}
        {modalOpen && (
          <div className="modal-overlay" style={{ backdropFilter: 'blur(8px)' }}>
            <div style={{
              background: 'var(--bg-surface)', borderRadius: 24, width: '100%', maxWidth: 420,
              boxShadow: '0 28px 80px rgba(0,0,0,0.22)', overflow: 'hidden',
              animation: 'svc-pop 0.24s cubic-bezier(.34,1.56,.64,1)',
            }}>
              <div style={{ height: 5, background: 'linear-gradient(90deg,var(--rose),#a855f7,#3b82f6)' }} />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 22px 10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 46, height: 46, borderRadius: 14, flexShrink: 0,
                    background: nameToGradient(form.name || 'branch'),
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '1.4rem', boxShadow: '0 4px 14px rgba(0,0,0,0.13)',
                  }}>🏢</div>
                  <div style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--text)' }}>
                    {selected ? t('editBranch') : t('addBranch')}
                  </div>
                </div>
                <button onClick={() => setModalOpen(false)} style={{ background: 'var(--bg-elevated)', border: 'none', cursor: 'pointer', color: 'var(--text-sub)', fontSize: 14, width: 30, height: 30, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
              </div>

              <div style={{ padding: '6px 22px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: 11.5, color: 'var(--text-sub)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {t('branchName')} <span style={{ color: 'var(--rose)' }}>*</span>
                  </label>
                  <input className="form-input" placeholder="e.g. Downtown Branch" dir="ltr"
                    value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: 11.5, color: 'var(--text-sub)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {t('branchNameAr')}
                  </label>
                  <input className="form-input" placeholder="مثال: الفرع الرئيسي" dir="rtl"
                    value={form.nameAr} onChange={e => setForm(f => ({ ...f, nameAr: e.target.value }))} />
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: 11.5, color: 'var(--text-sub)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {t('address')}
                  </label>
                  <input className="form-input" placeholder="Full address"
                    value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: 11.5, color: 'var(--text-sub)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {t('phone')}
                  </label>
                  <input className="form-input" type="tel" placeholder="+1 (555) 000-0000"
                    value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                </div>
                <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
                  <button onClick={() => setModalOpen(false)} style={{ flex: 1, padding: '11px', border: '1.5px solid var(--border)', borderRadius: 12, background: 'transparent', color: 'var(--text-muted)', fontFamily: 'var(--font)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                    {t('cancel')}
                  </button>
                  <button onClick={save} style={{ flex: 1, padding: '11px', border: 'none', borderRadius: 12, background: 'linear-gradient(135deg,var(--rose),#c0392b)', color: '#fff', fontFamily: 'var(--font)', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                    {selected ? t('saveChanges') : t('addBranch')}
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
                <div style={{ width: 58, height: 58, borderRadius: '50%', margin: '0 auto 14px', background: 'rgba(229,62,90,0.10)', border: '1.5px solid rgba(229,62,90,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#e53e5a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                    <path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                  </svg>
                </div>
                <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 6 }}>{t('delete')} {t('branch')}</div>
                <div style={{ fontSize: 13.5, color: 'var(--text-sub)', marginBottom: 20, lineHeight: 1.6 }}>
                  <strong style={{ color: 'var(--text)' }}>{isRTL && deleteTarget.nameAr ? deleteTarget.nameAr : deleteTarget.name}</strong>
                  {' — '}{t('deleteApptConfirm')}
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
