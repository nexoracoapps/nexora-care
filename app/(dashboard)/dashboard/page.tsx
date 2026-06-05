'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import ProtectedRoute from '@/components/ProtectedRoute';
import NexoraCareIcon from '@/components/NexoraCareIcon';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { useBranch } from '@/context/BranchContext';
import type { Appointment } from '@/types';

/* ── Count-up animation ─────────────────────────────────── */
function useCountUp(target: number | null | undefined, duration = 1400) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (target == null) return;
    const to = parseFloat(String(target)) || 0;
    if (to === 0) { setVal(0); return; }
    const start = performance.now();
    const tick = (ts: number) => {
      const p = Math.min((ts - start) / duration, 1);
      setVal(to * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [target, duration]);
  return val;
}

/* ── Live clock ─────────────────────────────────────────── */
function useClock() {
  const [t, setT] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setT(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return t;
}

/* ── Entrance fade helper ───────────────────────────────── */
function useEnter(delay = 0) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setOn(true), delay);
    return () => clearTimeout(id);
  }, [delay]);
  return on;
}

/* ── Radial progress ring ───────────────────────────────── */
function Ring({ pct = 0, color, size = 90, stroke = 7, label, value }: {
  pct?: number; color: string; size?: number; stroke?: number; label?: string; value?: string;
}) {
  const r = (size - stroke * 2) / 2;
  const circ = 2 * Math.PI * r;
  const off = circ * (1 - Math.min(100, Math.max(0, pct)) / 100);
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', display: 'block' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={off}
          style={{ transition: 'stroke-dashoffset 1.5s cubic-bezier(.34,1.56,.64,1)', filter: `drop-shadow(0 0 6px ${color}88)` }}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', lineHeight: 1 }}>{value}</span>
        {label && <span style={{ fontSize: 9, color: 'var(--text-sub)', marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</span>}
      </div>
    </div>
  );
}

/* ── KPI card ───────────────────────────────────────────── */
function KpiCard({ label, value, icon, accent, to, delay = 0 }: {
  label: string; value: number | null | undefined;
  icon: React.ReactNode; accent: string; to: string; delay?: number;
}) {
  const num = useCountUp(typeof value === 'number' ? value : null);
  const on = useEnter(delay);
  return (
    <Link href={to} className="db-kpi" style={{
      '--ka': accent,
      opacity: on ? 1 : 0,
      transform: on ? 'translateY(0)' : 'translateY(18px)',
      transition: `opacity 0.45s ease ${delay}ms, transform 0.45s ease ${delay}ms`,
    } as React.CSSProperties}>
      <div className="db-kpi-top">
        <div className="db-kpi-ico">{icon}</div>
        <svg className="db-kpi-arr" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M7 17L17 7M7 7h10v10"/></svg>
      </div>
      <div className="db-kpi-num">
        {value == null ? <span style={{ opacity: 0.25 }}>—</span> : Math.round(num).toLocaleString()}
      </div>
      <div className="db-kpi-lbl">{label}</div>
      <div className="db-kpi-bar" />
    </Link>
  );
}

/* ── Revenue counter ────────────────────────────────────── */
function Revenue({ val }: { val: number | undefined }) {
  const n = useCountUp(val, 1600);
  return <>{n.toFixed(0)}</>;
}

/* ── Booking card row ───────────────────────────────────── */
function BkCard({ appt, fmt, t, delay }: {
  appt: Appointment; fmt: (d: string) => string;
  t: (k: string) => any; delay: number;
}) {
  const on = useEnter(delay);
  const name = appt.customer?.name || '?';
  const initials = name.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase();
  const SC: Record<string, { bg: string; c: string; b: string }> = {
    SCHEDULED: { bg: 'rgba(5,150,105,0.10)',  c: '#059669', b: 'rgba(5,150,105,0.22)' },
    COMPLETED: { bg: 'rgba(37,99,235,0.10)',  c: '#2563eb', b: 'rgba(37,99,235,0.22)' },
    CANCELLED: { bg: 'rgba(220,38,38,0.10)',  c: '#dc2626', b: 'rgba(220,38,38,0.22)' },
    NO_SHOW:   { bg: 'rgba(217,119,6,0.10)',  c: '#d97706', b: 'rgba(217,119,6,0.22)' },
  };
  const sc = SC[appt.status] || SC.SCHEDULED;
  const SL: Record<string, string> = {
    SCHEDULED: t('scheduled'), COMPLETED: t('completed'),
    CANCELLED: t('cancelled'), NO_SHOW: t('noShows'),
  };
  const statusLabel = SL[appt.status] || appt.status;

  return (
    <div className="db-bk-row" style={{
      opacity: on ? 1 : 0,
      transform: on ? 'translateX(0)' : 'translateX(-14px)',
      transition: `opacity 0.4s ease ${delay}ms, transform 0.4s ease ${delay}ms`,
    }}>
      <div className="db-bk-av">{initials}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--text)' }}>{name}</span>
          <span style={{ fontSize: 11, padding: '2px 9px', borderRadius: 20, background: sc.bg, color: sc.c, border: `1px solid ${sc.b}`, fontWeight: 600, flexShrink: 0 }}>{statusLabel}</span>
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--text-sub)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {appt.service?.name && <span>✨ {appt.service.name}</span>}
          {appt.serviceProvider?.name && <><span style={{ opacity: 0.3 }}>·</span><span>✂️ {appt.serviceProvider.name}</span></>}
        </div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, background: 'var(--grad)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          ${parseFloat(String(appt.amount || 0)).toFixed(2)}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-sub)', marginTop: 2 }}>{fmt(appt.dateTime)}</div>
      </div>
    </div>
  );
}

