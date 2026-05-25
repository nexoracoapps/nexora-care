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

function fmt(n: number) { return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
function fmtDate(iso: string) { return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }

const PAYMENT_BADGE: Record<string, { bg: string; color: string }> = {
  PAID:   { bg: 'rgba(5,150,105,0.12)',  color: '#059669' },
  UNPAID: { bg: 'rgba(220,38,38,0.10)',  color: '#dc2626' },
};
const STATUS_BADGE: Record<string, { bg: string; color: string }> = {
  SCHEDULED:  { bg: 'rgba(5,150,105,0.12)',  color: '#059669' },
  COMPLETED:  { bg: 'rgba(37,99,235,0.10)',  color: '#2563eb' },
  CANCELLED:  { bg: 'rgba(220,38,38,0.10)',  color: '#dc2626' },
  NO_SHOW:    { bg: 'rgba(217,119,6,0.10)',  color: '#d97706' },
};

export default function RevenuePage() {
  const { user } = useAuth();
  const { activeBranchId } = useBranch();
  const { t } = useLanguage();

  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const [fromDate, setFromDate] = useState(firstOfMonth.toISOString().split('T')[0]);
  const [toDate, setToDate] = useState(today.toISOString().split('T')[0]);
  const [data, setData] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingPct, setEditingPct] = useState<Record<string, string>>({});
  const [savingPct, setSavingPct] = useState<string | null>(null);

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
    if (isNaN(val) || val < 0 || val > 100) { toast.error('Enter a value between 0 and 100'); return; }
    setSavingPct(providerId);
    const res = await fetch(`/api/providers/${providerId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${user!.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ revenuePercentage: val }),
    });
    if (res.ok) {
      toast.success('Contract % updated');
      setEditingPct(prev => { const n = { ...prev }; delete n[providerId]; return n; });
      load();
    } else {
      toast.error('Failed to update');
    }
    setSavingPct(null);
  };

  const summaryCards = [
    { label: 'Total Revenue', value: fmt(data?.totalRevenue ?? 0), icon: '💰', color: '#2563eb' },
    { label: 'Collected (Paid)', value: fmt(data?.paidRevenue ?? 0), icon: '✅', color: '#059669' },
    { label: 'Total Appointments', value: String(data?.totalAppointments ?? 0), icon: '📅', color: '#7c3aed' },
    { label: 'Total Distributed', value: fmt(data?.totalDistributed ?? 0), icon: '📊', color: '#d97706' },
  ];

  return (
    <ProtectedRoute roles={['ADMIN', 'MANAGER']} permKey="viewReports">
      <style dangerouslySetInnerHTML={{ __html: `
        .rev-input { background: var(--bg-surface); border: 1.5px solid var(--border-strong); border-radius: 9px; padding: 7px 11px; color: var(--text); font-family: var(--font); font-size: 0.85rem; outline: none; transition: border-color 0.15s; }
        .rev-input:focus { border-color: var(--rose); box-shadow: 0 0 0 3px rgba(196,120,140,0.12); }
        .pct-input { width: 70px; background: var(--bg-surface); border: 1.5px solid var(--rose); border-radius: 7px; padding: 4px 8px; color: var(--text); font-family: var(--font); font-size: 0.82rem; outline: none; text-align: center; }
        .expand-row { cursor: pointer; transition: background 0.12s; }
        .expand-row:hover { background: var(--bg-elevated); }
      `}} />

      <div className="page-header">
        <div>
          <h1 className="page-title">
            <span style={{ marginRight: 10 }}>💰</span>Revenue Distribution
          </h1>
          <p className="page-sub">Provider payouts and contract percentages</p>
        </div>
      </div>

      {/* Filters */}
      <div className="glass-card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-sub)', marginBottom: 5 }}>From</div>
            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="rev-input" />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-sub)', marginBottom: 5 }}>To</div>
            <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="rev-input" />
          </div>
          <button onClick={load} className="btn btn-primary btn-sm" disabled={loading}>
            {loading ? 'Loading…' : 'Apply'}
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
          <div key={c.label} className="glass-card" style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: `${c.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.35rem', flexShrink: 0 }}>
              {c.icon}
            </div>
            <div>
              <div style={{ fontSize: '1.3rem', fontWeight: 800, color: c.color }}>{c.value}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-sub)', fontWeight: 600, marginTop: 1 }}>{c.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Provider table */}
      <div className="glass-card">
        <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>🩺</span> Provider Breakdown
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-sub)' }}>Loading…</div>
        ) : !data || data.byProvider.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-sub)' }}>No data for selected period.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)' }}>
                  {['Provider', 'Appts', 'Revenue', 'Paid Revenue', 'Contract %', 'Payout', ''].map((h, i) => (
                    <th key={i} style={{ padding: '8px 12px', textAlign: i === 0 ? 'left' : 'center', fontWeight: 700, color: 'var(--text-sub)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.byProvider.map(row => {
                  const pid = row.provider.id;
                  const isEditing = pid in editingPct;
                  const isExpanded = expandedId === pid;
                  const pct = row.provider.revenuePercentage;
                  return (
                    <React.Fragment key={pid}>
                      <tr
                        className="expand-row"
                        onClick={() => setExpandedId(isExpanded ? null : pid)}
                        style={{ borderBottom: '1px solid var(--border)' }}
                      >
                        <td style={{ padding: '12px 12px' }}>
                          <div style={{ fontWeight: 700, color: 'var(--text)' }}>{row.provider.name}</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-sub)', marginTop: 2 }}>{row.provider.type}</div>
                        </td>
                        <td style={{ padding: '12px', textAlign: 'center', fontWeight: 600, color: 'var(--text)' }}>
                          {row.appointmentCount}
                        </td>
                        <td style={{ padding: '12px', textAlign: 'center', fontWeight: 600, color: 'var(--text)' }}>
                          {fmt(row.revenue)}
                        </td>
                        <td style={{ padding: '12px', textAlign: 'center' }}>
                          <span style={{ fontWeight: 600, color: '#059669' }}>{fmt(row.paidRevenue)}</span>
                        </td>
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
                                style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                              >
                                {savingPct === pid ? '…' : '✓'}
                              </button>
                              <button
                                onClick={() => setEditingPct(prev => { const n = { ...prev }; delete n[pid]; return n; })}
                                className="btn btn-secondary btn-sm"
                                style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
                              <span style={{
                                background: `rgba(${pct > 0 ? '124,58,237' : '100,100,100'},0.12)`,
                                color: pct > 0 ? '#7c3aed' : 'var(--text-sub)',
                                borderRadius: 6, padding: '3px 10px', fontWeight: 700, fontSize: '0.85rem',
                              }}>
                                {pct}%
                              </span>
                              <button
                                onClick={() => setEditingPct(prev => ({ ...prev, [pid]: String(pct) }))}
                                title="Edit contract %"
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-sub)', fontSize: '0.85rem', padding: '2px 4px' }}
                              >
                                ✏️
                              </button>
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '12px', textAlign: 'center' }}>
                          <span style={{ fontWeight: 800, color: '#d97706', fontSize: '0.95rem' }}>{fmt(row.payout)}</span>
                        </td>
                        <td style={{ padding: '12px', textAlign: 'center', color: 'var(--text-sub)', fontSize: '0.8rem' }}>
                          {row.appointmentCount > 0 ? (isExpanded ? '▲' : '▼') : ''}
                        </td>
                      </tr>

                      {/* Expanded appointments */}
                      {isExpanded && row.appointments.length > 0 && (
                        <tr style={{ background: 'var(--bg-elevated)' }}>
                          <td colSpan={7} style={{ padding: '0 12px 14px 36px' }}>
                            <div style={{ paddingTop: 10 }}>
                              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-sub)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                                Appointments
                              </div>
                              <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                                  <thead>
                                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                      {['Date', 'Client', 'Service', 'Amount', 'Payment', 'Status'].map(h => (
                                        <th key={h} style={{ padding: '5px 10px', textAlign: 'left', color: 'var(--text-sub)', fontWeight: 600, fontSize: '0.72rem', textTransform: 'uppercase' }}>{h}</th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {row.appointments.map(a => {
                                      const pb = PAYMENT_BADGE[a.paymentStatus] ?? { bg: 'transparent', color: 'var(--text-sub)' };
                                      const sb = STATUS_BADGE[a.status] ?? { bg: 'transparent', color: 'var(--text-sub)' };
                                      return (
                                        <tr key={a.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                          <td style={{ padding: '6px 10px', whiteSpace: 'nowrap', color: 'var(--text-sub)' }}>
                                            {new Date(a.dateTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                            {' '}
                                            {new Date(a.dateTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                                          </td>
                                          <td style={{ padding: '6px 10px', fontWeight: 600, color: 'var(--text)' }}>{a.customer}</td>
                                          <td style={{ padding: '6px 10px', color: 'var(--text-sub)' }}>{a.service}</td>
                                          <td style={{ padding: '6px 10px', fontWeight: 600, color: 'var(--text)' }}>{a.amount != null ? fmt(a.amount) : '—'}</td>
                                          <td style={{ padding: '6px 10px' }}>
                                            <span style={{ background: pb.bg, color: pb.color, borderRadius: 5, padding: '2px 8px', fontWeight: 700, fontSize: '0.7rem' }}>
                                              {a.paymentStatus}
                                            </span>
                                          </td>
                                          <td style={{ padding: '6px 10px' }}>
                                            <span style={{ background: sb.bg, color: sb.color, borderRadius: 5, padding: '2px 8px', fontWeight: 700, fontSize: '0.7rem' }}>
                                              {a.status}
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
                      <div style={{ fontWeight: 700, color: 'var(--text-sub)' }}>Unassigned</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-sub)', marginTop: 2 }}>No provider</div>
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center', color: 'var(--text-sub)' }}>{data.unassigned.count}</td>
                    <td style={{ padding: '12px', textAlign: 'center', color: 'var(--text-sub)' }}>{fmt(data.unassigned.revenue)}</td>
                    <td colSpan={4} />
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Distribution bar */}
      {data && data.totalRevenue > 0 && data.byProvider.length > 0 && (
        <div className="glass-card" style={{ marginTop: 16 }}>
          <div style={{ fontWeight: 700, fontSize: '0.875rem', marginBottom: 12, color: 'var(--text)' }}>Revenue Distribution</div>
          <div style={{ display: 'flex', height: 24, borderRadius: 12, overflow: 'hidden', gap: 1 }}>
            {data.byProvider.filter(r => r.revenue > 0).map((row, i) => {
              const pct = (row.revenue / data.totalRevenue) * 100;
              const hues = ['#7c3aed', '#059669', '#2563eb', '#d97706', '#dc2626', '#0891b2', '#db2777'];
              const color = hues[i % hues.length];
              return (
                <div
                  key={row.provider.id}
                  title={`${row.provider.name}: ${fmt(row.revenue)} (${pct.toFixed(1)}%)`}
                  style={{ flex: `0 0 ${pct}%`, background: color, transition: 'flex 0.3s' }}
                />
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 10 }}>
            {data.byProvider.filter(r => r.revenue > 0).map((row, i) => {
              const hues = ['#7c3aed', '#059669', '#2563eb', '#d97706', '#dc2626', '#0891b2', '#db2777'];
              const color = hues[i % hues.length];
              return (
                <div key={row.provider.id} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-sub)' }}>
                    {row.provider.name} ({((row.revenue / data.totalRevenue) * 100).toFixed(1)}%)
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
