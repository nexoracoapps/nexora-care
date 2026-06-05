'use client';

import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { Pencil, Trash2 } from 'lucide-react';
import { swrGet, swrSet, swrBust } from '@/lib/swrCache';
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
  _pending?: boolean;
}

interface Customer { id: string; name: string; phone?: string; }

const FREQUENCIES = ['Once daily', 'Twice daily', 'Three times daily', 'Four times daily', 'Every 8 hours', 'Every 6 hours', 'As needed', 'At bedtime', 'With meals'];
const DURATIONS   = ['3 days', '5 days', '7 days', '10 days', '14 days', '1 month', '2 months', '3 months', 'Ongoing'];
const CATEGORY_AR: Record<string, string> = {
  'Pain Relief': 'مسكنات الألم', 'Antibiotic': 'مضادات حيوية',
  'Dermatology': 'أمراض جلدية', 'Antihistamine': 'مضادات الهيستامين',
  'Supplement': 'مكملات غذائية', 'Gastrointestinal': 'الجهاز الهضمي',
  'Skincare': 'العناية بالبشرة', 'General': 'عام',
};
function rxCatLabel(cat: string, lang: string) {
  if (cat === 'All') return lang === 'ar' ? 'الكل' : 'All';
  return lang === 'ar' ? (CATEGORY_AR[cat] || cat) : cat;
}

const FREQ_AR: Record<string, string> = {
  'Once daily': 'مرة يومياً', 'Twice daily': 'مرتين يومياً', 'Three times daily': 'ثلاث مرات يومياً',
  'Four times daily': 'أربع مرات يومياً', 'Every 8 hours': 'كل 8 ساعات', 'Every 6 hours': 'كل 6 ساعات',
  'As needed': 'عند الحاجة', 'At bedtime': 'عند النوم', 'With meals': 'مع الوجبات',
};
const DUR_AR: Record<string, string> = {
  '3 days': '3 أيام', '5 days': '5 أيام', '7 days': '7 أيام', '10 days': '10 أيام',
  '14 days': '14 يوم', '1 month': 'شهر', '2 months': 'شهران', '3 months': '3 أشهر', 'Ongoing': 'مستمر',
};

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

