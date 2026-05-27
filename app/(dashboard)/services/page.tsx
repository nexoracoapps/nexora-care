'use client';

import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { usePermissions } from '@/context/PermissionsContext';
import type { Service } from '@/types';

const BEAUTY_EMOJIS = ['💇','💅','🧖','💆','💄','👁','✨','🛁','🪒','🦷','🎨','🌸','💐','🩷','🌟','⭐','🔮','🫧','🧴','🪞'];

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

function nameToEmoji(name: string): string {
  const n = name.toLowerCase();
  if (/hair/.test(n)) return '💇';
  if (/nail|manicure|pedicure/.test(n)) return '💅';
  if (/facial|face|skin/.test(n)) return '🧖';
  if (/massage|body/.test(n)) return '💆';
  if (/makeup|beauty/.test(n)) return '💄';
  if (/eyebrow|lash|brow/.test(n)) return '👁';
  if (/wax/.test(n)) return '✨';
  if (/spa|bath|sauna/.test(n)) return '🛁';
  if (/beard|barber|shave/.test(n)) return '🪒';
  if (/teeth|dental|bleach|whiten/.test(n)) return '🦷';
  if (/color|colour|dye|highlight|tint/.test(n)) return '🎨';
  return '🌸';
}

function nameToGradient(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) { h = ((h << 5) - h) + name.charCodeAt(i); h |= 0; }
  return GRADIENTS[Math.abs(h) % GRADIENTS.length];
}