/* ── Filter appointments by period ─────────────────────── */
function filterByPeriod(appts: Appointment[], period: string) {
  const now = new Date();
  if (period === 'today') {
    const todayStr = now.toDateString();
    return appts.filter(a => new Date(a.dateTime).toDateString() === todayStr);
  }
  if (period === 'week') {
    const cutoff = new Date(now); cutoff.setDate(now.getDate() - 7);
    return appts.filter(a => new Date(a.dateTime) >= cutoff);
  }
  if (period === 'month') {
    const cutoff = new Date(now); cutoff.setMonth(now.getMonth() - 1);
    return appts.filter(a => new Date(a.dateTime) >= cutoff);
  }
  return appts;
}

/* ── Dashboard ──────────────────────────────────────────── */
export default function DashboardPage() {
  const { user } = useAuth();
  const { t, lang } = useLanguage();
  const { activeBranchId } = useBranch();
  const now = useClock();

  const [allAppts, setAllAppts] = useState<Appointment[]>([]);
  const [staticCounts, setStaticCounts] = useState<{ clients?: number; treatments?: number; specialists?: number }>({});
  const [stats, setStats] = useState<Record<string, any>>({});
  const [recent, setRecent] = useState<Appointment[]>([]);
  const [rings, setRings] = useState(false);
  const [period, setPeriod] = useState('all');

  useEffect(() => {
    if (!user?.token) return;
    const headers = { Authorization: `Bearer ${user.token}` };
    const bq = activeBranchId ? `?branchId=${activeBranchId}` : '';
    Promise.all([
      fetch(`/api/customers${bq}`, { headers }).then(r => r.json()),
      fetch('/api/services', { headers }).then(r => r.json()),
      fetch(`/api/providers${bq}`, { headers }).then(r => r.json()),
      fetch(`/api/appointments${bq}`, { headers }).then(r => r.json()),
    ]).then(([c, s, p, a]) => {
      const appts: Appointment[] = Array.isArray(a) ? a : (a.items ?? []);
      setAllAppts(appts);
      const customers = Array.isArray(c) ? c : (c.items ?? c.data ?? []);
      setStaticCounts({
        clients:     typeof c.total === 'number' ? c.total : customers.length,
        treatments:  Array.isArray(s) ? s.length : (s.items ?? s.data ?? []).length,
        specialists: Array.isArray(p) ? p.length : (p.items ?? p.data ?? []).length,
      });
    }).catch(() => {});
  }, [user, activeBranchId]);

  useEffect(() => {
    setRings(false);
    const appts    = filterByPeriod(allAppts, period);
    const total    = appts.length;
    const scheduled = appts.filter(x => x.status === 'SCHEDULED').length;
    const completed = appts.filter(x => x.status === 'COMPLETED').length;
    const cancelled = appts.filter(x => x.status === 'CANCELLED').length;
    const noShow    = appts.filter(x => x.status === 'NO_SHOW').length;
    const revenue   = appts.filter(x => x.status !== 'CANCELLED')
      .reduce((sum, x) => sum + parseFloat(String(x.amount || 0)), 0);
    setStats({
      ...staticCounts,
      total, scheduled, completed, cancelled, noShow, revenue,
      schedRate:     total ? Math.round((scheduled / total) * 100) : 0,
      completedRate: total ? Math.round((completed / total) * 100) : 0,
    });
    setRecent([...appts].sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime()).slice(0, 7));
    setTimeout(() => setRings(true), 300);
  }, [allAppts, staticCounts, period]);

  const fmt = (dt: string) => dt
    ? new Date(dt).toLocaleString(lang === 'ar' ? 'ar-SA' : 'en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—';

  const greeting = () => {
    const h = now.getHours();
    if (lang === 'ar') {
      if (h < 12) return 'صباح الخير';
      if (h < 17) return 'مساء النور';
      return 'مساء الخير';
    }
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const timeStr = now.toLocaleTimeString(lang === 'ar' ? 'ar-SA' : 'en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dateStr = now.toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const statusRows = [
    { label: t('scheduled'), val: stats.scheduled ?? 0, color: '#059669', pct: stats.total ? (stats.scheduled / stats.total) * 100 : 0 },
    { label: t('completed'), val: stats.completed ?? 0, color: '#2563eb', pct: stats.total ? (stats.completed / stats.total) * 100 : 0 },
    { label: t('cancelled'), val: stats.cancelled ?? 0, color: '#dc2626', pct: stats.total ? (stats.cancelled / stats.total) * 100 : 0 },
    { label: t('noShows'),   val: stats.noShow   ?? 0, color: '#d97706', pct: stats.total ? (stats.noShow   / stats.total) * 100 : 0 },
  ];

  return (
    <ProtectedRoute permKey="dashboard">
      <>
        <style dangerouslySetInnerHTML={{ __html: `
          .db-kpi {
            position: relative; overflow: hidden;
            background: var(--bg-surface, #fff);
            border: 1px solid rgba(0,0,0,0.08);
            border-radius: 20px; padding: 22px 22px 18px;
            text-decoration: none; display: flex; flex-direction: column;
            cursor: pointer;
            box-shadow: 0 1px 4px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.06);
            transition: transform 0.22s, box-shadow 0.24s, border-color 0.22s;
          }
          .db-kpi::before {
            content: ''; position: absolute; inset: 0; border-radius: 20px;
            background: var(--ka); opacity: 0.045; pointer-events: none;
          }
          .db-kpi:hover {
            transform: translateY(-4px);
            box-shadow: 0 2px 6px rgba(0,0,0,0.04), 0 12px 36px rgba(0,0,0,0.10);
            border-color: var(--ka);
          }
          .db-kpi-top {
            display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px;
          }
          .db-kpi-ico {
            width: 44px; height: 44px; border-radius: 13px;
            background: color-mix(in srgb, var(--ka) 15%, transparent);
            border: 1px solid color-mix(in srgb, var(--ka) 30%, transparent);
            display: flex; align-items: center; justify-content: center;
            color: var(--ka);
          }
          .db-kpi-arr {
            color: color-mix(in srgb, var(--ka) 50%, transparent);
            transition: transform 0.2s;
          }
          .db-kpi:hover .db-kpi-arr { transform: translate(2px, -2px); }
          .db-kpi-num {
            font-size: 38px; font-weight: 800; line-height: 1;
            color: var(--text); letter-spacing: -1px;
            margin-bottom: 5px;
          }
          .db-kpi-lbl {
            font-size: 12px; font-weight: 600;
            color: var(--text-sub); letter-spacing: 0.3px; text-transform: uppercase;
          }
          .db-kpi-bar {
            position: absolute; bottom: 0; left: 0; right: 0; height: 3px;
            background: var(--ka); opacity: 0; border-radius: 0 0 20px 20px;
            transition: opacity 0.2s;
          }
          .db-kpi:hover .db-kpi-bar { opacity: 0.7; }
          .db-qa {
            display: inline-flex; align-items: center; gap: 7px;
            padding: 9px 16px; border-radius: 10px;
            font-family: var(--font); font-size: 12.5px; font-weight: 600;
            text-decoration: none; cursor: pointer; border: none;
            transition: transform 0.15s, box-shadow 0.18s;
            white-space: nowrap;
          }
          .db-qa:hover { transform: translateY(-1px); }
          .db-qa-primary {
            background: var(--grad);
            color: #fff; box-shadow: 0 4px 18px rgba(196,120,140,0.30);
          }
          .db-qa-primary:hover { box-shadow: 0 6px 28px rgba(196,120,140,0.50); }
          .db-qa-ghost {
            background: rgba(0,0,0,0.04); color: var(--text-muted);
            border: 1px solid rgba(0,0,0,0.09);
          }
          .db-qa-ghost:hover {
            background: rgba(196,120,140,0.08);
            border-color: rgba(196,120,140,0.28); color: var(--rose-dark);
          }
          .db-bar-track {
            height: 6px; border-radius: 20px;
            background: rgba(0,0,0,0.07); overflow: hidden;
          }
          .db-bar-fill {
            height: 100%; border-radius: 20px;
            transition: width 1.5s cubic-bezier(.34,1.56,.64,1);
          }
          .db-bk-row {
            display: flex; align-items: center; gap: 14px;
            padding: 14px 20px;
            border-bottom: 1px solid rgba(0,0,0,0.07);
            transition: background 0.14s;
          }
          .db-bk-row:last-child { border-bottom: none; }
          .db-bk-row:hover { background: rgba(196,120,140,0.04); }
          .db-bk-av {
            width: 40px; height: 40px; border-radius: 12px; flex-shrink: 0;
            background: var(--grad);
            display: flex; align-items: center; justify-content: center;
            font-size: 12px; font-weight: 700; color: #fff;
            box-shadow: 0 3px 14px rgba(196,120,140,0.28);
          }
          .db-clock {
            font-variant-numeric: tabular-nums; font-size: 18px; font-weight: 800;
            background: linear-gradient(135deg, var(--rose), var(--plum));
            -webkit-background-clip: text; -webkit-text-fill-color: transparent;
            letter-spacing: 1px; line-height: 1;
          }
          .db-orb {
            position: absolute; border-radius: 50%; pointer-events: none;
            filter: blur(90px); animation: db-float 14s ease-in-out infinite alternate;
          }
          @keyframes db-float {
            from { transform: translate(0, 0) scale(1); }
            to   { transform: translate(18px, -22px) scale(1.07); }
          }
          @media (max-width: 768px) {
            .db-mid { grid-template-columns: 1fr !important; }
            .db-kpi-num { font-size: 32px; }
          }
          @media (max-width: 640px) {
            .db-qa-row { flex-wrap: wrap; }
            .db-clock { font-size: 15px; }
          }
        ` }} />

        <div style={{ position: 'relative', overflow: 'hidden' }}>
          {/* Ambient glow orbs */}
          <div className="db-orb" style={{ width: 440, height: 440, background: 'radial-gradient(circle, rgba(196,120,140,0.11) 0%, transparent 70%)', top: -120, right: -100 }} />
          <div className="db-orb" style={{ width: 350, height: 350, background: 'radial-gradient(circle, rgba(123,94,168,0.09) 0%, transparent 70%)', bottom: 40, left: -80, animationDelay: '-7s' }} />
          <div className="db-orb" style={{ width: 260, height: 260, background: 'radial-gradient(circle, rgba(201,169,110,0.07) 0%, transparent 70%)', top: '40%', right: '30%', animationDelay: '-3s', animationDuration: '18s' }} />

          {/* Hero header */}
          <div style={{ marginBottom: 36, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 20, position: 'relative', zIndex: 1 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                <NexoraCareIcon size={52} />
                <div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text)', letterSpacing: -0.5, lineHeight: 1.1 }}>
                    {greeting()},{' '}
                    <span style={{ background: 'var(--grad)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                      {user?.username}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-sub)', marginTop: 3 }}>{t('overviewToday')}</div>
                </div>
              </div>
              {/* Quick actions */}
              <div className="db-qa-row" style={{ display: 'flex', gap: 8, marginInlineStart: 64 }}>
                <Link href="/appointments" className="db-qa db-qa-primary">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                  {t('newBooking')}
                </Link>
                <Link href="/customers" className="db-qa db-qa-ghost">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
                  </svg>
                  {t('newClient')}
                </Link>
                <Link href="/services" className="db-qa db-qa-ghost">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M12 2l1.8 5.5H19l-4.7 3.4 1.8 5.5L12 13l-4.1 3.4 1.8-5.5L5 7.5h5.2z" />
                  </svg>
                  {t('newTreatment')}
                </Link>
              </div>
            </div>

            {/* Live clock */}
            <div style={{ background: 'var(--bg-surface,#fff)', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 18, padding: '16px 22px', textAlign: 'center', minWidth: 170, boxShadow: '0 1px 4px rgba(0,0,0,0.04),0 4px 16px rgba(0,0,0,0.06)' }}>
              <div className="db-clock">{timeStr}</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-sub)', marginTop: 6, lineHeight: 1.5 }}>{dateStr}</div>
            </div>
          </div>

          {/* Period toggle */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 18, position: 'relative', zIndex: 1, flexWrap: 'wrap' }}>
            {[
              { key: 'today', label: 'Today',      labelAr: 'اليوم' },
              { key: 'week',  label: 'This Week',  labelAr: 'هذا الأسبوع' },
              { key: 'month', label: 'This Month', labelAr: 'هذا الشهر' },
              { key: 'all',   label: 'All Time',   labelAr: 'الكل' },
            ].map(p => (
              <button key={p.key} onClick={() => setPeriod(p.key)} style={{
                padding: '7px 16px', borderRadius: 20, cursor: 'pointer',
                border: period === p.key ? '1.5px solid rgba(var(--rose-rgb),0.45)' : '1.5px solid var(--border)',
                background: period === p.key ? 'rgba(var(--rose-rgb),0.10)' : 'transparent',
                color: period === p.key ? 'var(--rose)' : 'var(--text-muted)',
                fontSize: 12.5, fontWeight: 600, fontFamily: 'var(--font)',
                transition: 'all 0.15s',
              }}>
                {lang === 'ar' ? p.labelAr : p.label}
              </button>
            ))}
          </div>

          {/* KPI grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px,1fr))', gap: 16, marginBottom: 22, position: 'relative', zIndex: 1 }}>
            <KpiCard label={t('totalClients')}     value={stats.clients}     to="/customers"    accent="#c4788c" delay={0}
              icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>} />
            <KpiCard label={t('totalTreatments')}  value={stats.treatments}  to="/services"     accent="#c9a96e" delay={90}
              icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M12 2l1.8 5.5H19l-4.7 3.4 1.8 5.5L12 13l-4.1 3.4 1.8-5.5L5 7.5h5.2z"/></svg>} />
            <KpiCard label={t('totalSpecialists')} value={stats.specialists} to="/providers"    accent="#7b5ea8" delay={180}
              icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>} />
            <KpiCard label={t('totalBookings')}    value={stats.total}       to="/appointments" accent="#0d9488" delay={270}
              icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>} />
          </div>

          {/* Middle row: Status + Revenue */}
          <div className="db-mid" style={{ display: 'grid', gridTemplateColumns: '1.15fr 1fr', gap: 16, marginBottom: 22, position: 'relative', zIndex: 1 }}>
            {/* Status breakdown card */}
            <div style={{ background: 'var(--bg-surface,#fff)', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 20, padding: '22px 24px', boxShadow: '0 1px 4px rgba(0,0,0,0.04),0 4px 16px rgba(0,0,0,0.06)' }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)', marginBottom: 22 }}>{t('bookingBreakdown')}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 26 }}>
                <Ring pct={rings ? stats.schedRate || 0 : 0} color="#059669" size={88} stroke={7} value={`${stats.schedRate ?? 0}%`} label="sched" />
                <div style={{ flex: 1 }}>
                  {statusRows.map(s => (
                    <div key={s.label} style={{ marginBottom: 11 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>{s.label}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: s.color }}>{s.val}</span>
                      </div>
                      <div className="db-bar-track">
                        <div className="db-bar-fill" style={{ width: rings ? `${s.pct}%` : '0%', background: s.color }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Revenue card */}
            <div style={{ background: 'var(--bg-surface,#fff)', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 20, padding: '22px 24px', position: 'relative', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04),0 4px 16px rgba(0,0,0,0.06)' }}>
              <div style={{ position: 'absolute', top: -50, right: -50, width: 180, height: 180, borderRadius: '50%', background: 'radial-gradient(circle, rgba(201,169,110,0.22) 0%, transparent 70%)', pointerEvents: 'none' }} />
              <div style={{ position: 'absolute', bottom: -30, left: -30, width: 130, height: 130, borderRadius: '50%', background: 'radial-gradient(circle, rgba(196,120,140,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />
              <div style={{ position: 'relative', zIndex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)', marginBottom: 18 }}>{t('totalRevenue')}</div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, marginBottom: 20 }}>
                  <span style={{ fontSize: 16, fontWeight: 700, color: 'rgba(201,169,110,0.65)', marginBottom: 6 }}>$</span>
                  <span style={{ fontSize: 50, fontWeight: 800, lineHeight: 1, background: 'linear-gradient(135deg,#c9a96e,#e8c98a)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    <Revenue val={stats.revenue} />
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {[
                    { label: t('scheduled'), val: stats.scheduled ?? 0, c: '#059669' },
                    { label: t('completed'), val: stats.completed ?? 0, c: '#2563eb' },
                  ].map(s => (
                    <div key={s.label} style={{ background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 10, padding: '8px 14px' }}>
                      <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase', color: 'var(--text-sub)', marginBottom: 3 }}>{s.label}</div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: s.c }}>{s.val}</div>
                    </div>
                  ))}
                  <div style={{ display: 'flex', alignItems: 'center', marginLeft: 4 }}>
                    <Ring pct={rings ? stats.completedRate || 0 : 0} color="#2563eb" size={56} stroke={5} value={`${stats.completedRate ?? 0}%`} label="done" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Recent bookings */}
          <div style={{ background: 'var(--bg-surface,#fff)', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 20, overflow: 'hidden', position: 'relative', zIndex: 1, boxShadow: '0 1px 4px rgba(0,0,0,0.04),0 4px 16px rgba(0,0,0,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 22px 16px', borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>{t('recentBookings')}</div>
              </div>
              <Link href="/appointments" style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12.5, color: 'var(--rose)', fontWeight: 600, textDecoration: 'none' }}>
                {t('viewAll')}
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d={lang === 'ar' ? 'M19 12H5M12 19l-7-7 7-7' : 'M5 12h14M12 5l7 7-7 7'} />
                </svg>
              </Link>
            </div>
            {recent.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '64px 20px', color: 'var(--text-sub)', fontSize: 14 }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>📅</div>
                {t('noBookings')}
              </div>
            ) : (
              recent.map((a, i) => <BkCard key={a.id} appt={a} fmt={fmt} t={t} delay={i * 65} />)
            )}
          </div>
        </div>
      </>
    </ProtectedRoute>
  );
}
