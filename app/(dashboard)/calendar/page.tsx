'use client';

import React, { useState, useEffect, useCallback, useRef, TouchEvent } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import toast from 'react-hot-toast';
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
  const [hasPushSub, setHasPushSub] = useState(false);
  const [reminderLeadMinutes, setReminderLeadMinutes] = useState(60);
  const [savingLead, setSavingLead] = useState(false);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [testingNotif, setTestingNotif] = useState(false);
  const notifiedRef = useRef<Set<string>>(new Set());
  const touchStartX = useRef<number | null>(null);

  const days   = lang === 'ar' ? DAYS_AR   : DAYS_EN;
  const months = lang === 'ar' ? MONTHS_AR : MONTHS_EN;
  const isPrivileged = ['ADMIN', 'MANAGER'].includes(user?.role ?? '');
  const isOwnCalendar = !!user?.providerId && filterProvider === user.providerId;

  useEffect(() => {
    if (!('Notification' in window)) { setNotifStatus('unsupported'); return; }
    setNotifStatus(Notification.permission);
    if (Notification.permission === 'granted' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then(reg => {
        if (reg) reg.pushManager.getSubscription().then(sub => setHasPushSub(!!sub));
      }).catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (!user?.token) return;
    fetch('/api/notifications/config', { headers: { Authorization: `Bearer ${user.token}` } })
      .then(r => r.json())
      .then(d => { if (d.reminderLeadMinutes) setReminderLeadMinutes(d.reminderLeadMinutes); })
      .catch(() => {});
  }, [user?.token]);

  const requestNotif = async () => {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'denied') {
      toast.error(
        lang === 'ar'
          ? 'الإشعارات محظورة — افتح إعدادات المتصفح ← إعدادات الموقع ← الإشعارات ← اسمح لهذا الموقع'
          : 'Notifications are blocked — open Chrome Settings → Site Settings → Notifications → Allow for this site',
        { duration: 6000 }
      );
      return;
    }
    const perm = await Notification.requestPermission();
    setNotifStatus(perm);
    if (perm !== 'granted' || !user?.token) return;
    // Always create a fresh push subscription so it matches the current VAPID key
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
      const reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      // Unsubscribe any stale subscription first
      const existing = await reg.pushManager.getSubscription();
      if (existing) await existing.unsubscribe();
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;
      const padding = '='.repeat((4 - (vapidKey.length % 4)) % 4);
      const base64 = (vapidKey + padding).replace(/-/g, '+').replace(/_/g, '/');
      const key = Uint8Array.from([...atob(base64)].map(c => c.charCodeAt(0)));
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.token}` },
        body: JSON.stringify(sub.toJSON()),
      });
      setHasPushSub(true);
      toast.success('Reminders enabled — you\'ll receive push notifications');
    } catch (e) {
      console.warn('[Push] subscribe failed', e);
      toast.error('Failed to enable reminders — ' + String(e));
    }
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

  const [isOnline, setIsOnline] = useState(true);

  const load = useCallback(async () => {
    if (!user?.token) return;
    setLoading(true);
    const { from, to } = getRange();
    const q = new URLSearchParams({ from: from.toISOString(), to: to.toISOString() });
    if (filterProvider) q.set('providerId', filterProvider);
    if (activeBranchId) q.set('branchId', activeBranchId);
    try {
      const res = await fetch(`/api/calendar?${q}`, { headers: { Authorization: `Bearer ${user.token}` } });
      if (res.ok) setAppts(await res.json());
    } catch {
      // offline — SW serves cached response automatically; nothing to do
    }
    setLoading(false);
  }, [user, activeBranchId, filterProvider, getRange]);

  useEffect(() => { load(); }, [load]);

  // Re-fetch when tab becomes visible again (user switched tabs to create/edit an appointment)
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [load]);

  // Re-fetch after offline sync or appointment changes
  useEffect(() => {
    const onSync = () => load();
    window.addEventListener('nexora-sync-complete', onSync);
    window.addEventListener('nexora-appointments-changed', onSync);
    return () => {
      window.removeEventListener('nexora-sync-complete', onSync);
      window.removeEventListener('nexora-appointments-changed', onSync);
    };
  }, [load]);

  // Track online/offline state
  useEffect(() => {
    setIsOnline(navigator.onLine);
    const goOnline  = () => { setIsOnline(true);  load(); };
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online',  goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online',  goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, [load]);

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

  const saveLeadTime = async (minutes: number) => {
    if (!user?.token) return;
    setSavingLead(true);
    try {
      const res = await fetch('/api/notifications/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.token}` },
        body: JSON.stringify({ reminderLeadMinutes: minutes }),
      });
      if (res.ok) {
        setReminderLeadMinutes(minutes);
        toast.success(`Reminder lead time set to ${minutes < 60 ? minutes + ' min' : (minutes / 60) + ' hr'}`);
      }
    } finally {
      setSavingLead(false);
    }
  };

  const sendTestNotification = async () => {
    if (!user?.token) return;
    setTestingNotif(true);
    try {
      const res = await fetch('/api/cron/reminders?test=true', {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      if (!res.ok) throw new Error(data.error ?? `Server error ${res.status}`);
      if (data.sent === 0) {
        toast.error(data.message ?? 'No push subscriptions found — enable reminders first');
      } else {
        toast.success(`Test notification sent to ${data.sent} device(s)`);
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to send test notification');
    } finally {
      setTestingNotif(false);
    }
  };

  const onTouchStart = (e: TouchEvent) => { touchStartX.current = e.touches[0].clientX; };
  const onTouchEnd = (e: TouchEvent) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) < 50) return;
    goTo(dx < 0 ? 1 : -1);
  };

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
    const isToday = sameDay(cursor, new Date());
    return (
      <div>
        {/* Day header */}
        <div style={{
          textAlign: 'center', padding: '14px 0 16px',
          borderBottom: '1px solid var(--border)', marginBottom: 8,
        }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: isToday ? 'var(--rose)' : 'var(--text-sub)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
            {days[cursor.getDay()]}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <div style={{
              width: 42, height: 42, borderRadius: '50%',
              background: isToday ? 'var(--rose)' : 'transparent',
              color: isToday ? '#fff' : 'var(--text)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 900, fontSize: '1.2rem',
              boxShadow: isToday ? '0 4px 16px rgba(var(--rose-rgb),0.40)' : 'none',
            }}>
              {cursor.getDate()}
            </div>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-sub)', marginTop: 6, fontWeight: 600 }}>
            {months[cursor.getMonth()]} {cursor.getFullYear()}
            {todayAppts.length > 0 && (
              <span style={{ marginInlineStart: 8, background: 'var(--rose)', color: '#fff', borderRadius: 10, padding: '1px 7px', fontSize: '0.68rem', fontWeight: 700 }}>
                {todayAppts.length} {lang === 'ar' ? 'موعد' : 'appts'}
              </span>
            )}
          </div>
        </div>

        {/* Back to week button */}
        <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button
            onClick={() => setView('week')}
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '5px 12px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-sub)', fontFamily: 'var(--font)', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            ← {lang === 'ar' ? 'العودة للأسبوع' : 'Back to week'}
          </button>
          {loading && <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>...</span>}
        </div>

        {/* Appointments — full list, ALL hours (not filtered to 6–21) */}
        {todayAppts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-sub)' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: 10, opacity: 0.4 }}>📅</div>
            <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{t('calNoApptsDay')}</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {todayAppts.map(a => (
              <div key={a.id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                {/* Time label */}
                <div style={{
                  width: 62, flexShrink: 0, paddingTop: 10,
                  fontSize: '0.72rem', color: 'var(--text-sub)', fontWeight: 700,
                  textAlign: isRTL ? 'left' : 'right',
                }}>
                  {fmtTime(a.dateTime)}
                </div>
                {/* Full appointment card */}
                <div style={{ flex: 1 }}>
                  <ApptCard a={a} />
                </div>
              </div>
            ))}
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
    const [hoveredDay, setHoveredDay] = useState<number | null>(null);
    return (
      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(110px, 1fr))', gap: 5, minWidth: 580 }}>
          {weekDays.map((d, i) => {
            const dayAppts = apptsByDay(d);
            const isToday = sameDay(d, today);
            const hasSelf = isOwnCalendar;
            const isHovered = hoveredDay === i;
            return (
              <div
                key={i}
                onClick={() => { setCursor(d); setView('day'); }}
                onMouseEnter={() => setHoveredDay(i)}
                onMouseLeave={() => setHoveredDay(null)}
                style={{
                  background: isToday ? 'var(--bg-card)' : isHovered ? 'var(--bg-card)' : 'var(--bg-elevated)',
                  borderRadius: 12,
                  padding: '10px 8px 12px',
                  border: isToday
                    ? '2px solid var(--rose)'
                    : isHovered
                      ? '1.5px solid rgba(var(--rose-rgb),0.4)'
                      : hasSelf && dayAppts.length > 0
                        ? '1.5px solid rgba(124,58,237,0.3)'
                        : '1.5px solid var(--border)',
                  minHeight: 110,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  boxShadow: isHovered ? '0 4px 20px rgba(0,0,0,0.1)' : 'none',
                  transform: isHovered ? 'translateY(-2px)' : 'none',
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
                {/* Click hint */}
                {dayAppts.length > 0 && isHovered && (
                  <div style={{ textAlign: 'center', marginTop: 6, fontSize: '0.58rem', color: 'var(--rose)', fontWeight: 700 }}>
                    {lang === 'ar' ? 'انقر للتفاصيل' : 'tap for details'}
                  </div>
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
                onClick={() => { setCursor(d); setView('day'); }}
                style={{
                  background: isToday ? 'rgba(var(--rose-rgb),0.06)' : 'var(--bg-elevated)',
                  borderRadius: 10,
                  padding: '6px 5px 8px',
                  border: isToday ? '2px solid var(--rose)' : '1.5px solid var(--border)',
                  minHeight: 72,
                  cursor: 'pointer',
                  transition: 'all 0.12s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(var(--rose-rgb),0.4)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = isToday ? 'var(--rose)' : 'var(--border)'; (e.currentTarget as HTMLElement).style.transform = ''; }}
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
          background: linear-gradient(135deg, var(--rose), rgba(var(--rose-rgb),0.75));
          border: none;
          border-radius: 50%;
          width: 38px; height: 38px;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; color: #fff;
          transition: all 0.18s cubic-bezier(.4,0,.2,1);
          box-shadow: 0 4px 14px rgba(var(--rose-rgb),0.38);
          flex-shrink: 0;
        }
        .cal-nav-btn:hover {
          transform: scale(1.12);
          box-shadow: 0 6px 22px rgba(var(--rose-rgb),0.55);
        }
        .cal-nav-btn:active { transform: scale(0.93); }
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

          /* Bigger touch targets on mobile */
          .cal-nav-btn { width: 44px !important; height: 44px !important; }
          .cal-view-btn { padding: 10px 14px !important; font-size: 0.84rem !important; }

          /* Day view improvements on mobile */
          .cal-day-slot { padding: 10px 0 !important; }
          .cal-day-time { width: 46px !important; font-size: 0.68rem !important; }

          /* Month view — tighter cells on small screens */
          .cal-month-cell { min-height: 58px !important; padding: 5px 4px 6px !important; }
          .cal-month-day-num { width: 22px !important; height: 22px !important; font-size: 0.74rem !important; }

          /* Week view compact cards */
          .cal-week-card { padding: 4px 6px 4px 8px !important; }
        }
        @media (min-width: 641px) {
          .cal-controls-top, .cal-controls-bottom { display: contents; }
        }

        /* Swipe hint bar */
        .cal-swipe-hint {
          display: none;
          text-align: center;
          font-size: 0.65rem;
          color: var(--text-sub);
          padding: 6px 0 0;
          letter-spacing: 0.04em;
          opacity: 0.6;
        }
        @media (max-width: 640px) { .cal-swipe-hint { display: block; } }
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
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {notifStatus !== 'unsupported' && (notifStatus !== 'granted' || !hasPushSub) && (
            <button onClick={requestNotif} className="btn btn-secondary btn-sm">
              🔔 {t('calEnableReminders')}
            </button>
          )}
          {notifStatus === 'granted' && hasPushSub && (
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
          {isPrivileged && notifStatus === 'granted' && hasPushSub && (
            <>
              <select
                value={reminderLeadMinutes}
                disabled={savingLead}
                onChange={e => saveLeadTime(Number(e.target.value))}
                title="Send reminder this many minutes before each appointment"
                style={{
                  fontSize: '0.78rem', fontWeight: 600, padding: '5px 8px',
                  borderRadius: 8, border: '1.5px solid var(--border)',
                  background: 'var(--bg-elevated)', color: 'var(--text)',
                  cursor: 'pointer',
                }}
              >
                <option value={15}>⏰ 15 min before</option>
                <option value={30}>⏰ 30 min before</option>
                <option value={60}>⏰ 1 hr before</option>
                <option value={120}>⏰ 2 hr before</option>
                <option value={180}>⏰ 3 hr before</option>
                <option value={360}>⏰ 6 hr before</option>
                <option value={720}>⏰ 12 hr before</option>
                <option value={1440}>⏰ 24 hr before</option>
              </select>
              <button
                className="btn btn-ghost btn-sm"
                onClick={sendTestNotification}
                disabled={testingNotif}
                title="Send a test push notification to your device now"
                style={{ fontSize: '0.78rem' }}
              >
                {testingNotif ? '⏳' : '🧪'} {lang === 'ar' ? 'اختبار الإشعار' : 'Test Notif'}
              </button>
            </>
          )}
          {/* Offline indicator */}
          {!isOnline && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(245,158,11,0.12)', border: '1.5px solid rgba(245,158,11,0.3)', borderRadius: 9, padding: '6px 12px', fontSize: '0.78rem', fontWeight: 700, color: '#d97706' }}>
              📡 {lang === 'ar' ? 'غير متصل — عرض مؤقت' : 'Offline — cached view'}
            </div>
          )}
          {/* Manual refresh */}
          <button
            onClick={() => load()}
            disabled={loading}
            title={lang === 'ar' ? 'تحديث البيانات' : 'Refresh calendar'}
            style={{ background: 'var(--bg-elevated)', border: '1.5px solid var(--border)', borderRadius: 9, padding: '7px 12px', cursor: loading ? 'not-allowed' : 'pointer', fontSize: '1rem', opacity: loading ? 0.5 : 1, transition: 'opacity 0.15s' }}
          >
            🔄
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="glass-card" style={{ marginBottom: 14, padding: '14px 18px' }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap', direction: isRTL ? 'rtl' : 'ltr' }}>

          {/* Left: View toggle */}
          <div style={{ display: 'flex', gap: 4, background: 'var(--bg-elevated)', borderRadius: 11, padding: 4, flexShrink: 0 }}>
            {(['day', 'week', 'month'] as View[]).map(v => (
              <button key={v} onClick={() => setView(v)} className={`cal-view-btn${view === v ? ' active' : ''}`}
                style={{ padding: '6px 13px', borderRadius: 7, border: 'none' }}>
                {viewLabels[v]}
              </button>
            ))}
          </div>

          {/* Center: ← Date heading → with Today */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flex: 1, justifyContent: 'center', minWidth: 220 }}>
            <button onClick={() => goTo(-1)} className="cal-nav-btn" title="Previous">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d={isRTL ? 'M9 18l6-6-6-6' : 'M15 18l-6-6 6-6'} />
              </svg>
            </button>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, minWidth: 150 }}>
              <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text)', textAlign: 'center', whiteSpace: 'nowrap' }}>
                {headingLabel()}
              </div>
              <button onClick={goToday} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 700, color: 'var(--rose)', fontFamily: 'var(--font)', padding: '1px 6px', borderRadius: 4, transition: 'background 0.12s' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(var(--rose-rgb),0.10)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                {t('today')}
              </button>
            </div>
            <button onClick={() => goTo(1)} className="cal-nav-btn" title="Next">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d={isRTL ? 'M15 18l-6-6 6-6' : 'M9 18l6-6-6-6'} />
              </svg>
            </button>
          </div>

          {/* Right: Provider filter */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
            {user?.providerId && (
              <button
                onClick={() => setFilterProvider(isOwnCalendar ? '' : user.providerId!)}
                className={`cal-view-btn${isOwnCalendar ? ' active' : ''}`}
                style={{ display: 'flex', alignItems: 'center', gap: 5 }}
              >
                🩺 {t('calMyCalendar')}
              </button>
            )}
            {isPrivileged && (
              <select value={filterProvider} onChange={e => setFilterProvider(e.target.value)} className="cal-select">
                <option value="">{t('calAllProviders')}</option>
                {providers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            )}
          </div>
        </div>
      </div>

      {/* Calendar body */}
      <div
        className="glass-card"
        style={{ minHeight: 300 }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
          <div style={{ opacity: loading ? 0.55 : 1, transition: 'opacity 0.25s', pointerEvents: loading ? 'none' : 'auto' }}>
            {view === 'day'   && <DayView />}
            {view === 'week'  && <WeekView />}
            {view === 'month' && <MonthView />}
            <div className="cal-swipe-hint">← swipe to navigate →</div>
          </div>
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
