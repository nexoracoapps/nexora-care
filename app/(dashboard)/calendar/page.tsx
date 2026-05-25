'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/context/AuthContext';
import { useBranch } from '@/context/BranchContext';
import { useLanguage } from '@/context/LanguageContext';

type CalAppt = {
  id: string;
  dateTime: string;
  status: string;
  paymentStatus: string;
  amount?: number;
  customer?: { id: string; name: string; phone?: string };
  service?: { id: string; name: string; price: number };
  serviceProvider?: { id: string; name: string; type: string };
  branch?: { id: string; name: string };
};

type CalProvider = { id: string; name: string; type: string };

type View = 'day' | 'week' | 'month';

const STATUS_COLOR: Record<string, string> = {
  SCHEDULED: '#059669',
  COMPLETED: '#2563eb',
  CANCELLED: '#dc2626',
  NO_SHOW: '#d97706',
};

const DAYS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAYS_AR = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];
const MONTHS_EN = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTHS_AR = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function startOfWeek(d: Date) {
  const r = new Date(d);
  r.setDate(r.getDate() - r.getDay());
  r.setHours(0, 0, 0, 0);
  return r;
}

export default function CalendarPage() {
  const { user } = useAuth();
  const { activeBranchId } = useBranch();
  const { lang } = useLanguage();

  const [view, setView] = useState<View>('week');
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setHours(0,0,0,0); return d; });
  const [appts, setAppts] = useState<CalAppt[]>([]);
  const [providers, setProviders] = useState<CalProvider[]>([]);
  const [filterProvider, setFilterProvider] = useState('');
  const [loading, setLoading] = useState(false);
  const [notifStatus, setNotifStatus] = useState<NotificationPermission | 'unsupported'>('default');
  const [expandedDay, setExpandedDay] = useState<string | null>(null); // for month view click
  const notifiedRef = useRef<Set<string>>(new Set());

  const days  = lang === 'ar' ? DAYS_AR : DAYS_EN;
  const months = lang === 'ar' ? MONTHS_AR : MONTHS_EN;

  // Detect notification support
  useEffect(() => {
    if (!('Notification' in window)) { setNotifStatus('unsupported'); return; }
    setNotifStatus(Notification.permission);
  }, []);

  const requestNotif = async () => {
    if (!('Notification' in window)) return;
    const perm = await Notification.requestPermission();
    setNotifStatus(perm);
  };

  // Compute range for current view
  const getRange = useCallback((): { from: Date; to: Date } => {
    if (view === 'day') {
      const from = new Date(cursor); from.setHours(0,0,0,0);
      const to   = new Date(cursor); to.setHours(23,59,59,999);
      return { from, to };
    }
    if (view === 'week') {
      const from = startOfWeek(cursor);
      const to   = new Date(from); to.setDate(from.getDate() + 6); to.setHours(23,59,59,999);
      return { from, to };
    }
    // month
    const from = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const to   = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0, 23, 59, 59, 999);
    return { from, to };
  }, [cursor, view]);

  const load = useCallback(async () => {
    if (!user?.token) return;
    setLoading(true);
    const { from, to } = getRange();
    const q = new URLSearchParams({ from: from.toISOString(), to: to.toISOString() });
    if (filterProvider) q.set('providerId', filterProvider);
    if (activeBranchId) q.set('branchId', activeBranchId);
    const res = await fetch(`/api/calendar?${q}`, { headers: { Authorization: `Bearer ${user.token}` } });
    if (res.ok) setAppts(await res.json());
    setLoading(false);
  }, [user, activeBranchId, filterProvider, getRange]);

  useEffect(() => { load(); }, [load]);

  // Load providers for filter
  useEffect(() => {
    if (!user?.token) return;
    const q = activeBranchId ? `?branchId=${activeBranchId}` : '';
    fetch(`/api/providers${q}`, { headers: { Authorization: `Bearer ${user.token}` } })
      .then(r => r.json()).then(d => { if (Array.isArray(d)) setProviders(d); }).catch(() => {});
  }, [user, activeBranchId]);

  // 15-min reminders
  useEffect(() => {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const check = () => {
      const now = Date.now();
      appts.forEach(a => {
        if (a.status === 'CANCELLED') return;
        const diff = new Date(a.dateTime).getTime() - now;
        if (diff > 0 && diff <= 15 * 60 * 1000 && !notifiedRef.current.has(a.id)) {
          notifiedRef.current.add(a.id);
          new Notification('Appointment Reminder – Nexora Care', {
            body: `${a.customer?.name ?? 'Client'} · ${a.service?.name ?? 'Appointment'} at ${fmtTime(a.dateTime)}`,
            icon: '/icon.svg',
          });
        }
      });
    };
    check();
    const t = setInterval(check, 60_000);
    return () => clearInterval(t);
  }, [appts]);

  const goTo = (n: number) => {
    const d = new Date(cursor);
    if (view === 'day')   d.setDate(d.getDate() + n);
    if (view === 'week')  d.setDate(d.getDate() + n * 7);
    if (view === 'month') d.setMonth(d.getMonth() + n);
    d.setHours(0,0,0,0);
    setCursor(d);
    setExpandedDay(null);
  };

  const goToday = () => { const d = new Date(); d.setHours(0,0,0,0); setCursor(d); setExpandedDay(null); };

  const headingLabel = () => {
    if (view === 'month') return `${months[cursor.getMonth()]} ${cursor.getFullYear()}`;
    if (view === 'week') {
      const sw = startOfWeek(cursor);
      const ew = new Date(sw); ew.setDate(sw.getDate() + 6);
      return `${sw.getDate()} ${months[sw.getMonth()]} – ${ew.getDate()} ${months[ew.getMonth()]} ${ew.getFullYear()}`;
    }
    return `${cursor.getDate()} ${months[cursor.getMonth()]} ${cursor.getFullYear()}`;
  };

  const apptsByDay = (d: Date) => appts.filter(a => sameDay(new Date(a.dateTime), d)).sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());

  // --- APPOINTMENT CARD ---
  const ApptCard = ({ a, compact }: { a: CalAppt; compact?: boolean }) => (
    <div style={{
      background: `${STATUS_COLOR[a.status] ?? '#6366f1'}18`,
      border: `1.5px solid ${STATUS_COLOR[a.status] ?? '#6366f1'}55`,
      borderLeft: `3.5px solid ${STATUS_COLOR[a.status] ?? '#6366f1'}`,
      borderRadius: 8,
      padding: compact ? '5px 8px' : '8px 11px',
      marginBottom: 5,
      cursor: 'default',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <span style={{ fontSize: compact ? '0.7rem' : '0.75rem', fontWeight: 700, color: STATUS_COLOR[a.status] ?? '#6366f1' }}>
          {fmtTime(a.dateTime)}
        </span>
        <span style={{ fontSize: compact ? '0.72rem' : '0.82rem', fontWeight: 600, color: 'var(--text)', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {a.customer?.name ?? '—'}
        </span>
      </div>
      {!compact && (
        <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
          {a.service && <span style={{ fontSize: '0.72rem', color: 'var(--text-sub)' }}>✦ {a.service.name}</span>}
          {a.serviceProvider && <span style={{ fontSize: '0.72rem', color: 'var(--text-sub)' }}>🩺 {a.serviceProvider.name}</span>}
          {a.amount != null && <span style={{ fontSize: '0.72rem', color: 'var(--text-sub)' }}>${a.amount}</span>}
        </div>
      )}
    </div>
  );

  // --- DAY VIEW ---
  const DayView = () => {
    const todayAppts = apptsByDay(cursor);
    const hours = Array.from({ length: 16 }, (_, i) => i + 6); // 6am–9pm
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        <div style={{ textAlign: 'center', padding: '12px 0 16px', fontSize: '1rem', fontWeight: 700, color: 'var(--text)' }}>
          {days[cursor.getDay()]}, {cursor.getDate()} {months[cursor.getMonth()]} {cursor.getFullYear()}
        </div>
        {todayAppts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-sub)', fontSize: '0.9rem' }}>
            No appointments for this day.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {hours.map(h => {
              const slotAppts = todayAppts.filter(a => new Date(a.dateTime).getHours() === h);
              if (slotAppts.length === 0) return null;
              return (
                <div key={h} style={{ display: 'flex', gap: 12, padding: '6px 0', borderTop: '1px solid var(--border)' }}>
                  <div style={{ width: 52, flexShrink: 0, paddingTop: 4, fontSize: '0.72rem', color: 'var(--text-sub)', fontWeight: 600 }}>
                    {h % 12 === 0 ? 12 : h % 12}{h < 12 ? ' AM' : ' PM'}
                  </div>
                  <div style={{ flex: 1 }}>
                    {slotAppts.map(a => <ApptCard key={a.id} a={a} />)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // --- WEEK VIEW ---
  const WeekView = () => {
    const sw = startOfWeek(cursor);
    const weekDays = Array.from({ length: 7 }, (_, i) => { const d = new Date(sw); d.setDate(sw.getDate() + i); return d; });
    const today = new Date(); today.setHours(0,0,0,0);
    return (
      <div style={{ overflowX: 'auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(120px, 1fr))', gap: 8, minWidth: 700 }}>
          {weekDays.map((d, i) => {
            const dayAppts = apptsByDay(d);
            const isToday = sameDay(d, today);
            return (
              <div key={i} style={{
                background: 'var(--bg-card)',
                borderRadius: 12,
                padding: '10px 10px 12px',
                border: isToday ? '2px solid var(--rose)' : '1.5px solid var(--border)',
                minHeight: 120,
              }}>
                <div style={{ textAlign: 'center', marginBottom: 8 }}>
                  <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-sub)', fontWeight: 600 }}>
                    {days[d.getDay()]}
                  </div>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%',
                    background: isToday ? 'var(--rose)' : 'transparent',
                    color: isToday ? '#fff' : 'var(--text)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '3px auto 0',
                    fontWeight: 700, fontSize: '0.9rem',
                  }}>
                    {d.getDate()}
                  </div>
                </div>
                {dayAppts.length === 0 ? (
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-sub)', textAlign: 'center', marginTop: 8 }}>—</div>
                ) : (
                  dayAppts.map(a => <ApptCard key={a.id} a={a} compact />)
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // --- MONTH VIEW ---
  const MonthView = () => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date(); today.setHours(0,0,0,0);
    const cells: (Date | null)[] = [
      ...Array(firstDay).fill(null),
      ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1)),
    ];
    // Pad to full weeks
    while (cells.length % 7 !== 0) cells.push(null);

    return (
      <div>
        {/* Day headers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 4 }}>
          {days.map(d => (
            <div key={d} style={{ textAlign: 'center', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-sub)', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '4px 0' }}>
              {d}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
          {cells.map((d, i) => {
            if (!d) return <div key={i} style={{ minHeight: 80 }} />;
            const dayAppts = apptsByDay(d);
            const isToday = sameDay(d, today);
            const key = d.toISOString().split('T')[0];
            const isExpanded = expandedDay === key;
            return (
              <div
                key={i}
                onClick={() => setExpandedDay(isExpanded ? null : key)}
                style={{
                  background: 'var(--bg-card)',
                  borderRadius: 10,
                  padding: '6px 6px 8px',
                  border: isToday ? '2px solid var(--rose)' : '1.5px solid var(--border)',
                  minHeight: 80,
                  cursor: 'pointer',
                  transition: 'box-shadow 0.15s',
                }}
              >
                <div style={{
                  width: 26, height: 26, borderRadius: '50%',
                  background: isToday ? 'var(--rose)' : 'transparent',
                  color: isToday ? '#fff' : 'var(--text)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, fontSize: '0.82rem', marginBottom: 4,
                }}>
                  {d.getDate()}
                </div>
                {dayAppts.length > 0 ? (
                  isExpanded ? (
                    dayAppts.map(a => <ApptCard key={a.id} a={a} compact />)
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {dayAppts.slice(0, 3).map(a => (
                        <div key={a.id} style={{
                          height: 5, borderRadius: 3,
                          background: STATUS_COLOR[a.status] ?? '#6366f1',
                        }} />
                      ))}
                      {dayAppts.length > 3 && (
                        <div style={{ fontSize: '0.6rem', color: 'var(--text-sub)', marginTop: 2 }}>
                          +{dayAppts.length - 3} more
                        </div>
                      )}
                    </div>
                  )
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <ProtectedRoute permKey="manageAppointments">
      <style dangerouslySetInnerHTML={{ __html: `
        .cal-view-btn { background: transparent; border: 1.5px solid var(--border); border-radius: 8px; padding: 7px 14px; font-size: 0.82rem; font-weight: 600; color: var(--text-sub); cursor: pointer; transition: all 0.15s; font-family: var(--font); }
        .cal-view-btn.active { background: var(--rose); border-color: var(--rose); color: #fff; }
        .cal-view-btn:hover:not(.active) { border-color: var(--rose); color: var(--rose); }
        .cal-nav-btn { background: var(--bg-elevated); border: 1.5px solid var(--border); border-radius: 8px; padding: 7px 12px; cursor: pointer; color: var(--text); font-size: 0.95rem; transition: background 0.15s; }
        .cal-nav-btn:hover { background: var(--bg-card); }
      `}} />

      <div className="page-header">
        <div>
          <h1 className="page-title">
            <span style={{ marginRight: 10 }}>📅</span>Calendar
          </h1>
          <p className="page-sub">View appointments by provider and date</p>
        </div>
        {notifStatus !== 'unsupported' && notifStatus !== 'granted' && (
          <button onClick={requestNotif} className="btn btn-secondary btn-sm">
            🔔 Enable Reminders
          </button>
        )}
        {notifStatus === 'granted' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(5,150,105,0.12)', border: '1.5px solid rgba(5,150,105,0.3)', borderRadius: 8, padding: '6px 12px', fontSize: '0.8rem', fontWeight: 600, color: '#059669' }}>
            🔔 Reminders On
          </div>
        )}
      </div>

      <div className="glass-card" style={{ marginBottom: 16 }}>
        {/* Controls bar */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* View toggle */}
          <div style={{ display: 'flex', gap: 4 }}>
            {(['day', 'week', 'month'] as View[]).map(v => (
              <button key={v} onClick={() => setView(v)} className={`cal-view-btn${view === v ? ' active' : ''}`}>
                {v === 'day' ? 'Day' : v === 'week' ? 'Week' : 'Month'}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button onClick={() => goTo(-1)} className="cal-nav-btn">‹</button>
            <button onClick={goToday} className="btn btn-secondary btn-sm">Today</button>
            <button onClick={() => goTo(1)} className="cal-nav-btn">›</button>
          </div>

          <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text)', flex: 1, textAlign: 'center' }}>
            {headingLabel()}
          </div>

          {/* Provider filter */}
          <select
            value={filterProvider}
            onChange={e => setFilterProvider(e.target.value)}
            style={{ background: 'var(--bg-surface)', border: '1.5px solid var(--border-strong)', borderRadius: 9, padding: '7px 12px', color: 'var(--text)', fontSize: '0.82rem', fontFamily: 'var(--font)', outline: 'none' }}
          >
            <option value="">All Providers</option>
            {providers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      </div>

      <div className="glass-card">
        {loading ? (
          <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-sub)' }}>Loading…</div>
        ) : (
          <>
            {view === 'day' && <DayView />}
            {view === 'week' && <WeekView />}
            {view === 'month' && <MonthView />}
          </>
        )}
      </div>

      {/* Legend */}
      <div className="glass-card" style={{ marginTop: 12 }}>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-sub)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Status:</span>
          {Object.entries(STATUS_COLOR).map(([s, c]) => (
            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: c }} />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-sub)' }}>{s.replace('_', ' ')}</span>
            </div>
          ))}
        </div>
      </div>
    </ProtectedRoute>
  );
}
