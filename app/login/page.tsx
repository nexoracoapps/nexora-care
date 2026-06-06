'use client';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useBranch } from '@/context/BranchContext';
import { useLanguage } from '@/context/LanguageContext';
import { useTheme, THEMES } from '@/context/ThemeContext';
import NexoraCareIcon from '@/components/NexoraCareIcon';


const SLIDES = [
  {
    url: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&w=1600&q=85',
    titleEn: 'Deliver Exceptional Care',      titleAr: 'قدّم رعاية استثنائية',
    subEn:   'Manage every client interaction with precision and warmth', subAr: 'أدِر كل تفاعل مع العميل بدقة ودفء',
  },
  {
    url: 'https://images.unsplash.com/photo-1551076805-e1869033e561?auto=format&w=1600&q=85',
    titleEn: 'Smart Scheduling',              titleAr: 'جدولة ذكية وفعّالة',
    subEn:   'Book, track and follow up appointments effortlessly', subAr: 'احجز وتابع المواعيد بكل سهولة',
  },
  {
    url: 'https://images.unsplash.com/photo-1582750433449-648ed127bb54?auto=format&w=1600&q=85',
    titleEn: 'Your Team, Empowered',          titleAr: 'فريقك في أفضل حالاته',
    subEn:   'Coordinate specialists and services across all branches', subAr: 'نسّق المتخصصين والخدمات عبر جميع الفروع',
  },
  {
    url: 'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?auto=format&w=1600&q=85',
    titleEn: 'Trusted by Professionals',      titleAr: 'موثوق من قِبَل المحترفين',
    subEn:   'Built for clinics, wellness centres and care providers', subAr: 'مصمم للعيادات ومراكز الرعاية والمتخصصين',
  },
];

