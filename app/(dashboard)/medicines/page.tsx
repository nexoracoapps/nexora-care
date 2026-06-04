'use client';

import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { usePermissions } from '@/context/PermissionsContext';
import { queuedFetch } from '@/lib/queuedFetch';

interface Medicine {
  id: string;
  name: string;
  nameAr?: string;
  category: string;
  dosageOptions: string;
  instructions?: string;
  instructionsAr?: string;
  isActive: boolean;
  createdAt: string;
  _pending?: boolean;
}

const CATEGORY_COLORS: Record<string, string> = {
  'Pain Relief':      '#ef4444',
  'Antibiotic':       '#0891b2',
  'Dermatology':      '#ec4899',
  'Antihistamine':    '#f59e0b',
  'Supplement':       '#10b981',
  'Gastrointestinal': '#8b5cf6',
  'Skincare':         '#06b6d4',
  'General':          '#6366f1',
};
function catColor(cat: string) {
  return CATEGORY_COLORS[cat] || '#6366f1';
}

const PRESET_CATEGORIES = ['Pain Relief', 'Antibiotic', 'Dermatology', 'Antihistamine', 'Supplement', 'Gastrointestinal', 'Skincare', 'General'];

const CATEGORY_AR: Record<string, string> = {
  'Pain Relief': 'مسكنات الألم', 'Antibiotic': 'مضادات حيوية',
  'Dermatology': 'أمراض جلدية', 'Antihistamine': 'مضادات الهيستامين',
  'Supplement': 'مكملات غذائية', 'Gastrointestinal': 'الجهاز الهضمي',
  'Skincare': 'العناية بالبشرة', 'General': 'عام',
};
function catLabel(cat: string, lang: string) {
  if (cat === 'All') return lang === 'ar' ? 'الكل' : 'All';
  return lang === 'ar' ? (CATEGORY_AR[cat] || cat) : cat;
}

