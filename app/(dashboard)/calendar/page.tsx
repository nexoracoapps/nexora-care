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
  NO_SHOW:   '#d97706',
};

const DAYS_EN  = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAYS_AR  = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];
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
  const { t, lang, isRTL } = useLanguage();

  const [view, setView] = useState<View>(() => typeof window !== 'undefined' && window.innerWidth < 640 ? 'day' : 'week');
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setHours(0,0,0,0); return d; });
  const [appts, setAppts] = useState<CalAppt[]>([]);
  const [providers, setProviders] = useState<CalProvider[]>([]);
  const [filterProvider, setFilterProvider] = useState('');
  const [loading, setLoading] = useState(false);
  const [notifStatus, setNotifStatus] = useState<NotificationPermission | 'unsupported'>('default');
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const notifiedRef = useRef<Set<string>>(new Set());

  const days   = lang === 'ar' ? DAYS_AR   : DAYS_EN;
  const months = lang === 'ar' ? MONTHS_AR : MONTHS_EN;
  const isPrivileged = ['ADMIN', 'MANAGER'].includes(user?.role ?? '');
  const isLockedToProvider = !isPrivileged && !!user?.providerId;
  const isOwnCalendar = !!user?.providerId && filterProvider === user.providerId;

  // Auto-select linked provider on load
  useEffect(() => {
    if (user?.providerId) setFilterProvider(user.providerId);
  }, [user?.providerId]);

  useEffect(() => {
    if (!('Notification' in window)) { setNotifStatus('unsupported'); return; }
    setNotifStatus(Notification.permission);
  }, []);

  const requestNotif = async () => {
    if (!('Notification' in window)) return;
    const perm = await Notification.requestPermission();
    setNotifStatus(perm);
  };

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
    const timer = setInterval(check, 60_000);
    return () => clearInterval(timer);
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

  const apptsByDay = (d: Date) =>
    appts.filter(a => sameDay(new Date(a.dateTime), d))
      .sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());

  const statusLabel = (s: string) => ({
    SCHEDULED: t('scheduled'), COMPLETED: t('completed'),
    CANCELLED: t('cancelled'), NO_SHOW: t('noShow'),
  }[s] ?? s);

  // --- APPOINTMENT CARD ---
  const ApptCard = ({ a, compact }: { a: CalAppt; compact?: boolean }) => {
    const color = STATUS_COLOR[a.status] ?? '#6366f1';
    return (
      <div style={{
        background: `${color}12`,
        borderRadius: compact ? 7 : 10,
        padding: compact ? '5px 7px 5px 10px' : '9px 12px 9px 13px',
        marginBottom: compact ? 4 : 6,
        borderLeft: isRTL ? 'none' : `3px solid ${color}`,
        borderRight: isRTL ? `3px solid ${color}` : 'none',
        position: 'relative',
        cursor: 'default',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{
            fontSize: compact ? '0.68rem' : '0.73rem', fontWeight: 800, color,
            background: `${color}20`, borderRadius: 4, padding: '1px 5px', flexShrink: 0,
          }}>
            {fmtTime(a.dateTime)}
          </span>
          <span style={{
            fontSize: compact ? '0.72rem' : '0.84rem', fontWeight: 700, color: 'var(--text)',
            flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {a.customer?.name ?? '—'}
          </span>
        </div>
        {!compact && (
          <div style={{ display: 'flex', gap: 10, marginTop: 5, flexWrap: 'wrap', alignItems: 'center' }}>
            {a.service && (
              <span style={{ fontSize: '0.72rem', color: 'var(--text-sub)', display: 'flex', alignItems: 'center', gap: 3 }}>
                <span style={{ opacity: 0.6 }}>✦</span> {a.service.name}
              </span>
            )}
            {a.serviceProvider && (
              <span style={{ fontSize: '0.72rem', color: 'var(--text-sub)', display: 'flex', alignItems: 'center', gap: 3 }}>
                <span>🩺</span> {a.serviceProvider.name}
              </span>
            )}
            {a.amount != null && (
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#059669', marginLeft: 'auto' }}>
                ${a.amount}
              </span>
            )}
          </div>
        )}
        {/* Status dot */}
        <div style={{
          position: 'absolute', top: compact ? 6 : 9, right: isRTL ? 'unset' : 7, left: isRTL ? 7 : 'unset',
          width: 6, height: 6, borderRadius: '50%', background: color,
        }} />
      </div>
    );
  };

  // --- DAY VIEW ---
  const DayView = () => {
    const todayAppts = apptsByDay(cursor);
    const hours = Array.from({ length: 16 }, (_, i) => i + 6);
    return (
      <div>
        <div style={{
          textAlign: 'center', padding: '14px 0 20px',
          fontSize: '1.05rem', fontWeight: 800, color: 'var(--text)',
          letterSpacing: '-0.3px',
        }}>
          {days[cursor.getDay()]}, {cursor.getDate()} {months[cursor.getMonth()]} {cursor.getFullYear()}
        </div>
        {todayAppts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-sub)' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: 10, opacity: 0.4 }}>📅</div>
            <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{t('calNoApptsDay')}</div>
          </div>
        ) : (
          <div>
            {hours.map(h => {
              const slotAppts = todayAppts.filter(a => new Date(a.dateTime).getHours() === h);
              if (slotAppts.length === 0) return null;
              const label = `${h % 12 === 0 ? 12 : h % 12}:00 ${h < 12 ? 'AM' : 'PM'}`;
              return (
                <div key={h} style={{ display: 'flex', gap: 14, padding: '8px 0', borderTop: '1px solid var(--border)' }}>
                  <div style={{
                    width: 58, flexShrink: 0, paddingTop: 6,
                    fontSize: '0.7rem', color: 'var(--text-sub)', fontWeight: 700,
                    textAlign: isRTL ? 'left' : 'right',
                  }}>
                    {label}
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
      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(110px, 1fr))', gap: 5, minWidth: 580 }}>
          {weekDays.map((d, i) => {
            const dayAppts = apptsByDay(d);
            const isToday = sameDay(d, today);
            const hasSelf = isOwnCalendar;
            return (
              <div key={i} style={{
                background: isToday ? 'var(--bg-card)' : 'var(--bg-elevated)',
                borderRadius: 12,
                padding: '10px 8px 12px',
                border: isToday
                  ? '2px solid var(--rose)'
                  : hasSelf && dayAppts.length > 0
                    ? '1.5px solid rgba(124,58,237,0.3)'
                    : '1.5px solid var(--border)',
                minHeight: 110,
                transition: 'box-shadow 0.15s',
              }}>
                {/* Day header */}
                <div style={{ textAlign: 'center', marginBottom: 8 }}>
                  <div style={{
                    fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.07em',
                    color: isToday ? 'var(--rose)' : 'var(--text-sub)', fontWeight: 700,
                  }}>
                    {days[d.getDay()]}
                  </div>
                  <div style={{
                    width: 30, height: 30, borderRadius: '50%',
                    background: isToday ? 'var(--rose)' : 'transparent',
                    color: isToday ? '#fff' : 'var(--text)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '3px auto 0',
                    fontWeight: 800, fontSize: '0.92rem',
                    boxShadow: isToday ? '0 4px 12px rgba(var(--rose-rgb),0.4)' : 'none',
                  }}>
                    {d.getDate()}
                  </div>
                </div>
                {/* Appt count badge */}
                {dayAppts.length > 0 && (
                  <div style={{
                    textAlign: 'center', marginBottom: 6,
                    fontSize: '0.62rem', fontWeight: 700,
                    color: 'var(--text-sub)',
                  }}>
                    {dayAppts.length} {dayAppts.length === 1 ? (lang === 'ar' ? 'موعد' : 'appt') : (lang === 'ar' ? 'مواعيد' : 'appts')}
                  </div>
                )}
                {dayAppts.length === 0 ? (
                  <div style={{ fontSize: '0.62rem', color: 'var(--border)', textAlign: 'center', marginTop: 12 }}>·</div>
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
    while (cells.length % 7 !== 0) cells.push(null);

    return (
      <div>
        {/* Day name headers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3, marginBottom: 6 }}>
          {days.map(d => (
            <div key={d} style={{
              textAlign: 'center', fontSize: '0.68rem', fontWeight: 700,
              color: 'var(--text-sub)', textTransform: 'uppercase',
              letterSpacing: lang === 'ar' ? 0 : '0.06em', padding: '5px 0',
            }}>
              {d}
            </div>
          ))}
        </div>

        {/* Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
          {cells.map((d, i) => {
            if (!d) return <div key={i} style={{ minHeight: 72 }} />;
            const dayAppts = apptsByDay(d);
            const isToday = sameDay(d, today);
            const key = d.toISOString().split('T')[0];
            const isExpanded = expandedDay === key;
            return (
              <div
                key={i}
                onClick={() => setExpandedDay(isExpanded ? null : key)}
                style={{
                  background: isToday ? 'rgba(var(--rose-rgb),0.06)' : 'var(--bg-elevated)',
                  borderRadius: 10,
                  padding: '6px 5px 8px',
                  border: isToday ? '2px solid var(--rose)' : '1.5px solid var(--border)',
                  minHeight: 72,
                  cursor: dayAppts.length > 0 ? 'pointer' : 'default',
                  transition: 'background 0.12s',
                }}
              >
                <div style={{
                  width: 24, height: 24, borderRadius: '50%',
                  background: isToday ? 'var(--rose)' : 'transparent',
                  color: isToday ? '#fff' : 'var(--text)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 800, fontSize: '0.78rem', marginBottom: 4,
                  boxShadow: isToday ? '0 2px 8px rgba(var(--rose-rgb),0.35)' : 'none',
                }}>
                  {d.getDate()}
                </div>
                {dayAppts.length > 0 && (
                  isExpanded ? (
                    <div>
                      {dayAppts.map(a => <ApptCard key={a.id} a={a} compact />)}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {dayAppts.slice(0, 3).map(a => (
                        <div key={a.id} style={{
                          height: 4, borderRadius: 2,
                          background: STATUS_COLOR[a.status] ?? '#6366f1',
                        }} />
                      ))}
                      {dayAppts.length > 3 && (
                        <div style={{ fontSize: '0.58rem', color: 'var(--text-sub)', marginTop: 1, fontWeight: 700 }}>
                          +{dayAppts.length - 3} {t('calMore')}
                        </div>
                      )}
                    </div>
                  )
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const viewLabels: Record<View, string> = { day: t('calDay'), week: t('calWeek'), month: t('calMonth') };

  return (
    <ProtectedRoute permKeys={['viewCalendar', 'manageAppointments']}>
      <style dangerouslySetInnerHTML={{ __html: `
        .cal-view-btn {
          background: var(--bg-elevated);
          border: 1.5px solid var(--border);
          border-radius: 9px;
          padding: 8px 16px;
          font-size: 0.82rem; font-weight: 700;
          color: var(--text-sub);
          cursor: pointer;
          transition: all 0.15s;
          font-family: var(--font);
          white-space: nowrap;
        }
        .cal-view-btn.active {
          background: var(--rose);
          border-color: var(--rose);
          color: #fff;
          box-shadow: 0 4px 14px rgba(var(--rose-rgb),0.35);
        }
        .cal-view-btn:hover:not(.active) {
          border-color: var(--rose);
          color: var(--text);
          background: var(--bg-card);
        }
        .cal-nav-btn {
          background: var(--bg-elevated);
          border: 1.5px solid var(--border);
          border-radius: 9px;
          width: 36px; height: 36px;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; color: var(--text);
          font-size: 1.1rem; font-weight: 700;
          transition: all 0.15s;
        }
        .cal-nav-btn:hover { background: var(--bg-card); border-color: var(--rose); color: var(--rose); }
        .cal-select {
          background: var(--bg-surface);
          border: 1.5px solid var(--border-strong);
          border-radius: 9px;
          padding: 8px 12px;
          color: var(--text);
          font-size: 0.82rem;
          font-family: var(--font);
          outline: none;
          transition: border-color 0.15s;
          min-width: 0;
        }
        .cal-select:focus { border-color: var(--rose); }
        .cal-select { flex: 1; min-width: 120px; }

        /* ── responsive controls ── */
        @media (max-width: 640px) {
          .cal-controls {
            flex-direction: column !important;
            gap: 10px !important;
          }
          .cal-controls-top {
            display: flex; gap: 8px; align-items: center; justify-content: space-between; flex-wrap: wrap;
          }
          .cal-controls-bottom {
            display: flex; gap: 8px; align-items: center; flex-wrap: wrap;
          }
          .cal-heading-text {
            font-size: 0.85rem !important;
            text-align: center;
            width: 100%;
            order: -1;
          }
          .cal-select { width: 100%; }
        }
        @media (min-width: 641px) {
          .cal-controls-top, .cal-controls-bottom { display: contents; }
        }
      `}} />

      {/* Page header */}
      <div className="page-header" dir={isRTL ? 'rtl' : 'ltr'}>
        <div>
          <h1 className="page-title">
            <span style={{ marginRight: isRTL ? 0 : 10, marginLeft: isRTL ? 10 : 0 }}>📅</span>
            {t('calTitle')}
          </h1>
          <p className="page-sub">{t('calSub')}</p>
        </div>
        {notifStatus !== 'unsupported' && notifStatus !== 'granted' && (
          <button onClick={requestNotif} className="btn btn-secondary btn-sm">
            🔔 {t('calEnableReminders')}
          </button>
        )}
        {notifStatus === 'granted' && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'rgba(5,150,105,0.12)',
            border: '1.5px solid rgba(5,150,105,0.3)',
            borderRadius: 9, padding: '7px 13px',
            fontSize: '0.8rem', fontWeight: 700, color: '#059669',
          }}>
            🔔 {t('calRemindersOn')}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="glass-card" style={{ marginBottom: 14 }}>
        <div className="cal-controls" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', direction: isRTL ? 'rtl' : 'ltr' }}>

          {/* Top row on mobile: view toggle + nav */}
          <div className="cal-controls-top" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {/* View toggle */}
            <div style={{ display: 'flex', gap: 4, background: 'var(--bg-elevated)', borderRadius: 11, padding: 4 }}>
              {(['day', 'week', 'month'] as View[]).map(v => (
                <button key={v} onClick={() => setView(v)} className={`cal-view-btn${view === v ? ' active' : ''}`}
                  style={{ padding: '6px 13px', borderRadius: 7, border: 'none' }}>
                  {viewLabels[v]}
                </button>
              ))}
            </div>

            {/* Nav */}
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <button onClick={() => goTo(-1)} className="cal-nav-btn">{isRTL ? '›' : '‹'}</button>
              <button onClick={goToday} className="cal-view-btn" style={{ padding: '6px 12px' }}>
                {t('today')}
              </button>
              <button onClick={() => goTo(1)} className="cal-nav-btn">{isRTL ? '‹' : '›'}</button>
            </div>

            {/* Date heading */}
            <div className="cal-heading-text" style={{ flex: 1, fontWeight: 800, fontSize: '0.92rem', color: 'var(--text)', textAlign: 'center', minWidth: 140 }}>
              {headingLabel()}
            </div>
          </div>

          {/* Bottom row on mobile: provider filter */}
          <div className="cal-controls-bottom" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {/* My Calendar badge (locked) or toggle (privileged) */}
            {isLockedToProvider ? (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 7,
                background: 'rgba(124,58,237,0.12)', border: '1.5px solid rgba(124,58,237,0.30)',
                borderRadius: 9, padding: '6px 13px',
                fontSize: '0.82rem', fontWeight: 700, color: '#7c3aed',
              }}>
                🩺 {t('calMyCalendar')}
                <span style={{ fontSize: '0.65rem', opacity: 0.7, marginLeft: 2 }}>🔒</span>
              </div>
            ) : (
              <>
                {user?.providerId && (
                  <button
                    onClick={() => setFilterProvider(isOwnCalendar ? '' : user.providerId!)}
                    className={`cal-view-btn${isOwnCalendar ? ' active' : ''}`}
                    style={{ display: 'flex', alignItems: 'center', gap: 5 }}
                  >
                    🩺 {t('calMyCalendar')}
                  </button>
                )}
                {/* Provider filter — only for privileged users */}
                {isPrivileged && (
                  <select value={filterProvider} onChange={e => setFilterProvider(e.target.value)} className="cal-select">
                    <option value="">{t('calAllProviders')}</option>
                    {providers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Calendar body */}
      <div className="glass-card" style={{ minHeight: 300 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-sub)' }}>
            <div style={{ fontSize: '1.8rem', marginBottom: 12, opacity: 0.4 }}>⏳</div>
            <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{t('loading')}</div>
          </div>
        ) : (
          <>
            {view === 'day'   && <DayView />}
            {view === 'week'  && <WeekView />}
            {view === 'month' && <MonthView />}
          </>
        )}
      </div>

      {/* Status legend */}
      <div className="glass-card" style={{ marginTop: 10 }}>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center', direction: isRTL ? 'rtl' : 'ltr' }}>
          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-sub)', textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }}>
            {t('calStatusLabel')}:
          </span>
          {Object.entries(STATUS_COLOR).map(([s, c]) => (
            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 9, height: 9, borderRadius: '50%', background: c, flexShrink: 0 }} />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-sub)', fontWeight: 600 }}>
                {statusLabel(s)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </ProtectedRoute>
  );
}
