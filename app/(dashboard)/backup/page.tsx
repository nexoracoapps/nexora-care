'use client';

import { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';

interface BackupPreview {
  exportedAt?: string;
  version?: string;
  counts: {
    branches: number;
    services: number;
    providers: number;
    customers: number;
    appointments: number;
    absences: number;
    callLogs: number;
  };
  raw: any;
}

const COUNT_LABELS: { key: keyof BackupPreview['counts']; icon: string; en: string; ar: string }[] = [
  { key: 'branches',     icon: '🏢', en: 'Branches',     ar: 'الفروع' },
  { key: 'services',     icon: '🛠', en: 'Services',     ar: 'الخدمات' },
  { key: 'providers',    icon: '👨‍⚕️', en: 'Providers',    ar: 'مقدمو الخدمة' },
  { key: 'customers',    icon: '👥', en: 'Customers',    ar: 'العملاء' },
  { key: 'appointments', icon: '📅', en: 'Appointments', ar: 'المواعيد' },
  { key: 'absences',     icon: '📆', en: 'Absences',     ar: 'الغيابات' },
  { key: 'callLogs',     icon: '📞', en: 'Call Logs',    ar: 'سجلات المكالمات' },
];

export default function BackupPage() {
  const { user } = useAuth();
  const { isRTL } = useLanguage();
  const [exporting,  setExporting]  = useState(false);
  const [importing,  setImporting]  = useState(false);
  const [preview,    setPreview]    = useState<BackupPreview | null>(null);
  const importFileRef = useRef<HTMLInputElement>(null);

  const exportData = async () => {
    setExporting(true);
    try {
      const res = await fetch('/api/backup', {
        headers: { Authorization: `Bearer ${user?.token}` },
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nexora-care-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(isRTL ? 'تم التصدير بنجاح!' : 'Backup exported successfully!');
    } catch {
      toast.error(isRTL ? 'فشل التصدير' : 'Export failed');
    }
    setExporting(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const parsed = JSON.parse(ev.target?.result as string);
        const data = parsed.data ?? parsed;
        setPreview({
          exportedAt: parsed.exportedAt,
          version:    parsed.version,
          counts: {
            branches:     (data.branches     ?? []).length,
            services:     (data.services     ?? []).length,
            providers:    (data.providers    ?? []).length,
            customers:    (data.customers    ?? []).length,
            appointments: (data.appointments ?? []).length,
            absences:     (data.absences     ?? []).length,
            callLogs:     (data.callLogs     ?? []).length,
          },
          raw: parsed,
        });
      } catch {
        toast.error(isRTL ? 'ملف JSON غير صالح' : 'Invalid JSON file');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const confirmImport = async () => {
    if (!preview || !user?.token) return;
    setImporting(true);
    try {
      const res = await fetch('/api/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.token}` },
        body: JSON.stringify(preview.raw),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Import failed');

      const r = data.restored;
      toast.success(
        isRTL
          ? `تم الاستيراد: ${r.customers} عميل، ${r.appointments} موعد، ${r.services} خدمة`
          : `Imported: ${r.customers} customers, ${r.appointments} appointments, ${r.services} services`
      );
      setPreview(null);
    } catch (e: any) {
      toast.error(e.message ?? (isRTL ? 'فشل الاستيراد' : 'Import failed'));
    }
    setImporting(false);
  };

  return (
    <ProtectedRoute adminOnly permKey="systemBackup">
      <div>
        <div className="page-header">
          <div>
            <h1 className="page-title">{isRTL ? 'النسخ الاحتياطي والبيانات' : 'Backup & Data'}</h1>
            <p className="page-sub">{isRTL ? 'تصدير واستيراد بيانات النظام' : 'Export and import your system data'}</p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>

          {/* Export */}
          <div className="glass-card" style={{ padding: 28 }}>
            <div style={{ width: 52, height: 52, borderRadius: 14, background: 'var(--grad-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--rose)', fontSize: '1.5rem', marginBottom: 16 }}>💾</div>
            <h2 style={{ fontFamily: 'var(--font)', fontSize: '1.2rem', marginBottom: 8, color: 'var(--text)' }}>
              {isRTL ? 'تصدير النسخة الاحتياطية' : 'Export Backup'}
            </h2>
            <p style={{ color: 'var(--text-sub)', fontSize: '0.9rem', marginBottom: 20, lineHeight: 1.6 }}>
              {isRTL
                ? 'تصدير جميع البيانات بما في ذلك المواعيد والعملاء والخدمات ومقدمي الخدمات والفروع كملف JSON.'
                : 'Export all your data including appointments, customers, services, providers, and branches as a JSON file.'}
            </p>
            <button className="btn btn-primary" onClick={exportData} disabled={exporting}>
              {exporting ? <span className="spin">⟳</span> : '💾'}
              {exporting ? (isRTL ? 'جاري التصدير...' : 'Exporting...') : (isRTL ? 'تصدير جميع البيانات' : 'Export All Data')}
            </button>
          </div>

          {/* Import */}
          <div className="glass-card" style={{ padding: 28 }}>
            <div style={{ width: 52, height: 52, borderRadius: 14, background: 'rgba(14,165,233,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0ea5e9', fontSize: '1.5rem', marginBottom: 16 }}>📤</div>
            <h2 style={{ fontFamily: 'var(--font)', fontSize: '1.2rem', marginBottom: 8, color: 'var(--text)' }}>
              {isRTL ? 'استيراد نسخة احتياطية' : 'Import Backup'}
            </h2>
            <p style={{ color: 'var(--text-sub)', fontSize: '0.9rem', marginBottom: 20, lineHeight: 1.6 }}>
              {isRTL
                ? 'استعادة بياناتك من ملف نسخة احتياطية تم تصديره مسبقاً.'
                : 'Restore your data from a previously exported backup file.'}
            </p>

            {!preview ? (
              <>
                <button className="btn btn-secondary" onClick={() => importFileRef.current?.click()}>
                  📂 {isRTL ? 'اختر ملف النسخة الاحتياطية' : 'Choose Backup File'}
                </button>
                <input ref={importFileRef} type="file" accept=".json" onChange={handleFileChange} style={{ display: 'none' }} />
              </>
            ) : (
              <div>
                {/* File info */}
                <div style={{ marginBottom: 14, padding: '10px 14px', background: 'rgba(14,165,233,0.08)', border: '1px solid rgba(14,165,233,0.2)', borderRadius: 10 }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0ea5e9', marginBottom: 4 }}>
                    {isRTL ? 'ملف النسخة الاحتياطية' : 'Backup file ready'}
                  </div>
                  {preview.exportedAt && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-sub)' }}>
                      {isRTL ? 'تاريخ التصدير:' : 'Exported:'} {new Date(preview.exportedAt).toLocaleString()}
                    </div>
                  )}
                </div>

                {/* Counts preview */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 14 }}>
                  {COUNT_LABELS.map(({ key, icon, en, ar }) => (
                    <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 10px', background: 'var(--bg-elevated)', borderRadius: 8, border: '1px solid var(--border)' }}>
                      <span style={{ fontSize: '1rem' }}>{icon}</span>
                      <div>
                        <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text)', lineHeight: 1.2 }}>{preview.counts[key]}</div>
                        <div style={{ fontSize: '0.67rem', color: 'var(--text-sub)' }}>{isRTL ? ar : en}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Warning */}
                <div style={{ marginBottom: 14, padding: '9px 12px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 9, fontSize: '0.78rem', color: 'var(--text-sub)', lineHeight: 1.6 }}>
                  ⚠️ {isRTL
                    ? 'سيؤدي الاستيراد إلى تحديث السجلات الموجودة بنفس المعرف وإضافة السجلات الجديدة. لن يتم حذف أي بيانات.'
                    : 'Import will update existing records with matching IDs and add new ones. No existing data will be deleted.'}
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => setPreview(null)}
                    style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-sub)', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', fontFamily: 'var(--font)' }}
                  >
                    {isRTL ? 'إلغاء' : 'Cancel'}
                  </button>
                  <button
                    onClick={confirmImport}
                    disabled={importing}
                    style={{ flex: 1, padding: '10px', borderRadius: 10, border: 'none', background: '#0ea5e9', color: '#fff', fontWeight: 700, fontSize: '0.85rem', cursor: importing ? 'not-allowed' : 'pointer', opacity: importing ? 0.7 : 1, fontFamily: 'var(--font)' }}
                  >
                    {importing ? (isRTL ? 'جاري الاستيراد...' : 'Importing...') : (isRTL ? 'استيراد البيانات' : 'Import Data')}
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </ProtectedRoute>
  );
}
