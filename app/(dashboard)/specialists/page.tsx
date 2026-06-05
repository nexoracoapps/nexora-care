'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import { Pencil, Trash2 } from 'lucide-react';
import { swrGet, swrSet, swrBust } from '@/lib/swrCache';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/context/AuthContext';
import { useBranch } from '@/context/BranchContext';
import { useLanguage } from '@/context/LanguageContext';
import { usePermissions } from '@/context/PermissionsContext';
import type { ServiceProvider, ProviderType } from '@/types';

const TYPE_ICON: Record<ProviderType, string> = {
  DOCTOR: '🩺', STYLIST: '✂️', THERAPIST: '🧘', ESTHETICIAN: '💆', NAIL_ARTIST: '💅',
};
const TYPE_LABEL_EN: Record<ProviderType, string> = {
  DOCTOR: 'Doctor', STYLIST: 'Stylist', THERAPIST: 'Therapist', ESTHETICIAN: 'Esthetician', NAIL_ARTIST: 'Nail Artist',
};
const TYPE_LABEL_AR: Record<ProviderType, string> = {
  DOCTOR: 'طبيب', STYLIST: 'مصفف شعر', THERAPIST: 'معالج', ESTHETICIAN: 'خبير تجميل', NAIL_ARTIST: 'خبيرة أظافر',
};
const PROVIDER_TYPES: ProviderType[] = ['DOCTOR', 'STYLIST', 'THERAPIST', 'ESTHETICIAN', 'NAIL_ARTIST'];

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

