'use client';

import React, { useState, useEffect, useCallback } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/context/AuthContext';
import { useBranch } from '@/context/BranchContext';
import { useLanguage } from '@/context/LanguageContext';
import toast from 'react-hot-toast';

type ProviderRevenue = {
  provider: { id: string; name: string; type: string; revenuePercentage: number };
  appointmentCount: number;
  revenue: number;
  paidRevenue: number;
  payout: number;
  appointments: {
    id: string; dateTime: string; customer: string; service: string;
    amount?: number; paymentStatus: string; status: string;
  }[];
};

type RevenueData = {
  period: { from: string; to: string };
  totalRevenue: number;
  paidRevenue: number;
  totalAppointments: number;
  totalDistributed: number;
  byProvider: ProviderRevenue[];
  unassigned: { count: number; revenue: number };
};

function fmt(n: number) {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const PAYMENT_STYLE: Record<string, { bg: string; color: string }> = {
  PAID:   { bg: 'rgba(5,150,105,0.13)',  color: '#059669' },
  UNPAID: { bg: 'rgba(220,38,38,0.11)',  color: '#dc2626' },
};
const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  SCHEDULED:  { bg: 'rgba(5,150,105,0.13)',  color: '#059669' },
  COMPLETED:  { bg: 'rgba(37,99,235,0.11)',  color: '#2563eb' },
  CANCELLED:  { bg: 'rgba(220,38,38,0.11)',  color: '#dc2626' },
  NO_SHOW:    { bg: 'rgba(217,119,6,0.11)',  color: '#d97706' },
};
const PROVIDER_HUES = ['#7c3aed', '#059669', '#2563eb', '#d97706', '#dc2626', '#0891b2', '#db2777'];