const pwStrength = (pw: string) => {
  if (!pw) return 0;
  let s = 0;
  if (pw.length >= 6)  s++;
  if (pw.length >= 10) s++;
  if (/[A-Z]/.test(pw)) s++;
  if (/[0-9]/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return Math.min(s, 4);
};
const SC = ['', '#f43f5e', '#f59e0b', '#10b981', '#10b981'];

function LoginPageInner() {
  const { login } = useAuth();
  const { setActiveBranchId } = useBranch();
  const { lang, toggleLang, t } = useLanguage();
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnUrl = searchParams.get('returnUrl');
  const isAr = lang === 'ar';

  /* ── Login state ── */
  const [form,      setForm]     = useState({ username: '', password: '' });
  const [remember,  setRemember] = useState(true);
  const [showPw,    setShowPw]   = useState(false);
  const [loading,   setLoading]  = useState(false);
  const [error,     setError]    = useState('');

  /* ── Forgot password state ── */
  const [fpStep,    setFpStep]   = useState(0);
  const [fpEmail,   setFpEmail]  = useState('');
  const [fpOtp,     setFpOtp]    = useState('');
  const [fpNewPw,   setFpNewPw]  = useState('');
  const [fpShowPw,  setFpShowPw] = useState(false);
  const [fpLoad,    setFpLoad]   = useState(false);
  const [fpErr,     setFpErr]    = useState('');
  const [devOtp,    setDevOtp]   = useState('');

  /* ── Slider state ── */
  const [current,      setCurrent]      = useState(0);
  const [prev,         setPrev]         = useState<number | null>(null);
  const [transitioning, setTransitioning] = useState(false);

  const goTo = useCallback((idx: number) => {
    if (transitioning) return;
    setPrev(current);
    setTransitioning(true);
    setCurrent(idx);
    setTimeout(() => { setPrev(null); setTransitioning(false); }, 1200);
  }, [current, transitioning]);

  useEffect(() => {
    const id = setInterval(() => goTo((current + 1) % SLIDES.length), 6000);
    return () => clearInterval(id);
  }, [current, goTo]);

  /* ── Branch picker state ── */
  const [branchStep, setBranchStep] = useState<any[] | null>(null);

  /* ── Auto-login on mount if offline with a valid cached session ── */
  useEffect(() => {
    if (typeof navigator === 'undefined' || navigator.onLine) return;
    const raw = localStorage.getItem('nexora-user') || sessionStorage.getItem('nexora-user');
    if (!raw) return;
    try {
      const cached = JSON.parse(raw);
      if (cached?.token) {
        const payload = JSON.parse(atob(cached.token.split('.')[1]));
        if (!payload.exp || Date.now() / 1000 < payload.exp) {
          login(cached, !!localStorage.getItem('nexora-user'));
          const role = cached.role;
          if (returnUrl) { router.push(returnUrl); return; }
          if (!['ADMIN', 'MANAGER'].includes(role)) {
            if (cached.branchId) setActiveBranchId(cached.branchId);
            router.push('/appointments');
          } else {
            router.push('/dashboard');
          }
        }
      }
    } catch { /* malformed stored data */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Post-login routing ── */
  const afterLogin = async (loginData: any) => {
    // Always honour an explicit returnUrl (e.g. from the welcome/rate flow)
    if (returnUrl) { router.push(returnUrl); return; }
    if (!['ADMIN', 'MANAGER'].includes(loginData?.role)) {
      if (loginData?.branchId) setActiveBranchId(loginData.branchId);
      router.push('/appointments');
      return;
    }
    // For MANAGER: check branchSwitching permission before showing the picker
    if (loginData?.role === 'MANAGER') {
      try {
        const permRes = await fetch('/api/permissions', { headers: { Authorization: `Bearer ${loginData.token}` } });
        if (permRes.ok) {
          const perms = await permRes.json();
          if (!perms?.MANAGER?.branchSwitching) {
            if (loginData?.branchId) setActiveBranchId(loginData.branchId);
            router.push('/dashboard');
            return;
          }
        }
      } catch { /* fall through to branch picker on error */ }
    }
    try {
      const res = await fetch('/api/branches', { headers: { Authorization: `Bearer ${loginData.token}` } });
      const brs = await res.json();
      const list = Array.isArray(brs) ? brs : (brs.data ?? []);
      if (list.length > 0) { setBranchStep(list); }
      else { router.push('/dashboard'); }
    } catch { router.push('/dashboard'); }
  };

  const handlePickBranch = (branch: any) => {
    setBranchStep(null);
    setActiveBranchId(branch?.id ?? null);
    router.push('/dashboard');
  };

  /* ── Login submit ── */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setLoading(true);

    // Offline path: try to resume a cached valid session
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      const raw = localStorage.getItem('nexora-user') || sessionStorage.getItem('nexora-user');
      if (raw) {
        try {
          const cached = JSON.parse(raw);
          if (cached?.token) {
            const payload = JSON.parse(atob(cached.token.split('.')[1]));
            if (!payload.exp || Date.now() / 1000 < payload.exp) {
              login(cached, !!localStorage.getItem('nexora-user'));
              await afterLogin(cached);
              setLoading(false);
              return;
            }
          }
        } catch { /* malformed stored data — fall through */ }
      }
      setError(isAr
        ? 'أنت غير متصل بالإنترنت. للعمل دون إنترنت، سجّل الدخول مرة واحدة وأنت متصل مع تفعيل "تذكرني".'
        : 'You\'re offline and no saved session was found. Sign in once while online with "Remember me" checked — after that you can work fully offline.');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: form.username, password: form.password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');
      login(data, remember);
      if (typeof window !== 'undefined' && window.PasswordCredential) {
        try {
          const cred = new window.PasswordCredential({ id: form.username, password: form.password });
          await navigator.credentials.store(cred);
        } catch { /* browser may silently decline */ }
      }
      await afterLogin(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : (isAr ? 'اسم المستخدم أو كلمة المرور غير صحيحة.' : 'Invalid username or password.'));
    } finally { setLoading(false); }
  };

  /* ── Forgot password ── */
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault(); setFpErr(''); setFpLoad(true); setDevOtp('');
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: 'request', email: fpEmail }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (data.otp) { setDevOtp(data.otp); setFpOtp(data.otp); }
      setFpStep(2);
    } catch (e: unknown) { setFpErr(e instanceof Error ? e.message : (isAr ? 'حدث خطأ، حاول مجدداً.' : 'Something went wrong. Try again.')); }
    finally { setFpLoad(false); }
  };

  const handleResetPw = async (e: React.FormEvent) => {
    e.preventDefault(); setFpErr(''); setFpLoad(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: 'reset', email: fpEmail, otp: fpOtp, newPassword: fpNewPw }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setFpStep(3);
    } catch (e: unknown) { setFpErr(e instanceof Error ? e.message : (isAr ? 'رمز غير صالح أو منتهٍ.' : 'Invalid or expired code.')); }
    finally { setFpLoad(false); }
  };

  const closeFp = () => { setFpStep(0); setFpEmail(''); setFpOtp(''); setFpNewPw(''); setFpErr(''); setDevOtp(''); };

  const pwStr = pwStrength(fpNewPw);
  const strengthLabels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
  const strengthLabelsAr = ['', 'ضعيفة', 'مقبولة', 'جيدة', 'قوية'];

  const sl = SLIDES[current];

  const themeEntries = Object.entries(THEMES) as [string, any][];
  const [themePickerOpen, setThemePickerOpen] = useState(false);
  const themePickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (themePickerRef.current && !themePickerRef.current.contains(e.target as Node)) {
        setThemePickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        html, body { height: 100%; margin: 0; overflow: hidden; }

        .lr-root {
          position: relative; height: 100vh; height: 100dvh;
          display: flex; align-items: center; justify-content: flex-end;
          font-family: var(--font, 'Inter', sans-serif); overflow: hidden;
        }
        .lr-bg { position: absolute; inset: 0; z-index: 0; }
        .lr-bg-img {
          position: absolute; inset: 0;
          background-size: cover; background-position: center;
          opacity: 0; transition: opacity 1.2s ease; transform-origin: center;
        }
        .lr-bg-img.active { opacity: 1; animation: kenburns 8s ease-in-out forwards; }
        .lr-bg-img.leaving { opacity: 0; transition: opacity 1.2s ease; }
        @keyframes kenburns {
          0%   { transform: scale(1.0) translate(0, 0); }
          100% { transform: scale(1.10) translate(-1%, -1%); }
        }
        .lr-overlay {
          position: absolute; inset: 0; z-index: 1;
          background:
            linear-gradient(to right, rgba(6,14,40,0.78) 0%, rgba(6,14,40,0.35) 45%, rgba(6,14,40,0.88) 100%),
            linear-gradient(to bottom, rgba(6,14,40,0.45) 0%, transparent 35%, rgba(6,14,40,0.75) 100%);
        }
        .lr-petal {
          position: absolute; z-index: 2;
          border-radius: 50% 0 50% 0;
          pointer-events: none; opacity: 0;
          animation: petal-fall linear infinite;
        }
        @keyframes petal-fall {
          0%   { transform: translateY(-80px) rotate(0deg) translateX(0);    opacity: 0; }
          8%   { opacity: 0.55; }
          90%  { opacity: 0.20; }
          100% { transform: translateY(105vh) rotate(540deg) translateX(30px); opacity: 0; }
        }
        .lr-slide-info {
          position: absolute; z-index: 3;
          bottom: 48px; left: 52px; right: auto; max-width: 460px;
        }
        [dir="rtl"] .lr-slide-info { left: auto; right: 52px; }
        @media (max-width: 900px) { .lr-slide-info { display: none; } }
        .lr-slide-badge {
          display: inline-flex; align-items: center; gap: 8px;
          background: rgba(var(--rose-rgb),0.18); border: 1px solid rgba(var(--rose-rgb),0.32);
          border-radius: 20px; padding: 5px 14px;
          font-size: 11px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase;
          color: var(--rose-light); margin-bottom: 16px; backdrop-filter: blur(8px);
        }
        .lr-slide-title {
          font-size: 42px; font-weight: 800; color: #fff; line-height: 1.15;
          letter-spacing: -1px; text-shadow: 0 2px 8px rgba(0,0,0,0.7), 0 8px 32px rgba(0,0,0,0.55);
          margin-bottom: 12px; animation: slide-up 0.7s ease forwards;
        }
        .lr-slide-sub { font-size: 16px; color: rgba(255,255,255,0.82); line-height: 1.6; font-weight: 400; text-shadow: 0 2px 12px rgba(0,0,0,0.6); animation: slide-up 0.7s ease 0.12s both; }
        @keyframes slide-up { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: translateY(0); } }
        .lr-dots { position: absolute; z-index: 3; bottom: 52px; left: 52px; display: flex; gap: 9px; align-items: center; }
        @media (min-width: 901px) { .lr-dots { left: auto; right: calc(44% + 20px); } }
        [dir="rtl"] .lr-dots { left: auto; right: 52px; }
        @media (min-width: 901px) { [dir="rtl"] .lr-dots { right: auto; left: calc(44% + 20px); } }
        .lr-dot { border: none; cursor: pointer; padding: 0; border-radius: 20px; transition: all 0.35s ease; outline: none; }
        .lr-dot.on  { width: 32px; height: 6px; background: linear-gradient(90deg, var(--rose), var(--plum-light)); }
        .lr-dot.off { width: 6px;  height: 6px; background: rgba(255,255,255,0.25); }
        .lr-dot.off:hover { background: rgba(255,255,255,0.55); }
        .lr-brand-top {
          position: absolute; z-index: 4; top: 36px;
          left: 44px; right: auto;
          display: flex; align-items: center; gap: 13px;
        }
        [dir="rtl"] .lr-brand-top { left: auto; right: 44px; }
        @media (max-width: 900px) { .lr-brand-top { display: none; } }
        .lr-brand-ico {
          width: 46px; height: 46px; border-radius: 13px; background: var(--grad);
          display: flex; align-items: center; justify-content: center; font-size: 22px;
          box-shadow: 0 6px 28px rgba(var(--rose-rgb),0.50);
        }
        .lr-brand-name {
          font-size: 20px; font-weight: 800; letter-spacing: -0.4px;
          background: linear-gradient(135deg, var(--rose-light), #fff);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
        }
        .lr-brand-tag { font-size: 11px; color: rgba(255,255,255,0.35); font-weight: 500; letter-spacing: 0.5px; margin-top: 2px; }
        .lr-panel {
          position: relative; z-index: 5;
          width: 100%; max-width: 440px; height: 100vh; height: 100dvh;
          display: flex; align-items: center; justify-content: center;
          padding: 24px 28px; overflow: hidden;
          background: rgba(255,255,255,0.97);
          border-left: 1px solid rgba(0,0,0,0.08);
          backdrop-filter: blur(32px); -webkit-backdrop-filter: blur(32px);
        }
        [dir="rtl"] .lr-panel { border-left: none; border-right: 1px solid rgba(0,0,0,0.08); }
        @media (max-width: 900px) {
          .lr-root { justify-content: center; align-items: center; padding: 16px; overflow: hidden; position: fixed; inset: 0; height: auto; }
          .lr-overlay { background: linear-gradient(to bottom, rgba(6,14,40,0.55) 0%, rgba(6,14,40,0.65) 50%, rgba(6,14,40,0.80) 100%); }
          .lr-panel {
            position: relative; z-index: 5; width: 100%; max-width: 390px; min-height: 0;
            max-height: calc(100dvh - 24px); overflow-y: auto; -webkit-overflow-scrolling: touch;
            padding: 22px 20px 24px; border-left: none; border-radius: 24px;
            border: 1px solid rgba(0,0,0,0.08); background: rgba(255,255,255,0.97);
            backdrop-filter: blur(40px); -webkit-backdrop-filter: blur(40px);
            box-shadow: 0 16px 60px rgba(0,0,0,0.18), 0 0 0 1px rgba(var(--rose-rgb),0.10);
            align-items: flex-start;
          }
          .lr-dots { bottom: 18px !important; left: 50% !important; right: auto !important; transform: translateX(-50%); }
          .lr-welcome-wrap { margin-bottom: 20px !important; }
          .lr-wb-badge { font-size: 11px !important; padding: 4px 12px 4px 7px !important; margin-bottom: 10px !important; }
          .lr-h1 { font-size: 26px !important; margin-bottom: 6px !important; }
          .lr-sub { font-size: 12px !important; margin-bottom: 18px !important; }
          .lr-footer { margin-top: 18px; padding-top: 14px; }
        }
        .lr-form-inner { width: 100%; max-width: 380px; }
        .lr-mobile-brand { display: none; align-items: center; gap: 12px; margin-bottom: 36px; }
        @media (max-width: 900px) { .lr-mobile-brand { display: flex; } }
        .lr-mobile-ico { width: 42px; height: 42px; border-radius: 12px; background: var(--grad); display: flex; align-items: center; justify-content: center; font-size: 20px; box-shadow: 0 6px 22px rgba(var(--rose-rgb),0.44); }
        .lr-mobile-name { font-size: 18px; font-weight: 700; background: linear-gradient(135deg, var(--rose-light), var(--plum-light)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .lr-mobile-sub { font-size: 10.5px; color: var(--text-sub); font-weight: 500; }
        .lr-lang-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
        @keyframes back-bg   { 0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%} }
        @keyframes back-glow { 0%,100%{box-shadow:0 0 14px rgba(229,62,90,0.45),0 4px 18px rgba(123,94,168,0.35)} 50%{box-shadow:0 0 26px rgba(229,62,90,0.7),0 8px 28px rgba(123,94,168,0.55)} }
        @keyframes back-sweep{ 0%{left:-80%;opacity:0} 20%{opacity:1} 100%{left:140%;opacity:0} }
        .lr-back { position:relative; overflow:hidden; background: linear-gradient(135deg,#e53e5a,#a855f7,#7B5EA8,#e53e5a); background-size:300% 300%; border: none; border-radius: 12px; color: #fff; font-family: var(--font, 'Inter', sans-serif); font-size: 12px; font-weight: 800; padding: 8px 18px; cursor: pointer; letter-spacing: 0.3px; transition: transform 0.15s, filter 0.15s; display: flex; align-items: center; gap: 6px; text-decoration: none; text-shadow:0 1px 6px rgba(0,0,0,0.2); animation: back-bg 5s ease infinite, back-glow 2.8s ease-in-out infinite; }
        .lr-back::after { content:''; position:absolute; top:0; left:-80%; width:40%; height:100%; background:linear-gradient(90deg,transparent,rgba(255,255,255,0.3),transparent); transform:skewX(-18deg); animation:back-sweep 3.5s ease-in-out infinite 1s; pointer-events:none; }
        .lr-back:hover { transform: translateY(-2px); filter: brightness(1.12); }
        .lr-lang {
          position:relative; overflow:hidden;
          background: linear-gradient(135deg,#e53e5a,#a855f7,#7B5EA8,#e53e5a); background-size:300% 300%;
          border: none; border-radius: 12px; color: #fff;
          font-family: var(--font, 'Inter', sans-serif);
          font-size: 12px; font-weight: 800; padding: 8px 18px; cursor: pointer;
          letter-spacing: 0.3px; text-shadow:0 1px 6px rgba(0,0,0,0.2);
          animation: back-bg 5s ease infinite, back-glow 2.8s ease-in-out infinite;
          transition: transform 0.15s, filter 0.15s;
        }
        .lr-lang::after { content:''; position:absolute; top:0; left:-80%; width:40%; height:100%; background:linear-gradient(90deg,transparent,rgba(255,255,255,0.3),transparent); transform:skewX(-18deg); animation:back-sweep 3.5s ease-in-out infinite 1.8s; pointer-events:none; }
        .lr-lang:hover { transform: translateY(-2px); filter: brightness(1.12); }
        /* ── Welcome Back animated section ── */
        .lr-welcome-wrap {
          position: relative; margin-bottom: 18px;
          animation: ww-enter 0.7s cubic-bezier(0.34,1.56,0.64,1) both;
        }
        @keyframes ww-enter {
          from { opacity: 0; transform: translateY(-18px) scale(0.93); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .lr-wb-badge {
          display: inline-flex; align-items: center; gap: 7px;
          background: linear-gradient(135deg, rgba(var(--rose-rgb),0.10), rgba(var(--rose-rgb),0.04));
          border: 1px solid rgba(var(--rose-rgb),0.22);
          border-radius: 30px; padding: 5px 14px 5px 8px;
          font-size: 12px; font-weight: 600; color: var(--rose-light);
          letter-spacing: 0.3px; margin-bottom: 14px;
          animation: badge-pop 0.55s cubic-bezier(0.34,1.56,0.64,1) 0.12s both;
        }
        @keyframes badge-pop {
          from { opacity: 0; transform: scale(0.65) translateY(6px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        .lr-wave-hand {
          font-size: 16px; display: inline-block;
          animation: hand-wave 2.6s ease-in-out 1s infinite;
          transform-origin: 70% 80%;
        }
        @keyframes hand-wave {
          0%,50%,100% { transform: rotate(0deg); }
          10%,30%     { transform: rotate(22deg); }
          20%         { transform: rotate(-8deg); }
          40%         { transform: rotate(14deg); }
        }
        .lr-h1 {
          font-size: 36px; font-weight: 900; letter-spacing: -1.1px; line-height: 1.1; margin-bottom: 10px;
          background: var(--grad); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
          animation: h1-slide 0.6s cubic-bezier(0.34,1.56,0.64,1) 0.18s both;
        }
        @keyframes h1-slide {
          from { opacity: 0; transform: translateX(-16px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        .lr-sub {
          font-size: 13.5px; color: var(--text-sub); margin-bottom: 22px; font-weight: 400; line-height: 1.6;
          animation: sub-fade 0.55s ease 0.30s both;
        }
        @keyframes sub-fade {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .lr-sparks { position: absolute; top: 0; right: 0; pointer-events: none; }
        .lr-spark {
          position: absolute; color: var(--rose);
          animation: spark-float 3s ease-in-out infinite;
        }
        .lr-spark.sp1 { top: 2px;  right: 10px; font-size: 11px; opacity: 0.55; animation-delay: 0s; }
        .lr-spark.sp2 { top: 22px; right: -4px; font-size: 8px;  opacity: 0.40; animation-delay: 0.85s; }
        .lr-spark.sp3 { top: -4px; right: 28px; font-size: 15px; opacity: 0.45; animation-delay: 1.55s; }
        @keyframes spark-float {
          0%,100% { transform: translateY(0)    rotate(0deg)   scale(1); }
          33%     { transform: translateY(-8px) rotate(18deg)  scale(1.18); }
          66%     { transform: translateY(4px)  rotate(-12deg) scale(0.88); }
        }
        .lr-error { display: flex; align-items: center; gap: 8px; background: rgba(244,63,94,0.09); border: 1px solid rgba(244,63,94,0.24); border-radius: 10px; padding: 11px 14px; margin-bottom: 22px; font-size: 13px; color: #dc2626; }
        .lr-lbl { display: block; font-size: 10.5px; font-weight: 700; letter-spacing: 1.1px; text-transform: uppercase; color: var(--text-sub); margin-bottom: 8px; }
        .lr-iw { position: relative; margin-bottom: 20px; }
        .lr-input {
          width: 100%; padding: 13px 16px; background: rgba(0,0,0,0.03);
          border: 1.5px solid rgba(0,0,0,0.10); border-radius: 11px;
          font-family: var(--font, 'Inter', sans-serif); font-size: 14px; color: var(--text);
          outline: none; transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
          box-sizing: border-box;
        }
        .lr-input::placeholder { color: var(--text-sub); }
        .lr-input:focus { border-color: var(--rose); box-shadow: 0 0 0 3px rgba(var(--rose-rgb),0.13); background: rgba(0,0,0,0.02); }
        .lr-input.pr { padding-right: 48px; }
        .lr-eye { position: absolute; right: 14px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: var(--text-sub); display: flex; align-items: center; transition: color 0.15s; padding: 4px; }
        .lr-eye:hover { color: var(--text-muted); }
        .lr-opts { display: flex; align-items: center; justify-content: space-between; margin-bottom: 18px; }
        .lr-remember { display: flex; align-items: center; gap: 9px; cursor: pointer; user-select: none; }
        .lr-cb { width: 17px; height: 17px; border-radius: 5px; border: 1.5px solid rgba(0,0,0,0.18); background: rgba(0,0,0,0.03); appearance: none; -webkit-appearance: none; cursor: pointer; position: relative; flex-shrink: 0; transition: all 0.15s; }
        .lr-cb:checked { background: var(--grad); border-color: transparent; }
        .lr-cb:checked::after { content: ''; position: absolute; left: 4px; top: 1px; width: 5px; height: 9px; border: 2px solid #fff; border-left: none; border-top: none; transform: rotate(45deg); }
        .lr-remember-lbl { font-size: 13px; color: var(--text-muted); }
        .lr-forgot { font-size: 13px; color: var(--rose); font-weight: 500; background: none; border: none; cursor: pointer; font-family: var(--font, 'Inter', sans-serif); padding: 0; transition: color 0.15s; }
        .lr-forgot:hover { color: var(--rose-light); }
        .lr-btn { width: 100%; padding: 14.5px; border: none; border-radius: 12px; background: var(--grad); color: #fff; font-family: var(--font, 'Inter', sans-serif); font-size: 15px; font-weight: 700; cursor: pointer; box-shadow: 0 6px 28px rgba(var(--rose-rgb),0.40); transition: transform 0.15s, box-shadow 0.2s; display: flex; align-items: center; justify-content: center; gap: 8px; letter-spacing: 0.2px; }
        .lr-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 10px 36px rgba(var(--rose-rgb),0.56); }
        .lr-btn:active:not(:disabled) { transform: translateY(0); }
        .lr-btn:disabled { opacity: 0.55; cursor: not-allowed; }
        .lr-div { display: flex; align-items: center; gap: 14px; margin-top: 18px; }
        .lr-div-line { flex: 1; height: 1px; background: rgba(0,0,0,0.09); }
        .lr-div-txt { font-size: 11.5px; color: var(--text-sub); white-space: nowrap; letter-spacing: 0.5px; }
        .lr-explore { display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; margin-top: 18px; margin-bottom: 4px; padding: 12px; background: rgba(0,0,0,0.03); border: 1px solid rgba(0,0,0,0.09); border-radius: 11px; cursor: pointer; color: var(--text-sub); font-family: var(--font, 'Inter', sans-serif); font-size: 13px; font-weight: 500; transition: background 0.15s, border-color 0.15s, color 0.15s; text-decoration: none; }
        .lr-explore:hover { background: rgba(var(--rose-rgb),0.08); border-color: rgba(var(--rose-rgb),0.20); color: var(--rose-light); }
        .lr-spin { width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.25); border-top-color: #fff; border-radius: 50%; animation: spin 0.65s linear infinite; flex-shrink: 0; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .lr-ctrl-divider { width: 1px; height: 22px; background: rgba(0,0,0,0.10); margin: 0 2px; flex-shrink: 0; }
        .lr-social-btn {
          width: 40px; height: 40px; border-radius: 11px;
          display: flex; align-items: center; justify-content: center;
          border: 1px solid rgba(0,0,0,0.10); background: rgba(0,0,0,0.04);
          color: rgba(0,0,0,0.45); text-decoration: none;
          transition: all 0.18s; flex-shrink: 0;
        }
        .lr-social-btn:hover { transform: translateY(-2px); border-color: rgba(var(--rose-rgb),0.35); color: var(--rose-light); background: rgba(var(--rose-rgb),0.10); }
        .lr-ctrl-btn {
          width: 34px; height: 34px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          border: none; background: transparent; cursor: pointer;
          color: var(--text-sub); text-decoration: none; font-size: 16px;
          transition: background 0.15s, color 0.15s, transform 0.15s;
          flex-shrink: 0;
        }
        .lr-ctrl-btn:hover { background: rgba(var(--rose-rgb),0.10); color: var(--rose-light); transform: scale(1.12); }
        /* theme toggle inside bar */
        .lr-ctrl-theme {
          display: flex; align-items: center; gap: 5px;
          padding: 0 10px; height: 34px; border-radius: 50px;
          border: none; background: transparent; cursor: pointer;
          font-family: var(--font,'Inter',sans-serif); font-size: 12px; font-weight: 600;
          color: var(--text-muted); transition: background 0.15s, color 0.15s; white-space: nowrap;
        }
        .lr-ctrl-theme:hover { background: rgba(var(--rose-rgb),0.10); color: var(--rose-light); }
        .lr-theme-dots { display: flex; gap: 3px; }
        .lr-theme-dot { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }
        .lr-theme-popup {
          position: absolute; bottom: calc(100% + 10px);
          right: 0;
          background: #ffffff; border: 1px solid rgba(0,0,0,0.10);
          border-radius: 14px; padding: 12px;
          display: grid; grid-template-columns: repeat(4,1fr); gap: 7px;
          width: 216px; box-shadow: 0 12px 40px rgba(0,0,0,0.18);
          animation: popup-in 0.18s cubic-bezier(0.34,1.56,0.64,1);
          z-index: 600;
        }
        @keyframes popup-in {
          from { opacity: 0; transform: scale(0.88) translateY(8px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        .lr-theme-swatch {
          width: 100%; aspect-ratio: 1; border-radius: 9px;
          border: 2.5px solid transparent; cursor: pointer;
          transition: transform 0.15s, border-color 0.15s, box-shadow 0.15s;
        }
        .lr-theme-swatch:hover { transform: scale(1.1); box-shadow: 0 4px 12px rgba(0,0,0,0.18); }
        .lr-theme-swatch.active { border-color: #1a1a2e; box-shadow: 0 0 0 2px rgba(0,0,0,0.12); transform: scale(1.08); }
        @media (max-width: 480px) {
          .lr-ctrl-theme span:last-child { display: none; }
          /* Compact card — shows background around it */
          .lr-panel {
            border-radius: 22px;
            width: calc(100% - 28px);
            max-width: 380px;
            max-height: calc(100dvh - 28px);
            overflow-y: auto;
            -webkit-overflow-scrolling: touch;
            padding: 18px 18px 20px !important;
          }
          .lr-root { align-items: center; justify-content: center; padding: 14px; }
          .lr-h1 { font-size: 24px !important; margin-bottom: 4px !important; }
          .lr-sub { font-size: 11.5px !important; margin-bottom: 14px !important; }
          .lr-welcome-wrap { margin-bottom: 12px !important; }
          .lr-wb-badge { margin-bottom: 8px !important; }
          .lr-iw { margin-bottom: 14px !important; }
          .lr-opts { margin-bottom: 14px !important; }
          .lr-mobile-brand { margin-bottom: 20px !important; }
          /* Hide non-essential elements to keep card compact */
          .lr-div { display: none !important; }
          .lr-explore { display: none !important; }
          .lr-social-row { display: none !important; }
        }

        /* Forgot Password Modal */
        .fp-ov { position: fixed; inset: 0; z-index: 9000; background: rgba(0,0,0,0.55); backdrop-filter: blur(14px); display: flex; align-items: center; justify-content: center; padding: 20px; animation: fadein 0.18s ease; }
        @keyframes fadein { from { opacity: 0; } }
        .fp-box { background: #ffffff; border: 1px solid rgba(var(--rose-rgb),0.20); border-radius: 24px; padding: 44px; width: 100%; max-width: 420px; box-shadow: 0 16px 60px rgba(0,0,0,0.14); animation: popin 0.22s cubic-bezier(.34,1.56,.64,1); }
        @keyframes popin { from { opacity: 0; transform: scale(0.92) translateY(16px); } }
        .fp-icon { font-size: 38px; text-align: center; margin-bottom: 16px; }
        .fp-title { font-size: 20px; font-weight: 700; color: var(--text); margin-bottom: 8px; }
        .fp-sub { font-size: 13.5px; color: var(--text-sub); margin-bottom: 28px; line-height: 1.7; }
        .fp-input { width: 100%; padding: 12px 14px; margin-bottom: 16px; background: rgba(0,0,0,0.03); border: 1.5px solid rgba(0,0,0,0.10); border-radius: 10px; font-family: var(--font, 'Inter', sans-serif); font-size: 14px; color: var(--text); outline: none; transition: border-color 0.2s; box-sizing: border-box; }
        .fp-input:focus { border-color: var(--rose); box-shadow: 0 0 0 3px rgba(var(--rose-rgb),0.10); }
        .fp-otp { width: 100%; padding: 16px; font-size: 30px; font-weight: 800; text-align: center; letter-spacing: 12px; font-family: monospace; background: rgba(var(--rose-rgb),0.06); border: 2px dashed rgba(var(--rose-rgb),0.30); border-radius: 12px; margin-bottom: 16px; color: var(--rose-light); outline: none; transition: border-color 0.2s; box-sizing: border-box; }
        .fp-otp:focus { border-color: var(--rose); }
        .fp-otp::placeholder { color: rgba(var(--rose-rgb),0.22); letter-spacing: 8px; font-size: 24px; }
        .fp-pw-wrap { position: relative; margin-bottom: 8px; }
        .fp-pw-eye { position: absolute; right: 14px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: var(--text-sub); display: flex; align-items: center; transition: color 0.15s; }
        .fp-pw-eye:hover { color: var(--text-muted); }
        .fp-strength { display: flex; gap: 5px; margin-bottom: 14px; }
        .fp-bar { height: 3px; flex: 1; border-radius: 3px; background: rgba(0,0,0,0.09); transition: background 0.3s; }
        .fp-btn { width: 100%; padding: 13px; margin-bottom: 10px; border: none; border-radius: 10px; background: var(--grad); color: #fff; font-family: var(--font, 'Inter', sans-serif); font-size: 14px; font-weight: 600; cursor: pointer; box-shadow: 0 4px 18px rgba(var(--rose-rgb),0.30); transition: opacity 0.15s, transform 0.15s; display: flex; align-items: center; justify-content: center; gap: 8px; }
        .fp-btn:hover:not(:disabled) { opacity: 0.92; transform: translateY(-1px); }
        .fp-btn:disabled { opacity: 0.55; cursor: not-allowed; }
        .fp-cancel { width: 100%; padding: 11px; border: 1px solid rgba(0,0,0,0.10); border-radius: 10px; background: rgba(0,0,0,0.03); color: var(--text-sub); font-family: var(--font, 'Inter', sans-serif); font-size: 13.5px; cursor: pointer; transition: background 0.15s; }
        .fp-cancel:hover { background: rgba(0,0,0,0.06); }
        .fp-back { background: none; border: none; color: var(--text-sub); font-family: var(--font, 'Inter', sans-serif); font-size: 12.5px; cursor: pointer; margin-bottom: 20px; display: flex; align-items: center; gap: 5px; padding: 0; transition: color 0.15s; }
        .fp-back:hover { color: var(--text); }
        .fp-err { background: rgba(244,63,94,0.08); border: 1px solid rgba(244,63,94,0.20); border-radius: 9px; padding: 10px 12px; font-size: 12.5px; color: #dc2626; margin-bottom: 16px; }
        @media (max-width: 480px) { .fp-box { padding: 32px 20px; border-radius: 18px; } }

        /* Branch Picker Modal */
        .bp-ov { position: fixed; inset: 0; z-index: 9000; background: rgba(0,0,0,0.55); backdrop-filter: blur(14px); display: flex; align-items: center; justify-content: center; padding: 20px; animation: fadein 0.18s ease; }
        .bp-box { background: #ffffff; border: 1px solid rgba(var(--rose-rgb),0.20); border-radius: 24px; padding: 36px 32px; width: 100%; max-width: 440px; box-shadow: 0 16px 60px rgba(0,0,0,0.14); animation: popin 0.22s cubic-bezier(.34,1.56,.64,1); }
        .bp-opt { width: 100%; padding: 13px 16px; margin-bottom: 10px; border: 1px solid rgba(0,0,0,0.09); border-radius: 12px; background: rgba(0,0,0,0.03); color: var(--text); font-family: var(--font, 'Inter', sans-serif); font-size: 14px; font-weight: 600; cursor: pointer; text-align: left; display: flex; align-items: center; gap: 12px; transition: all 0.15s; }
        .bp-opt:hover { background: rgba(var(--rose-rgb),0.10); border-color: rgba(var(--rose-rgb),0.28); color: var(--rose-light); }
        .bp-opt-all { border-color: rgba(var(--rose-rgb),0.22); background: rgba(var(--rose-rgb),0.07); margin-bottom: 16px; }
      ` }} />

      <div className="lr-root" dir={isAr ? 'rtl' : 'ltr'}>

        {/* ── Background slides ── */}
        <div className="lr-bg">
          {SLIDES.map((s, i) => (
            <div key={i}
              className={`lr-bg-img ${i === current ? 'active' : ''} ${i === prev ? 'leaving' : ''}`}
              style={{ backgroundImage: `url(${s.url})` }}
            />
          ))}
        </div>

        {/* ── Dark overlay ── */}
        <div className="lr-overlay" />

        {/* ── Floating petals ── */}
        {[...Array(10)].map((_, i) => (
          <div key={i} className="lr-petal" style={{
            width:  `${7 + (i % 4) * 4}px`,
            height: `${9 + (i % 3) * 4}px`,
            left:   `${(i * 11 + 3) % 88}%`,
            background: i % 2 === 0
              ? `rgba(196,120,140,${0.18 + (i % 3) * 0.07})`
              : `rgba(201,169,110,${0.14 + (i % 4) * 0.06})`,
            animationDuration: `${12 + i * 2.2}s`,
            animationDelay:    `${i * 1.6}s`,
          }} />
        ))}

        {/* ── Brand (desktop top-left) ── */}
        <div className="lr-brand-top">
          <div className="lr-brand-ico" style={{ background: 'none', boxShadow: 'none' }}>
            <NexoraCareIcon size={46} />
          </div>
          <div>
            <div className="lr-brand-name">Nexora Care</div>
          </div>
        </div>

        {/* ── Slide caption (desktop bottom-left) ── */}
        <div className="lr-slide-info" key={current}>
          <div className="lr-slide-title">{isAr ? sl.titleAr : sl.titleEn}</div>
          <div className="lr-slide-sub">{isAr ? sl.subAr : sl.subEn}</div>
        </div>

        {/* ── Dot navigation ── */}
        <div className="lr-dots">
          {SLIDES.map((_, i) => (
            <button key={i} className={`lr-dot ${i === current ? 'on' : 'off'}`}
              onClick={() => goTo(i)} aria-label={`Slide ${i + 1}`} />
          ))}
        </div>

        {/* ── Form Panel ── */}
        <div className="lr-panel">
          <div className="lr-form-inner">

            {/* Mobile brand */}
            <div className="lr-mobile-brand">
              <div className="lr-mobile-ico" style={{ background: 'none', boxShadow: 'none' }}>
                <NexoraCareIcon size={42} />
              </div>
              <div>
                <div className="lr-mobile-name">Nexora Care</div>
              </div>
            </div>

            {/* Back + Lang toggle */}
            <div className="lr-lang-row">
              <a href="/landing" className="lr-back">
                {isAr ? '→' : '←'} {isAr ? 'الصفحة الرئيسية' : 'Home'}
              </a>
              <button className="lr-lang" onClick={toggleLang}>
                {lang === 'en' ? 'AR' : 'EN'}
              </button>
            </div>

            <div className="lr-welcome-wrap">
              <div className="lr-sparks" aria-hidden="true">
                <span className="lr-spark sp1">✦</span>
                <span className="lr-spark sp2">✦</span>
                <span className="lr-spark sp3">✦</span>
              </div>
              <div className="lr-wb-badge">
                <span className="lr-wave-hand">👋</span>
                {isAr ? 'أهلاً وسهلاً بعودتك!' : "Great to see you again!"}
              </div>
              <div className="lr-h1">{isAr ? 'مرحباً بعودتك' : 'Welcome Back'}</div>
            </div>

            {error && <div className="lr-error">⚠ {error}</div>}

            <form onSubmit={handleSubmit} autoComplete="on">
              <label className="lr-lbl">{isAr ? 'اسم المستخدم' : 'Username'}</label>
              <div className="lr-iw">
                <input className="lr-input" type="text"
                  placeholder={isAr ? 'اسم المستخدم' : 'Username'} value={form.username}
                  autoComplete="username"
                  onChange={e => setForm({ ...form, username: e.target.value })} required />
              </div>

              <label className="lr-lbl">{isAr ? 'كلمة المرور' : 'Password'}</label>
              <div className="lr-iw">
                <input className={`lr-input pr`}
                  type={showPw ? 'text' : 'password'}
                  placeholder={isAr ? 'كلمة المرور' : 'Password'} value={form.password}
                  autoComplete="current-password"
                  onChange={e => setForm({ ...form, password: e.target.value })} required />
                <button type="button" className="lr-eye" onClick={() => setShowPw(v => !v)} tabIndex={-1}>
                  {showPw
                    ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24M1 1l22 22"/></svg>
                    : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  }
                </button>
              </div>

              <div className="lr-opts">
                <label className="lr-remember">
                  <input type="checkbox" className="lr-cb" checked={remember} onChange={e => setRemember(e.target.checked)} />
                  <span className="lr-remember-lbl">{isAr ? 'تذكرني' : 'Remember me'}</span>
                </label>
                <button type="button" className="lr-forgot" onClick={() => { setFpStep(1); setFpErr(''); }}>
                  {isAr ? 'نسيت كلمة المرور؟' : 'Forgot password?'}
                </button>
              </div>

              <button type="submit" className="lr-btn" disabled={loading}>
                {loading ? <><span className="lr-spin" /> {isAr ? 'جاري تسجيل الدخول…' : 'Signing in…'}</> : (isAr ? 'تسجيل الدخول' : 'Sign In')}
              </button>
            </form>

            <div className="lr-div">
              <div className="lr-div-line" />
              <div className="lr-div-txt">✦ Nexora Care ✦</div>
              <div className="lr-div-line" />
            </div>

            <button className="lr-explore" onClick={() => router.push('/welcome')} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <NexoraCareIcon size={18} />{isAr ? 'استعرض منصتنا وتعرّف على فريقنا' : 'Explore Nexora Care · Meet Our Team'}
            </button>

            {/* Social + Theme row inside form */}
            <div ref={themePickerRef} className="lr-social-row" style={{ position:'relative', display:'flex', alignItems:'center', justifyContent:'center', gap:10, marginTop:20, marginBottom:16 }}>
              <a href="https://wa.me/962790891028" target="_blank" rel="noopener noreferrer" aria-label="WhatsApp" className="lr-social-btn">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.890-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              </a>
              <a href="https://www.instagram.com/medowahbeh/" target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="lr-social-btn">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
              </a>
              <div style={{ width:1, height:28, background:'rgba(0,0,0,0.10)', flexShrink:0 }} />
              <button className="lr-ctrl-theme" onClick={() => setThemePickerOpen(v => !v)}>
                <div className="lr-theme-dots">
                  {themeEntries.slice(0, 3).map(([key, def]) => (
                    <div key={key} className="lr-theme-dot" style={{ background: def.swatch[0] }} />
                  ))}
                </div>
                <span>🎨</span>
                <span>{t('theme')}</span>
              </button>
              {themePickerOpen && (
                <div className="lr-theme-popup" style={{ bottom:'calc(100% + 10px)', left:0, right:'auto' }}>
                  {themeEntries.map(([key, def]) => (
                    <button
                      key={key}
                      className={`lr-theme-swatch${theme === key ? ' active' : ''}`}
                      style={{ background: `linear-gradient(135deg, ${def.swatch[0]}, ${def.swatch[1]})` }}
                      onClick={() => { setTheme(key); setThemePickerOpen(false); }}
                      title={def.label}
                      aria-label={def.label}
                    />
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>
      </div>

      {/* ── Admin Branch Picker Modal ── */}
      {branchStep && (
        <div className="bp-ov">
          <div className="bp-box" dir={isAr ? 'rtl' : 'ltr'}>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>🏢</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', marginBottom: 6 }}>
                {isAr ? 'اختر الفرع' : 'Select Branch'}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-sub)' }}>
                {isAr ? 'اختر الفرع الذي ستعمل منه اليوم، أو اعرض جميع الفروع.' : 'Choose which branch to work from today, or view all branches.'}
              </div>
            </div>
            <button className="bp-opt bp-opt-all" onClick={() => handlePickBranch(null)}>
              <span style={{ fontSize: 20 }}>🌐</span>
              <div>
                <div>{isAr ? 'جميع الفروع' : 'All Branches'}</div>
                <div style={{ fontSize: 11.5, fontWeight: 400, color: 'var(--text-sub)', marginTop: 2 }}>
                  {isAr ? 'عرض بيانات جميع الفروع' : 'View data across all branches'}
                </div>
              </div>
            </button>
            {branchStep.map((b: any) => (
              <button key={b.id} className="bp-opt" onClick={() => handlePickBranch({ id: b.id })}>
                <span style={{ fontSize: 20 }}>🏢</span>
                <div>
                  <div>{(isAr && b.nameAr) ? b.nameAr : b.name}</div>
                  {b.address && <div style={{ fontSize: 11.5, fontWeight: 400, color: 'var(--text-sub)', marginTop: 2 }}>{b.address}</div>}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Forgot Password Modal ── */}
      {fpStep > 0 && (
        <div className="fp-ov" onClick={(e: React.MouseEvent) => { if (e.target === e.currentTarget) closeFp(); }}>
          <div className="fp-box" dir={isAr ? 'rtl' : 'ltr'}>

            {fpStep === 1 && (
              <>
                <div className="fp-icon">🔑</div>
                <div className="fp-title">{isAr ? 'نسيت كلمة المرور' : 'Forgot Password'}</div>
                <div className="fp-sub">{isAr ? 'أدخل بريدك الإلكتروني وسنرسل لك رمز إعادة التعيين.' : "Enter your account email and we'll send you a reset code."}</div>
                {fpErr && <div className="fp-err">⚠ {fpErr}</div>}
                <form onSubmit={handleSendOtp}>
                  <label className="lr-lbl">{isAr ? 'البريد الإلكتروني' : 'Email Address'}</label>
                  <input className="fp-input" type="email" placeholder={isAr ? 'بريدك@example.com' : 'your@email.com'}
                    value={fpEmail} onChange={e => setFpEmail(e.target.value)} required autoFocus />
                  <button type="submit" className="fp-btn" disabled={fpLoad}>
                    {fpLoad ? <><span className="lr-spin" /> {isAr ? 'جاري الإرسال…' : 'Sending…'}</> : (isAr ? 'إرسال الرمز' : 'Send Code')}
                  </button>
                  <button type="button" className="fp-cancel" onClick={closeFp}>{isAr ? 'إلغاء' : 'Cancel'}</button>
                </form>
              </>
            )}

            {fpStep === 2 && (
              <>
                <button className="fp-back" onClick={() => setFpStep(1)}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d={isAr ? 'M5 12h14M12 5l7 7-7 7' : 'M19 12H5M12 19l-7-7 7-7'}/>
                  </svg>
                  {isAr ? 'رجوع' : 'Back'}
                </button>
                <div className="fp-icon">📬</div>
                <div className="fp-title">{isAr ? 'أدخل رمز التحقق' : 'Enter Reset Code'}</div>
                <div className="fp-sub">
                  {isAr ? 'تحقق من بريدك الإلكتروني للرمز المكون من 6 أرقام.' : 'Check your email for the 6-digit code. '}
                  <strong style={{ color: 'var(--rose-light)' }}>{fpEmail}</strong>
                </div>
                {fpErr && <div className="fp-err">⚠ {fpErr}</div>}
                {devOtp && (
                  <div style={{ background: 'rgba(201,169,110,0.12)', border: '1px solid rgba(201,169,110,0.30)', borderRadius: 10, padding: '12px 14px', marginBottom: 16, fontSize: 12.5, color: '#e8c98a', lineHeight: 1.7 }}>
                    ⚙️ <strong>Dev mode</strong> — OTP: <span style={{ fontFamily: 'monospace', fontSize: 20, fontWeight: 800, letterSpacing: 4, color: '#b08030' }}>{devOtp}</span>
                  </div>
                )}
                <form onSubmit={handleResetPw}>
                  <label className="lr-lbl">{isAr ? 'رمز التحقق' : 'Verification Code'}</label>
                  <input className="fp-otp" type="text" inputMode="numeric"
                    maxLength={6} placeholder="000000"
                    value={fpOtp} onChange={e => setFpOtp(e.target.value.replace(/\D/g,''))} required />
                  <label className="lr-lbl">{isAr ? 'كلمة المرور الجديدة' : 'New Password'}</label>
                  <div className="fp-pw-wrap">
                    <input className="fp-input" style={{ paddingRight: 44, marginBottom: 0 }}
                      type={fpShowPw ? 'text' : 'password'}
                      placeholder={isAr ? '٦ أحرف على الأقل' : 'Min. 6 characters'}
                      value={fpNewPw} onChange={e => setFpNewPw(e.target.value)} required minLength={6} />
                    <button type="button" className="fp-pw-eye" onClick={() => setFpShowPw(v => !v)} tabIndex={-1}>
                      {fpShowPw
                        ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24M1 1l22 22"/></svg>
                        : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                      }
                    </button>
                  </div>
                  {fpNewPw && (
                    <>
                      <div className="fp-strength" style={{ marginTop: 10 }}>
                        {[1,2,3,4].map(n => (
                          <div key={n} className="fp-bar" style={{ background: pwStr >= n ? SC[pwStr] : undefined }} />
                        ))}
                      </div>
                      <div style={{ fontSize: 11.5, color: SC[pwStr], marginBottom: 14, fontWeight: 600 }}>
                        {isAr ? strengthLabelsAr[pwStr] : strengthLabels[pwStr]}
                      </div>
                    </>
                  )}
                  <button type="submit" className="fp-btn" disabled={fpLoad} style={{ marginTop: fpNewPw ? 0 : 16 }}>
                    {fpLoad ? <><span className="lr-spin" /> {isAr ? 'جاري التحقق…' : 'Verifying…'}</> : (isAr ? 'تحقق وإعادة التعيين' : 'Verify & Reset')}
                  </button>
                  <button type="button" className="fp-cancel" onClick={closeFp}>{isAr ? 'إلغاء' : 'Cancel'}</button>
                </form>
              </>
            )}

            {fpStep === 3 && (
              <div style={{ textAlign: 'center', padding: '8px 0' }}>
                <div style={{ fontSize: 56, marginBottom: 18 }}>✨</div>
                <div className="fp-title" style={{ textAlign: 'center' }}>{isAr ? 'تمت إعادة التعيين!' : 'Password Reset!'}</div>
                <div className="fp-sub" style={{ textAlign: 'center', marginBottom: 28 }}>{isAr ? 'تم تحديث كلمة المرور. يمكنك الآن تسجيل الدخول.' : 'Your password has been updated. You can now sign in.'}</div>
                <button className="fp-btn" onClick={closeFp}>{isAr ? 'العودة لتسجيل الدخول' : 'Back to Login'}</button>
              </div>
            )}

          </div>
        </div>
      )}
    </>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginPageInner />
    </Suspense>
  );
}