export default function SpecialistsPage() {
  const { user } = useAuth();
  const { activeBranchId } = useBranch();
  const { t, isRTL } = useLanguage();
  const { canDo } = usePermissions();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [providers, setProviders] = useState<ServiceProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ServiceProvider | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [selected, setSelected] = useState<ServiceProvider | null>(null);
  const [form, setForm] = useState({ name: '', type: 'THERAPIST' as ProviderType, bio: '', photoUrl: '' });

  const headers = { Authorization: `Bearer ${user?.token}`, 'Content-Type': 'application/json' };

  const load = useCallback(async () => {
    if (!user?.token) return;
    const ck = `/api/providers${activeBranchId ? `?branchId=${activeBranchId}` : ''}`;
    const stale = swrGet<ServiceProvider[]>(ck);
    if (stale) { setProviders(stale); setLoading(false); } else setLoading(true);
    const res = await fetch(ck, { headers: { Authorization: `Bearer ${user.token}` } });
    if (res.ok) { const d = await res.json(); setProviders(d); swrSet(ck, d); }
    setLoading(false);
  }, [user, activeBranchId]);

  useEffect(() => { load(); }, [load]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return toast.error('Image must be under 2 MB');
    const reader = new FileReader();
    reader.onload = ev => setForm(f => ({ ...f, photoUrl: ev.target?.result as string }));
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const openCreate = () => {
    setSelected(null);
    setForm({ name: '', type: 'THERAPIST', bio: '', photoUrl: '' });
    setModalOpen(true);
  };

  const openEdit = (p: ServiceProvider) => {
    setSelected(p);
    setForm({ name: p.name, type: p.type, bio: p.bio || '', photoUrl: p.photoUrl || '' });
    setModalOpen(true);
  };

  const save = async () => {
    if (!form.name) return toast.error(t('required'));
    const url = selected ? `/api/providers/${selected.id}` : '/api/providers';
    const method = selected ? 'PUT' : 'POST';
    const res = await fetch(url, { method, headers, body: JSON.stringify({ name: form.name, type: form.type, bio: form.bio || null, photoUrl: form.photoUrl || null }) });
    if (!res.ok) return toast.error('Failed to save');
    toast.success(selected ? t('providerUpdated') : t('providerCreated'));
    setModalOpen(false);
    swrBust('/api/providers');
    load();
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const res = await fetch(`/api/providers/${deleteTarget.id}`, { method: 'DELETE', headers });
    setDeleting(false);
    if (res.ok) { toast.success(t('deleted')); setDeleteTarget(null); swrBust('/api/providers'); load(); }
    else toast.error(t('failedToDelete'));
  };

  const filtered = providers.filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <ProtectedRoute permKeys={['manageProviders', 'manageServices']}>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes svc-pop { from { opacity:0; transform:scale(0.92) translateY(18px); } to { opacity:1; transform:scale(1) translateY(0); } }
        @keyframes del-pop { from { opacity:0; transform:scale(0.88) translateY(16px); } to { opacity:1; transform:scale(1) translateY(0); } }
        .prov-card { transition: transform 0.18s, box-shadow 0.18s; }
        .prov-card:hover { transform: translateY(-3px); box-shadow: 0 12px 40px rgba(0,0,0,0.13); }
        .prov-action-btn { flex:1; padding:10px; border:none; background:transparent; cursor:pointer; font-size:13px; font-weight:600; display:flex; align-items:center; justify-content:center; gap:5px; transition:background 0.15s, color 0.15s; font-family:var(--font); }
        .prov-action-edit { color: var(--text-sub); }
        .prov-action-edit:hover { background: var(--bg-elevated); color: var(--text); }
        .prov-action-del { color: #e53e5a; }
        .prov-action-del:hover { background: rgba(229,62,90,0.06); }
        .photo-avatar:hover .photo-overlay { opacity: 1; }
      `}} />
      <div>
        <div className="page-header">
          <div>
            <h1 className="page-title">{t('specialists')}</h1>
            <p className="page-sub">{filtered.length} {t('specialists').toLowerCase()}</p>
          </div>
          {canDo('createProviders') && <button className="btn btn-primary" onClick={openCreate}>+ {t('newSpecialist')}</button>}
        </div>

        <div style={{ marginBottom: 20 }}>
          <div className="search-wrap">
            <span className="search-icon">🔍</span>
            <input className="search-input" placeholder={t('searchSpecialists')} value={search}
              onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(255px, 1fr))', gap: 18 }}>
            {[...Array(6)].map((_, i) => <div key={i} className="skeleton" style={{ height: 220 }} />)}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(255px, 1fr))', gap: 18 }}>
            {filtered.length === 0 ? (
              <div className="empty-state" style={{ gridColumn: '1/-1' }}>
                <div className="empty-state-icon">⭐</div>
                <div className="empty-state-title">{t('noSpecialists')}</div>
              </div>
            ) : filtered.map(p => {
              const grad = nameToGradient(p.name);
              const typeLabel = isRTL ? TYPE_LABEL_AR[p.type] : TYPE_LABEL_EN[p.type];
              return (
                <div key={p.id} className="glass-card prov-card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                  {/* Banner */}
                  <div style={{ position: 'relative', height: 110, background: grad, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {p.photoUrl ? (
                      <img src={p.photoUrl} alt={p.name}
                        style={{ width: 74, height: 74, borderRadius: '50%', objectFit: 'cover', border: '3px solid rgba(255,255,255,0.75)', boxShadow: '0 4px 18px rgba(0,0,0,0.2)' }} />
                    ) : (
                      <span style={{ fontSize: '2.8rem', lineHeight: 1, filter: 'drop-shadow(0 2px 10px rgba(0,0,0,0.18))' }}>
                        {TYPE_ICON[p.type]}
                      </span>
                    )}
                    <div style={{
                      position: 'absolute', top: 10, insetInlineEnd: 10,
                      background: 'rgba(0,0,0,0.22)', backdropFilter: 'blur(6px)',
                      borderRadius: 20, padding: '4px 10px',
                      fontSize: 11.5, fontWeight: 700, color: '#fff',
                    }}>
                      {TYPE_ICON[p.type]} {typeLabel}
                    </div>
                  </div>

                  {/* Body */}
                  <div style={{ padding: '15px 17px 12px', flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <h3 style={{ fontWeight: 700, fontSize: '0.96rem', color: 'var(--text)', margin: 0, lineHeight: 1.3 }}>{p.name}</h3>
                    {p.bio && (
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: '0.78rem', color: 'var(--text-sub)', lineHeight: 1.5 }}>
                        <span style={{ opacity: 0.6, flexShrink: 0, marginTop: 1 }}>💬</span>
                        <span style={{ overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{p.bio}</span>
                      </div>
                    )}
                    {p.branch && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: 'var(--text-sub)' }}>
                        <span style={{ opacity: 0.7 }}>🏢</span>{p.branch.name}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  {(canDo('editProviders') || canDo('deleteProviders')) && <div style={{ display: 'flex', borderTop: '1px solid var(--border)', overflow: 'hidden' }}>
                    {canDo('editProviders') && <button className="prov-action-btn prov-action-edit" onClick={() => openEdit(p)}>
                      <Pencil size={13} style={{ flexShrink: 0 }} /> {t('edit')}
                    </button>}
                    {canDo('editProviders') && canDo('deleteProviders') && <div style={{ width: 1, background: 'var(--border)' }} />}
                    {canDo('deleteProviders') && <button className="prov-action-btn prov-action-del" onClick={() => setDeleteTarget(p)}>
                      <Trash2 size={13} style={{ flexShrink: 0 }} /> {t('delete')}
                    </button>}
                  </div>}
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
              background: 'var(--bg-surface)', borderRadius: 24, width: '100%', maxWidth: 430,
              boxShadow: '0 28px 80px rgba(0,0,0,0.22)', overflow: 'hidden',
              animation: 'svc-pop 0.24s cubic-bezier(.34,1.56,.64,1)',
            }}>
              <div style={{ height: 5, background: 'linear-gradient(90deg,var(--rose),#a855f7,#3b82f6)' }} />

              {/* Modal Header — clickable avatar */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 22px 10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {/* Clickable avatar preview */}
                  <div className="photo-avatar" onClick={() => fileInputRef.current?.click()}
                    style={{
                      position: 'relative', width: 56, height: 56, borderRadius: '50%', flexShrink: 0,
                      cursor: 'pointer', overflow: 'hidden',
                      background: nameToGradient(form.name || 'specialist'),
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: '0 4px 14px rgba(0,0,0,0.15)',
                      border: '2.5px solid var(--border)',
                    }}>
                    {form.photoUrl ? (
                      <img src={form.photoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <span style={{ fontSize: '1.5rem' }}>{TYPE_ICON[form.type]}</span>
                    )}
                    {/* Camera overlay on hover */}
                    <div className="photo-overlay" style={{
                      position: 'absolute', inset: 0,
                      background: 'rgba(0,0,0,0.45)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      opacity: 0, transition: 'opacity 0.15s',
                      fontSize: '1.1rem',
                    }}>📷</div>
                  </div>
                  <div style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--text)' }}>
                    {selected ? t('editSpecialist') : t('addSpecialist')}
                  </div>
                </div>
                <button onClick={() => setModalOpen(false)} style={{
                  background: 'var(--bg-elevated)', border: 'none', cursor: 'pointer',
                  color: 'var(--text-sub)', fontSize: 14, width: 30, height: 30,
                  borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>✕</button>
              </div>

              <div style={{ padding: '4px 22px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>

                {/* Photo upload row */}
                <div>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: 11.5, color: 'var(--text-sub)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {t('photo')}
                  </label>
                  {form.photoUrl ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <img src={form.photoUrl} alt=""
                        style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--border)', flexShrink: 0 }} />
                      <button onClick={() => fileInputRef.current?.click()} style={{
                        padding: '7px 14px', border: '1.5px solid var(--border)', borderRadius: 10,
                        background: 'var(--bg-elevated)', cursor: 'pointer',
                        fontFamily: 'var(--font)', fontSize: 13, fontWeight: 600, color: 'var(--text)',
                      }}>
                        📷 {t('changePhoto')}
                      </button>
                      <button onClick={() => setForm(f => ({ ...f, photoUrl: '' }))} style={{
                        padding: '7px 14px', border: '1.5px solid rgba(229,62,90,0.3)', borderRadius: 10,
                        background: 'transparent', cursor: 'pointer',
                        fontFamily: 'var(--font)', fontSize: 13, fontWeight: 600, color: '#e53e5a',
                      }}>
                        {t('removePhoto')}
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => fileInputRef.current?.click()} style={{
                      width: '100%', padding: '18px', border: '2px dashed var(--border)', borderRadius: 12,
                      background: 'var(--bg-elevated)', cursor: 'pointer',
                      fontFamily: 'var(--font)', fontSize: 13, fontWeight: 600, color: 'var(--text-sub)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      transition: 'border-color 0.15s, color 0.15s',
                    }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--rose)'; (e.currentTarget as HTMLElement).style.color = 'var(--text)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-sub)'; }}>
                      <span style={{ fontSize: '1.3rem' }}>📷</span>
                      {t('choosePhoto')}
                    </button>
                  )}
                </div>

                {/* Name */}
                <div>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: 11.5, color: 'var(--text-sub)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {t('specialistName')} <span style={{ color: 'var(--rose)' }}>*</span>
                  </label>
                  <input className="form-input" placeholder="e.g. Sara Ahmed"
                    value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                </div>

                {/* Type grid */}
                <div>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: 11.5, color: 'var(--text-sub)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {t('specialistType')}
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
                    {PROVIDER_TYPES.map(pt => (
                      <button key={pt} onClick={() => setForm(f => ({ ...f, type: pt }))} style={{
                        padding: '8px 4px', border: '2px solid',
                        borderColor: form.type === pt ? 'var(--rose)' : 'var(--border)',
                        borderRadius: 10, cursor: 'pointer',
                        background: form.type === pt ? 'rgba(229,62,90,0.08)' : 'var(--bg-elevated)',
                        fontFamily: 'var(--font)', fontSize: 11, fontWeight: 600,
                        color: form.type === pt ? 'var(--rose)' : 'var(--text-sub)',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                        transition: 'all 0.12s',
                      }}>
                        <span style={{ fontSize: '1.2rem' }}>{TYPE_ICON[pt]}</span>
                        <span style={{ fontSize: 10, lineHeight: 1.2, textAlign: 'center' }}>{isRTL ? TYPE_LABEL_AR[pt] : TYPE_LABEL_EN[pt]}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Bio */}
                <div>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: 11.5, color: 'var(--text-sub)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {t('bio')}
                  </label>
                  <textarea className="form-textarea" placeholder="Optional short bio…"
                    value={form.bio} onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
                    style={{ minHeight: 68, resize: 'vertical' }} />
                </div>

                {/* Footer */}
                <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
                  <button onClick={() => setModalOpen(false)} style={{
                    flex: 1, padding: '11px', border: '1.5px solid var(--border)', borderRadius: 12,
                    background: 'transparent', color: 'var(--text-muted)',
                    fontFamily: 'var(--font)', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                  }}>
                    {t('cancel')}
                  </button>
                  <button onClick={save} style={{
                    flex: 1, padding: '11px', border: 'none', borderRadius: 12,
                    background: 'linear-gradient(135deg,var(--rose),#c0392b)', color: '#fff',
                    fontFamily: 'var(--font)', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                  }}>
                    {selected ? t('saveChanges') : t('addSpecialist')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation */}
        {deleteTarget && (
          <div className="modal-overlay" style={{ backdropFilter: 'blur(6px)' }}>
            <div style={{
              background: 'var(--bg-surface)', borderRadius: 24, width: '100%', maxWidth: 370,
              boxShadow: '0 24px 80px rgba(0,0,0,0.18)',
              overflow: 'hidden', animation: 'del-pop 0.22s cubic-bezier(.34,1.56,.64,1)',
            }}>
              <div style={{ height: 5, background: 'linear-gradient(90deg,#e53e5a,#ff6b81)' }} />
              <div style={{ padding: '26px 26px 22px', textAlign: 'center' }}>
                <div style={{
                  width: 58, height: 58, borderRadius: '50%', margin: '0 auto 14px',
                  background: 'rgba(229,62,90,0.10)', border: '1.5px solid rgba(229,62,90,0.22)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#e53e5a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                    <path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                  </svg>
                </div>
                <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 6 }}>{t('delete')} {t('specialist')}</div>
                <div style={{ fontSize: 13.5, color: 'var(--text-sub)', marginBottom: 20, lineHeight: 1.6 }}>
                  <strong style={{ color: 'var(--text)' }}>{deleteTarget.name}</strong>
                  {' — '}{t('deleteApptConfirm')}
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => setDeleteTarget(null)} disabled={deleting} style={{
                    flex: 1, padding: '11px', border: '1.5px solid var(--border)', borderRadius: 12,
                    background: 'transparent', color: 'var(--text-muted)',
                    fontFamily: 'var(--font)', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                  }}>
                    {t('cancel')}
                  </button>
                  <button onClick={confirmDelete} disabled={deleting} style={{
                    flex: 1, padding: '11px', border: 'none', borderRadius: 12,
                    background: 'linear-gradient(135deg,#e53e5a,#c0392b)', color: '#fff',
                    fontFamily: 'var(--font)', fontSize: 14, fontWeight: 700,
                    cursor: deleting ? 'not-allowed' : 'pointer', opacity: deleting ? 0.7 : 1,
                  }}>
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
