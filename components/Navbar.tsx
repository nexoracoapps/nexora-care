'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Users, Calendar, ClipboardList, CalendarDays,
  Pill, Scissors, Stethoscope, UserCog, Theater, Building2,
  TrendingUp, CreditCard, BarChart2, CalendarOff, ShieldCheck,
  Lock, Bell, ChevronDown, ChevronLeft, LogOut, Palette, Menu, X,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useBranch } from '@/context/BranchContext';
import { useLanguage } from '@/context/LanguageContext';
import { useTheme, THEMES } from '@/context/ThemeContext';
import { usePermissions, type PermissionKey } from '@/context/PermissionsContext';
import type { Appointment } from '@/types';
import NexoraCareIcon from '@/components/NexoraCareIcon';

const ALL     = ['ADMIN', 'MANAGER', 'STAFF'];
const PRIV    = ['ADMIN', 'MANAGER'];
const ADMIN_  = ['ADMIN'];

type NavIcon = React.ElementType;

const navItems: { href: string; labelKey: string; Icon: NavIcon; roles: string[]; permKey?: PermissionKey; permKeys?: PermissionKey[] }[] = [
  // ALL roles — permission key is the sole gate; admin can enable/disable per role
  { href: '/dashboard',    labelKey: 'dashboard',       Icon: LayoutDashboard, roles: ALL,   permKey: 'dashboard' },
  { href: '/customers',    labelKey: 'customers',       Icon: Users,           roles: ALL,   permKey: 'manageCustomers' },
  { href: '/appointments', labelKey: 'appointments',    Icon: CalendarDays,    roles: ALL,   permKey: 'manageAppointments' },
  { href: '/prescriptions',labelKey: 'prescriptions',   Icon: ClipboardList,   roles: ALL,   permKey: 'viewPrescriptions' },
  { href: '/calendar',     labelKey: 'calendarNav',     Icon: Calendar,        roles: ALL,   permKeys: ['viewCalendar', 'manageAppointments'] },
  { href: '/medicines',    labelKey: 'medicines',       Icon: Pill,            roles: ALL,   permKey: 'manageMedicines' },
  { href: '/services',     labelKey: 'services',        Icon: Scissors,        roles: ALL,   permKey: 'manageServices' },
  { href: '/providers',    labelKey: 'serviceProviders',Icon: Stethoscope,     roles: ALL,   permKeys: ['manageProviders', 'manageServices'] },
  { href: '/revenue',      labelKey: 'revenueNav',      Icon: TrendingUp,      roles: ALL,   permKey: 'viewRevenue' },
  { href: '/payments',     labelKey: 'payments',        Icon: CreditCard,      roles: ALL,   permKey: 'recordPayments' },
  { href: '/reports',      labelKey: 'reports',         Icon: BarChart2,       roles: ALL,   permKey: 'viewReports' },
  { href: '/staff-absence',labelKey: 'staffAbsenceNav', Icon: CalendarOff,     roles: ALL,   permKey: 'manageStaffAbsence' },
  // PRIV — user management & role/branch admin; STAFF excluded at API level too
  { href: '/users',        labelKey: 'users',           Icon: UserCog,         roles: PRIV,  permKey: 'viewUsers' },
  { href: '/branches',     labelKey: 'branches',        Icon: Building2,       roles: PRIV,  permKey: 'manageBranches' },
  { href: '/roles',        labelKey: 'rolesNav',        Icon: Theater,         roles: PRIV,  permKeys: ['viewRoles', 'managePermissions'] },
  { href: '/permissions',  labelKey: 'permissions',     Icon: ShieldCheck,     roles: PRIV,  permKey: 'managePermissions' },
  // ADMIN only
  { href: '/backup',       labelKey: 'backup',          Icon: Lock,            roles: ADMIN_,permKey: 'systemBackup' },
];

