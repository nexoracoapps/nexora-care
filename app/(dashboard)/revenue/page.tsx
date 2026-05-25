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

  const summaryCards = [
    { label: t('revTotalRevenue'),      value: fmt(data?.totalRevenue    ?? 0), icon: '💰', color: '#2563eb' },
    { label: t('revCollected'),         value: fmt(data?.paidRevenue     ?? 0), icon: '✅', color: '#059669' },
    { label: t('revTotalAppointments'), value: String(data?.totalAppointments ?? 0), icon: '📅', color: '#7c3aed' },
    { label: t('revTotalDistributed'),  value: fmt(data?.totalDistributed ?? 0), icon: '📊', color: '#d97706' },
  ];

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
        .rev-row:hover { background: var(--bg-elevated); }
        .rev-badge { border-radius: 6px; padding: 3px 9px; font-weight: 700; font-size: 0.72rem; display: inline-block; }
      `}} />

      {/* Header */}
      <div className="page-header" dir={isRTL ? 'rtl' : 'ltr'}>
        <div>
          <h1 className="page-title">💰 {t('revenueDistribution')}</h1>
          <p className="page-sub">{t('revenueDistributionSub')}</p>
        </div>
        {data && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'rgba(5,150,105,0.10)', border: '1.5px solid rgba(5,150,105,0.25)',
            borderRadius: 12, padding: '8px 16px',
            fontSize: '0.82rem', fontWeight: 700, color: '#059669',
          }}>
            ✅ {isRTL ? 'نسبة التحصيل' : 'Collection rate'}:&nbsp;
            <span style={{ fontSize: '1rem' }}>
              {data.totalRevenue > 0 ? ((data.paidRevenue / data.totalRevenue) * 100).toFixed(0) : 0}%
            </span>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="glass-card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap', direction: isRTL ? 'rtl' : 'ltr' }}>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-sub)', marginBottom: 5 }}>{t('revFrom')}</div>
            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="rev-input" />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-sub)', marginBottom: 5 }}>{t('revTo')}</div>
            <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="rev-input" />
          </div>
          <button onClick={load} className="btn btn-primary btn-sm" disabled={loading}>
            {loading ? t('revLoading') : t('revApply')}
          </button>
          {data && (
            <div style={{ fontSize: '0.78rem', color: 'var(--text-sub)', paddingBottom: 2 }}>
              {fmtDate(data.period.from)} – {fmtDate(data.period.to)}
            </div>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
        {summaryCards.map(c => (
          <div key={c.label} className="glass-card" style={{ padding: '18px 20px', direction: isRTL ? 'rtl' : 'ltr' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 46, height: 46, borderRadius: 13,
              background: `${c.color}1a`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.4rem', flexShrink: 0,
              boxShadow: `0 4px 14px ${c.color}22`,
            }}>
              {c.icon}
            </div>
            <div>
              <div style={{ fontSize: '1.35rem', fontWeight: 800, color: c.color, lineHeight: 1.1 }}>{c.value}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-sub)', fontWeight: 600, marginTop: 3 }}>{c.label}</div>
            </div>
            </div>
            {/* Collection progress bar for paid revenue card */}
            {c.icon === '✅' && data && data.totalRevenue > 0 && (
              <div style={{ marginTop: 10 }}>
                <div style={{ height: 4, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 4,
                    background: `linear-gradient(90deg, ${c.color}, ${c.color}aa)`,
                    width: `${Math.min(100, (data.paidRevenue / data.totalRevenue) * 100)}%`,
                    transition: 'width 0.6s ease',
                  }} />
                </div>
              </div>
            )}
            {/* Payout progress for distributed card */}
            {c.icon === '📊' && data && data.totalRevenue > 0 && (
              <div style={{ marginTop: 10 }}>
                <div style={{ height: 4, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 4,
                    background: `linear-gradient(90deg, ${c.color}, ${c.color}aa)`,
                    width: `${Math.min(100, (data.totalDistributed / data.totalRevenue) * 100)}%`,
                    transition: 'width 0.6s ease',
                  }} />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Provider table */}
      <div className="glass-card">
        <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, direction: isRTL ? 'rtl' : 'ltr' }}>
          <span>🩺</span>
          <span>{t('revProviderBreakdown')}</span>
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
                <tr style={{ borderBottom: '2px solid var(--border)' }}>
                  {tableHeaders.map((h, i) => (
                    <th key={i} style={{
                      padding: '9px 12px',
                      textAlign: i === 0 ? (isRTL ? 'right' : 'left') : 'center',
                      fontWeight: 700,
                      color: 'var(--text-sub)',
                      fontSize: '0.72rem',
                      textTransform: 'uppercase',
                      letterSpacing: isRTL ? 0 : '0.05em',
                      whiteSpace: 'nowrap',
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

                  return (
                    <React.Fragment key={pid}>
                      <tr
                        className="rev-row"
                        onClick={() => setExpandedId(isExpanded ? null : pid)}
                        style={{ borderBottom: '1px solid var(--border)' }}
                      >
                        {/* Provider name + color dot */}
                        <td style={{ padding: '12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{
                              width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                              background: `${color}22`,
                              border: `2px solid ${color}44`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '0.78rem', fontWeight: 800, color,
                            }}>
                              {row.provider.name.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div style={{ fontWeight: 700, color: 'var(--text)' }}>{row.provider.name}</div>
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-sub)', marginTop: 1 }}>{row.provider.type}</div>
                            </div>
                          </div>
                        </td>

                        {/* Appointment count */}
                        <td style={{ padding: '12px', textAlign: 'center' }}>
                          <span style={{
                            background: 'var(--bg-elevated)', borderRadius: 8,
                            padding: '4px 10px', fontWeight: 700, color: 'var(--text)', fontSize: '0.88rem',
                          }}>
                            {row.appointmentCount}
                          </span>
                        </td>

                        {/* Revenue */}
                        <td style={{ padding: '12px', textAlign: 'center', fontWeight: 700, color: 'var(--text)', fontSize: '0.9rem' }}>
                          {fmt(row.revenue)}
                        </td>

                        {/* Paid revenue */}
                        <td style={{ padding: '12px', textAlign: 'center' }}>
                          <span style={{ fontWeight: 700, color: '#059669', fontSize: '0.9rem' }}>{fmt(row.paidRevenue)}</span>
                        </td>

                        {/* Contract % — editable */}
                        <td style={{ padding: '12px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                          {isEditing ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'center' }}>
                              <input
                                type="number" min={0} max={100} step={0.1}
                                value={editingPct[pid]}
                                onChange={e => setEditingPct(prev => ({ ...prev, [pid]: e.target.value }))}
                                className="pct-input"
                                autoFocus
                              />
                              <button
                                onClick={() => savePct(pid)}
                                disabled={savingPct === pid}
                                className="btn btn-primary btn-sm"
                                style={{ padding: '5px 10px', fontSize: '0.75rem' }}
                              >
                                {savingPct === pid ? '…' : '✓'}
                              </button>
                              <button
                                onClick={() => setEditingPct(prev => { const n = { ...prev }; delete n[pid]; return n; })}
                                className="btn btn-secondary btn-sm"
                                style={{ padding: '5px 8px', fontSize: '0.75rem' }}
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
                              <span style={{
                                background: pct > 0 ? `${color}22` : 'var(--bg-elevated)',
                                color: pct > 0 ? color : 'var(--text-sub)',
                                borderRadius: 7, padding: '4px 12px',
                                fontWeight: 800, fontSize: '0.88rem',
                                border: `1.5px solid ${pct > 0 ? color + '44' : 'transparent'}`,
                              }}>
                                {pct}%
                              </span>
                              <button
                                onClick={() => setEditingPct(prev => ({ ...prev, [pid]: String(pct) }))}
                                title={t('revEditContractPct')}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-sub)', fontSize: '0.9rem', padding: '2px 4px', lineHeight: 1 }}
                              >
                                ✏️
                              </button>
                            </div>
                          )}
                        </td>

                        {/* Payout */}
                        <td style={{ padding: '12px', textAlign: 'center' }}>
                          <span style={{
                            background: 'rgba(217,119,6,0.12)',
                            color: '#d97706',
                            borderRadius: 8, padding: '4px 12px',
                            fontWeight: 800, fontSize: '0.9rem',
                          }}>
                            {fmt(row.payout)}
                          </span>
                        </td>

                        {/* Expand toggle */}
                        <td style={{ padding: '12px', textAlign: 'center', color: 'var(--text-sub)', fontSize: '0.8rem', width: 32 }}>
                          {row.appointmentCount > 0 && (
                            <span style={{ color: color }}>{isExpanded ? '▲' : '▼'}</span>
                          )}
                        </td>
                      </tr>

                      {/* Expanded appointments sub-table */}
                      {isExpanded && row.appointments.length > 0 && (
                        <tr style={{ background: 'var(--bg-elevated)' }}>
                          <td colSpan={7} style={{ padding: isRTL ? '0 28px 16px 12px' : '0 12px 16px 28px' }}>
                            <div style={{ paddingTop: 12 }}>
                              <div style={{
                                fontSize: '0.7rem', fontWeight: 700, color,
                                textTransform: 'uppercase', letterSpacing: isRTL ? 0 : '0.08em',
                                marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6,
                              }}>
                                <div style={{ width: 3, height: 14, borderRadius: 2, background: color }} />
                                {t('revAppointments')}
                              </div>
                              <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }} dir={isRTL ? 'rtl' : 'ltr'}>
                                  <thead>
                                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                      {subHeaders.map(h => (
                                        <th key={h} style={{
                                          padding: '5px 10px',
                                          textAlign: isRTL ? 'right' : 'left',
                                          color: 'var(--text-sub)', fontWeight: 600,
                                          fontSize: '0.7rem', textTransform: 'uppercase',
                                          letterSpacing: isRTL ? 0 : '0.04em',
                                          whiteSpace: 'nowrap',
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
                                          <td style={{ padding: '7px 10px', whiteSpace: 'nowrap', color: 'var(--text-sub)', fontSize: '0.78rem' }}>
                                            {fmtDateTime(a.dateTime)}
                                          </td>
                                          <td style={{ padding: '7px 10px', fontWeight: 600, color: 'var(--text)' }}>{a.customer}</td>
                                          <td style={{ padding: '7px 10px', color: 'var(--text-sub)' }}>{a.service}</td>
                                          <td style={{ padding: '7px 10px', fontWeight: 700, color: 'var(--text)' }}>
                                            {a.amount != null ? fmt(a.amount) : '—'}
                                          </td>
                                          <td style={{ padding: '7px 10px' }}>
                                            <span className="rev-badge" style={{ background: pb.bg, color: pb.color }}>
                                              {paymentLabel[a.paymentStatus] ?? a.paymentStatus}
                                            </span>
                                          </td>
                                          <td style={{ padding: '7px 10px' }}>
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
                    <td style={{ padding: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                          background: 'rgba(100,100,100,0.12)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '1.1rem',
                        }}>❓</div>
                        <div>
                          <div style={{ fontWeight: 700, color: 'var(--text-sub)' }}>{t('revUnassigned')}</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-sub)', marginTop: 1 }}>{t('revNoProvider')}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center', color: 'var(--text-sub)', fontWeight: 600 }}>{data.unassigned.count}</td>
                    <td style={{ padding: '12px', textAlign: 'center', color: 'var(--text-sub)', fontWeight: 600 }}>{fmt(data.unassigned.revenue)}</td>
                    <td colSpan={4} />
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Distribution bar chart */}
      {data && data.totalRevenue > 0 && data.byProvider.some(r => r.revenue > 0) && (
        <div className="glass-card" style={{ marginTop: 16 }}>
          <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 14, color: 'var(--text)', direction: isRTL ? 'rtl' : 'ltr' }}>
            {t('revDistributionBar')}
          </div>
          <div style={{ display: 'flex', height: 28, borderRadius: 14, overflow: 'hidden', gap: 2 }}>
            {data.byProvider.filter(r => r.revenue > 0).map((row, i) => {
              const pct   = (row.revenue / data.totalRevenue) * 100;
              const color = PROVIDER_HUES[i % PROVIDER_HUES.length];
              return (
                <div
                  key={row.provider.id}
                  title={`${row.provider.name}: ${fmt(row.revenue)} (${pct.toFixed(1)}%)`}
                  style={{ flex: `0 0 ${pct}%`, background: color, transition: 'flex 0.3s', minWidth: 4 }}
                />
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 12 }}>
            {data.byProvider.filter(r => r.revenue > 0).map((row, i) => {
              const color = PROVIDER_HUES[i % PROVIDER_HUES.length];
              return (
                <div key={row.provider.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-sub)' }}>
                    {row.provider.name}
                    <span style={{ color: 'var(--text)', fontWeight: 700, marginLeft: 4 }}>
                      {((row.revenue / data.totalRevenue) * 100).toFixed(1)}%
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </ProtectedRoute>
  );
}