export default function RevenuePage() {
  const { user } = useAuth();
  const { activeBranchId } = useBranch();
  const { t, lang, isRTL } = useLanguage();

  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const [fromDate, setFromDate] = useState(firstOfMonth.toISOString().split('T')[0]);
  const [toDate,   setToDate]   = useState(today.toISOString().split('T')[0]);
  const [data, setData] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingPct, setEditingPct] = useState<Record<string, string>>({});
  const [savingPct,  setSavingPct]  = useState<string | null>(null);

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const fmtDateTime = (iso: string) => {
    const d = new Date(iso);
    return `${d.toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US', { month: 'short', day: 'numeric' })} ${d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}`;
  };

  const paymentLabel: Record<string, string> = {
    PAID: t('paymentPaid'), UNPAID: t('paymentUnpaid'),
  };
  const statusLabel: Record<string, string> = {
    SCHEDULED: t('statusScheduled'), COMPLETED: t('statusCompleted'),
    CANCELLED: t('statusCancelled'), NO_SHOW: t('statusNoShow'),
  };

  const load = useCallback(async () => {
    if (!user?.token) return;
    setLoading(true);
    const q = new URLSearchParams({ from: fromDate, to: toDate });
    if (activeBranchId) q.set('branchId', activeBranchId);
    const res = await fetch(`/api/reports/revenue?${q}`, { headers: { Authorization: `Bearer ${user.token}` } });
    if (res.ok) setData(await res.json());
    setLoading(false);
  }, [user, activeBranchId, fromDate, toDate]);

  useEffect(() => { load(); }, [load]);

  // Quick presets
  const applyPreset = (preset: 'this-month' | 'last-month' | 'last-7') => {
    const now = new Date();
    if (preset === 'this-month') {
      setFromDate(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]);
      setToDate(now.toISOString().split('T')[0]);
    } else if (preset === 'last-month') {
      setFromDate(new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0]);
      setToDate(new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0]);
    } else {
      const d = new Date(now); d.setDate(d.getDate() - 7);
      setFromDate(d.toISOString().split('T')[0]);
      setToDate(now.toISOString().split('T')[0]);
    }
  };

  const savePct = async (providerId: string) => {
    const raw = editingPct[providerId];
    const val = parseFloat(raw);
    if (isNaN(val) || val < 0 || val > 100) { toast.error(t('revPctError')); return; }
    setSavingPct(providerId);
    const res = await fetch(`/api/providers/${providerId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${user!.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ revenuePercentage: val }),
    });
    if (res.ok) {
      toast.success(t('revPctUpdated'));
      setEditingPct(prev => { const n = { ...prev }; delete n[providerId]; return n; });
      load();
    } else {
      toast.error(t('revUpdateFailed'));
    }
    setSavingPct(null);
  };

  // Derived metrics
  const collectionRate  = data && data.totalRevenue > 0 ? Math.round((data.paidRevenue / data.totalRevenue) * 100) : 0;
  const distributionRate = data && data.paidRevenue > 0 ? Math.round((data.totalDistributed / data.paidRevenue) * 100) : 0;
  const outstanding     = data ? data.totalRevenue - data.paidRevenue : 0;
  const topProvider     = data?.byProvider.reduce<ProviderRevenue | null>((best, r) => !best || r.revenue > best.revenue ? r : best, null);

  const tableHeaders = [
    t('revProvider'), t('revAppts'), t('revRevenue'),
    t('revPaidRevenue'), t('revContractPct'), t('revPayout'), '',
  ];
  const subHeaders = [t('revDate'), t('revClient'), t('revService'), t('revAmount'), t('revPayment'), t('revStatus')];

  return (
    <ProtectedRoute roles={['ADMIN', 'MANAGER']} permKey="viewReports">
      <style dangerouslySetInnerHTML={{ __html: `
        .rev-input {
          background: var(--bg-surface);
          border: 1.5px solid var(--border-strong);
          border-radius: 10px;
          padding: 8px 12px;
          color: var(--text);
          font-family: var(--font);
          font-size: 0.85rem;
          outline: none;
          transition: border-color 0.15s;
        }
        .rev-input:focus { border-color: var(--rose); box-shadow: 0 0 0 3px rgba(196,120,140,0.12); }
        .pct-input {
          width: 70px;
          background: var(--bg-surface);
          border: 1.5px solid var(--rose);
          border-radius: 7px;
          padding: 5px 8px;
          color: var(--text);
          font-family: var(--font);
          font-size: 0.82rem;
          outline: none;
          text-align: center;
        }
        .rev-row { cursor: pointer; transition: background 0.12s; }
        .rev-row:hover { background: var(--bg-elevated) !important; }
        .rev-badge { border-radius: 6px; padding: 3px 9px; font-weight: 700; font-size: 0.72rem; display: inline-block; }
        .preset-btn {
          padding: 6px 13px; border-radius: 20px; font-size: 0.78rem; font-weight: 600;
          border: 1.5px solid var(--border); background: var(--bg-surface);
          color: var(--text-sub); cursor: pointer; font-family: var(--font);
          transition: all 0.15s; white-space: nowrap;
        }
        .preset-btn:hover { border-color: var(--rose); color: var(--rose); background: var(--bg-elevated); }
        @keyframes bar-grow { from { width: 0 } }
        .rev-bar-fill { animation: bar-grow 0.7s ease; }
      `}} />

      {/* ── Header ── */}
      <div className="page-header" dir={isRTL ? 'rtl' : 'ltr'}>
        <div>
          <h1 className="page-title">💰 {t('revenueDistribution')}</h1>
          <p className="page-sub">{t('revenueDistributionSub')}</p>
        </div>
        {data && (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'rgba(5,150,105,0.10)', border: '1.5px solid rgba(5,150,105,0.25)',
              borderRadius: 12, padding: '8px 16px',
              fontSize: '0.82rem', fontWeight: 700, color: '#059669',
            }}>
              ✅ {isRTL ? 'نسبة التحصيل' : 'Collection rate'}:&nbsp;
              <span style={{ fontSize: '1.05rem', fontWeight: 900 }}>{collectionRate}%</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Quick Insights strip ── */}
      {data && data.totalRevenue > 0 && (
        <div style={{
          display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16,
          direction: isRTL ? 'rtl' : 'ltr',
        }}>
          {/* Outstanding */}
          {outstanding > 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 200,
              background: 'rgba(220,38,38,0.07)', border: '1px solid rgba(220,38,38,0.18)',
              borderRadius: 12, padding: '10px 16px',
            }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(220,38,38,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', flexShrink: 0 }}>⚠️</div>
              <div>
                <div style={{ fontSize: '0.72rem', color: '#dc2626', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{isRTL ? 'غير محصّل' : 'Outstanding Balance'}</div>
                <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#dc2626' }}>{fmt(outstanding)}</div>
              </div>
            </div>
          )}
          {/* Top performer */}
          {topProvider && topProvider.revenue > 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 200,
              background: 'rgba(124,58,237,0.07)', border: '1px solid rgba(124,58,237,0.18)',
              borderRadius: 12, padding: '10px 16px',
            }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(124,58,237,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', flexShrink: 0 }}>🏆</div>
              <div>
                <div style={{ fontSize: '0.72rem', color: '#7c3aed', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{isRTL ? 'الأعلى أداءً' : 'Top Performer'}</div>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text)' }}>
                  {topProvider.provider.name}
                  <span style={{ color: '#7c3aed', marginLeft: 6, fontWeight: 800 }}>{fmt(topProvider.revenue)}</span>
                </div>
              </div>
            </div>
          )}
          {/* Payout ready */}
          {data.totalDistributed > 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 200,
              background: 'rgba(217,119,6,0.07)', border: '1px solid rgba(217,119,6,0.18)',
              borderRadius: 12, padding: '10px 16px',
            }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(217,119,6,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', flexShrink: 0 }}>💸</div>
              <div>
                <div style={{ fontSize: '0.72rem', color: '#d97706', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{isRTL ? 'المدفوع للمزودين' : 'Provider Payouts'}</div>
                <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#d97706' }}>{fmt(data.totalDistributed)}</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Filters ── */}
      <div className="glass-card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap', direction: isRTL ? 'rtl' : 'ltr' }}>
          {/* Presets */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignSelf: 'center' }}>
            <button className="preset-btn" onClick={() => applyPreset('this-month')}>{isRTL ? 'هذا الشهر' : 'This Month'}</button>
            <button className="preset-btn" onClick={() => applyPreset('last-month')}>{isRTL ? 'الشهر الماضي' : 'Last Month'}</button>
            <button className="preset-btn" onClick={() => applyPreset('last-7')}>{isRTL ? 'آخر 7 أيام' : 'Last 7 Days'}</button>
          </div>
          <div style={{ width: 1, height: 32, background: 'var(--border)', flexShrink: 0, alignSelf: 'center' }} />
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-sub)', marginBottom: 5 }}>{t('revFrom')}</div>
            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="rev-input" />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-sub)', marginBottom: 5 }}>{t('revTo')}</div>
            <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="rev-input" />
          </div>
          <button onClick={load} className="btn btn-primary btn-sm" style={{ marginBottom: 1 }} disabled={loading}>
            {loading ? t('revLoading') : `🔍 ${t('revApply')}`}
          </button>
          {data && (
            <div style={{ fontSize: '0.76rem', color: 'var(--text-sub)', paddingBottom: 2, display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ opacity: 0.5 }}>📆</span>
              {fmtDate(data.period.from)} – {fmtDate(data.period.to)}
            </div>
          )}
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 20 }}>

        {/* Total Revenue */}
        <div className="glass-card" style={{ padding: '20px', direction: isRTL ? 'rtl' : 'ltr' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-sub)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>{t('revTotalRevenue')}</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#2563eb', lineHeight: 1.1 }}>{fmt(data?.totalRevenue ?? 0)}</div>
            </div>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(37,99,235,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem', flexShrink: 0 }}>💰</div>
          </div>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-sub)' }}>
            {data?.totalAppointments ?? 0} {isRTL ? 'موعد' : 'appointments'}
            {outstanding > 0 && <span style={{ color: '#dc2626', marginLeft: 6, fontWeight: 600 }}>· {fmt(outstanding)} {isRTL ? 'معلق' : 'pending'}</span>}
          </div>
        </div>

        {/* Collected */}
        <div className="glass-card" style={{ padding: '20px', direction: isRTL ? 'rtl' : 'ltr' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-sub)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>{t('revCollected')}</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#059669', lineHeight: 1.1 }}>{fmt(data?.paidRevenue ?? 0)}</div>
            </div>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(5,150,105,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem', flexShrink: 0 }}>✅</div>
          </div>
          {/* Progress bar with label */}
          <div style={{ marginBottom: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-sub)' }}>{isRTL ? 'معدل التحصيل' : 'Collection rate'}</span>
              <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#059669' }}>{collectionRate}%</span>
            </div>
            <div style={{ height: 6, background: 'var(--border)', borderRadius: 6, overflow: 'hidden' }}>
              <div className="rev-bar-fill" style={{
                height: '100%', borderRadius: 6,
                background: 'linear-gradient(90deg, #059669, #34d399)',
                width: `${collectionRate}%`,
              }} />
            </div>
          </div>
        </div>

        {/* Total Appointments */}
        <div className="glass-card" style={{ padding: '20px', direction: isRTL ? 'rtl' : 'ltr' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-sub)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>{t('revTotalAppointments')}</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#7c3aed', lineHeight: 1.1 }}>{data?.totalAppointments ?? 0}</div>
            </div>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(124,58,237,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem', flexShrink: 0 }}>📅</div>
          </div>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-sub)' }}>
            {data?.byProvider.length ?? 0} {isRTL ? 'مزودو خدمة نشطون' : 'active providers'}
            {(data?.unassigned.count ?? 0) > 0 && <span style={{ marginLeft: 6 }}>· {data!.unassigned.count} {isRTL ? 'غير مخصص' : 'unassigned'}</span>}
          </div>
        </div>

        {/* Total Distributed */}
        <div className="glass-card" style={{ padding: '20px', direction: isRTL ? 'rtl' : 'ltr' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-sub)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>{t('revTotalDistributed')}</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#d97706', lineHeight: 1.1 }}>{fmt(data?.totalDistributed ?? 0)}</div>
            </div>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(217,119,6,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem', flexShrink: 0 }}>📊</div>
          </div>
          {/* Distribution rate */}
          <div style={{ marginBottom: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-sub)' }}>{isRTL ? 'من المحصّل' : 'Of collected'}</span>
              <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#d97706' }}>{distributionRate}%</span>
            </div>
            <div style={{ height: 6, background: 'var(--border)', borderRadius: 6, overflow: 'hidden' }}>
              <div className="rev-bar-fill" style={{
                height: '100%', borderRadius: 6,
                background: 'linear-gradient(90deg, #d97706, #fbbf24)',
                width: `${distributionRate}%`,
              }} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Provider Breakdown Table ── */}
      <div className="glass-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, direction: isRTL ? 'rtl' : 'ltr' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--grad-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>🩺</div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text)' }}>{t('revProviderBreakdown')}</div>
              {data && <div style={{ fontSize: '0.72rem', color: 'var(--text-sub)', marginTop: 1 }}>{data.byProvider.length} {isRTL ? 'مزود' : 'providers'} · {isRTL ? 'انقر لعرض المواعيد' : 'Click row to expand appointments'}</div>}
            </div>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 56, color: 'var(--text-sub)' }}>
            <div style={{ fontSize: '1.5rem', marginBottom: 10 }}>⏳</div>
            {t('revLoading')}
          </div>
        ) : !data || data.byProvider.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 56, color: 'var(--text-sub)' }}>
            <div style={{ fontSize: '2rem', marginBottom: 10 }}>📋</div>
            {t('revNoData')}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }} dir={isRTL ? 'rtl' : 'ltr'}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)', background: 'var(--bg-elevated)' }}>
                  {tableHeaders.map((h, i) => (
                    <th key={i} style={{
                      padding: '10px 14px',
                      textAlign: i === 0 ? (isRTL ? 'right' : 'left') : 'center',
                      fontWeight: 700, color: 'var(--text-sub)',
                      fontSize: '0.7rem', textTransform: 'uppercase',
                      letterSpacing: isRTL ? 0 : '0.05em', whiteSpace: 'nowrap',
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.byProvider.map((row, rowIdx) => {
                  const pid = row.provider.id;
                  const isEditing  = pid in editingPct;
                  const isExpanded = expandedId === pid;
                  const pct   = row.provider.revenuePercentage;
                  const color = PROVIDER_HUES[rowIdx % PROVIDER_HUES.length];
                  const revShare = data.totalRevenue > 0 ? (row.revenue / data.totalRevenue) * 100 : 0;
                  const isTop   = topProvider?.provider.id === pid && row.revenue > 0;

                  return (
                    <React.Fragment key={pid}>
                      <tr
                        className="rev-row"
                        onClick={() => setExpandedId(isExpanded ? null : pid)}
                        style={{
                          borderBottom: '1px solid var(--border)',
                          background: isExpanded ? 'var(--bg-elevated)' : 'transparent',
                        }}
                      >
                        {/* Provider name */}
                        <td style={{ padding: '14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{
                              width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                              background: `${color}1a`, border: `2px solid ${color}44`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '0.8rem', fontWeight: 800, color,
                            }}>
                              {row.provider.name.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ fontWeight: 700, color: 'var(--text)', fontSize: '0.9rem' }}>{row.provider.name}</span>
                                {isTop && <span title="Top Performer" style={{ fontSize: '0.75rem' }}>🏆</span>}
                              </div>
                              <div style={{ fontSize: '0.68rem', color: 'var(--text-sub)', marginTop: 1 }}>{row.provider.type}</div>
                            </div>
                          </div>
                        </td>

                        {/* Appt count */}
                        <td style={{ padding: '14px', textAlign: 'center' }}>
                          <span style={{
                            background: `${color}15`, border: `1px solid ${color}30`,
                            borderRadius: 8, padding: '4px 12px',
                            fontWeight: 700, color, fontSize: '0.88rem',
                          }}>
                            {row.appointmentCount}
                          </span>
                        </td>

                        {/* Revenue + mini share bar */}
                        <td style={{ padding: '14px', textAlign: 'center' }}>
                          <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: '0.9rem' }}>{fmt(row.revenue)}</div>
                          <div style={{ margin: '5px auto 0', width: '80%', height: 4, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                            <div className="rev-bar-fill" style={{ height: '100%', background: color, borderRadius: 4, width: `${revShare}%` }} />
                          </div>
                          <div style={{ fontSize: '0.62rem', color, fontWeight: 700, marginTop: 2 }}>{revShare.toFixed(1)}%</div>
                        </td>

                        {/* Paid revenue */}
                        <td style={{ padding: '14px', textAlign: 'center' }}>
                          <span style={{ fontWeight: 700, color: '#059669', fontSize: '0.9rem' }}>{fmt(row.paidRevenue)}</span>
                        </td>

                        {/* Contract % — editable */}
                        <td style={{ padding: '14px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                          {isEditing ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'center' }}>
                              <input
                                type="number" min={0} max={100} step={0.1}
                                value={editingPct[pid]}
                                onChange={e => setEditingPct(prev => ({ ...prev, [pid]: e.target.value }))}
                                className="pct-input" autoFocus
                              />
                              <button onClick={() => savePct(pid)} disabled={savingPct === pid}
                                className="btn btn-primary btn-sm" style={{ padding: '5px 10px', fontSize: '0.75rem' }}>
                                {savingPct === pid ? '…' : '✓'}
                              </button>
                              <button onClick={() => setEditingPct(prev => { const n = { ...prev }; delete n[pid]; return n; })}
                                className="btn btn-secondary btn-sm" style={{ padding: '5px 8px', fontSize: '0.75rem' }}>
                                ✕
                              </button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
                              <span style={{
                                background: pct > 0 ? `${color}1a` : 'var(--bg-elevated)',
                                color: pct > 0 ? color : 'var(--text-sub)',
                                borderRadius: 8, padding: '4px 12px',
                                fontWeight: 800, fontSize: '0.88rem',
                                border: `1.5px solid ${pct > 0 ? color + '40' : 'transparent'}`,
                              }}>
                                {pct}%
                              </span>
                              <button onClick={() => setEditingPct(prev => ({ ...prev, [pid]: String(pct) }))}
                                title={t('revEditContractPct')}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-sub)', fontSize: '0.9rem', padding: '2px 4px', lineHeight: 1 }}>
                                ✏️
                              </button>
                            </div>
                          )}
                        </td>

                        {/* Payout */}
                        <td style={{ padding: '14px', textAlign: 'center' }}>
                          <div style={{
                            display: 'inline-flex', alignItems: 'center', gap: 5,
                            background: row.payout > 0 ? 'rgba(217,119,6,0.12)' : 'var(--bg-elevated)',
                            color: row.payout > 0 ? '#d97706' : 'var(--text-sub)',
                            borderRadius: 8, padding: '6px 14px',
                            fontWeight: 800, fontSize: '0.9rem',
                            border: `1.5px solid ${row.payout > 0 ? 'rgba(217,119,6,0.3)' : 'transparent'}`,
                          }}>
                            {row.payout > 0 && <span style={{ fontSize: '0.75rem' }}>💸</span>}
                            {fmt(row.payout)}
                          </div>
                        </td>

                        {/* Expand toggle */}
                        <td style={{ padding: '14px', textAlign: 'center', width: 36 }}>
                          {row.appointmentCount > 0 && (
                            <div style={{
                              width: 26, height: 26, borderRadius: '50%',
                              background: isExpanded ? `${color}20` : 'var(--bg-elevated)',
                              border: `1.5px solid ${isExpanded ? color + '50' : 'var(--border)'}`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              color: isExpanded ? color : 'var(--text-sub)',
                              fontSize: '0.7rem', cursor: 'pointer',
                              transition: 'all 0.15s',
                            }}>
                              {isExpanded ? '▲' : '▼'}
                            </div>
                          )}
                        </td>
                      </tr>

                      {/* Expanded sub-table */}
                      {isExpanded && row.appointments.length > 0 && (
                        <tr>
                          <td colSpan={7} style={{ padding: 0, background: 'var(--bg-elevated)', borderBottom: '2px solid var(--border)' }}>
                            <div style={{ padding: isRTL ? '16px 32px 20px 16px' : '16px 16px 20px 32px', borderLeft: isRTL ? 'none' : `3px solid ${color}`, borderRight: isRTL ? `3px solid ${color}` : 'none' }}>
                              <div style={{
                                fontSize: '0.7rem', fontWeight: 800, color,
                                textTransform: 'uppercase', letterSpacing: '0.08em',
                                marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6,
                              }}>
                                <div style={{ width: 4, height: 14, borderRadius: 2, background: color }} />
                                {row.provider.name} — {t('revAppointments')} ({row.appointments.length})
                              </div>
                              <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }} dir={isRTL ? 'rtl' : 'ltr'}>
                                  <thead>
                                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                      {subHeaders.map(h => (
                                        <th key={h} style={{
                                          padding: '6px 12px', textAlign: isRTL ? 'right' : 'left',
                                          color: 'var(--text-sub)', fontWeight: 700,
                                          fontSize: '0.68rem', textTransform: 'uppercase',
                                          letterSpacing: isRTL ? 0 : '0.04em', whiteSpace: 'nowrap',
                                        }}>
                                          {h}
                                        </th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {row.appointments.map(a => {
                                      const pb = PAYMENT_STYLE[a.paymentStatus] ?? { bg: 'var(--bg-elevated)', color: 'var(--text-sub)' };
                                      const sb = STATUS_STYLE[a.status]         ?? { bg: 'var(--bg-elevated)', color: 'var(--text-sub)' };
                                      return (
                                        <tr key={a.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                          <td style={{ padding: '8px 12px', whiteSpace: 'nowrap', color: 'var(--text-sub)', fontSize: '0.78rem' }}>{fmtDateTime(a.dateTime)}</td>
                                          <td style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--text)' }}>{a.customer}</td>
                                          <td style={{ padding: '8px 12px', color: 'var(--text-sub)' }}>{a.service}</td>
                                          <td style={{ padding: '8px 12px', fontWeight: 700, color: a.paymentStatus === 'PAID' ? '#059669' : 'var(--text)' }}>
                                            {a.amount != null ? fmt(a.amount) : '—'}
                                          </td>
                                          <td style={{ padding: '8px 12px' }}>
                                            <span className="rev-badge" style={{ background: pb.bg, color: pb.color }}>
                                              {paymentLabel[a.paymentStatus] ?? a.paymentStatus}
                                            </span>
                                          </td>
                                          <td style={{ padding: '8px 12px' }}>
                                            <span className="rev-badge" style={{ background: sb.bg, color: sb.color }}>
                                              {statusLabel[a.status] ?? a.status}
                                            </span>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}

                {/* Unassigned row */}
                {data.unassigned.count > 0 && (
                  <tr style={{ borderTop: '2px solid var(--border)', background: 'var(--bg-elevated)' }}>
                    <td style={{ padding: '14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0, background: 'rgba(100,100,100,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem' }}>❓</div>
                        <div>
                          <div style={{ fontWeight: 700, color: 'var(--text-sub)' }}>{t('revUnassigned')}</div>
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-sub)', marginTop: 1 }}>{t('revNoProvider')}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '14px', textAlign: 'center', color: 'var(--text-sub)', fontWeight: 600 }}>{data.unassigned.count}</td>
                    <td style={{ padding: '14px', textAlign: 'center', color: 'var(--text-sub)', fontWeight: 600 }}>{fmt(data.unassigned.revenue)}</td>
                    <td colSpan={4} />
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Revenue Distribution Bar ── */}
      {data && data.totalRevenue > 0 && data.byProvider.some(r => r.revenue > 0) && (
        <div className="glass-card" style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, direction: isRTL ? 'rtl' : 'ltr' }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: 'var(--grad-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem' }}>📊</div>
            <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text)' }}>{t('revDistributionBar')}</div>
          </div>

          {/* Stacked bar */}
          <div style={{ display: 'flex', height: 44, borderRadius: 14, overflow: 'hidden', gap: 2, marginBottom: 16 }}>
            {data.byProvider.filter(r => r.revenue > 0).map((row, i) => {
              const pct   = (row.revenue / data.totalRevenue) * 100;
              const color = PROVIDER_HUES[i % PROVIDER_HUES.length];
              return (
                <div
                  key={row.provider.id}
                  title={`${row.provider.name}: ${fmt(row.revenue)} (${pct.toFixed(1)}%)`}
                  style={{
                    flex: `0 0 ${pct}%`, minWidth: 4,
                    background: `linear-gradient(135deg, ${color}, ${color}cc)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    overflow: 'hidden', transition: 'flex 0.4s ease',
                  }}
                >
                  {pct > 9 && (
                    <span style={{ color: '#fff', fontSize: '0.68rem', fontWeight: 800, textShadow: '0 1px 2px rgba(0,0,0,0.3)', whiteSpace: 'nowrap' }}>
                      {pct.toFixed(0)}%
                    </span>
                  )}
                </div>
              );
            })}
            {/* Unassigned portion */}
            {data.unassigned.revenue > 0 && (() => {
              const pct = (data.unassigned.revenue / data.totalRevenue) * 100;
              return (
                <div style={{ flex: `0 0 ${pct}%`, minWidth: 4, background: 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {pct > 9 && <span style={{ color: 'var(--text-sub)', fontSize: '0.68rem', fontWeight: 700 }}>{pct.toFixed(0)}%</span>}
                </div>
              );
            })()}
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', direction: isRTL ? 'rtl' : 'ltr' }}>
            {data.byProvider.filter(r => r.revenue > 0).map((row, i) => {
              const color = PROVIDER_HUES[i % PROVIDER_HUES.length];
              const pct   = (row.revenue / data.totalRevenue) * 100;
              return (
                <div key={row.provider.id} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <div style={{ width: 12, height: 12, borderRadius: 3, background: color, flexShrink: 0 }} />
                  <div>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-sub)', fontWeight: 500 }}>{row.provider.name}</span>
                    <span style={{ color, fontWeight: 800, marginLeft: 5, fontSize: '0.78rem' }}>{pct.toFixed(1)}%</span>
                    <span style={{ color: 'var(--text-sub)', fontSize: '0.72rem', marginLeft: 4 }}>({fmt(row.revenue)})</span>
                  </div>
                </div>
              );
            })}
            {data.unassigned.revenue > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <div style={{ width: 12, height: 12, borderRadius: 3, background: 'var(--border)', flexShrink: 0 }} />
                <span style={{ fontSize: '0.78rem', color: 'var(--text-sub)' }}>
                  {t('revUnassigned')}
                  <span style={{ fontWeight: 700, marginLeft: 5 }}>({fmt(data.unassigned.revenue)})</span>
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </ProtectedRoute>
  );
}