export default function Navbar() {
  const { user, logout } = useAuth();
  const { branches, activeBranchId, setActiveBranchId } = useBranch();
  const { lang, setLang, isRTL, t } = useLanguage();
  const { theme, setTheme } = useTheme();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [themePopBottom, setThemePopBottom] = useState(0);
  const [branchOpen, setBranchOpen] = useState(false);
  const [branchPos, setBranchPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const [notifications, setNotifications] = useState<Appointment[]>([]);
  const notifRef = useRef<HTMLDivElement>(null);
  const themeRef = useRef<HTMLDivElement>(null);
  const branchRef = useRef<HTMLDivElement>(null);
  const mobileSidebarRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const stored = localStorage.getItem('sidebarCollapsed') === 'true';
    if (stored) {
      setSidebarCollapsed(true);
      document.documentElement.setAttribute('data-sidebar-collapsed', 'true');
    }
  }, []);

  const toggleSidebar = () => {
    const next = !sidebarCollapsed;
    setSidebarCollapsed(next);
    if (next) { setThemeOpen(false); setBranchOpen(false); }
    try { localStorage.setItem('sidebarCollapsed', String(next)); } catch {}
    document.documentElement.setAttribute('data-sidebar-collapsed', String(next));
  };

  useEffect(() => {
    const fetchNotifs = async () => {
      if (!user?.token) return;
      try {
        const q = activeBranchId ? `?branchId=${activeBranchId}&status=SCHEDULED` : '?status=SCHEDULED';
        const res = await fetch(`/api/appointments${q}`, {
          headers: { Authorization: `Bearer ${user.token}` },
        });
        if (res.ok) {
          const data: Appointment[] = await res.json();
          const upcoming = data.filter(a => new Date(a.dateTime) > new Date());
          setNotifications(upcoming.slice(0, 5));
        }
      } catch { /* ignore */ }
    };
    fetchNotifs();
    const interval = setInterval(fetchNotifs, 60000);
    return () => clearInterval(interval);
  }, [user, activeBranchId]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
      if (themeRef.current && !themeRef.current.contains(e.target as Node)) setThemeOpen(false);
      if (branchRef.current && !branchRef.current.contains(e.target as Node)) setBranchOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Close mobile sidebar when tapping outside — works on iOS where backdrop div can swallow events
  useEffect(() => {
    if (!sidebarOpen) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      if (mobileSidebarRef.current && !mobileSidebarRef.current.contains(e.target as Node)) {
        setSidebarOpen(false);
      }
    };
    // Small delay so the open-click doesn't immediately close
    const t = setTimeout(() => {
      document.addEventListener('mousedown', handler);
      document.addEventListener('touchstart', handler, { passive: true });
    }, 50);
    return () => {
      clearTimeout(t);
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [sidebarOpen]);

  const { canDo } = usePermissions();

  if (!user) return null;
  // roles is always a hard gate; permKey/permKeys is an additional permission check
  const visibleItems = navItems.filter(item => {
    if (!item.roles.includes(user.role)) return false;
    if (item.permKeys && item.permKeys.length > 0) return item.permKeys.some(k => canDo(k));
    if (item.permKey) return canDo(item.permKey);
    return true;
  });

  // forMobile=true forces expanded state so all labels are visible on mobile overlay
  const makeSidebarContent = (forMobile: boolean) => {
    const collapsed = forMobile ? false : sidebarCollapsed;
    return (
    <>
      <div className="sidebar-logo">
        <NexoraCareIcon size={38} />
        {!collapsed && (
          <div style={{ flex: 1 }}>
            <div className="sidebar-logo-text">Nexora Care</div>
          </div>
        )}
        {!forMobile && (
          <button className="sidebar-collapse-btn" onClick={toggleSidebar} title={collapsed ? 'Expand' : 'Collapse'}>
            <ChevronLeft size={14} style={{ transform: collapsed === isRTL ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
          </button>
        )}
        <button className="sidebar-mobile-close" onClick={() => setSidebarOpen(false)}><X size={16} /></button>
      </div>

      {!collapsed && branches.length > 0 && canDo('branchSwitching') && (
        <div style={{ padding: '10px 12px 6px' }} ref={branchRef}>
          <div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.30)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.12em', paddingLeft: '2px' }}>
            {t('activeBranch')}
          </div>
          <button
            onClick={e => {
              const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
              setBranchPos({ top: rect.bottom + 6, left: rect.left, width: rect.width });
              setBranchOpen(v => !v);
            }}
            style={{
              width: '100%',
              background: branchOpen
                ? 'linear-gradient(135deg, rgba(var(--rose-rgb),0.22), rgba(var(--rose-rgb),0.10))'
                : 'rgba(255,255,255,0.07)',
              border: branchOpen ? '1px solid rgba(var(--rose-rgb),0.40)' : '1px solid rgba(255,255,255,0.10)',
              borderRadius: '10px', padding: '9px 12px',
              display: 'flex', alignItems: 'center', gap: '9px',
              cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s',
              fontFamily: 'var(--font)',
            }}
          >
            <span style={{ fontSize: '0.9rem', flexShrink: 0 }}>{activeBranchId ? '🏢' : '🌐'}</span>
            <span style={{ flex: 1, fontSize: '0.82rem', fontWeight: 600, color: 'rgba(255,255,255,0.90)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {activeBranchId ? (() => { const b = branches.find(b => b.id === activeBranchId); return (lang === 'ar' && b?.nameAr) ? b.nameAr : (b?.name ?? 'Branch'); })() : t('allBranches')}
            </span>
            <svg width="13" height="13" viewBox="0 0 12 12" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="2"
              style={{ flexShrink: 0, transition: 'transform 0.2s', transform: branchOpen ? 'rotate(180deg)' : 'none' }}>
              <path d="M2 4l4 4 4-4"/>
            </svg>
          </button>
        </div>
      )}

      <nav className="sidebar-nav">
        {!collapsed && <div className="sidebar-section-label">{t('navigation')}</div>}
        {visibleItems.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={`sidebar-item${pathname === item.href ? ' active' : ''}`}
            onClick={() => setSidebarOpen(false)}
            title={collapsed ? t(item.labelKey) : undefined}
          >
            <item.Icon size={18} style={{ flexShrink: 0, opacity: 0.85 }} />
            {!collapsed && <span>{t(item.labelKey)}</span>}
          </Link>
        ))}
      </nav>

      {collapsed ? (
        <div style={{ padding: '12px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <button
            onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}
            style={{ background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: '7px', padding: '7px 10px', color: 'rgba(255,255,255,0.7)', fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'var(--font)', fontWeight: 600 }}
          >
            {lang === 'en' ? 'ع' : 'EN'}
          </button>
          <button
            onClick={logout}
            title={t('signOut')}
            style={{ background: 'var(--grad)', border: 'none', borderRadius: '10px', padding: '10px 12px', color: '#fff', cursor: 'pointer', fontFamily: 'var(--font)', boxShadow: '0 4px 20px rgba(var(--rose-rgb),0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <LogOut size={16} />
          </button>
        </div>
      ) : (
        <div className="sidebar-footer">
          <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
            <div ref={themeRef} style={{ position: 'relative', flex: 1 }}>
              <button
                onClick={e => {
                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                  setThemePopBottom(window.innerHeight - rect.top + 8);
                  setThemeOpen(!themeOpen);
                }}
                style={{
                  width: '100%', background: 'rgba(255,255,255,0.06)', border: 'none',
                  borderRadius: '7px', padding: '7px 10px', color: 'rgba(255,255,255,0.7)',
                  fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
                }}
              >
                <Palette size={14} /> {t('theme')}
              </button>
              {themeOpen && (
                <div style={{
                  position: 'fixed', bottom: themePopBottom, ...(isRTL ? { right: 20 } : { left: 20 }),
                  direction: 'ltr', background: 'rgba(14,11,28,0.98)', border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: '14px', padding: '12px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '6px', width: '216px', zIndex: 400, boxShadow: '0 16px 48px rgba(0,0,0,0.55)',
                }}>
                  {Object.entries(THEMES).map(([key, def]) => (
                    <button key={key} onClick={() => { setTheme(key); setThemeOpen(false); }}
                      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, padding: '7px 4px', borderRadius: '10px', cursor: 'pointer', background: theme === key ? 'rgba(255,255,255,0.10)' : 'transparent', border: theme === key ? '1px solid rgba(255,255,255,0.18)' : '1px solid transparent', transition: 'all 0.15s' }}
                      onMouseEnter={e => { if (theme !== key) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.06)'; }}
                      onMouseLeave={e => { if (theme !== key) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                    >
                      <div style={{ width: 34, height: 34, borderRadius: '9px', flexShrink: 0, background: `linear-gradient(135deg, ${def.swatch[0]}, ${def.swatch[1]})`, border: theme === key ? '2px solid rgba(255,255,255,0.9)' : '2px solid transparent', boxShadow: theme === key ? `0 0 14px ${def.swatch[0]}90` : 'none', transition: 'all 0.15s' }} />
                      <span style={{ fontSize: 9, fontWeight: 600, lineHeight: 1, textAlign: 'center', color: theme === key ? 'rgba(255,255,255,0.90)' : 'rgba(255,255,255,0.45)', fontFamily: 'var(--font)', transition: 'color 0.15s' }}>
                        {lang === 'ar' ? def.labelAr : def.label}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}
              style={{ background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: '7px', padding: '7px 10px', color: 'rgba(255,255,255,0.7)', fontSize: '0.8rem', cursor: 'pointer' }}
            >
              {lang === 'en' ? 'عربي' : 'EN'}
            </button>
          </div>

          <Link
            href="/profile"
            style={{ display: 'flex', alignItems: 'center', gap: '9px', padding: '8px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', textDecoration: 'none', marginBottom: '6px' }}
            onClick={() => setSidebarOpen(false)}
          >
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--grad)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: '0.8rem', flexShrink: 0 }}>
              {user.username.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div style={{ color: 'rgba(255,255,255,0.9)', fontSize: '0.875rem', fontWeight: 600 }}>{user.username}</div>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.7rem' }}>{user.role}</div>
            </div>
          </Link>

          <button
            onClick={logout}
            style={{ width: '100%', background: 'var(--grad)', border: 'none', borderRadius: '12px', padding: '14px', color: '#fff', fontSize: '0.95rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)', boxShadow: '0 6px 28px rgba(var(--rose-rgb),0.40)', transition: 'transform 0.15s, box-shadow 0.2s', letterSpacing: '0.2px' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 10px 36px rgba(var(--rose-rgb),0.56)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = ''; (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 6px 28px rgba(var(--rose-rgb),0.40)'; }}
          >
            {t('signOut')}
          </button>
        </div>
      )}
    </>
  );
  }; // end makeSidebarContent

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className={`sidebar${sidebarCollapsed ? ' sidebar-collapsed' : ''}`}>
        {makeSidebarContent(false)}
      </aside>

      {/* Mobile Topbar */}
      <header className="topbar">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          style={{ background: 'none', border: 'none', color: 'white', fontSize: '1.4rem', cursor: 'pointer', padding: '4px' }}
        >
          <Menu size={22} />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <NexoraCareIcon size={24} />
          <span style={{ fontFamily: 'var(--font, Inter, sans-serif)', fontWeight: 800, fontSize: '1.15rem', letterSpacing: '-0.4px', background: 'linear-gradient(135deg, var(--rose-light, #ff7096), #fff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>Nexora Care</span>
        </div>
        <div style={{ position: 'relative' }} ref={notifRef}>
          <button
            onClick={() => setNotifOpen(!notifOpen)}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              borderRadius: '8px',
              width: '36px', height: '36px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: 'white', position: 'relative',
              fontSize: '1rem',
            }}
          >
            <Bell size={20} />
            {notifications.length > 0 && (
              <span style={{
                position: 'absolute', top: '4px', right: '4px',
                background: 'var(--rose)', color: 'white',
                borderRadius: '50%', width: '14px', height: '14px',
                fontSize: '0.6rem', fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {notifications.length}
              </span>
            )}
          </button>
          {notifOpen && (
            <div className="notif-panel" style={{ right: 0 }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontWeight: 600, fontSize: '0.9rem' }}>
                Upcoming Appointments
              </div>
              {notifications.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-sub)', fontSize: '0.875rem' }}>
                  No upcoming appointments
                </div>
              ) : notifications.map(n => (
                <div key={n.id} className="notif-item">
                  <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{n.customer?.name || 'Unknown'}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-sub)' }}>
                    {new Date(n.dateTime).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    {n.service && ` • ${n.service.name}`}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </header>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <>
          {/* Backdrop — visual only, pointer-events:none so it never swallows taps */}
          <div
            aria-hidden="true"
            style={{
              position: 'fixed', inset: 0,
              background: 'rgba(0,0,0,0.5)',
              zIndex: 9998,
              pointerEvents: 'none',
            }}
          />
          <aside ref={mobileSidebarRef} className={`sidebar open`} style={{ zIndex: 9999 }}>
            {makeSidebarContent(true)}
          </aside>
        </>
      )}

      {/* Branch dropdown — rendered at root level to escape sidebar overflow/transform */}
      {branchOpen && branchPos && (
        <>
          <style dangerouslySetInnerHTML={{ __html: `
            @keyframes branchDrop {
              from { opacity:0; transform:translateY(-6px) scale(0.97); }
              to   { opacity:1; transform:translateY(0) scale(1); }
            }
            .branch-opt:hover { background: rgba(var(--rose-rgb),0.14) !important; }
            .branch-opt.branch-active { background: rgba(var(--rose-rgb),0.18) !important; }
          `}} />
          <div
            ref={branchRef}
            style={{
              position: 'fixed',
              top: branchPos.top,
              left: branchPos.left,
              width: branchPos.width,
              background: 'rgba(15,12,32,0.98)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '14px',
              overflow: 'hidden',
              boxShadow: '0 16px 48px rgba(0,0,0,0.55), 0 0 0 1px rgba(var(--rose-rgb),0.10)',
              zIndex: 9999,
              animation: 'branchDrop 0.2s cubic-bezier(0.34,1.56,0.64,1)',
            }}
          >
            {/* All Branches */}
            <button
              className={`branch-opt${!activeBranchId ? ' branch-active' : ''}`}
              onClick={() => { setActiveBranchId(null); setBranchOpen(false); }}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                padding: '11px 13px', background: 'none', border: 'none',
                borderBottom: '1px solid rgba(255,255,255,0.07)',
                cursor: 'pointer', textAlign: 'left', transition: 'background 0.15s',
                fontFamily: 'var(--font)',
              }}
            >
              <div style={{
                width: '30px', height: '30px', borderRadius: '8px', flexShrink: 0,
                background: 'rgba(255,255,255,0.08)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem',
              }}>🌐</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'rgba(255,255,255,0.92)' }}>{t('allBranches')}</div>
                <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.38)', marginTop: '1px' }}>{t('viewAllData')}</div>
              </div>
              {!activeBranchId && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--rose)" strokeWidth="2.5">
                  <path d="M20 6L9 17l-5-5"/>
                </svg>
              )}
            </button>

            {/* Each branch */}
            {branches.map((b, i) => (
              <button
                key={b.id}
                className={`branch-opt${activeBranchId === b.id ? ' branch-active' : ''}`}
                onClick={() => { setActiveBranchId(b.id); setBranchOpen(false); }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '11px 13px', background: 'none', border: 'none',
                  borderBottom: i < branches.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                  cursor: 'pointer', textAlign: 'left', transition: 'background 0.15s',
                  fontFamily: 'var(--font)',
                }}
              >
                <div style={{
                  width: '30px', height: '30px', borderRadius: '8px', flexShrink: 0,
                  background: 'linear-gradient(135deg, var(--rose), #9b5de5)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.72rem', fontWeight: 800, color: '#fff', letterSpacing: '0.5px',
                }}>
                  {b.name.slice(0, 2).toUpperCase()}
                </div>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'rgba(255,255,255,0.92)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                    {(lang === 'ar' && b.nameAr) ? b.nameAr : b.name}
                  </div>
                  {(b as any).address && (
                    <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.38)', marginTop: '1px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                      {(b as any).address}
                    </div>
                  )}
                </div>
                {activeBranchId === b.id && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--rose)" strokeWidth="2.5">
                    <path d="M20 6L9 17l-5-5"/>
                  </svg>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </>
  );
}
