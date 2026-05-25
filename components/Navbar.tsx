'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
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

const navItems: { href: string; labelKey: string; icon: string; roles: string[]; permKey?: PermissionKey }[] = [
  { href: '/dashboard',    labelKey: 'dashboard',       icon: '⊞', roles: PRIV,   permKey: 'dashboard' },
  { href: '/customers',    labelKey: 'customers',        icon: '👥', roles: ALL,   permKey: 'manageCustomers' },
  { href: '/appointments', labelKey: 'appointments',     icon: '📅', roles: ALL,   permKey: 'manageAppointments' },
  { href: '/services',     labelKey: 'services',         icon: '✦',  roles: PRIV,  permKey: 'manageServices' },
  { href: '/providers',    labelKey: 'serviceProviders', icon: '🩺', roles: ALL,   permKey: 'manageServices' },
  { href: '/users',        labelKey: 'users',            icon: '👤', roles: ADMIN_, permKey: 'viewUsers' },
  { href: '/roles',        labelKey: 'rolesNav',         icon: '🎭', roles: ADMIN_, permKey: 'managePermissions' },
  { href: '/branches',     labelKey: 'branches',         icon: '🏢', roles: PRIV,   permKey: 'manageBranches' },
  { href: '/payments',     labelKey: 'payments',         icon: '💳', roles: PRIV,   permKey: 'recordPayments' },
  { href: '/reports',      labelKey: 'reports',          icon: '📊', roles: PRIV,   permKey: 'viewReports' },
  { href: '/staff-absence',labelKey: 'staffAbsenceNav',  icon: '📆', roles: PRIV,   permKey: 'manageStaffAbsence' },
  { href: '/permissions',  labelKey: 'permissions',      icon: '🛡️', roles: ADMIN_, permKey: 'managePermissions' },
  { href: '/backup',       labelKey: 'backup',           icon: '🔒', roles: ADMIN_, permKey: 'systemBackup' },
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

  const { canDo } = usePermissions();

  if (!user) return null;
  // If a nav item has a permKey, the permission is the sole visibility gate.
  // Roles fallback is only used for items without a permKey.
  const visibleItems = navItems.filter(item =>
    item.permKey ? canDo(item.permKey) : item.roles.includes(user.role)
  );

  const sidebarContent = (
    <>
      <div className="sidebar-logo">
        <NexoraCareIcon size={38} />
        {!sidebarCollapsed && (
          <div style={{ flex: 1 }}>
            <div className="sidebar-logo-text">Nexora Care</div>
          </div>
        )}
        <button className="sidebar-collapse-btn" onClick={toggleSidebar} title={sidebarCollapsed ? 'Expand' : 'Collapse'}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d={sidebarCollapsed === isRTL ? 'M15 18l-6-6 6-6' : 'M9 18l6-6-6-6'} />
          </svg>
        </button>
        <button className="sidebar-mobile-close" onClick={() => setSidebarOpen(false)}>✕</button>
      </div>

      {!sidebarCollapsed && branches.length > 0 && canDo('branchSwitching') && (
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
        {!sidebarCollapsed && <div className="sidebar-section-label">{t('navigation')}</div>}
        {visibleItems.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={`sidebar-item${pathname === item.href ? ' active' : ''}`}
            onClick={() => setSidebarOpen(false)}
            title={sidebarCollapsed ? t(item.labelKey) : undefined}
          >
            <span style={{ fontSize: '1rem', flexShrink: 0 }}>{item.icon}</span>
            {!sidebarCollapsed && <span>{t(item.labelKey)}</span>}
          </Link>
        ))}
      </nav>

      {sidebarCollapsed ? (
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
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
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
                🎨 {t('theme')}
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

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className={`sidebar${sidebarCollapsed ? ' sidebar-collapsed' : ''}`}>
        {sidebarContent}
      </aside>

      {/* Mobile Topbar */}
      <header className="topbar">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          style={{ background: 'none', border: 'none', color: 'white', fontSize: '1.4rem', cursor: 'pointer', padding: '4px' }}
        >
          ☰
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
            🔔
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
          <div
            onClick={() => setSidebarOpen(false)}
            style={{
              position: 'fixed', inset: 0,
              background: 'rgba(0,0,0,0.5)',
              zIndex: 399,
            }}
          />
          <aside className={`sidebar open`} style={{ zIndex: 400 }}>
            {sidebarContent}
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