export default function MedicinesPage() {
  const { user }           = useAuth();
  const { lang, isRTL }    = useLanguage();
  const { canDo }          = usePermissions();

  const [medicines, setMedicines]   = useState<Medicine[]>([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [catFilter, setCatFilter]   = useState('All');
  const [showInactive, setShowInactive] = useState(false);

  const [modal, setModal]           = useState<'create' | 'edit' | 'delete' | null>(null);
  const [selected, setSelected]     = useState<Medicine | null>(null);
  const [saving, setSaving]         = useState(false);
  const [deleting, setDeleting]     = useState(false);

  // Form state
  const [fName, setFName]               = useState('');
  const [fNameAr, setFNameAr]           = useState('');
  const [fCategory, setFCategory]       = useState('General');
  const [fCategoryCustom, setFCategoryCustom] = useState('');
  const [fDosageInput, setFDosageInput] = useState('');
  const [fDosageOpts, setFDosageOpts]   = useState<string[]>([]);
  const [fInstructions, setFInstructions]   = useState('');
  const [fInstructionsAr, setFInstructionsAr] = useState('');
  const [fIsActive, setFIsActive]       = useState(true);

  const headers = useCallback(() => ({ Authorization: `Bearer ${user?.token}`, 'Content-Type': 'application/json' }), [user?.token]);

  const load = useCallback(async () => {
    if (!user?.token) return;
    setLoading(true);
    const res = await fetch('/api/medicines?all=true', { headers: headers() });
    if (res.ok) setMedicines(await res.json());
    setLoading(false);
  }, [user?.token, headers]);

  useEffect(() => { load(); }, [load]);

  // Re-fetch when offline sync completes so pending items get replaced with real server data
  useEffect(() => {
    const handler = () => load();
    window.addEventListener('nexora-sync-complete', handler);
    return () => window.removeEventListener('nexora-sync-complete', handler);
  }, [load]);

  const resetForm = () => {
    setFName(''); setFNameAr(''); setFCategory('General'); setFCategoryCustom('');
    setFDosageInput(''); setFDosageOpts([]); setFInstructions(''); setFInstructionsAr(''); setFIsActive(true);
  };

  const openCreate = () => { resetForm(); setSelected(null); setModal('create'); };

  const openEdit = (m: Medicine) => {
    setSelected(m);
    setFName(m.name); setFNameAr(m.nameAr || '');
    const isPreset = PRESET_CATEGORIES.includes(m.category);
    setFCategory(isPreset ? m.category : 'custom');
    setFCategoryCustom(isPreset ? '' : m.category);
    setFDosageOpts(JSON.parse(m.dosageOptions || '[]'));
    setFDosageInput('');
    setFInstructions(m.instructions || ''); setFInstructionsAr(m.instructionsAr || '');
    setFIsActive(m.isActive);
    setModal('edit');
  };

  const addDosageOpt = () => {
    const val = fDosageInput.trim();
    if (!val || fDosageOpts.includes(val)) return;
    setFDosageOpts(prev => [...prev, val]);
    setFDosageInput('');
  };

  const removeDosageOpt = (opt: string) => setFDosageOpts(prev => prev.filter(o => o !== opt));

  const effectiveCategory = fCategory === 'custom' ? fCategoryCustom.trim() : fCategory;

  const save = async () => {
    if (!fName.trim()) return toast.error(lang === 'ar' ? 'اسم الدواء مطلوب' : 'Medicine name is required');
    if (!effectiveCategory) return toast.error(lang === 'ar' ? 'الفئة مطلوبة' : 'Category is required');
    setSaving(true);
    try {
      const body = { name: fName.trim(), nameAr: fNameAr.trim() || null, category: effectiveCategory, dosageOptions: fDosageOpts, instructions: fInstructions.trim() || null, instructionsAr: fInstructionsAr.trim() || null, isActive: fIsActive };
      const isEdit = modal === 'edit' && selected;
      const url = isEdit ? `/api/medicines/${selected.id}` : '/api/medicines';
      const res = await queuedFetch(url, { method: isEdit ? 'PUT' : 'POST', headers: headers(), body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok && !data?.queued) throw new Error(data?.error || 'Failed');
      if (data?.queued) {
        // Optimistic update — show immediately without waiting for server
        const optimistic: Medicine = {
          id: isEdit ? selected!.id : `pending-${Date.now()}`,
          name: fName.trim(), nameAr: fNameAr.trim() || undefined,
          category: effectiveCategory, dosageOptions: JSON.stringify(fDosageOpts),
          instructions: fInstructions.trim() || undefined, instructionsAr: fInstructionsAr.trim() || undefined,
          isActive: fIsActive, createdAt: new Date().toISOString(), _pending: true,
        };
        setMedicines(prev => isEdit
          ? prev.map(m => m.id === selected!.id ? optimistic : m)
          : [...prev, optimistic]);
        toast.success(lang === 'ar' ? '⏳ حُفظ مؤقتاً — سيُزامَن عند الاتصال' : '⏳ Saved locally — will sync when online');
      } else {
        toast.success(isEdit ? (lang === 'ar' ? 'تم تحديث الدواء' : 'Medicine updated') : (lang === 'ar' ? 'تمت إضافة الدواء' : 'Medicine added'));
        load();
      }
      setModal(null);
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : (lang === 'ar' ? 'خطأ في الحفظ' : 'Error')); }
    setSaving(false);
  };

  const doDelete = async () => {
    if (!selected) return;
    setDeleting(true);
    const res = await queuedFetch(`/api/medicines/${selected.id}`, { method: 'DELETE', headers: headers() });
    const data = await res.json().catch(() => ({}));
    setDeleting(false);
    if (res.ok || data?.queued) {
      // Optimistic removal — remove from UI immediately
      setMedicines(prev => prev.filter(m => m.id !== selected!.id));
      toast.success(data?.queued
        ? (lang === 'ar' ? '⏳ حُذف مؤقتاً — سيُزامَن عند الاتصال' : '⏳ Removed locally — will sync when online')
        : (lang === 'ar' ? 'تم حذف الدواء' : 'Medicine removed'));
      setModal(null); setSelected(null);
      if (!data?.queued) load();
    } else toast.error(lang === 'ar' ? 'فشل الحذف' : 'Failed to delete');
  };

  const allCategories = ['All', ...Array.from(new Set(medicines.map(m => m.category))).sort()];

  const filtered = medicines.filter(m => {
    if (!showInactive && !m.isActive) return false;
    const matchCat = catFilter === 'All' || m.category === catFilter;
    const q = search.toLowerCase();
    const matchSearch = !q || m.name.toLowerCase().includes(q) || (m.nameAr || '').includes(q) || m.category.toLowerCase().includes(q);
    return matchCat && matchSearch;
  });

  const grouped = filtered.reduce<Record<string, Medicine[]>>((acc, m) => {
    if (!acc[m.category]) acc[m.category] = [];
    acc[m.category].push(m);
    return acc;
  }, {});

  return (
    <ProtectedRoute roles={["ADMIN","MANAGER"]} permKey="manageMedicines">
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes med-pop { from{opacity:0;transform:scale(0.92) translateY(18px)} to{opacity:1;transform:scale(1) translateY(0)} }
        .med-card { transition:transform 0.18s,box-shadow 0.18s; }
        .med-card:hover { transform:translateY(-3px); box-shadow:0 12px 40px rgba(0,0,0,0.13); }
        .med-action-btn { flex:1; padding:9px; border:none; background:transparent; cursor:pointer; font-size:12.5px; font-weight:600; display:flex; align-items:center; justify-content:center; gap:5px; transition:background 0.15s; font-family:var(--font); color:var(--text-sub); }
        .med-action-btn:hover { background:var(--bg-elevated); color:var(--text); }
        .med-action-del { color:#e53e5a; }
        .med-action-del:hover { background:rgba(229,62,90,0.06) !important; color:#e53e5a !important; }
        .med-modal { display:flex; flex-direction:column; max-height:calc(100vh - 60px); overflow:hidden; width:100%; max-width:560px; border-radius:20px; box-shadow:0 24px 64px rgba(0,0,0,0.35); }
        .med-modal-body { flex:1; overflow-y:auto; min-height:0; padding:20px; }
        .med-dosage-tag { display:inline-flex; align-items:center; gap:6px; background:rgba(5,150,105,0.08); border:1px solid rgba(5,150,105,0.2); borderRadius:20px; padding:4px 10px; fontSize:0.8rem; color:#059669; fontWeight:600; }
      `}} />

      <div dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="page-header">
          <div>
            <h1 className="page-title">💉 {lang === 'ar' ? 'الأدوية' : 'Medicines'}</h1>
            <p className="page-sub">{filtered.length} {lang === 'ar' ? 'دواء' : 'medicines'}</p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {canDo('createMedicines') && (
              <button className="btn btn-primary" onClick={openCreate}>
                + {lang === 'ar' ? 'إضافة دواء' : 'Add Medicine'}
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="search-wrap" style={{ flex: 1, minWidth: 180 }}>
            <span className="search-icon">🔍</span>
            <input className="search-input" placeholder={lang === 'ar' ? 'ابحث عن دواء...' : 'Search medicines...'} value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: '0.82rem', color: 'var(--text-sub)', cursor: 'pointer', userSelect: 'none', flexShrink: 0 }}>
            <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} />
            {lang === 'ar' ? 'إظهار المحذوفة' : 'Show inactive'}
          </label>
        </div>

        {/* Category tabs */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 20 }}>
          {allCategories.map(cat => {
            const active = catFilter === cat;
            const color = cat === 'All' ? 'var(--rose)' : catColor(cat);
            return (
              <button key={cat} onClick={() => setCatFilter(cat)} style={{ padding: '6px 14px', borderRadius: 20, border: `1.5px solid ${active ? color : 'var(--border)'}`, background: active ? `${color}15` : 'var(--bg-elevated)', color: active ? color : 'var(--text-sub)', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)', transition: 'all 0.15s' }}>
                {catLabel(cat, lang)}
                {cat !== 'All' && <span style={{ marginInlineStart: 5, fontSize: '0.7rem', opacity: 0.7 }}>({medicines.filter(m => m.category === cat && (showInactive || m.isActive)).length})</span>}
              </button>
            );
          })}
        </div>

        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
            {[1,2,3,4,5,6].map(i => <div key={i} className="skeleton" style={{ height: 180, borderRadius: 14 }} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">💉</div>
            <div className="empty-state-title">{lang === 'ar' ? 'لا توجد أدوية' : 'No medicines found'}</div>
          </div>
        ) : (
          /* Grouped by category */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
            {Object.entries(grouped).map(([cat, meds]) => {
              const color = catColor(cat);
              return (
                <div key={cat}>
                  {/* Category header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: `${color}20`, border: `1px solid ${color}35`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem' }}>💊</div>
                    <span style={{ fontWeight: 800, fontSize: '0.85rem', color, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{catLabel(cat, lang)}</span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', background: 'var(--bg-elevated)', borderRadius: 10, padding: '2px 8px', border: '1px solid var(--border)' }}>{meds.length}</span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
                    {meds.map(m => (
                      <div key={m.id} className="glass-card med-card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', opacity: m.isActive ? 1 : 0.55 }}>
                        {/* Color top band */}
                        <div style={{ height: 5, background: `linear-gradient(90deg, ${color}, ${color}88)`, flexShrink: 0 }} />

                        <div style={{ padding: '14px 16px', flex: 1 }}>
                          {/* Name row */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--text)', marginBottom: 2 }}>
                                {lang === 'ar' && m.nameAr ? m.nameAr : m.name}
                              </div>
                              {(lang === 'ar' ? m.name : m.nameAr) && (
                                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                  {lang === 'ar' ? m.name : m.nameAr}
                                </div>
                              )}
                            </div>
                            {!m.isActive && (
                              <span style={{ flexShrink: 0, marginInlineStart: 8, fontSize: '0.65rem', fontWeight: 700, background: 'rgba(239,68,68,0.1)', color: '#ef4444', borderRadius: 10, padding: '2px 7px', border: '1px solid rgba(239,68,68,0.2)' }}>
                                {lang === 'ar' ? 'محذوف' : 'Inactive'}
                              </span>
                            )}
                          </div>

                          {/* Dosage options */}
                          {JSON.parse(m.dosageOptions || '[]').length > 0 && (
                            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 6 }}>
                              {(JSON.parse(m.dosageOptions) as string[]).map((opt, i) => (
                                <span key={i} style={{ background: `${color}10`, color, borderRadius: 20, padding: '2px 9px', fontSize: '0.72rem', fontWeight: 700, border: `1px solid ${color}25` }}>
                                  {opt}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Instructions — show AR when lang is AR */}
                          {(m.instructions || m.instructionsAr) && (
                            <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', lineHeight: 1.5, marginTop: 4, display: '-webkit-box', overflow: 'hidden', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                              ℹ️ {lang === 'ar' && m.instructionsAr ? m.instructionsAr : m.instructions}
                            </div>
                          )}
                          {/* Pending badge */}
                          {m._pending && (
                            <div style={{ marginTop: 6, fontSize: '0.7rem', color: '#f59e0b', fontWeight: 700 }}>⏳ {lang === 'ar' ? 'في انتظار المزامنة' : 'Pending sync'}</div>
                          )}
                        </div>

                        {/* Action buttons */}
                        <div style={{ display: 'flex', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
                          {canDo('editMedicines') && (
                            <button className="med-action-btn" onClick={() => openEdit(m)}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                              {lang === 'ar' ? 'تعديل' : 'Edit'}
                            </button>
                          )}
                          {canDo('deleteMedicines') && m.isActive && (
                            <>
                              {canDo('editMedicines') && <div style={{ width: 1, background: 'var(--border)' }} />}
                              <button className="med-action-btn med-action-del" onClick={() => { setSelected(m); setModal('delete'); }}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
                                {lang === 'ar' ? 'حذف' : 'Delete'}
                              </button>
                            </>
                          )}
                          {!canDo('editMedicines') && !canDo('deleteMedicines') && (
                            <div style={{ padding: '9px', fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', flex: 1 }}>
                              {lang === 'ar' ? 'للعرض فقط' : 'View only'}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Create / Edit Modal ── */}
        {(modal === 'create' || modal === 'edit') && (
          <div className="modal-overlay" style={{ padding: '16px' }}>
            <div className="med-modal glass-card">
              <div className="modal-header" style={{ flexShrink: 0, borderBottom: '1px solid var(--border)', padding: '16px 20px' }}>
                <h2 className="modal-title" style={{ fontSize: '1rem' }}>
                  💉 {modal === 'edit' ? (lang === 'ar' ? 'تعديل الدواء' : 'Edit Medicine') : (lang === 'ar' ? 'إضافة دواء' : 'Add Medicine')}
                </h2>
                <button className="modal-close" onClick={() => setModal(null)}>✕</button>
              </div>

              <div className="med-modal-body">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

                  {/* Name */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label className="form-label">Name (EN) *</label>
                      <input className="form-input" placeholder="e.g. Amoxicillin" value={fName} onChange={e => setFName(e.target.value)} />
                    </div>
                    <div>
                      <label className="form-label">{lang === 'ar' ? 'الاسم بالعربية' : 'Name (AR)'}</label>
                      <input className="form-input" placeholder="e.g. أموكسيسيلين" value={fNameAr} onChange={e => setFNameAr(e.target.value)} dir="rtl" />
                    </div>
                  </div>

                  {/* Category */}
                  <div>
                    <label className="form-label">{lang === 'ar' ? 'الفئة' : 'Category'} *</label>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                      {PRESET_CATEGORIES.map(cat => (
                        <button key={cat} type="button" onClick={() => setFCategory(cat)} style={{ padding: '5px 12px', borderRadius: 20, border: `1.5px solid ${fCategory === cat ? catColor(cat) : 'var(--border)'}`, background: fCategory === cat ? `${catColor(cat)}15` : 'var(--bg-elevated)', color: fCategory === cat ? catColor(cat) : 'var(--text-sub)', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)', transition: 'all 0.14s' }}>
                          {catLabel(cat, lang)}
                        </button>
                      ))}
                      <button type="button" onClick={() => setFCategory('custom')} style={{ padding: '5px 12px', borderRadius: 20, border: `1.5px solid ${fCategory === 'custom' ? '#6366f1' : 'var(--border)'}`, background: fCategory === 'custom' ? 'rgba(99,102,241,0.1)' : 'var(--bg-elevated)', color: fCategory === 'custom' ? '#6366f1' : 'var(--text-sub)', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)', transition: 'all 0.14s' }}>
                        + {lang === 'ar' ? 'أخرى' : 'Custom'}
                      </button>
                    </div>
                    {fCategory === 'custom' && (
                      <input className="form-input" placeholder={lang === 'ar' ? 'اكتب فئة مخصصة...' : 'Enter custom category...'} value={fCategoryCustom} onChange={e => setFCategoryCustom(e.target.value)} />
                    )}
                  </div>

                  {/* Dosage options */}
                  <div>
                    <label className="form-label">{lang === 'ar' ? 'خيارات الجرعة' : 'Dosage Options'}</label>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                      <input className="form-input" placeholder={lang === 'ar' ? 'e.g. 250mg, 500mg...' : 'e.g. 250mg, 500mg...'} value={fDosageInput} onChange={e => setFDosageInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addDosageOpt())} style={{ flex: 1 }} />
                      <button type="button" className="btn btn-secondary" onClick={addDosageOpt} style={{ flexShrink: 0 }}>
                        {lang === 'ar' ? 'إضافة' : 'Add'}
                      </button>
                    </div>
                    {fDosageOpts.length > 0 && (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {fDosageOpts.map(opt => (
                          <span key={opt} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(5,150,105,0.08)', border: '1px solid rgba(5,150,105,0.2)', borderRadius: 20, padding: '4px 10px', fontSize: '0.8rem', color: '#059669', fontWeight: 600 }}>
                            {opt}
                            <button type="button" onClick={() => removeDosageOpt(opt)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#059669', lineHeight: 1, padding: 0, fontSize: '0.9rem' }}>×</button>
                          </span>
                        ))}
                      </div>
                    )}
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4 }}>
                      {lang === 'ar' ? 'اضغط Enter أو "إضافة" لإضافة كل جرعة' : 'Press Enter or "Add" to add each dosage option'}
                    </div>
                  </div>

                  {/* Instructions */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label className="form-label">{lang === 'ar' ? 'التعليمات (EN)' : 'Instructions (EN)'}</label>
                      <textarea className="form-input" rows={2} placeholder="e.g. Take with food" value={fInstructions} onChange={e => setFInstructions(e.target.value)} style={{ resize: 'vertical' }} />
                    </div>
                    <div>
                      <label className="form-label">{lang === 'ar' ? 'التعليمات (AR)' : 'Instructions (AR)'}</label>
                      <textarea className="form-input" rows={2} placeholder="e.g. تناول مع الطعام" value={fInstructionsAr} onChange={e => setFInstructionsAr(e.target.value)} dir="rtl" style={{ resize: 'vertical' }} />
                    </div>
                  </div>

                  {/* Active toggle (edit only) */}
                  {modal === 'edit' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--bg-elevated)', borderRadius: 10, border: '1px solid var(--border)' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', flex: 1, userSelect: 'none' }}>
                        <input type="checkbox" checked={fIsActive} onChange={e => setFIsActive(e.target.checked)} />
                        <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>
                          {fIsActive
                            ? (lang === 'ar' ? '✅ نشط — يظهر في قائمة الوصفات' : '✅ Active — appears in prescription picker')
                            : (lang === 'ar' ? '⛔ غير نشط — مخفي من الوصفات' : '⛔ Inactive — hidden from prescription picker')}
                        </span>
                      </label>
                    </div>
                  )}
                </div>
              </div>

              <div className="modal-footer" style={{ flexShrink: 0, borderTop: '1px solid var(--border)', padding: '14px 20px' }}>
                <button className="btn btn-secondary" onClick={() => setModal(null)}>
                  {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
                <button className="btn btn-primary" onClick={save} disabled={saving}>
                  {saving ? '⏳' : '💾'} {modal === 'edit' ? (lang === 'ar' ? 'حفظ' : 'Save Changes') : (lang === 'ar' ? 'إضافة' : 'Add Medicine')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Delete Confirmation ── */}
        {modal === 'delete' && selected && (
          <div className="modal-overlay" style={{ backdropFilter: 'blur(6px)', padding: '16px' }}>
            <div style={{ background: 'var(--bg-surface)', borderRadius: 22, width: '100%', maxWidth: 360, boxShadow: '0 24px 80px rgba(0,0,0,0.2)', overflow: 'hidden', animation: 'med-pop 0.22s ease' }}>
              <div style={{ height: 5, background: 'linear-gradient(90deg,#e53e5a,#ff6b81)' }} />
              <div style={{ padding: '28px 24px 24px', textAlign: 'center' }}>
                <div style={{ fontSize: '2.2rem', marginBottom: 10 }}>🗑️</div>
                <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 6 }}>
                  {lang === 'ar' ? 'حذف الدواء؟' : 'Remove Medicine?'}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.6, marginBottom: 18 }}>
                  <strong style={{ color: 'var(--text)' }}>{selected.name}</strong>
                  {lang === 'ar'
                    ? ' سيُخفى من قائمة الوصفات. يمكن استعادته لاحقاً.'
                    : ' will be hidden from the prescription picker. It can be restored later.'}
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => { setModal(null); setSelected(null); }} style={{ flex: 1, padding: 11, borderRadius: 12, border: '1.5px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', fontFamily: 'var(--font)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                    {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                  </button>
                  <button onClick={doDelete} disabled={deleting} style={{ flex: 1, padding: 11, borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#e53e5a,#c0392b)', color: '#fff', fontFamily: 'var(--font)', fontSize: 14, fontWeight: 700, cursor: deleting ? 'not-allowed' : 'pointer', opacity: deleting ? 0.7 : 1 }}>
                    {deleting ? '…' : (lang === 'ar' ? 'حذف' : 'Remove')}
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