function PrintPrescription({ prescription, onClose, lang }: { prescription: Prescription; onClose: () => void; lang: string }) {
  const isAr = lang === 'ar';
  const dateLocale = isAr ? 'ar-SA' : 'en-US';

  const doPrint = () => {
    const win = window.open('', '_blank', 'width=820,height=700');
    if (!win) return;
    const items = prescription.items.map(item => {
      const instr = isAr && item.medicine?.instructionsAr ? item.medicine.instructionsAr : item.medicine?.instructions;
      return `
        <div class="med-row">
          <div class="med-header">
            <span class="med-name">${item.medicine?.name || ''}${item.medicine?.nameAr ? ` <span class="med-name-ar">${item.medicine.nameAr}</span>` : ''}</span>
            ${item.dosage ? `<span class="dosage-badge">${item.dosage}</span>` : ''}
          </div>
          <div class="med-meta">
            ${item.frequency ? `<span>📅 ${item.frequency}</span>` : ''}
            ${item.duration  ? `<span>⏳ ${item.duration}</span>`  : ''}
          </div>
          ${item.notes ? `<div class="med-notes">${item.notes}</div>` : ''}
          ${instr ? `<div class="med-instr">ℹ️ ${instr}</div>` : ''}
        </div>`;
    }).join('');

    win.document.write(`<!DOCTYPE html><html lang="${lang}" dir="${isAr ? 'rtl' : 'ltr'}">
<head>
  <meta charset="UTF-8">
  <title>${isAr ? 'وصفة طبية' : 'Prescription'} — ${prescription.customer.name}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans Arabic',sans-serif; color:#1a202c; background:#fff; padding:32px; font-size:14px; }
    .header { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:2px solid #e2e8f0; padding-bottom:16px; margin-bottom:20px; }
    .brand { font-size:1.3rem; font-weight:800; color:#1d4ed8; }
    .brand-sub { font-size:0.8rem; color:#64748b; margin-top:2px; }
    .rx-title { font-size:1.4rem; font-weight:800; color:#1e293b; }
    .rx-sub { font-size:0.85rem; color:#64748b; margin-top:3px; }
    .section { margin-bottom:18px; }
    .label { font-size:0.75rem; color:#94a3b8; font-weight:600; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:4px; }
    .value { font-weight:700; font-size:1rem; color:#1e293b; }
    .value-sub { font-size:0.85rem; color:#64748b; margin-top:2px; }
    .meds-title { font-weight:800; font-size:0.9rem; text-transform:uppercase; letter-spacing:0.05em; color:#475569; margin-bottom:12px; border-top:1px solid #e2e8f0; padding-top:16px; }
    .med-row { border:1px solid #e2e8f0; border-radius:8px; padding:12px 14px; margin-bottom:10px; background:#f8fafc; }
    .med-header { display:flex; justify-content:space-between; align-items:center; gap:8px; margin-bottom:5px; }
    .med-name { font-weight:700; font-size:0.95rem; }
    .med-name-ar { font-size:0.8rem; color:#64748b; margin-inline-start:6px; }
    .dosage-badge { background:#dbeafe; color:#1d4ed8; border-radius:6px; padding:2px 10px; font-size:0.8rem; font-weight:700; white-space:nowrap; }
    .med-meta { display:flex; gap:16px; font-size:0.83rem; color:#64748b; margin-bottom:4px; }
    .med-notes { font-size:0.82rem; font-style:italic; color:#64748b; margin-top:4px; }
    .med-instr { font-size:0.8rem; color:#64748b; background:#f1f5f9; border-radius:5px; padding:4px 8px; margin-top:5px; }
    .doctor-notes { border:1px solid #e2e8f0; border-radius:8px; padding:12px 14px; background:#fef9ec; margin-top:4px; }
    .doctor-notes-title { font-weight:700; font-size:0.88rem; color:#92400e; margin-bottom:6px; }
    .footer { border-top:1px solid #e2e8f0; padding-top:12px; margin-top:24px; text-align:center; font-size:0.75rem; color:#94a3b8; }
    @media print { body { padding:16px; } @page { margin:1.5cm; size:A4; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="brand">Nexora Care</div>
      <div class="brand-sub">${isAr ? 'وصفة طبية رسمية' : 'Official Medical Prescription'}</div>
    </div>
    <div style="text-align:${isAr ? 'left' : 'right'}">
      <div class="rx-title">${prescription.customer.name}</div>
      <div class="rx-sub">${prescription.customer.phone || ''}</div>
    </div>
  </div>

  ${prescription.appointment ? `
  <div class="section">
    <div class="label">${isAr ? 'تاريخ الزيارة' : 'Visit Date'}</div>
    <div class="value">${new Date(prescription.appointment.dateTime).toLocaleDateString(dateLocale, { dateStyle: 'long' })}</div>
    ${prescription.appointment.service ? `<div class="value-sub">${prescription.appointment.service.name}</div>` : ''}
  </div>` : ''}

  <div class="meds-title">${isAr ? 'الأدوية الموصوفة' : 'Prescribed Medicines'}</div>
  ${items}

  ${prescription.notes ? `
  <div class="doctor-notes">
    <div class="doctor-notes-title">📝 ${isAr ? 'ملاحظات الطبيب' : "Doctor's Notes"}</div>
    <div style="font-size:0.9rem;line-height:1.6;color:#1e293b">${prescription.notes}</div>
  </div>` : ''}

  <div class="footer">
    Nexora Care · ${new Date(prescription.createdAt).toLocaleDateString(dateLocale, { dateStyle: 'long' })}
  </div>
  <script>window.onload = function(){ window.print(); window.onafterprint = function(){ window.close(); }; }<\/script>
</body></html>`);
    win.document.close();
  };

  return (
    <div className="modal-overlay">
      <div className="modal modal-lg" style={{ maxWidth: 680 }}>
        <div className="modal-header" style={{ borderBottom: '2px solid var(--border)' }}>
          <h2 className="modal-title">🖨️ {isAr ? 'طباعة الوصفة' : 'Print Prescription'} — {prescription.customer.name}</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary btn-sm" onClick={doPrint}>{isAr ? 'طباعة' : 'Print'}</button>
            <button className="modal-close" onClick={onClose}>✕</button>
          </div>
        </div>
        <div className="modal-body">
          {/* Preview */}
          <div style={{ background: 'var(--bg-elevated)', borderRadius: 12, padding: '20px', border: '1px solid var(--border)', fontSize: '0.88rem' }}>
            <div style={{ fontWeight: 800, marginBottom: 12 }}>{prescription.customer.name}</div>
            {prescription.items.map((item, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: i < prescription.items.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <span style={{ fontWeight: 600 }}>{item.medicine?.name}</span>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>{item.dosage} · {item.frequency}</span>
              </div>
            ))}
            {prescription.notes && <div style={{ marginTop: 10, fontSize: '0.82rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>📝 {prescription.notes}</div>}
          </div>
          <p style={{ marginTop: 12, fontSize: '0.82rem', color: 'var(--text-muted)', textAlign: 'center' }}>
            {isAr ? 'سيُفتح نافذة الطباعة بصفحة وصفة نظيفة.' : 'Clicking Print opens a clean prescription page in a new window.'}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function PrescriptionsPage() {
  const { user }          = useAuth();
  const { t, lang, isRTL } = useLanguage();
  const { canDo }          = usePermissions();

  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [medicines, setMedicines]         = useState<Medicine[]>([]);
  const [customers, setCustomers]         = useState<Customer[]>([]);
  const [loading, setLoading]             = useState(true);
  const [modal, setModal]                 = useState<'create' | 'edit' | 'view' | 'print' | 'delete' | null>(null);
  const [selected, setSelected]           = useState<Prescription | null>(null);
  const [editTarget, setEditTarget]       = useState<Prescription | null>(null);
  const [deleteTarget, setDeleteTarget]   = useState<Prescription | null>(null);
  const [deleting, setDeleting]           = useState(false);
  const [search, setSearch]               = useState('');
  const [medSearch, setMedSearch]         = useState('');

  // Form state
  const [formCustomerId, setFormCustomerId] = useState('');
  const [formNotes, setFormNotes]           = useState('');
  const [formItems, setFormItems]           = useState<PrescriptionItem[]>([]);
  const [saving, setSaving]                 = useState(false);
  const [catFilter, setCatFilter]           = useState('All');

  const headers = useCallback(() => ({ Authorization: `Bearer ${user?.token}` }), [user?.token]);

  const load = useCallback(async () => {
    if (!user?.token) return;
    const ckP = '/api/prescriptions', ckM = '/api/medicines', ckC = '/api/customers';
    const staleP = swrGet<Prescription[]>(ckP), staleM = swrGet<Medicine[]>(ckM), staleC = swrGet<Customer[]>(ckC);
    if (staleP && staleM && staleC) { setPrescriptions(staleP); setMedicines(staleM); setCustomers(staleC); setLoading(false); } else setLoading(true);
    const [pRes, mRes, cRes] = await Promise.all([
      fetch(ckP, { headers: headers() }),
      fetch(ckM, { headers: headers() }),
      fetch(ckC, { headers: headers() }),
    ]);
    if (pRes.ok) { const d = await pRes.json(); setPrescriptions(d); swrSet(ckP, d); }
    if (mRes.ok) { const d = await mRes.json(); setMedicines(d); swrSet(ckM, d); }
    if (cRes.ok) { const d = await cRes.json(); setCustomers(d); swrSet(ckC, d); }
    setLoading(false);
  }, [user?.token, headers]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const handler = () => load();
    window.addEventListener('nexora-sync-complete', handler);
    return () => window.removeEventListener('nexora-sync-complete', handler);
  }, [load]);

  const openCreate = () => {
    setEditTarget(null);
    setFormCustomerId('');
    setFormNotes('');
    setFormItems([]);
    setMedSearch('');
    setCatFilter('All');
    setModal('create');
  };

  const openEdit = (p: Prescription) => {
    setEditTarget(p);
    setFormCustomerId(p.customerId);
    setFormNotes(p.notes || '');
    setFormItems(p.items.map(item => ({
      id: item.id,
      medicineId: item.medicineId,
      medicine: item.medicine,
      dosage: item.dosage || '',
      frequency: item.frequency || 'Twice daily',
      duration: item.duration || '7 days',
      notes: item.notes || '',
    })));
    setMedSearch('');
    setCatFilter('All');
    setModal('edit');
  };

  const toggleMedicine = (med: Medicine) => {
    const existing = formItems.find(i => i.medicineId === med.id);
    if (existing) {
      setFormItems(prev => prev.filter(i => i.medicineId !== med.id));
    } else {
      const opts: string[] = JSON.parse(med.dosageOptions || '[]');
      setFormItems(prev => [...prev, { medicineId: med.id, medicine: med, dosage: opts[0] || '', frequency: 'Twice daily', duration: '7 days', notes: '' }]);
    }
  };

  const removeItem = (idx: number) => setFormItems(prev => prev.filter((_, i) => i !== idx));
  const updateItem = (idx: number, field: string, value: string) =>
    setFormItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));

  const save = async () => {
    if (!formCustomerId) return toast.error(lang === 'ar' ? 'اختر مريضاً' : 'Select a patient');
    if (formItems.length === 0) return toast.error(lang === 'ar' ? 'أضف دواءً واحداً على الأقل' : 'Add at least one medicine');
    setSaving(true);
    try {
      const isEdit = modal === 'edit' && editTarget;
      const url = isEdit ? `/api/prescriptions/${editTarget.id}` : '/api/prescriptions';
      const method = isEdit ? 'PUT' : 'POST';
      const res = await queuedFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', ...headers() },
        body: JSON.stringify({ customerId: formCustomerId, notes: formNotes, items: formItems }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok && !data?.queued) throw new Error();
      if (data?.queued) {
        const optimistic: Prescription = {
          id: isEdit ? editTarget!.id : `pending-${Date.now()}`,
          customerId: formCustomerId,
          customer: customers.find(c => c.id === formCustomerId) || { id: formCustomerId, name: '—' },
          notes: formNotes,
          createdAt: new Date().toISOString(),
          items: formItems,
          _pending: true,
        };
        setPrescriptions(prev => isEdit
          ? prev.map(p => p.id === editTarget!.id ? optimistic : p)
          : [...prev, optimistic]);
        toast.success(lang === 'ar' ? '⏳ حُفظت مؤقتاً — ستُزامَن عند الاتصال' : '⏳ Saved locally — will sync when online');
      } else {
        toast.success(isEdit ? (lang === 'ar' ? 'تم تحديث الوصفة' : 'Prescription updated') : (lang === 'ar' ? 'تم حفظ الوصفة' : 'Prescription saved'));
        swrBust('/api/prescriptions');
        load();
      }
      setModal(null);
      setEditTarget(null);
    } catch {
      toast.error(lang === 'ar' ? 'فشل حفظ الوصفة' : 'Failed to save prescription');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (p: Prescription) => { setDeleteTarget(p); setModal('delete'); };

  const doDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const res = await queuedFetch(`/api/prescriptions/${deleteTarget.id}`, { method: 'DELETE', headers: headers() });
    const data = await res.json().catch(() => ({}));
    setDeleting(false);
    if (res.ok || data?.queued) {
      setPrescriptions(prev => prev.filter(p => p.id !== deleteTarget!.id));
      toast.success(data?.queued
        ? (lang === 'ar' ? '⏳ حُذف مؤقتاً — سيُزامَن عند الاتصال' : '⏳ Removed locally — will sync when online')
        : (lang === 'ar' ? 'تم الحذف' : 'Deleted'));
      setModal(null); setDeleteTarget(null);
      if (!data?.queued) { swrBust('/api/prescriptions'); load(); }
    } else toast.error(lang === 'ar' ? 'فشل الحذف' : 'Failed to delete');
  };

  const filtered = prescriptions.filter(p =>
    !search ||
    p.customer.name.toLowerCase().includes(search.toLowerCase()) ||
    p.items.some(i => i.medicine?.name.toLowerCase().includes(search.toLowerCase()))
  );

  // Medicine picker data
  const categories = ['All', ...Array.from(new Set(medicines.map(m => m.category)))];
  const visibleMeds = medicines.filter(m => {
    const matchCat = catFilter === 'All' || m.category === catFilter;
    const matchSearch = !medSearch || m.name.toLowerCase().includes(medSearch.toLowerCase()) || (m.nameAr && m.nameAr.includes(medSearch));
    return matchCat && matchSearch;
  });
  const groupedVisible = visibleMeds.reduce<Record<string, Medicine[]>>((acc, m) => {
    const cat = catFilter === 'All' ? m.category : catFilter;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(m);
    return acc;
  }, {});

  return (
    <ProtectedRoute permKey="viewPrescriptions">
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes rx-pop { from { opacity:0; transform:scale(0.92) translateY(18px); } to { opacity:1; transform:scale(1) translateY(0); } }
        .rx-card { transition: transform 0.18s, box-shadow 0.18s; }
        .rx-card:hover { transform: translateY(-3px); box-shadow: 0 12px 40px rgba(0,0,0,0.13); }
        .rx-action-btn { flex:1; padding:10px; border:none; background:transparent; cursor:pointer; font-size:13px; font-weight:600; display:flex; align-items:center; justify-content:center; gap:5px; transition:background 0.15s, color 0.15s; font-family:var(--font); }
        .rx-action-view { color: var(--text-sub); }
        .rx-action-view:hover { background: var(--bg-elevated); color: var(--text); }
        .rx-action-del { color: #e53e5a; }
        .rx-action-del:hover { background: rgba(229,62,90,0.06); }
        .rx-med-row { display:flex; align-items:center; gap:10px; padding:8px 12px; border-radius:8px; cursor:pointer; transition:background 0.1s; }
        .rx-med-row:hover { background: rgba(255,255,255,0.06); }
        .rx-med-row.selected { background: rgba(124,58,237,0.1); }
        .rx-cat-btn { padding:5px 12px; border-radius:20px; border:1.5px solid var(--border); background:var(--bg-elevated); font-size:0.75rem; font-weight:700; cursor:pointer; font-family:var(--font); color:var(--text-sub); transition:all 0.15s; white-space:nowrap; }
        .rx-cat-btn.active { border-color:#7c3aed; background:rgba(124,58,237,0.1); color:#7c3aed; }
        .rx-create-modal { display:flex; flex-direction:column; max-height:calc(100vh - 60px); overflow:hidden; width:100%; max-width:860px; }
        .rx-modal-body { flex:1; overflow-y:auto; min-height:0; padding:20px; }
        .rx-two-col { display:grid; grid-template-columns:1fr 1.1fr; gap:20px; align-items:start; }
        .rx-med-list { border:1px solid var(--border); border-radius:12px; overflow-y:auto; background:var(--bg-elevated); }
        @media(max-width:700px){
          .rx-two-col { grid-template-columns:1fr !important; }
          .rx-create-modal { max-height:calc(100vh - 40px); border-radius:16px !important; }
          .rx-dosage-right { max-height:320px; overflow-y:auto; }
        }
        @media(max-height:700px){
          .rx-med-list { max-height:160px !important; }
        }
      `}} />

      <div dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="page-header">
          <div>
            <h1 className="page-title">💊 {lang === 'ar' ? 'الوصفات الطبية' : 'Prescriptions'}</h1>
            <p className="page-sub">{filtered.length} {lang === 'ar' ? 'وصفة' : 'prescriptions'}</p>
          </div>
          {canDo('createPrescriptions') && (
            <button className="btn btn-primary" onClick={openCreate}>
              + {lang === 'ar' ? 'وصفة جديدة' : 'New Prescription'}
            </button>
          )}
        </div>

        {/* Search */}
        <div style={{ marginBottom: 20 }}>
          <div className="search-wrap">
            <span className="search-icon">🔍</span>
            <input
              className="search-input"
              placeholder={lang === 'ar' ? 'ابحث بالاسم أو الدواء...' : 'Search by patient or medicine...'}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Cards grid */}
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 18 }}>
            {[1,2,3,4,5,6].map(i => <div key={i} className="skeleton" style={{ height: 220, borderRadius: 16 }} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">💊</div>
            <div className="empty-state-title">{lang === 'ar' ? 'لا توجد وصفات' : 'No prescriptions yet'}</div>
            <div className="empty-state-sub">{lang === 'ar' ? 'أنشئ وصفة جديدة للمريض' : 'Create a prescription for a patient visit'}</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 18 }}>
            {filtered.map(p => {
              const grad = nameToGradient(p.customer.name);
              return (
                <div key={p.id} className="glass-card rx-card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                  {/* Gradient banner */}
                  <div style={{ position: 'relative', height: 96, background: grad, display: 'flex', alignItems: 'center', padding: '0 18px', gap: 14, flexShrink: 0 }}>
                    <div style={{
                      width: 56, height: 56, borderRadius: '50%',
                      background: 'rgba(255,255,255,0.25)', backdropFilter: 'blur(6px)',
                      border: '2.5px solid rgba(255,255,255,0.6)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '1.3rem', fontWeight: 800, color: '#fff',
                      boxShadow: '0 4px 16px rgba(0,0,0,0.12)', letterSpacing: '-1px', flexShrink: 0,
                    }}>
                      {p.customer.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '1rem', color: '#fff', textShadow: '0 1px 4px rgba(0,0,0,0.18)' }}>
                        {p.customer.name}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.82)', marginTop: 2 }}>
                        {new Date(p.createdAt).toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US', { dateStyle: 'medium' })}
                        {p.appointment?.service && ` · ${p.appointment.service.name}`}
                      </div>
                    </div>
                    {/* Rx badge — "Rx" = وصفة طبية */}
                    <div style={{ position: 'absolute', top: 10, insetInlineEnd: 12, background: 'rgba(0,0,0,0.22)', backdropFilter: 'blur(6px)', borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700, color: '#fff' }}>
                      💊 {lang === 'ar' ? 'وصفة' : 'Rx'}
                    </div>
                    {p._pending && (
                      <div style={{ position: 'absolute', bottom: 8, insetInlineEnd: 12, background: 'rgba(245,158,11,0.85)', borderRadius: 20, padding: '2px 8px', fontSize: 10, fontWeight: 700, color: '#fff' }}>
                        ⏳ {lang === 'ar' ? 'مؤقت' : 'Pending'}
                      </div>
                    )}
                  </div>

                  {/* Body */}
                  <div style={{ padding: '12px 16px', flex: 1 }}>
                    {/* Medicine pills */}
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: p.notes ? 8 : 0 }}>
                      {p.items.slice(0, 4).map((item, i) => {
                        const primaryName = lang === 'ar' && item.medicine?.nameAr ? item.medicine.nameAr : item.medicine?.name;
                        const secondaryName = lang === 'ar' ? item.medicine?.name : item.medicine?.nameAr;
                        return (
                          <span key={i} style={{ background: 'rgba(124,58,237,0.1)', color: '#7c3aed', borderRadius: 12, padding: '4px 10px', fontSize: '0.75rem', fontWeight: 600, border: '1px solid rgba(124,58,237,0.2)', display: 'inline-block', lineHeight: 1.4 }}>
                            <span style={{ display: 'block' }}>{primaryName}{item.dosage ? ` · ${item.dosage}` : ''}</span>
                            {secondaryName && <span style={{ display: 'block', fontSize: '0.65rem', opacity: 0.6, fontWeight: 500 }}>{secondaryName}</span>}
                          </span>
                        );
                      })}
                      {p.items.length > 4 && (
                        <span style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)', borderRadius: 20, padding: '3px 10px', fontSize: '0.75rem', fontWeight: 600, border: '1px solid var(--border)' }}>
                          +{p.items.length - 4} {lang === 'ar' ? 'أخرى' : 'more'}
                        </span>
                      )}
                    </div>
                    {/* Doctor notes */}
                    {p.notes && (
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: 4, lineHeight: 1.5,
                        overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                        📝 {p.notes}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', borderTop: '1px solid var(--border)' }}>
                    <button className="rx-action-btn rx-action-view" onClick={() => { setSelected(p); setModal('view'); }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                      {lang === 'ar' ? 'عرض' : 'View'}
                    </button>
                    {canDo('editPrescriptions') && (
                      <>
                        <div style={{ width: 1, background: 'var(--border)' }} />
                        <button className="rx-action-btn rx-action-view" onClick={() => openEdit(p)}>
                          <Pencil size={13} style={{ flexShrink: 0 }} />
                          {lang === 'ar' ? 'تعديل' : 'Edit'}
                        </button>
                      </>
                    )}
                    <div style={{ width: 1, background: 'var(--border)' }} />
                    <button className="rx-action-btn rx-action-view" onClick={() => { setSelected(p); setModal('print'); }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                      {lang === 'ar' ? 'طباعة' : 'Print'}
                    </button>
                    {canDo('deletePrescriptions') && (
                      <>
                        <div style={{ width: 1, background: 'var(--border)' }} />
                        <button className="rx-action-btn rx-action-del" onClick={() => confirmDelete(p)}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
                          {lang === 'ar' ? 'حذف' : 'Delete'}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Create / Edit Modal ── */}
        {(modal === 'create' || modal === 'edit') && (
          <div className="modal-overlay" style={{ alignItems: 'center', padding: '16px' }}>
            <div className="rx-create-modal glass-card" style={{ borderRadius: 20, boxShadow: '0 24px 64px rgba(0,0,0,0.35)' }}>
              {/* Header — fixed */}
              <div className="modal-header" style={{ flexShrink: 0, borderBottom: '1px solid var(--border)', padding: '16px 20px' }}>
                <h2 className="modal-title" style={{ fontSize: '1rem' }}>
                  💊 {modal === 'edit'
                    ? (lang === 'ar' ? 'تعديل الوصفة' : 'Edit Prescription')
                    : (lang === 'ar' ? 'وصفة جديدة' : 'New Prescription')}
                </h2>
                <button className="modal-close" onClick={() => setModal(null)}>✕</button>
              </div>

              {/* Scrollable body */}
              <div className="rx-modal-body">
                <div className="rx-two-col">

                  {/* LEFT: Patient + Medicine picker + Notes */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {/* Patient */}
                    <div>
                      <label className="form-label">{lang === 'ar' ? 'المريض' : 'Patient'} *</label>
                      <select className="form-input" value={formCustomerId} onChange={e => setFormCustomerId(e.target.value)}>
                        <option value="">{lang === 'ar' ? '— اختر المريض —' : '— Select patient —'}</option>
                        {customers.map(c => <option key={c.id} value={c.id}>{c.name}{c.phone ? ` · ${c.phone}` : ''}</option>)}
                      </select>
                    </div>

                    {/* Medicine picker */}
                    <div>
                      <label className="form-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span>{lang === 'ar' ? 'اختيار الأدوية' : 'Select Medicines'}</span>
                        {formItems.length > 0 && (
                          <span style={{ background: '#7c3aed', color: '#fff', borderRadius: 10, padding: '1px 9px', fontSize: '0.72rem', fontWeight: 700 }}>
                            {formItems.length} {lang === 'ar' ? 'مختار' : 'selected'}
                          </span>
                        )}
                      </label>

                      {/* Search */}
                      <div className="search-wrap" style={{ marginBottom: 8 }}>
                        <span className="search-icon">🔍</span>
                        <input className="search-input" placeholder={lang === 'ar' ? 'ابحث عن دواء...' : 'Search medicines...'} value={medSearch} onChange={e => setMedSearch(e.target.value)} />
                      </div>

                      {/* Category chips */}
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 8 }}>
                        {categories.map(cat => (
                          <button key={cat} className={`rx-cat-btn${catFilter === cat ? ' active' : ''}`} onClick={() => setCatFilter(cat)}>
                            {rxCatLabel(cat, lang)}
                          </button>
                        ))}
                      </div>

                      {/* Scrollable medicine list */}
                      <div className="rx-med-list" style={{ maxHeight: 220 }}>
                        {Object.entries(groupedVisible).length === 0 ? (
                          <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                            {lang === 'ar' ? 'لا توجد أدوية' : 'No medicines found'}
                          </div>
                        ) : Object.entries(groupedVisible).map(([cat, meds]) => (
                          <div key={cat}>
                            {catFilter === 'All' && (
                              <div style={{
                                padding: '6px 12px', fontSize: '0.65rem', fontWeight: 800,
                                color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.08em',
                                background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)',
                                borderTop: '1px solid var(--border)',
                                position: 'sticky', top: 0, zIndex: 10,
                                display: 'flex', alignItems: 'center', gap: 6,
                              }}>
                                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#7c3aed', flexShrink: 0, display: 'inline-block' }} />
                                {rxCatLabel(cat, lang)}
                              </div>
                            )}
                            {meds.map(m => {
                              const isChecked = formItems.some(i => i.medicineId === m.id);
                              const primaryName = lang === 'ar' && m.nameAr ? m.nameAr : m.name;
                              const secondaryName = lang === 'ar' ? m.name : m.nameAr;
                              return (
                                <div
                                  key={m.id}
                                  className={`rx-med-row${isChecked ? ' selected' : ''}`}
                                  onClick={() => toggleMedicine(m)}
                                  style={{ borderLeft: isChecked ? '3px solid #7c3aed' : '3px solid transparent' }}
                                >
                                  <div style={{ width: 18, height: 18, borderRadius: 5, flexShrink: 0, border: `2px solid ${isChecked ? '#7c3aed' : 'var(--border)'}`, background: isChecked ? '#7c3aed' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.12s' }}>
                                    {isChecked && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round"><path d="M20 6 9 17l-5-5"/></svg>}
                                  </div>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: '0.85rem', fontWeight: isChecked ? 700 : 600, color: isChecked ? '#7c3aed' : 'var(--text)', lineHeight: 1.3 }}>{primaryName}</div>
                                    {secondaryName && <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 1, fontStyle: 'italic' }}>{secondaryName}</div>}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Doctor's Notes */}
                    <div>
                      <label className="form-label">{lang === 'ar' ? 'ملاحظات الطبيب' : "Doctor's Notes"}</label>
                      <textarea className="form-input" rows={2} placeholder={lang === 'ar' ? 'ملاحظات، تعليمات المتابعة...' : 'Notes, follow-up instructions...'} value={formNotes} onChange={e => setFormNotes(e.target.value)} style={{ resize: 'vertical', minHeight: 60 }} />
                    </div>
                  </div>

                  {/* RIGHT: Dosage config for selected meds */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>
                      {lang === 'ar' ? 'تفاصيل الجرعة' : 'Dosage Details'}
                    </div>

                    {formItems.length === 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--text-muted)', padding: '32px 16px', border: '2px dashed var(--border)', borderRadius: 12 }}>
                        <span style={{ fontSize: '1.8rem' }}>💊</span>
                        <span style={{ fontSize: '0.82rem', textAlign: 'center' }}>{lang === 'ar' ? 'اختر الأدوية من القائمة' : 'Tick medicines on the left to configure dosage'}</span>
                      </div>
                    ) : (
                      <div className="rx-dosage-right" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {formItems.map((item, idx) => {
                          const opts: string[] = JSON.parse(item.medicine?.dosageOptions || '[]');
                          return (
                            <div key={idx} style={{ background: 'var(--bg-elevated)', borderRadius: 12, padding: '11px 13px', border: '1px solid var(--border)', animation: 'rx-pop 0.18s ease' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 9, alignItems: 'center', gap: 8 }}>
                                <div style={{ minWidth: 0 }}>
                                  <div style={{ fontWeight: 700, fontSize: '0.88rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {lang === 'ar' && item.medicine?.nameAr ? item.medicine.nameAr : item.medicine?.name}
                                  </div>
                                  {(lang === 'ar' ? item.medicine?.name : item.medicine?.nameAr) && (
                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{lang === 'ar' ? item.medicine?.name : item.medicine?.nameAr}</div>
                                  )}
                                </div>
                                <button onClick={() => removeItem(idx)} style={{ flexShrink: 0, background: 'rgba(229,62,90,0.08)', border: '1px solid rgba(229,62,90,0.2)', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', color: '#e53e5a', fontSize: '0.72rem', fontWeight: 700, fontFamily: 'var(--font)' }}>
                                  ✕
                                </button>
                              </div>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                                <div>
                                  <label style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block', marginBottom: 3, fontWeight: 700 }}>{lang === 'ar' ? 'الجرعة' : 'Dosage'}</label>
                                  {opts.length > 0 ? (
                                    <select className="form-input" style={{ fontSize: '0.8rem', padding: '5px 6px' }} value={item.dosage} onChange={e => updateItem(idx, 'dosage', e.target.value)}>
                                      {opts.map(o => <option key={o} value={o}>{o}</option>)}
                                    </select>
                                  ) : (
                                    <input className="form-input" style={{ fontSize: '0.8rem', padding: '5px 6px' }} placeholder="500mg" value={item.dosage || ''} onChange={e => updateItem(idx, 'dosage', e.target.value)} />
                                  )}
                                </div>
                                <div>
                                  <label style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block', marginBottom: 3, fontWeight: 700 }}>{lang === 'ar' ? 'التكرار' : 'Frequency'}</label>
                                  <select className="form-input" style={{ fontSize: '0.8rem', padding: '5px 6px' }} value={item.frequency || ''} onChange={e => updateItem(idx, 'frequency', e.target.value)}>
                                    <option value="">—</option>
                                    {FREQUENCIES.map(f => <option key={f} value={f}>{lang === 'ar' ? (FREQ_AR[f] || f) : f}</option>)}
                                  </select>
                                </div>
                                <div>
                                  <label style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block', marginBottom: 3, fontWeight: 700 }}>{lang === 'ar' ? 'المدة' : 'Duration'}</label>
                                  <select className="form-input" style={{ fontSize: '0.8rem', padding: '5px 6px' }} value={item.duration || ''} onChange={e => updateItem(idx, 'duration', e.target.value)}>
                                    <option value="">—</option>
                                    {DURATIONS.map(d => <option key={d} value={d}>{lang === 'ar' ? (DUR_AR[d] || d) : d}</option>)}
                                  </select>
                                </div>
                              </div>
                              <div style={{ marginTop: 6 }}>
                                <input className="form-input" style={{ fontSize: '0.8rem' }} placeholder={lang === 'ar' ? 'ملاحظات (اختياري)' : 'Notes (optional)'} value={item.notes || ''} onChange={e => updateItem(idx, 'notes', e.target.value)} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Footer — fixed */}
              <div className="modal-footer" style={{ flexShrink: 0, borderTop: '1px solid var(--border)', padding: '14px 20px' }}>
                <button className="btn btn-secondary" onClick={() => setModal(null)}>{t('cancel')}</button>
                <button className="btn btn-primary" onClick={save} disabled={saving}>
                  {saving ? '⏳' : '💊'} {modal === 'edit' ? (lang === 'ar' ? 'حفظ التعديلات' : 'Save Changes') : (lang === 'ar' ? 'حفظ الوصفة' : 'Save Prescription')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── View Modal ── */}
        {modal === 'view' && selected && (
          <div className="modal-overlay">
            <div className="modal modal-lg" style={{ maxWidth: 640 }}>
              <div className="modal-header" style={{ borderBottom: '1px solid var(--border)', background: nameToGradient(selected.customer.name), borderRadius: '16px 16px 0 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 46, height: 46, borderRadius: '50%', background: 'rgba(255,255,255,0.25)', backdropFilter: 'blur(6px)', border: '2px solid rgba(255,255,255,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', fontWeight: 800, color: '#fff', letterSpacing: '-1px' }}>
                    {selected.customer.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h2 className="modal-title" style={{ color: '#fff', textShadow: '0 1px 4px rgba(0,0,0,0.2)', margin: 0, fontSize: '1.05rem' }}>💊 {selected.customer.name}</h2>
                    <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.82)' }}>
                      {new Date(selected.createdAt).toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US', { dateStyle: 'long' })}
                      {selected.appointment?.service && ` · ${selected.appointment.service.name}`}
                    </div>
                  </div>
                </div>
                <button className="modal-close" style={{ color: '#fff' }} onClick={() => setModal(null)}>✕</button>
              </div>
              <div className="modal-body">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {selected.items.map((item, i) => (
                    <div key={i} style={{ background: 'var(--bg-elevated)', borderRadius: 12, padding: '12px 14px', border: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <div>
                          <span style={{ fontWeight: 700 }}>
                          {lang === 'ar' && item.medicine?.nameAr ? item.medicine.nameAr : item.medicine?.name}
                        </span>
                          {(lang === 'ar' ? item.medicine?.name : item.medicine?.nameAr) && (
                            <span style={{ marginInlineStart: 8, fontSize: '0.85rem', color: 'var(--text-muted)' }}>{lang === 'ar' ? item.medicine?.name : item.medicine?.nameAr}</span>
                          )}
                        </div>
                        {item.dosage && <span style={{ background: 'rgba(124,58,237,0.1)', color: '#7c3aed', borderRadius: 6, padding: '2px 10px', fontSize: '0.8rem', fontWeight: 600, border: '1px solid rgba(124,58,237,0.2)' }}>{item.dosage}</span>}
                      </div>
                      <div style={{ display: 'flex', gap: 16, fontSize: '0.83rem', color: 'var(--text-muted)' }}>
                        {item.frequency && <span>📅 {item.frequency}</span>}
                        {item.duration  && <span>⏳ {item.duration}</span>}
                      </div>
                      {item.notes && <div style={{ marginTop: 6, fontSize: '0.82rem', fontStyle: 'italic', color: 'var(--text-muted)' }}>{item.notes}</div>}
                    </div>
                  ))}
                </div>
                {selected.notes && (
                  <div style={{ marginTop: 14, background: 'rgba(124,58,237,0.06)', borderRadius: 12, padding: '14px 16px', border: '1px solid rgba(124,58,237,0.15)' }}>
                    <div style={{ fontWeight: 700, marginBottom: 6, color: '#7c3aed', fontSize: '0.88rem' }}>📝 {lang === 'ar' ? 'ملاحظات الطبيب' : "Doctor's Notes"}</div>
                    <div style={{ fontSize: '0.9rem', color: 'var(--text)', lineHeight: 1.6 }}>{selected.notes}</div>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setModal(null)}>{t('close')}</button>
                <button className="btn btn-primary" onClick={() => setModal('print')}>🖨️ {lang === 'ar' ? 'طباعة' : 'Print'}</button>
              </div>
            </div>
          </div>
        )}

        {/* Print */}
        {modal === 'print' && selected && <PrintPrescription prescription={selected} onClose={() => setModal(null)} lang={lang} />}

        {/* ── Delete Confirmation ── */}
        {modal === 'delete' && deleteTarget && (
          <div className="modal-overlay" style={{ backdropFilter: 'blur(6px)' }}>
            <div style={{ background: 'var(--bg-surface)', borderRadius: 24, width: '100%', maxWidth: 380, boxShadow: '0 24px 80px rgba(0,0,0,0.18), 0 0 0 1px rgba(229,62,90,0.12)', overflow: 'hidden', animation: 'del-pop 0.22s cubic-bezier(.34,1.56,.64,1)' }}>
              <style dangerouslySetInnerHTML={{ __html: `@keyframes del-pop { from { opacity:0; transform:scale(0.88) translateY(16px); } to { opacity:1; transform:scale(1) translateY(0); } }` }} />
              <div style={{ height: 5, background: 'linear-gradient(90deg,#e53e5a,#ff6b81)' }} />
              <div style={{ padding: '28px 24px 24px', textAlign: 'center' }}>
                <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center' }}><Trash2 size={48} strokeWidth={1.5} style={{ color: '#e53e5a' }} /></div>
                <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 6 }}>
                  {lang === 'ar' ? 'حذف الوصفة؟' : 'Delete Prescription?'}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.6, marginBottom: 20 }}>
                  {lang === 'ar' ? `وصفة ${deleteTarget.customer.name} سيتم حذفها نهائياً` : `Prescription for ${deleteTarget.customer.name} will be permanently deleted.`}
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => { setModal(null); setDeleteTarget(null); }} style={{ flex: 1, padding: 11, borderRadius: 12, border: '1.5px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', fontFamily: 'var(--font)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                    {t('cancel')}
                  </button>
                  <button onClick={doDelete} disabled={deleting} style={{ flex: 1, padding: 11, borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#e53e5a,#c0392b)', color: '#fff', fontFamily: 'var(--font)', fontSize: 14, fontWeight: 700, cursor: deleting ? 'not-allowed' : 'pointer', opacity: deleting ? 0.7 : 1 }}>
                    {deleting ? '…' : (lang === 'ar' ? 'حذف' : 'Delete')}
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
