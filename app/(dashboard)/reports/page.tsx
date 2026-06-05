'use client';

import { useState, useEffect } from 'react';
import { swrGet, swrSet } from '@/lib/swrCache';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/context/AuthContext';
import { useBranch } from '@/context/BranchContext';
import { useLanguage } from '@/context/LanguageContext';
import { usePermissions } from '@/context/PermissionsContext';
import type { DashboardStats } from '@/types';

export default function ReportsPage() {
  const { user } = useAuth();
  const { activeBranchId, activeBranch } = useBranch();
  const { t, lang, isRTL } = useLanguage();
  const { canDo } = usePermissions();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'today' | 'week' | 'month'>('month');

  useEffect(() => {
    const fetch_ = async () => {
      if (!user?.token) return;
      const q = new URLSearchParams({ period });
      if (activeBranchId) q.set('branchId', activeBranchId);
      const ck = `/api/reports/dashboard?${q}`;
      const stale = swrGet<DashboardStats>(ck);
      if (stale) { setStats(stale); setLoading(false); } else setLoading(true);
      const res = await fetch(ck, { headers: { Authorization: `Bearer ${user.token}` } });
      if (res.ok) { const d = await res.json(); setStats(d); swrSet(ck, d); }
      setLoading(false);
    };
    fetch_();
  }, [user, activeBranchId, period]);

  const noShowRate = stats ? ((stats.noShows / Math.max(stats.totalAppointments, 1)) * 100).toFixed(1) : '0';
  const paidRate = stats ? (((stats.totalAppointments - stats.unpaidCount) / Math.max(stats.totalAppointments, 1)) * 100).toFixed(1) : '0';

  const periodLabel = period === 'today' ? t('today') : period === 'week' ? t('thisWeek') : t('thisMonth');
  const branchLabel = activeBranch ? (isRTL && activeBranch.nameAr ? activeBranch.nameAr : activeBranch.name) : t('allBranches');
  const printDate = new Date().toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const handlePrint = () => window.print();

  return (
    <ProtectedRoute permKey="viewReports">
      <style dangerouslySetInnerHTML={{ __html: `
        @page { margin: 0; }
        @media print {
          body * { visibility: hidden !important; }
          #printable-report, #printable-report * { visibility: visible !important; }
          #printable-report { position: fixed; inset: 0; padding: 32px; background: #fff; color: #111; }
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          .glass-card { box-shadow: none !important; border: 1px solid #e2e8f0 !important; }
        }
      `}} />

      <div id="printable-report">
        {/* Print header — only visible on print */}
        <div style={{ display: 'none' }} className="print-only">
          <div style={{ textAlign: 'center', marginBottom: 24, borderBottom: '2px solid #e2e8f0', paddingBottom: 16 }}>
            <div style={{ fontSize: 22, fontWeight: 800 }}>Nexora Care</div>
            <div style={{ fontSize: 14, color: '#64748b', marginTop: 4 }}>{t('reports')} — {periodLabel} — {branchLabel}</div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{printDate}</div>
          </div>
        </div>

        <div className="page-header no-print">
          <div>
            <h1 className="page-title">{t('reports')}</h1>
            <p className="page-sub">{t('reportsSubtitle')}</p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 6 }}>
              {(['today', 'week', 'month'] as const).map(p => (
                <button key={p} onClick={() => setPeriod(p)}
                  className={`btn btn-${period === p ? 'primary' : 'secondary'} btn-sm`}>
                  {p === 'today' ? t('today') : p === 'week' ? t('thisWeek') : t('thisMonth')}
                </button>
              ))}
            </div>
            {canDo('exportReports') && <button onClick={handlePrint} style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '9px 18px', border: '1.5px solid var(--border)', borderRadius: 12,
              background: 'var(--bg-elevated)', cursor: 'pointer',
              fontFamily: 'var(--font)', fontSize: 13, fontWeight: 700, color: 'var(--text)',
              transition: 'all 0.15s',
            }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--rose)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}>
              🖨️ {t('printReport')}
            </button>}
          </div>
        </div>

        {/* Period picker shown on print via hidden header above */}
        <div className="no-print" style={{ marginBottom: 4, fontSize: '0.82rem', color: 'var(--text-sub)' }}>
          {periodLabel} · {branchLabel}
        </div>

        {loading ? (
          <div style={{ display: 'grid', gap: 16 }}>
            {[...Array(4)].map((_, i) => <div key={i} className="skeleton" style={{ height: 100 }} />)}
          </div>
        ) : stats ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24, marginTop: 16 }}>

            {/* Revenue */}
            <div className="glass-card" style={{ padding: 24 }}>
              <h2 style={{ fontFamily: 'var(--font)', fontSize: '1.1rem', fontWeight: 800, marginBottom: 18, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>
                💰 {t('revenueOverview')}
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14 }}>
                {[
                  { label: t('totalRevenue'), value: `$${stats.totalRevenue.toFixed(2)}`, color: 'var(--rose)' },
                  { label: t('avgPerAppointment'), value: stats.totalAppointments > 0 ? `$${(stats.totalRevenue / stats.totalAppointments).toFixed(2)}` : '$0.00', color: 'var(--plum)' },
                  { label: t('unpaidInvoices'), value: stats.unpaidCount.toString(), color: '#e53e5a' },
                  { label: t('paymentRate'), value: `${paidRate}%`, color: '#10b981' },
                ].map(item => (
                  <div key={item.label} style={{ background: 'var(--bg-elevated)', borderRadius: 12, padding: 16, borderTop: `3px solid ${item.color}` }}>
                    <div style={{ fontSize: '0.76rem', color: 'var(--text-sub)', marginBottom: 6, fontWeight: 500 }}>{item.label}</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: item.color }}>{item.value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Appointments */}
            <div className="glass-card" style={{ padding: 24 }}>
              <h2 style={{ fontFamily: 'var(--font)', fontSize: '1.1rem', fontWeight: 800, marginBottom: 18, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>
                📅 {t('appointmentMetrics')}
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14 }}>
                {[
                  { label: t('totalBookings'), value: stats.totalAppointments.toString(), color: 'var(--text)' },
                  { label: t('todaysSchedule'), value: stats.upcomingToday.toString(), color: 'var(--rose)' },
                  { label: t('noShows'), value: stats.noShows.toString(), color: '#d97706' },
                  { label: t('noShowRate'), value: `${noShowRate}%`, color: '#d97706' },
                ].map(item => (
                  <div key={item.label} style={{ background: 'var(--bg-elevated)', borderRadius: 12, padding: 16, borderTop: `3px solid ${item.color}` }}>
                    <div style={{ fontSize: '0.76rem', color: 'var(--text-sub)', marginBottom: 6, fontWeight: 500 }}>{item.label}</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: item.color }}>{item.value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Operations */}
            <div className="glass-card" style={{ padding: 24 }}>
              <h2 style={{ fontFamily: 'var(--font)', fontSize: '1.1rem', fontWeight: 800, marginBottom: 18, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>
                🏥 {t('operations')}
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14 }}>
                {[
                  { label: t('totalClients'), value: stats.totalCustomers.toString(), color: 'var(--text)' },
                  { label: t('specialists'), value: stats.totalProviders.toString(), color: 'var(--plum)' },
                  { label: t('servicesOffered'), value: stats.totalServices.toString(), color: 'var(--rose)' },
                  { label: t('revenuePerCustomer'), value: stats.totalCustomers > 0 ? `$${(stats.totalRevenue / stats.totalCustomers).toFixed(2)}` : '$0.00', color: '#10b981' },
                ].map(item => (
                  <div key={item.label} style={{ background: 'var(--bg-elevated)', borderRadius: 12, padding: 16, borderTop: `3px solid ${item.color}` }}>
                    <div style={{ fontSize: '0.76rem', color: 'var(--text-sub)', marginBottom: 6, fontWeight: 500 }}>{item.label}</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: item.color }}>{item.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </ProtectedRoute>
  );
}
