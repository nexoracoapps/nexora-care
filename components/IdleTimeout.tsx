'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';

const IDLE_MS    = 15 * 60 * 1000; // 15 min before warning
const WARNING_MS =  2 * 60 * 1000; // 2 min to respond before auto-logout
const TICK_MS    = 1000;

export default function IdleTimeout() {
  const { user, logout } = useAuth();
  const [warning, setWarning]   = useState(false);
  const [countdown, setCountdown] = useState(WARNING_MS / 1000);
  const idleTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countTimer  = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearAll = () => {
    if (idleTimer.current)  clearTimeout(idleTimer.current);
    if (countTimer.current) clearInterval(countTimer.current);
  };

  const startCountdown = useCallback(() => {
    setCountdown(WARNING_MS / 1000);
    setWarning(true);
    let secs = WARNING_MS / 1000;
    countTimer.current = setInterval(() => {
      secs -= 1;
      setCountdown(secs);
      if (secs <= 0) {
        clearAll();
        logout();
      }
    }, TICK_MS);
  }, [logout]);

  const resetIdle = useCallback(() => {
    if (warning) return; // don't reset during the warning
    clearAll();
    idleTimer.current = setTimeout(startCountdown, IDLE_MS);
  }, [warning, startCountdown]);

  const stayActive = () => {
    clearAll();
    setWarning(false);
    idleTimer.current = setTimeout(startCountdown, IDLE_MS);
  };

  useEffect(() => {
    if (!user) return;

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
    events.forEach(e => window.addEventListener(e, resetIdle, { passive: true }));
    idleTimer.current = setTimeout(startCountdown, IDLE_MS);

    return () => {
      clearAll();
      events.forEach(e => window.removeEventListener(e, resetIdle));
    };
  }, [user, resetIdle, startCountdown]);

  if (!user || !warning) return null;

  const pct = (countdown / (WARNING_MS / 1000)) * 100;
  const mins = Math.floor(countdown / 60);
  const secs = countdown % 60;
  const timeStr = mins > 0 ? `${mins}:${String(secs).padStart(2, '0')}` : `${secs}s`;

  const r = 28, circ = 2 * Math.PI * r;
  const dash = circ * (1 - pct / 100);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 99999,
      background: 'rgba(0,0,0,0.60)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes idle-pop { from { opacity:0; transform:scale(0.88) translateY(20px); } to { opacity:1; transform:scale(1) translateY(0); } }
        @keyframes spin { to { transform:rotate(360deg); } }
      `}} />
      <div style={{
        background: 'var(--bg-surface,#fff)', borderRadius: 24, width: '100%', maxWidth: 380,
        boxShadow: '0 32px 90px rgba(0,0,0,0.22)', overflow: 'hidden',
        animation: 'idle-pop 0.25s cubic-bezier(.34,1.56,.64,1)',
      }}>
        {/* Top progress bar */}
        <div style={{ height: 4, background: 'rgba(0,0,0,0.07)' }}>
          <div style={{
            height: '100%', background: countdown > 30 ? '#f59e0b' : '#e53e5a',
            width: `${pct}%`, transition: 'width 1s linear, background 0.5s',
            borderRadius: '0 4px 4px 0',
          }} />
        </div>

        <div style={{ padding: '32px 28px 28px', textAlign: 'center' }}>
          {/* Countdown ring */}
          <div style={{ position: 'relative', width: 80, height: 80, margin: '0 auto 20px' }}>
            <svg width="80" height="80" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="40" cy="40" r={r} fill="none" stroke="rgba(0,0,0,0.07)" strokeWidth="5" />
              <circle cx="40" cy="40" r={r} fill="none"
                stroke={countdown > 30 ? '#f59e0b' : '#e53e5a'}
                strokeWidth="5" strokeLinecap="round"
                strokeDasharray={circ} strokeDashoffset={dash}
                style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.5s' }}
              />
            </svg>
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: countdown > 99 ? 14 : 18, fontWeight: 800,
              color: countdown > 30 ? '#f59e0b' : '#e53e5a',
              fontVariantNumeric: 'tabular-nums',
            }}>
              {timeStr}
            </div>
          </div>

          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', marginBottom: 8, letterSpacing: -0.3 }}>
            Still there?
          </div>
          <div style={{ fontSize: 13.5, color: 'var(--text-sub)', lineHeight: 1.65, marginBottom: 24 }}>
            You've been inactive for a while.<br />
            You'll be signed out automatically in{' '}
            <strong style={{ color: countdown > 30 ? '#f59e0b' : '#e53e5a' }}>{timeStr}</strong>.
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={logout}
              style={{
                flex: 1, padding: '12px', border: '1.5px solid var(--border)', borderRadius: 12,
                background: 'transparent', color: 'var(--text-muted)', fontFamily: 'var(--font)',
                fontSize: 14, fontWeight: 600, cursor: 'pointer',
              }}
            >
              Sign Out
            </button>
            <button
              onClick={stayActive}
              style={{
                flex: 2, padding: '12px', border: 'none', borderRadius: 12,
                background: 'var(--grad)', color: '#fff', fontFamily: 'var(--font)',
                fontSize: 14, fontWeight: 700, cursor: 'pointer',
                boxShadow: '0 4px 18px rgba(var(--rose-rgb),0.35)',
              }}
            >
              Yes, Keep me signed in
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
