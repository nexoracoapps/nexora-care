'use client';

import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';

interface Medicine {
  id: string;
  name: string;
  nameAr?: string;
  category: string;
  dosageOptions: string;
  instructions?: string;
  instructionsAr?: string;
}

interface PrescriptionItem {
  id?: string;
  medicineId: string;
  medicine?: Medicine;
  dosage?: string;
  frequency?: string;
  duration?: string;
  notes?: string;
}

interface Prescription {
  id: string;
  customerId: string;
  customer: { id: string; name: string; phone?: string };
  appointmentId?: string;
  appointment?: { id: string; dateTime: string; service?: { name: string } };
  notes?: string;
  createdAt: string;
  items: PrescriptionItem[];
}

interface Customer { id: string; name: string; phone?: string; }

const FREQUENCIES = ['Once daily', 'Twice daily', 'Three times daily', 'Four times daily', 'Every 8 hours', 'Every 6 hours', 'As needed', 'At bedtime', 'With meals'];
const DURATIONS   = ['3 days', '5 days', '7 days', '10 days', '14 days', '1 month', '2 months', '3 months', 'Ongoing'];

function PrintPrescription({ prescription, onClose }: { prescription: Prescription; onClose: () => void }) {
  return (
    <div className="modal-overlay">
      <div className="modal modal-lg" style={{ maxWidth: 680 }}>
        <div className="modal-header" style={{ borderBottom: '2px solid var(--border)' }}>
          <h2 className="modal-title">🖨️ Prescription — {prescription.customer.name}</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary btn-sm" onClick={() => window.print()}>Print</button>
            <button className="modal-close" onClick={onClose}>✕</button>
          </div>
        </div>
        <div className="modal-body" id="print-area">
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Patient</div>
            <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{prescription.customer.name}</div>
            {prescription.customer.phone && <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{prescription.customer.phone}</div>}
          </div>
          {prescription.appointment && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Visit Date</div>
              <div style={{ fontWeight: 600 }}>{new Date(prescription.appointment.dateTime).toLocaleDateString('en-US', { dateStyle: 'long' })}</div>
              {prescription.appointment.service && <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{prescription.appointment.service.name}</div>}
            </div>
          )}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, marginBottom: 12 }}>
            <div style={{ fontWeight: 700, marginBottom: 12 }}>Prescribed Medicines</div>
            {prescription.items.map((item, i) => (
              <div key={i} style={{ background: 'var(--bg-elevated)', borderRadius: 10, padding: '12px 14px', marginBottom: 8, border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ fontWeight: 700 }}>{item.medicine?.name}</div>
                  {item.dosage && <span style={{ background: 'var(--rose-soft)', color: 'var(--rose)', borderRadius: 6, padding: '2px 8px', fontSize: '0.8rem', fontWeight: 600 }}>{item.dosage}</span>}
                </div>
                <div style={{ display: 'flex', gap: 16, marginTop: 4, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  {item.frequency && <span>📅 {item.frequency}</span>}
                  {item.duration  && <span>⏳ {item.duration}</span>}
                </div>
                {item.notes && <div style={{ marginTop: 6, fontSize: '0.82rem', fontStyle: 'italic', color: 'var(--text-muted)' }}>{item.notes}</div>}
                {item.medicine?.instructions && <div style={{ marginTop: 4, fontSize: '0.8rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.04)', borderRadius: 6, padding: '4px 8px' }}>ℹ️ {item.medicine.instructions}</div>}
              </div>
            ))}
          </div>
          {prescription.notes && (
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Doctor&apos;s Notes</div>
              <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>{prescription.notes}</div>
            </div>
          )}
          <div style={{ marginTop: 20, paddingTop: 12, borderTop: '1px solid var(--border)', fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'center' }}>
            Nexora Care · {new Date(prescription.createdAt).toLocaleDateString('en-US', { dateStyle: 'long' })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PrescriptionsPage() {
  const { user }          = useAuth();
  const { t, lang, isRTL } = useLanguage();

  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [medicines, setMedicines]         = useState<Medicine[]>([]);
  const [customers, setCustomers]         = useState<Customer[]>([]);
  const [loading, setLoading]             = useState(true);
  const [modal, setModal]                 = useState<'create' | 'view' | 'print' | null>(null);
  const [selected, setSelected]           = useState<Prescription | null>(null);
  const [search, setSearch]               = useState('');
  const [medSearch, setMedSearch]         = useState('');

  // Form state
  const [formCustomerId, setFormCustomerId] = useState('');
  const [formNotes, setFormNotes]           = useState('');
  const [formItems, setFormItems]           = useState<PrescriptionItem[]>([]);
  const [saving, setSaving]                 = useState(false);

  const headers = useCallback(() => ({ Authorization: `Bearer ${user?.token}` }), [user?.token]);

  const load = useCallback(async () => {
    if (!user?.token) return;
    setLoading(true);
    const [pRes, mRes, cRes] = await Promise.all([
      fetch('/api/prescriptions', { headers: headers() }),
      fetch('/api/medicines',     { headers: headers() }),
      fetch('/api/customers',     { headers: headers() }),
    ]);
    if (pRes.ok) setPrescriptions(await pRes.json());
    if (mRes.ok) setMedicines(await mRes.json());
    if (cRes.ok) setCustomers(await cRes.json());
    setLoading(false);
  }, [user?.token, headers]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setFormCustomerId('');
    setFormNotes('');
    setFormItems([]);
    setMedSearch('');
    setModal('create');
  };

  const addMedicine = (med: Medicine) => {
    if (formItems.find(i => i.medicineId === med.id)) return;
    const opts: string[] = JSON.parse(med.dosageOptions || '[]');
    setFormItems(prev => [...prev, { medicineId: med.id, medicine: med, dosage: opts[0] || '', frequency: 'Twice daily', duration: '7 days', notes: '' }]);
    setMedSearch('');
  };

  const removeItem = (idx: number) => setFormItems(prev => prev.filter((_, i) => i !== idx));
  const updateItem = (idx: number, field: string, value: string) =>
    setFormItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));

  const save = async () => {
    if (!formCustomerId) return toast.error('Select a patient');
    if (formItems.length === 0) return toast.error('Add at least one medicine');
    setSaving(true);
    try {
      const res = await fetch('/api/prescriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers() },
        body: JSON.stringify({ customerId: formCustomerId, notes: formNotes, items: formItems }),
      });
      if (!res.ok) throw new Error();
      toast.success('Prescription saved');
      setModal(null);
      load();
    } catch {
      toast.error('Failed to save prescription');
    } finally {
      setSaving(false);
    }
  };

  const deletePrescription = async (id: string) => {
    if (!confirm('Delete this prescription?')) return;
    const res = await fetch(`/api/prescriptions/${id}`, { method: 'DELETE', headers: headers() });
    if (res.ok) { toast.success('Deleted'); load(); }
  };

  const filtered = prescriptions.filter(p =>
    p.customer.name.toLowerCase().includes(search.toLowerCase()) ||
    p.items.some(i => i.medicine?.name.toLowerCase().includes(search.toLowerCase()))
  );

  const filteredMeds = medicines.filter(m =>
    m.name.toLowerCase().includes(medSearch.toLowerCase()) ||
    (m.nameAr && m.nameAr.includes(medSearch)) ||
    m.category.toLowerCase().includes(medSearch.toLowerCase())
  );

  const groupedMeds = filteredMeds.reduce<Record<string, Medicine[]>>((acc, m) => {
    if (!acc[m.category]) acc[m.category] = [];
    acc[m.category].push(m);
    return acc;
  }, {});

  return (
    <ProtectedRoute permKey="viewAppointments">
      <div className="page" dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="page-header">
          <div>
            <h1 className="page-title">💊 {lang === 'ar' ? 'الوصفات الطبية' : 'Prescriptions'}</h1>
            <p className="page-sub">{lang === 'ar' ? 'إدارة وصفات المرضى' : 'Manage patient prescriptions'}</p>
          </div>
          <button className="btn btn-primary" onClick={openCreate}>
            + {lang === 'ar' ? 'وصفة جديدة' : 'New Prescription'}
          </button>
        </div>

        <div className="glass-card" style={{ marginBottom: 16 }}>
          <input
            className="form-input"
            placeholder={lang === 'ar' ? 'ابحث بالاسم أو الدواء...' : 'Search by patient or medicine...'}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 72, borderRadius: 12 }} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">💊</div>
            <div className="empty-state-title">{lang === 'ar' ? 'لا توجد وصفات' : 'No prescriptions yet'}</div>
            <div className="empty-state-sub">{lang === 'ar' ? 'أنشئ وصفة جديدة للمريض' : 'Create a prescription for a patient visit'}</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.map(p => (
              <div key={p.id} className="glass-card" style={{ padding: '14px 18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                      <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{p.customer.name}</span>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        {new Date(p.createdAt).toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US', { dateStyle: 'medium' })}
                      </span>
                      {p.appointment?.service && (
                        <span style={{ background: 'var(--bg-elevated)', borderRadius: 6, padding: '2px 8px', fontSize: '0.75rem', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                          {p.appointment.service.name}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {p.items.map((item, i) => (
                        <span key={i} style={{ background: 'rgba(244,63,94,0.1)', color: 'var(--rose)', borderRadius: 20, padding: '2px 10px', fontSize: '0.78rem', fontWeight: 600, border: '1px solid rgba(244,63,94,0.2)' }}>
                          {item.medicine?.name} {item.dosage ? `· ${item.dosage}` : ''}
                        </span>
                      ))}
                    </div>
                    {p.notes && <div style={{ marginTop: 6, fontSize: '0.82rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>📝 {p.notes}</div>}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => { setSelected(p); setModal('view'); }}>👁</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => { setSelected(p); setModal('print'); }}>🖨️</button>
                    <button className="btn btn-ghost btn-sm" style={{ color: 'var(--rose)' }} onClick={() => deletePrescription(p.id)}>🗑</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create Modal */}
        {modal === 'create' && (
          <div className="modal-overlay">
            <div className="modal modal-lg" style={{ maxWidth: 760 }}>
              <div className="modal-header">
                <h2 className="modal-title">💊 {lang === 'ar' ? 'وصفة جديدة' : 'New Prescription'}</h2>
                <button className="modal-close" onClick={() => setModal(null)}>✕</button>
              </div>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

                {/* Patient selector */}
                <div className="form-group">
                  <label className="form-label">{lang === 'ar' ? 'المريض' : 'Patient'} *</label>
                  <select className="form-input" value={formCustomerId} onChange={e => setFormCustomerId(e.target.value)}>
                    <option value="">{lang === 'ar' ? '— اختر المريض —' : '— Select patient —'}</option>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.name}{c.phone ? ` · ${c.phone}` : ''}</option>)}
                  </select>
                </div>

                {/* Medicine search */}
                <div>
                  <label className="form-label">{lang === 'ar' ? 'إضافة دواء' : 'Add Medicine'}</label>
                  <input
                    className="form-input"
                    placeholder={lang === 'ar' ? 'ابحث عن دواء...' : 'Search medicines...'}
                    value={medSearch}
                    onChange={e => setMedSearch(e.target.value)}
                    style={{ marginBottom: 8 }}
                  />
                  {medSearch && (
                    <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 10, maxHeight: 240, overflowY: 'auto' }}>
                      {Object.entries(groupedMeds).map(([cat, meds]) => (
                        <div key={cat}>
                          <div style={{ padding: '6px 12px', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', background: 'rgba(255,255,255,0.03)' }}>{cat}</div>
                          {meds.map(m => (
                            <button key={m.id} onClick={() => addMedicine(m)} style={{ width: '100%', textAlign: 'left', padding: '8px 14px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text)' }}
                              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)') }
                              onMouseLeave={e => (e.currentTarget.style.background = 'none') }>
                              <span>{m.name} {m.nameAr ? <span style={{ color: 'var(--text-muted)', fontSize: '0.85em' }}>· {m.nameAr}</span> : null}</span>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>+</span>
                            </button>
                          ))}
                        </div>
                      ))}
                      {Object.keys(groupedMeds).length === 0 && <div style={{ padding: '12px 14px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>No medicines found</div>}
                    </div>
                  )}
                </div>

                {/* Selected medicines */}
                {formItems.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {lang === 'ar' ? 'الأدوية المختارة' : 'Selected Medicines'} ({formItems.length})
                    </div>
                    {formItems.map((item, idx) => {
                      const opts: string[] = JSON.parse(item.medicine?.dosageOptions || '[]');
                      return (
                        <div key={idx} style={{ background: 'var(--bg-elevated)', borderRadius: 12, padding: '12px 14px', border: '1px solid var(--border)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                            <span style={{ fontWeight: 700 }}>{item.medicine?.name}</span>
                            <button onClick={() => removeItem(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--rose)', fontSize: '0.85rem' }}>✕ Remove</button>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                            <div>
                              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>Dosage</label>
                              {opts.length > 0 ? (
                                <select className="form-input" style={{ fontSize: '0.82rem', padding: '5px 8px' }} value={item.dosage} onChange={e => updateItem(idx, 'dosage', e.target.value)}>
                                  {opts.map(o => <option key={o} value={o}>{o}</option>)}
                                </select>
                              ) : (
                                <input className="form-input" style={{ fontSize: '0.82rem', padding: '5px 8px' }} placeholder="e.g. 500mg" value={item.dosage || ''} onChange={e => updateItem(idx, 'dosage', e.target.value)} />
                              )}
                            </div>
                            <div>
                              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>Frequency</label>
                              <select className="form-input" style={{ fontSize: '0.82rem', padding: '5px 8px' }} value={item.frequency || ''} onChange={e => updateItem(idx, 'frequency', e.target.value)}>
                                <option value="">—</option>
                                {FREQUENCIES.map(f => <option key={f} value={f}>{f}</option>)}
                              </select>
                            </div>
                            <div>
                              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>Duration</label>
                              <select className="form-input" style={{ fontSize: '0.82rem', padding: '5px 8px' }} value={item.duration || ''} onChange={e => updateItem(idx, 'duration', e.target.value)}>
                                <option value="">—</option>
                                {DURATIONS.map(d => <option key={d} value={d}>{d}</option>)}
                              </select>
                            </div>
                          </div>
                          <div style={{ marginTop: 8 }}>
                            <input className="form-input" style={{ fontSize: '0.82rem' }} placeholder="Item notes (optional)" value={item.notes || ''} onChange={e => updateItem(idx, 'notes', e.target.value)} />
                          </div>
                          {item.medicine?.instructions && <div style={{ marginTop: 6, fontSize: '0.78rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.03)', borderRadius: 6, padding: '4px 8px' }}>ℹ️ {item.medicine.instructions}</div>}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Notes */}
                <div className="form-group">
                  <label className="form-label">{lang === 'ar' ? 'ملاحظات الطبيب' : "Doctor's Notes"}</label>
                  <textarea className="form-input" rows={3} placeholder={lang === 'ar' ? 'ملاحظات إضافية...' : 'Additional notes, follow-up instructions...'} value={formNotes} onChange={e => setFormNotes(e.target.value)} style={{ resize: 'vertical' }} />
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setModal(null)}>{t('cancel')}</button>
                <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? '⏳' : '💊'} {lang === 'ar' ? 'حفظ الوصفة' : 'Save Prescription'}</button>
              </div>
            </div>
          </div>
        )}

        {/* View Modal */}
        {modal === 'view' && selected && (
          <div className="modal-overlay">
            <div className="modal modal-lg">
              <div className="modal-header">
                <h2 className="modal-title">💊 {selected.customer.name}</h2>
                <button className="modal-close" onClick={() => setModal(null)}>✕</button>
              </div>
              <div className="modal-body">
                <div style={{ marginBottom: 14 }}>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    {new Date(selected.createdAt).toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US', { dateStyle: 'long' })}
                    {selected.appointment?.service && ` · ${selected.appointment.service.name}`}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {selected.items.map((item, i) => (
                    <div key={i} style={{ background: 'var(--bg-elevated)', borderRadius: 12, padding: '12px 14px', border: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <div>
                          <span style={{ fontWeight: 700 }}>{item.medicine?.name}</span>
                          {item.medicine?.nameAr && <span style={{ marginLeft: 8, fontSize: '0.85rem', color: 'var(--text-muted)' }}>{item.medicine.nameAr}</span>}
                        </div>
                        {item.dosage && <span style={{ background: 'var(--rose-soft)', color: 'var(--rose)', borderRadius: 6, padding: '2px 10px', fontSize: '0.8rem', fontWeight: 600 }}>{item.dosage}</span>}
                      </div>
                      <div style={{ display: 'flex', gap: 16, fontSize: '0.83rem', color: 'var(--text-muted)' }}>
                        {item.frequency && <span>📅 {item.frequency}</span>}
                        {item.duration  && <span>⏳ {item.duration}</span>}
                      </div>
                      {item.notes && <div style={{ marginTop: 6, fontSize: '0.82rem', fontStyle: 'italic', color: 'var(--text-muted)' }}>{item.notes}</div>}
                      {item.medicine?.instructions && <div style={{ marginTop: 6, fontSize: '0.8rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.04)', borderRadius: 6, padding: '4px 8px' }}>ℹ️ {item.medicine.instructions}</div>}
                    </div>
                  ))}
                </div>
                {selected.notes && (
                  <div style={{ marginTop: 16, background: 'var(--bg-elevated)', borderRadius: 10, padding: '12px 14px', border: '1px solid var(--border)' }}>
                    <div style={{ fontWeight: 700, marginBottom: 6 }}>📝 {lang === 'ar' ? 'ملاحظات الطبيب' : "Doctor's Notes"}</div>
                    <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>{selected.notes}</div>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setModal(null)}>{t('close')}</button>
                <button className="btn btn-primary" onClick={() => setModal('print')}>🖨️ Print</button>
              </div>
            </div>
          </div>
        )}

        {/* Print */}
        {modal === 'print' && selected && <PrintPrescription prescription={selected} onClose={() => setModal(null)} />}
      </div>
    </ProtectedRoute>
  );
}