export default function ServicesPage() {
  const { user } = useAuth();
  const { t, isRTL } = useLanguage();
  const { canDo } = usePermissions();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Service | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [selected, setSelected] = useState<Service | null>(null);
  const [form, setForm] = useState({ name: '', nameAr: '', price: '', description: '', icon: '🌸' });
  const [iconMap, setIconMap] = useState<Record<string, string>>({});

  const headers = { Authorization: `Bearer ${user?.token}`, 'Content-Type': 'application/json' };

  const load = useCallback(async () => {
    if (!user?.token) return;
    setLoading(true);
    const res = await fetch('/api/services', { headers: { Authorization: `Bearer ${user.token}` } });
    if (res.ok) setServices(await res.json());
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const map: Record<string, string> = {};
    for (const s of services) {
      const saved = typeof window !== 'undefined' ? localStorage.getItem(`serviceIcon_${s.id}`) : null;
      map[s.id] = saved || nameToEmoji(s.name);
    }
    setIconMap(map);
  }, [services]);

  const openCreate = () => {
    setSelected(null);
    setForm({ name: '', nameAr: '', price: '', description: '', icon: '🌸' });
    setModalOpen(true);
  };

  const openEdit = (s: Service) => {
    setSelected(s);
    const saved = typeof window !== 'undefined' ? localStorage.getItem(`serviceIcon_${s.id}`) : null;
    setForm({ name: s.name, nameAr: s.nameAr || '', price: s.price.toString(), description: s.description || '', icon: saved || nameToEmoji(s.name) });
    setModalOpen(true);
  };

  const save = async () => {
    if (!form.name) return toast.error(t('required'));
    const url = selected ? `/api/services/${selected.id}` : '/api/services';
    const method = selected ? 'PUT' : 'POST';
    const res = await fetch(url, { method, headers, body: JSON.stringify({ name: form.name, nameAr: form.nameAr || null, price: parseFloat(form.price) || 0, description: form.description || null }) });
    if (!res.ok) return toast.error('Failed to save');
    try {
      const data = await res.json();
      const sid = selected?.id || data?.id;
      if (sid && typeof window !== 'undefined') localStorage.setItem(`serviceIcon_${sid}`, form.icon);
    } catch {}
    toast.success(selected ? t('serviceUpdated') : t('serviceCreated'));
    setModalOpen(false);
    load();
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const res = await fetch(`/api/services/${deleteTarget.id}`, { method: 'DELETE', headers });
    setDeleting(false);
    if (res.ok) {
      if (typeof window !== 'undefined') localStorage.removeItem(`serviceIcon_${deleteTarget.id}`);
      toast.success(t('deleted'));
      setDeleteTarget(null);
      load();
    } else toast.error(t('failedToDelete'));
  };

  const filtered = services.filter(s => !search || s.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <ProtectedRoute roles={['ADMIN','MANAGER']} permKey="manageServices">
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes svc-pop { from { opacity:0; transform:scale(0.92) translateY(18px); } to { opacity:1; transform:scale(1) translateY(0); } }
        @keyframes del-pop { from { opacity:0; transform:scale(0.88) translateY(16px); } to { opacity:1; transform:scale(1) translateY(0); } }
        .svc-card { transition: transform 0.18s, box-shadow 0.18s; }
        .svc-card:hover { transform: translateY(-3px); box-shadow: 0 12px 40px rgba(0,0,0,0.13); }
        .svc-action-btn { flex:1; padding:10px; border:none; background:transparent; cursor:pointer; font-size:13px; font-weight:600; display:flex; align-items:center; justify-content:center; gap:5px; transition:background 0.15s, color 0.15s; }
        .svc-action-edit { color: var(--text-sub); }
        .svc-action-edit:hover { background: var(--bg-elevated); color: var(--text); }
        .svc-action-del { color: #e53e5a; }
        .svc-action-del:hover { background: rgba(229,62,90,0.06); }
        .icon-pick-btn { width:100%; aspect-ratio:1; font-size:1.1rem; border-radius:10px; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:all 0.12s; }
      `}} />
      <div>
        <div className="page-header">
          <div>
            <h1 className="page-title">{t('services')}</h1>
            <p className="page-sub">{filtered.length} {t('services').toLowerCase()}</p>
          </div>
          {canDo('createServices') && <button className="btn btn-primary" onClick={openCreate}>+ {t('addService')}</button>}
        </div>

        <div style={{ marginBottom: 20 }}>
          <div className="search-wrap">
            <span className="search-icon">🔍</span>
            <input className="search-input" placeholder={t('searchTreatments')} value={search}
              onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        {loading ? (
          <div className="skeleton" style={{ height: 300 }} />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(255px, 1fr))', gap: 18 }}>
            {filtered.length === 0 ? (
              <div className="empty-state" style={{ gridColumn: '1/-1' }}>
                <div className="empty-state-icon">🌸</div>
                <div className="empty-state-title">{t('noServices')}</div>
              </div>
            ) : filtered.map(s => {
              const emoji = iconMap[s.id] || nameToEmoji(s.name);
              const grad = nameToGradient(s.name);
              const displayName = isRTL && s.nameAr ? s.nameAr : s.name;
              return (
                <div key={s.id} className="glass-card svc-card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                  {/* Banner */}
                  <div style={{ position: 'relative', height: 110, background: grad, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: '2.8rem', lineHeight: 1, filter: 'drop-shadow(0 2px 10px rgba(0,0,0,0.18))' }}>{emoji}</span>
                    <div style={{
                      position: 'absolute', top: 10, insetInlineEnd: 10,
                      background: 'rgba(0,0,0,0.22)', backdropFilter: 'blur(6px)',
                      borderRadius: 20, padding: '4px 11px',
                      fontSize: 13, fontWeight: 800, color: '#fff', letterSpacing: '0.01em',
                    }}>
                      ${s.price.toFixed(2)}
                    </div>
                  </div>
                  {/* Body */}
                  <div style={{ padding: '15px 17px 12px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <h3 style={{ fontWeight: 700, fontSize: '0.96rem', color: 'var(--text)', marginBottom: 5, lineHeight: 1.3 }}>{displayName}</h3>
                    {s.description ? (
                      <p style={{ fontSize: '0.78rem', color: 'var(--text-sub)', lineHeight: 1.55, flex: 1, margin: 0 }}>{s.description}</p>
                    ) : <div style={{ flex: 1 }} />}
                  </div>
                  {/* Actions */}
                  <div style={{ display: 'flex', borderTop: '1px solid var(--border)', overflow: 'hidden' }}>
                    {canDo('editServices') && <button className="svc-action-btn svc-action-edit" onClick={() => openEdit(s)}
                      style={{ fontFamily: 'var(--font)' }}>
                      ✏️ {t('edit')}
                    </button>}
                    {canDo('deleteServices') && <>
                      <div style={{ width: 1, background: 'var(--border)' }} />
                      <button className="svc-action-btn svc-action-del" onClick={() => setDeleteTarget(s)}
                        style={{ fontFamily: 'var(--font)' }}>
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
              background: 'var(--bg-surface)', borderRadius: 24, width: '100%', maxWidth: 440,
              boxShadow: '0 28px 80px rgba(0,0,0,0.22)', overflow: 'hidden',
              animation: 'svc-pop 0.24s cubic-bezier(.34,1.56,.64,1)',
            }}>
              <div style={{ height: 5, background: 'linear-gradient(90deg,var(--rose),#a855f7,#3b82f6)' }} />
              {/* Modal Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 22px 10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: 14,
                    background: nameToGradient(form.name || 'service'),
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '1.55rem', flexShrink: 0,
                    boxShadow: '0 4px 14px rgba(0,0,0,0.13)',
                    transition: 'background 0.3s',
                  }}>
                    {form.icon}
                  </div>
                  <div style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--text)' }}>
                    {selected ? t('editService') : t('addService')}
                  </div>
                </div>
                <button onClick={() => setModalOpen(false)} style={{
                  background: 'var(--bg-elevated)', border: 'none', cursor: 'pointer',
                  color: 'var(--text-sub)', fontSize: 14, width: 30, height: 30,
                  borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>✕</button>
              </div>

              <div style={{ padding: '6px 22px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Icon Picker */}
                <div>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: 11.5, color: 'var(--text-sub)', marginBottom: 7, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {t('icon')}
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: 4 }}>
                    {BEAUTY_EMOJIS.map(e => (
                      <button key={e} className="icon-pick-btn" onClick={() => setForm(f => ({ ...f, icon: e }))}
                        style={{
                          border: `2px solid ${form.icon === e ? 'var(--rose)' : 'transparent'}`,
                          background: form.icon === e ? 'rgba(229,62,90,0.08)' : 'var(--bg-elevated)',
                        }}>
                        {e}
                      </button>
                    ))}
                  </div>
                </div>

                {/* English Name */}
                <div>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: 11.5, color: 'var(--text-sub)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {t('serviceNameEn')} <span style={{ color: 'var(--rose)' }}>*</span>
                  </label>
                  <input className="form-input" placeholder="e.g. Hair Cut & Style" dir="ltr"
                    value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                </div>

                {/* Arabic Name */}
                <div>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: 11.5, color: 'var(--text-sub)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {t('serviceNameAr')}
                  </label>
                  <input className="form-input" placeholder="مثال: قص الشعر" dir="rtl"
                    value={form.nameAr} onChange={e => setForm(f => ({ ...f, nameAr: e.target.value }))} />
                </div>

                {/* Price */}
                <div>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: 11.5, color: 'var(--text-sub)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {t('price')} ($)
                  </label>
                  <input className="form-input" type="number" step="0.01" placeholder="0.00"
                    value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} />
                </div>

                {/* Description */}
                <div>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: 11.5, color: 'var(--text-sub)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {t('description')}
                  </label>
                  <textarea className="form-textarea" placeholder="Optional description…"
                    value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
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
                    {selected ? t('saveChanges') : t('addService')}
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
                <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 6 }}>{t('delete')} {t('service')}</div>
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
