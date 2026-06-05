'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import NexoraCareIcon from '@/components/NexoraCareIcon';

export default function Home() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (!user) router.replace('/landing');
      else if (user.role === 'ADMIN' || user.role === 'MANAGER') router.replace('/dashboard');
      else router.replace('/appointments');
    }
  }, [user, isLoading, router]);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: 'var(--bg)',
      flexDirection: 'column', gap: 0,
    }}>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes nc-pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.75;transform:scale(0.96)} }
        @keyframes nc-dots { 0%,80%,100%{opacity:0.2;transform:scale(0.7)} 40%{opacity:1;transform:scale(1)} }
        .nc-icon-wrap { animation: nc-pulse 2s ease-in-out infinite; }
        .nc-dot { display:inline-block; width:6px; height:6px; border-radius:50%; background:var(--rose,#C4788C); margin:0 3px; }
        .nc-dot:nth-child(1){animation:nc-dots 1.2s 0s infinite;}
        .nc-dot:nth-child(2){animation:nc-dots 1.2s 0.2s infinite;}
        .nc-dot:nth-child(3){animation:nc-dots 1.2s 0.4s infinite;}
      `}} />

      <div className="nc-icon-wrap" style={{ marginBottom: 18 }}>
        <NexoraCareIcon size={64} />
      </div>

      <div style={{
        fontFamily: 'var(--font, "Inter", sans-serif)',
        fontSize: '1.35rem',
        fontWeight: 800,
        letterSpacing: '-0.4px',
        background: 'var(--grad, linear-gradient(135deg,#C4788C,#7B5EA8))',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
        marginBottom: 24,
      }}>
        Nexora Care
      </div>

      <div>
        <span className="nc-dot" />
        <span className="nc-dot" />
        <span className="nc-dot" />
      </div>
    </div>
  );
}
