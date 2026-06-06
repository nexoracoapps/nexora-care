'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import NexoraCareIcon from '@/components/NexoraCareIcon';
import { useLanguage } from '@/context/LanguageContext';

const GRAD   = 'linear-gradient(135deg,#e53e5a,#7B5EA8)';
const GRAD_R = 'linear-gradient(135deg,rgba(229,62,90,0.15),rgba(123,94,168,0.15))';
const PRIMARY = '#e53e5a';
const PURPLE  = '#7B5EA8';
const TEAL    = '#0ea5e9';
const GREEN   = '#10b981';

const FEATURES = [
  { icon: '🩺', color: PRIMARY,   title: 'Patient Records',      titleAr: 'سجلات المرضى',
    desc:   'Complete digital health profiles — diagnoses, treatments, allergies, and full visit history in one secure place.',
    descAr: 'ملفات صحية رقمية كاملة — التشخيصات والعلاجات والحساسية وسجل الزيارات في مكان واحد آمن.' },
  { icon: '📅', color: PURPLE,    title: 'Smart Scheduling',     titleAr: 'جدولة ذكية',
    desc:   'Conflict-free appointment booking with automated SMS reminders that cut no-shows by up to 60%.',
    descAr: 'حجز مواعيد بلا تعارضات مع تذكيرات SMS تلقائية تقلل حالات الغياب بنسبة تصل إلى 60%.' },
  { icon: '💊', color: TEAL,      title: 'Treatment Tracking',   titleAr: 'تتبع العلاجات',
    desc:   'Log every procedure, add delivery notes, track progress, and auto-schedule follow-up visits.',
    descAr: 'سجّل كل إجراء وأضف ملاحظات التسليم وتتبع التقدم وحدد مواعيد المتابعة تلقائياً.' },
  { icon: '💳', color: GREEN,     title: 'Billing & Payments',   titleAr: 'الفواتير والمدفوعات',
    desc:   'Invoice to receipt in seconds. Track unpaid bills, accept multiple payment methods, reconcile daily.',
    descAr: 'من الفاتورة إلى الإيصال في ثوانٍ. تتبع الفواتير غير المدفوعة واقبل طرق دفع متعددة.' },
  { icon: '👩‍⚕️', color: '#f59e0b', title: 'Staff & Specialists', titleAr: 'الفريق والمتخصصون',
    desc:   'Assign specialties, track availability, manage leave requests, and measure individual performance.',
    descAr: 'حدد التخصصات وتتبع التوفر وأدِر طلبات الإجازات وقيّم الأداء الفردي.' },
  { icon: '📊', color: '#8b5cf6', title: 'Clinical Analytics',   titleAr: 'تحليلات سريرية',
    desc:   'Discover your most profitable treatments, busiest hours, and top specialists — backed by real data.',
    descAr: 'اكتشف العلاجات الأكثر ربحاً وساعات الذروة وأفضل متخصصيك — مدعوماً بالبيانات الحقيقية.' },
];

const COMPARE = [
  { before: 'Paper files lost or buried in shelves',       beforeAr: 'ملفات ورقية ضائعة في الأرفف',
    after:  'Full patient history on any device, instantly',afterAr: 'سجل المريض الكامل على أي جهاز، فوراً' },
  { before: 'Phone calls for every appointment change',    beforeAr: 'مكالمات هاتفية لكل تغيير في الموعد',
    after:  'Auto-booking with SMS confirmations',         afterAr: 'حجز تلقائي مع تأكيدات SMS' },
  { before: 'No-shows with zero follow-up',               beforeAr: 'غياب بدون متابعة',
    after:  'Automated reminders before every visit',      afterAr: 'تذكيرات تلقائية قبل كل زيارة' },
  { before: 'End-of-month billing chaos',                 beforeAr: 'فوضى الفواتير في نهاية الشهر',
    after:  'Real-time revenue and payment dashboard',     afterAr: 'لوحة إيرادات ومدفوعات فورية' },
];

const SPECIALTIES = [
  { icon: '🦷', name: 'Dental',         nameAr: 'الأسنان' },
  { icon: '👁️', name: 'Eye Care',        nameAr: 'العيون' },
  { icon: '🧠', name: 'Mental Health',   nameAr: 'الصحة النفسية' },
  { icon: '🦴', name: 'Physiotherapy',   nameAr: 'العلاج الطبيعي' },
  { icon: '💅', name: 'Aesthetics',      nameAr: 'التجميل' },
  { icon: '🩺', name: 'General Practice',nameAr: 'الطب العام' },
  { icon: '👶', name: 'Pediatrics',      nameAr: 'طب الأطفال' },
  { icon: '🧖', name: 'Wellness & Spa',  nameAr: 'العافية والسبا' },
  { icon: '🫀', name: 'Cardiology',      nameAr: 'القلب' },
  { icon: '🩻', name: 'Radiology',       nameAr: 'الأشعة' },
];

const STEPS = [
  { n: '1', icon: '🏥', title: 'Set up your clinic',    titleAr: 'إعداد العيادة',
    desc:   'Add your clinic, branches, services, and team in minutes. No IT expertise needed.',
    descAr: 'أضف عيادتك وفروعها وخدماتها وفريقها في دقائق. لا خبرة تقنية مطلوبة.' },
  { n: '2', icon: '👥', title: 'Import your patients',  titleAr: 'استيراد المرضى',
    desc:   'Bring existing records, assign specialists, and start booking appointments immediately.',
    descAr: 'استورد السجلات الموجودة وحدد المتخصصين وابدأ حجز المواعيد فوراً.' },
  { n: '3', icon: '✨', title: 'Watch your clinic grow', titleAr: 'شاهد عيادتك تنمو',
    desc:   'Reduce no-shows, collect payments faster, and make smarter clinical decisions every day.',
    descAr: 'قلل الغيابات واجمع المدفوعات أسرع واتخذ قرارات سريرية أذكى كل يوم.' },
];


export default function LandingPage() {
  const { lang, setLang } = useLanguage();
  const router = useRouter();

  const ar = lang === 'ar';
  const dir = ar ? 'rtl' : 'ltr';

  const [isOffline, setIsOffline] = useState(false);
  const [hasCachedSession, setHasCachedSession] = useState(false);

  useEffect(() => {
    const update = () => setIsOffline(!navigator.onLine);
    setIsOffline(!navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    const raw = localStorage.getItem('nexora-user') || sessionStorage.getItem('nexora-user');
    if (raw) {
      try {
        const cached = JSON.parse(raw);
        if (cached?.token) {
          const payload = JSON.parse(atob(cached.token.split('.')[1]));
          if (!payload.exp || Date.now() / 1000 < payload.exp) setHasCachedSession(true);
        }
      } catch { /* ignore */ }
    }
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);

  const goLogin = () => {
    router.push('/login');
  };

  const goDashboard = () => {
    router.push('/dashboard');
  };

  return (
    <div dir={dir} style={{ fontFamily: '"Inter","Segoe UI",sans-serif', background: '#120b1a', color: 'rgba(255,255,255,0.92)', minHeight: '100vh' }}>
      <style dangerouslySetInnerHTML={{ __html: `
        * { box-sizing:border-box; margin:0; padding:0; }

        @keyframes fade-up    { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulse-ring { 0%{transform:scale(1);opacity:0.6} 70%{transform:scale(1.5);opacity:0} 100%{transform:scale(1.5);opacity:0} }
        @keyframes draw-hb    { to { stroke-dashoffset: 0; } }
        @keyframes float-y    { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
        @keyframes shimmer    { 0%{background-position:200% center} 100%{background-position:-200% center} }
        @keyframes spec-scroll{ 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }
        @keyframes hero-glow  { 0%,100%{box-shadow:0 0 28px rgba(229,62,90,0.6),0 8px 36px rgba(123,94,168,0.45)} 50%{box-shadow:0 0 52px rgba(229,62,90,0.85),0 16px 60px rgba(123,94,168,0.65),0 0 0 12px rgba(229,62,90,0)} }
        @keyframes hero-bg    { 0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%} }
        @keyframes hero-sweep { 0%{left:-80%;opacity:0} 20%{opacity:1} 100%{left:140%;opacity:0} }

        .lp-btn-primary {
          position:relative; overflow:hidden;
          background:${GRAD}; color:#fff; border:none; border-radius:16px;
          padding:15px 36px; font-size:1rem; font-weight:800; cursor:pointer;
          transition:transform 0.2s, box-shadow 0.2s;
          box-shadow:0 4px 20px rgba(229,62,90,0.45); letter-spacing:0.3px;
        }
        .lp-btn-primary::before { content:''; position:absolute; inset:0; background:linear-gradient(135deg,rgba(255,255,255,0.18) 0%,transparent 60%); border-radius:inherit; pointer-events:none; }
        .lp-btn-primary::after  { content:''; position:absolute; top:-50%; left:-60%; width:40%; height:200%; background:rgba(255,255,255,0.22); transform:skewX(-20deg); transition:left 0.5s ease; pointer-events:none; }
        .lp-btn-primary:hover   { transform:translateY(-3px); box-shadow:0 12px 36px rgba(229,62,90,0.6); }
        .lp-btn-primary:hover::after { left:130%; }
        .lp-btn-primary:active  { transform:translateY(-1px); }

        .lp-btn-outline {
          position:relative; overflow:hidden;
          background:rgba(229,62,90,0.08); color:#fff;
          border:1.5px solid rgba(229,62,90,0.55); border-radius:16px;
          padding:14px 34px; font-size:1rem; font-weight:700; cursor:pointer;
          transition:all 0.22s; letter-spacing:0.3px; backdrop-filter:blur(4px);
        }
        .lp-btn-outline:hover { background:${GRAD}; border-color:transparent; transform:translateY(-3px); box-shadow:0 10px 28px rgba(229,62,90,0.38); }

        .lp-btn-hero {
          position:relative; overflow:hidden; border:none; cursor:pointer; color:#fff;
          border-radius:20px; padding:17px 46px; font-size:1.1rem; font-weight:900; letter-spacing:0.4px;
          background:linear-gradient(135deg,#e53e5a,#a855f7,#7B5EA8,#e53e5a);
          background-size:300% 300%;
          animation:hero-bg 5s ease infinite, hero-glow 2.8s ease-in-out infinite;
          transition:transform 0.2s, filter 0.2s;
          text-shadow:0 1px 8px rgba(0,0,0,0.25);
        }
        .lp-btn-hero::before { content:''; position:absolute; inset:0; background:linear-gradient(135deg,rgba(255,255,255,0.22) 0%,transparent 55%); border-radius:inherit; pointer-events:none; }
        .lp-btn-hero::after  { content:''; position:absolute; top:0; left:-80%; width:40%; height:100%; background:linear-gradient(90deg,transparent,rgba(255,255,255,0.35),transparent); transform:skewX(-18deg); animation:hero-sweep 3.5s ease-in-out infinite 1s; pointer-events:none; }
        .lp-btn-hero:hover   { transform:translateY(-4px) scale(1.03); filter:brightness(1.12); }
        .lp-btn-hero:active  { transform:translateY(-1px) scale(1.01); }

        .lp-btn-hero-wrap { position:relative; display:inline-block; border-radius:22px; padding:2px; background:linear-gradient(135deg,#e53e5a,#7B5EA8,#0ea5e9,#e53e5a); background-size:300% 300%; animation:hero-bg 5s ease infinite; }
        .lp-btn-hero-wrap::before { content:''; position:absolute; inset:2px; border-radius:20px; background:#120b1a; z-index:0; }

        .lp-badge { display:inline-block; background:${GRAD_R}; color:${PRIMARY}; border:1px solid rgba(229,62,90,0.3); border-radius:100px; padding:6px 18px; font-size:0.82rem; font-weight:700; letter-spacing:0.04em; margin-bottom:18px; }

.feat-card { background:rgba(255,255,255,0.04); border-radius:20px; padding:28px; border:1px solid rgba(255,255,255,0.08); transition:transform 0.2s, border-color 0.2s, box-shadow 0.2s; position:relative; overflow:hidden; }
        .feat-card::before { content:''; position:absolute; top:0; inset-inline-start:0; height:3px; border-radius:3px 3px 0 0; background:var(--fc); width:100%; opacity:0.7; transition:opacity 0.2s; }
        .feat-card:hover { transform:translateY(-5px); border-color:rgba(255,255,255,0.15); box-shadow:0 20px 50px rgba(0,0,0,0.4); }
        .feat-card:hover::before { opacity:1; }

.comp-before { background:rgba(229,62,90,0.06); border:1px solid rgba(229,62,90,0.2); border-radius:14px; padding:16px 20px; display:flex; gap:12px; align-items:flex-start; }
        .comp-after  { background:rgba(16,185,129,0.06); border:1px solid rgba(16,185,129,0.2); border-radius:14px; padding:16px 20px; display:flex; gap:12px; align-items:flex-start; }

        .spec-track { display:flex; gap:12px; animation:spec-scroll 28s linear infinite; width:max-content; }
        .spec-chip  { display:flex; align-items:center; gap:8px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); border-radius:40px; padding:9px 18px; font-size:0.85rem; font-weight:600; white-space:nowrap; }
        .spec-chip:hover { background:${GRAD_R}; border-color:rgba(229,62,90,0.35); }

        .step-connector { flex:1; height:1px; background:linear-gradient(90deg,transparent,rgba(255,255,255,0.15),transparent); margin:0 8px; align-self:center; }

        @media(max-width:700px){
          .hero-btns{flex-direction:column;align-items:stretch;padding:0 12px;}
          .hero-btns a,.hero-btns button{width:100%!important;min-width:unset!important;text-align:center;}
          .lp-btn-hero{padding:16px 24px!important;font-size:1rem!important;}
          .lp-btn-outline{padding:15px 24px!important;font-size:0.97rem!important;}
          .lp-grid-3{grid-template-columns:1fr!important;}
          .lp-grid-2{grid-template-columns:1fr!important;}
          .step-connector{display:none;}
        }
      `}} />

      {/* ── Offline Banner ── */}
      {isOffline && (
        <div style={{ background: 'linear-gradient(90deg,#d97706,#b45309)', padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, flexWrap: 'wrap', textAlign: 'center', fontSize: 13, fontWeight: 600, color: '#fff' }}>
          <span>📶</span>
          <span>{ar ? 'أنت غير متصل بالإنترنت.' : 'You\'re offline.'}</span>
          {hasCachedSession ? (
            <button onClick={goDashboard} style={{ background: 'rgba(255,255,255,0.22)', border: '1px solid rgba(255,255,255,0.4)', borderRadius: 8, padding: '4px 14px', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              {ar ? 'متابعة إلى لوحة التحكم ←' : 'Continue to Dashboard →'}
            </button>
          ) : (
            <span style={{ opacity: 0.85 }}>{ar ? 'سجّل دخولك مرة واحدة عبر الإنترنت مع "تذكرني" لتتمكن من العمل بدون إنترنت.' : 'Sign in once online with "Remember me" to work offline.'}</span>
          )}
        </div>
      )}

      {/* ── NAV ── */}
      <nav style={{ position:'sticky', top:0, zIndex:100, background:'rgba(18,11,26,0.96)', backdropFilter:'blur(16px)', borderBottom:'1px solid rgba(255,255,255,0.07)', padding:'0 20px' }}>
        <div style={{ maxWidth:1100, margin:'0 auto', display:'flex', alignItems:'center', justifyContent:'space-between', height:62 }}>
          {/* Logo */}
          <div style={{ display:'flex', alignItems:'center', gap:9 }}>
            <NexoraCareIcon size={32} />
            <span style={{ fontWeight:800, fontSize:'1.05rem', background:GRAD, WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>Nexora Care</span>
          </div>
          {/* Actions */}
          <div style={{ display:'flex', gap:10, alignItems:'center' }}>
            {/* Language toggle — subtle ghost style */}
            <button
              onClick={() => setLang(ar ? 'en' : 'ar')}
              style={{ background:'rgba(255,255,255,0.07)', color:'rgba(255,255,255,0.75)', border:'1px solid rgba(255,255,255,0.13)', borderRadius:10, padding:'7px 16px', fontWeight:700, fontSize:13, cursor:'pointer', transition:'all 0.15s', letterSpacing:'0.04em' }}
              onMouseEnter={e=>{e.currentTarget.style.background='rgba(255,255,255,0.12)'; e.currentTarget.style.color='#fff';}}
              onMouseLeave={e=>{e.currentTarget.style.background='rgba(255,255,255,0.07)'; e.currentTarget.style.color='rgba(255,255,255,0.75)';}}>
              {ar ? 'EN' : 'عربي'}
            </button>
            {/* Login / Dashboard CTA */}
            {isOffline && hasCachedSession ? (
              <button
                onClick={goDashboard}
                style={{ background:'linear-gradient(135deg,#d97706,#b45309)', color:'#fff', border:'none', borderRadius:12, padding:'8px 22px', fontWeight:800, fontSize:14, cursor:'pointer', boxShadow:'0 4px 18px rgba(217,119,6,0.42)', transition:'transform 0.15s, filter 0.15s', letterSpacing:'0.2px' }}
                onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.filter='brightness(1.1)';}}
                onMouseLeave={e=>{e.currentTarget.style.transform='none'; e.currentTarget.style.filter='none';}}>
                {ar ? '📶 متابعة بدون إنترنت' : '📶 Continue Offline'}
              </button>
            ) : (
              <button
                onClick={goLogin}
                style={{ background:GRAD, color:'#fff', border:'none', borderRadius:12, padding:'8px 22px', fontWeight:800, fontSize:14, cursor:'pointer', boxShadow:'0 4px 18px rgba(229,62,90,0.42)', transition:'transform 0.15s, filter 0.15s', letterSpacing:'0.2px' }}
                onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.filter='brightness(1.1)';}}
                onMouseLeave={e=>{e.currentTarget.style.transform='none'; e.currentTarget.style.filter='none';}}>
                {ar ? 'تسجيل الدخول' : 'Sign In'}
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section style={{ position:'relative', overflow:'hidden', background:'linear-gradient(160deg,#1e0a22 0%,#160d30 50%,#0e0a2a 100%)', padding:'110px 24px 90px', textAlign:'center' }}>
        {/* Heartbeat SVG background */}
        <div style={{ position:'absolute', inset:0, overflow:'hidden', pointerEvents:'none', opacity:0.18 }}>
          <svg width="100%" height="100%" viewBox="0 0 1400 300" preserveAspectRatio="xMidYMid slice">
            <defs>
              <linearGradient id="hbGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#e53e5a" stopOpacity="0"/>
                <stop offset="25%" stopColor="#e53e5a"/>
                <stop offset="65%" stopColor="#7B5EA8"/>
                <stop offset="100%" stopColor="#7B5EA8" stopOpacity="0"/>
              </linearGradient>
            </defs>
            <polyline
              points="0,150 180,150 220,130 260,170 290,150 340,150 370,60 400,240 420,150 480,150 510,120 540,180 560,150 680,150 710,80 740,220 760,150 820,150 850,110 880,190 900,150 1000,150 1030,70 1060,230 1080,150 1140,150 1180,130 1220,170 1260,150 1400,150"
              fill="none" stroke="url(#hbGrad)" strokeWidth="1.5"
              style={{ strokeDasharray:3000, strokeDashoffset:3000, animation:'draw-hb 2.8s ease forwards 0.3s' }}
            />
          </svg>
        </div>

        {/* Glow orbs */}
        <div style={{ position:'absolute', top:'10%', left:'15%', width:400, height:400, borderRadius:'50%', background:'radial-gradient(circle,rgba(229,62,90,0.12),transparent 70%)', pointerEvents:'none' }}/>
        <div style={{ position:'absolute', bottom:'5%', right:'10%', width:350, height:350, borderRadius:'50%', background:'radial-gradient(circle,rgba(123,94,168,0.14),transparent 70%)', pointerEvents:'none' }}/>

        <div style={{ position:'relative', maxWidth:820, margin:'0 auto', animation:'fade-up 0.7s ease both' }}>
          <div className="lp-badge">
            {ar ? '🏥 إدارة العيادات من الجيل الجديد' : '🏥 Next-Generation Clinic Management'}
          </div>

          <h1 style={{ fontSize:'clamp(2rem,5vw,3.6rem)', fontWeight:900, lineHeight:1.12, letterSpacing:'-1.5px', marginBottom:22, color:'rgba(255,255,255,0.97)' }}>
            {ar
              ? <>{ar && 'كل تجربة رعاية استثنائية'}<br/><span style={{ background:GRAD, WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>تبدأ بإدارة عيادة ذكية</span></>
              : <>Every great patient experience<br/><span style={{ background:GRAD, WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>starts with smarter clinic management</span></>}
          </h1>

          <p style={{ fontSize:'1.15rem', color:'rgba(255,255,255,0.58)', lineHeight:1.75, maxWidth:600, margin:'0 auto 38px' }}>
            {ar
              ? 'Nexora Care يجمع ملفات المرضى والمواعيد والمدفوعات وتقارير الأداء في نظام واحد سهل الاستخدام — مصمم خصيصاً للعيادات.'
              : 'Nexora Care brings patient records, appointments, payments, and performance reports into one easy system — built specifically for clinics.'}
          </p>

          <div className="hero-btns" style={{ display:'flex', gap:14, justifyContent:'center', flexWrap:'wrap', marginBottom:40 }}>
            {/* Primary CTA — animated gradient */}
            <button className="lp-btn-hero" onClick={goLogin} style={{ minWidth:200 }}>
              {ar ? '✦ ابدأ الآن' : '✦ Get Started Now'}
            </button>
            {/* Secondary CTA — ghost/outline */}
            <a href="#features" style={{ textDecoration:'none', minWidth:200 }}>
              <button className="lp-btn-outline" style={{ width:'100%', padding:'16px 36px', fontSize:'1rem' }}>
                {ar ? '← اكتشف المميزات' : 'See Features →'}
              </button>
            </a>
          </div>

        </div>
      </section>


      {/* ── SPECIALTIES ── */}
      <section style={{ background:'#120b1a', padding:'40px 0', overflow:'hidden' }}>
        <p style={{ textAlign:'center', fontSize:'0.8rem', fontWeight:700, letterSpacing:'0.08em', color:'rgba(255,255,255,0.3)', textTransform:'uppercase', marginBottom:20 }}>
          {ar ? 'يعمل مع جميع أنواع العيادات' : 'Works with every type of clinic'}
        </p>
        <div style={{ overflow:'hidden', position:'relative' }}>
          <div style={{ position:'absolute', left:0, top:0, bottom:0, width:80, background:'linear-gradient(to right,#120b1a,transparent)', zIndex:1, pointerEvents:'none' }}/>
          <div style={{ position:'absolute', right:0, top:0, bottom:0, width:80, background:'linear-gradient(to left,#120b1a,transparent)', zIndex:1, pointerEvents:'none' }}/>
          <div className="spec-track">
            {[...SPECIALTIES, ...SPECIALTIES].map((s, i) => (
              <div key={i} className="spec-chip">
                <span style={{ fontSize:'1.1rem' }}>{s.icon}</span>
                <span>{ar ? s.nameAr : s.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── BEFORE / AFTER ── */}
      <section style={{ background:'linear-gradient(160deg,#160d30,#0e0a2a)', padding:'96px 24px' }}>
        <div style={{ maxWidth:1100, margin:'0 auto' }}>
          <div style={{ textAlign:'center', marginBottom:52 }}>
            <div className="lp-badge">{ar ? 'الفرق الحقيقي' : 'The Real Difference'}</div>
            <h2 style={{ fontSize:'clamp(1.6rem,3.5vw,2.5rem)', fontWeight:800, marginBottom:14, color:'rgba(255,255,255,0.96)' }}>
              {ar ? 'هل عيادتك لا تزال تعمل بهذه الطريقة؟' : 'Is your clinic still running like this?'}
            </h2>
            <p style={{ color:'rgba(255,255,255,0.45)', fontSize:'1rem', maxWidth:520, margin:'0 auto' }}>
              {ar ? 'معظم العيادات تخسر الوقت والمال يومياً بسبب أنظمة قديمة. Nexora Care يغير ذلك.' : 'Most clinics lose time and money daily due to outdated systems. Nexora Care changes that.'}
            </p>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }} className="lp-grid-2">
            {/* Before column */}
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <div style={{ background:'rgba(229,62,90,0.1)', borderRadius:14, padding:'12px 18px', textAlign:'center', fontWeight:700, fontSize:'0.82rem', color:PRIMARY, textTransform:'uppercase', letterSpacing:'0.06em', border:`1px solid rgba(229,62,90,0.2)` }}>
                {ar ? '❌ قبل Nexora Care' : '❌ Without Nexora Care'}
              </div>
              {COMPARE.map((c, i) => (
                <div key={i} className="comp-before">
                  <span style={{ color:PRIMARY, fontSize:'1rem', flexShrink:0, marginTop:2 }}>✗</span>
                  <span style={{ fontSize:'0.9rem', color:'rgba(255,255,255,0.7)', lineHeight:1.5 }}>{ar ? c.beforeAr : c.before}</span>
                </div>
              ))}
            </div>
            {/* After column */}
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <div style={{ background:'rgba(16,185,129,0.1)', borderRadius:14, padding:'12px 18px', textAlign:'center', fontWeight:700, fontSize:'0.82rem', color:GREEN, textTransform:'uppercase', letterSpacing:'0.06em', border:`1px solid rgba(16,185,129,0.2)` }}>
                {ar ? '✅ مع Nexora Care' : '✅ With Nexora Care'}
              </div>
              {COMPARE.map((c, i) => (
                <div key={i} className="comp-after">
                  <span style={{ color:GREEN, fontSize:'1rem', flexShrink:0, marginTop:2 }}>✓</span>
                  <span style={{ fontSize:'0.9rem', color:'rgba(255,255,255,0.7)', lineHeight:1.5 }}>{ar ? c.afterAr : c.after}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" style={{ padding:'96px 24px', background:'#120b1a' }}>
        <div style={{ maxWidth:1100, margin:'0 auto' }}>
          <div style={{ textAlign:'center', marginBottom:56 }}>
            <div className="lp-badge">{ar ? 'كل ما تحتاجه' : 'Everything You Need'}</div>
            <h2 style={{ fontSize:'clamp(1.6rem,3.5vw,2.5rem)', fontWeight:800, marginBottom:14, color:'rgba(255,255,255,0.96)' }}>
              {ar ? 'أدوات الرعاية في نظام واحد' : 'Care tools, one system'}
            </h2>
            <p style={{ color:'rgba(255,255,255,0.45)', fontSize:'1rem', maxWidth:520, margin:'0 auto' }}>
              {ar ? 'من ملف المريض الأول إلى تقرير الإيرادات الشهري — Nexora Care يغطي كل خطوة.' : 'From the first patient file to the monthly revenue report — Nexora Care covers every step.'}
            </p>
          </div>
          <div className="lp-grid-3" style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:20 }}>
            {FEATURES.map(f => (
              <div key={f.title} className="feat-card" style={{ '--fc': f.color } as any}>
                <div style={{ width:50, height:50, borderRadius:14, background:`${f.color}18`, border:`1.5px solid ${f.color}35`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.45rem', marginBottom:18 }}>
                  {f.icon}
                </div>
                <h3 style={{ fontWeight:700, fontSize:'1rem', marginBottom:10, color:'rgba(255,255,255,0.94)' }}>{ar ? f.titleAr : f.title}</h3>
                <p style={{ color:'rgba(255,255,255,0.46)', fontSize:'0.88rem', lineHeight:1.65 }}>{ar ? f.descAr : f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section style={{ background:'linear-gradient(160deg,#160d30,#0e0a2a)', padding:'96px 24px' }}>
        <div style={{ maxWidth:1100, margin:'0 auto', textAlign:'center' }}>
          <div className="lp-badge">{ar ? 'كيف تبدأ' : 'How to Start'}</div>
          <h2 style={{ fontSize:'clamp(1.6rem,3.5vw,2.5rem)', fontWeight:800, marginBottom:14, color:'rgba(255,255,255,0.96)' }}>
            {ar ? 'جاهز في ٣ خطوات بسيطة' : 'Ready in 3 simple steps'}
          </h2>
          <p style={{ color:'rgba(255,255,255,0.45)', fontSize:'1rem', marginBottom:60, maxWidth:480, margin:'0 auto 60px' }}>
            {ar ? 'لا تعقيد. لا تدريب طويل. فقط سجّل وابدأ.' : 'No complexity. No long training. Just register and go.'}
          </p>
          <div style={{ display:'flex', alignItems:'flex-start', gap:0 }} className="lp-grid-3 steps-row">
            {STEPS.map((s, i) => (
              <>
                <div key={s.n} style={{ flex:1, textAlign:'center', padding:'0 16px' }}>
                  <div style={{ position:'relative', display:'inline-block', marginBottom:22 }}>
                    <div style={{ width:66, height:66, borderRadius:'50%', background:GRAD, color:'#fff', fontSize:'1.5rem', fontWeight:900, display:'flex', alignItems:'center', justifyContent:'center', boxShadow:`0 8px 28px rgba(229,62,90,0.42)`, animation:'float-y 3s ease-in-out infinite', animationDelay:`${i*0.4}s` }}>
                      {s.icon}
                    </div>
                    <div style={{ position:'absolute', top:-4, insetInlineEnd:-4, width:24, height:24, borderRadius:'50%', background:'#120b1a', border:`2px solid ${PRIMARY}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.72rem', fontWeight:900, color:PRIMARY }}>
                      {s.n}
                    </div>
                  </div>
                  <h3 style={{ fontWeight:700, fontSize:'1.05rem', marginBottom:10, color:'rgba(255,255,255,0.94)' }}>{ar ? s.titleAr : s.title}</h3>
                  <p style={{ color:'rgba(255,255,255,0.46)', fontSize:'0.88rem', lineHeight:1.65 }}>{ar ? s.descAr : s.desc}</p>
                </div>
                {i < STEPS.length - 1 && <div key={`con${i}`} className="step-connector" style={{ marginTop:33 }} />}
              </>
            ))}
          </div>
        </div>
      </section>

      {/* ── TRUST ── */}
      <section style={{ background:'#120b1a', padding:'80px 24px' }}>
        <div style={{ maxWidth:1100, margin:'0 auto', textAlign:'center' }}>
          <div className="lp-badge">{ar ? 'ثق في نظامنا' : 'Built to Trust'}</div>
          <h2 style={{ fontSize:'clamp(1.5rem,3vw,2.2rem)', fontWeight:800, marginBottom:48, color:'rgba(255,255,255,0.96)' }}>
            {ar ? 'أمان وموثوقية على مستوى المستشفيات' : 'Hospital-grade security and reliability'}
          </h2>
          <div className="lp-grid-3" style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:22 }}>
            {[
              { icon:'🔐', color:'#0ea5e9',
                title: ar ? 'تشفير كامل'        : 'End-to-End Encryption',
                desc:  ar ? 'بيانات المرضى محمية بتشفير كامل مع نسخ احتياطية تلقائية منتظمة.' : 'Patient data protected with full encryption and regular automated backups.' },
              { icon:'🛡️', color:PRIMARY,
                title: ar ? 'صلاحيات دقيقة'     : 'Role-Based Access',
                desc:  ar ? 'تحكم دقيق في صلاحيات كل مستخدم — مدير، موظف، أو مشرف.' : 'Fine-grained control over every user — admin, staff, or supervisor.' },
              { icon:'⚡', color:'#f59e0b',
                title: ar ? 'متاح على مدار الساعة' : '99.9% Uptime',
                desc:  ar ? 'بنية سحابية موثوقة تضمن توفر النظام في أي وقت.' : 'Reliable cloud infrastructure ensures the system is available anytime.' },
            ].map(t => (
              <div key={t.title} style={{ background:'rgba(255,255,255,0.04)', borderRadius:20, padding:'32px 24px', textAlign:'center', border:'1px solid rgba(255,255,255,0.08)', transition:'transform 0.2s', cursor:'default' }}
                onMouseEnter={e=>(e.currentTarget.style.transform='translateY(-4px)')}
                onMouseLeave={e=>(e.currentTarget.style.transform='none')}>
                <div style={{ width:58, height:58, borderRadius:'50%', background:`${t.color}18`, border:`2px solid ${t.color}40`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.6rem', margin:'0 auto 18px' }}>
                  {t.icon}
                </div>
                <h3 style={{ fontWeight:700, fontSize:'1.05rem', marginBottom:10, color:'rgba(255,255,255,0.94)' }}>{t.title}</h3>
                <p style={{ color:'rgba(255,255,255,0.46)', fontSize:'0.88rem', lineHeight:1.65 }}>{t.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section style={{ position:'relative', overflow:'hidden', background:GRAD, padding:'100px 24px', textAlign:'center' }}>
        <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.18)', pointerEvents:'none' }}/>
        <div style={{ position:'absolute', top:'-40%', left:'50%', transform:'translateX(-50%)', width:600, height:600, borderRadius:'50%', background:'rgba(255,255,255,0.05)', pointerEvents:'none' }}/>
        <div style={{ position:'relative', maxWidth:720, margin:'0 auto' }}>
          <div style={{ display:'flex', justifyContent:'center', marginBottom:22 }}>
            <div style={{ position:'relative' }}>
              <NexoraCareIcon size={60} />
              <div style={{ position:'absolute', inset:-8, borderRadius:'50%', border:'2px solid rgba(255,255,255,0.35)', animation:'pulse-ring 2s ease-out infinite' }}/>
            </div>
          </div>
          <h2 style={{ fontSize:'clamp(1.8rem,4vw,2.8rem)', fontWeight:900, color:'#fff', lineHeight:1.18, marginBottom:18 }}>
            {ar ? 'مرضاك يستحقون الأفضل.\nعيادتك تستحق Nexora Care.' : 'Your patients deserve the best.\nYour clinic deserves Nexora Care.'}
          </h2>
          <p style={{ color:'rgba(255,255,255,0.82)', fontSize:'1.1rem', marginBottom:42, lineHeight:1.65 }}>
            {ar
              ? 'انضم إلى مئات العيادات التي تثق بـ Nexora Care لتقديم رعاية أفضل وإدارة أذكى.'
              : 'Join hundreds of clinics that trust Nexora Care to deliver better care and smarter management.'}
          </p>
          <button onClick={goLogin} className="lp-btn-hero" style={{ fontSize:'1.08rem', padding:'18px 52px' }}>
            {ar ? '✦ ابدأ الآن' : '✦ Get Started Now'}
          </button>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ background:'#080512', color:'rgba(255,255,255,0.3)', padding:'44px 24px', textAlign:'center', borderTop:'1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ maxWidth:1100, margin:'0 auto' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:10, marginBottom:14 }}>
            <NexoraCareIcon size={28} />
            <span style={{ fontWeight:800, color:'rgba(255,255,255,0.72)', fontSize:'0.95rem' }}>Nexora Care</span>
          </div>
          <p style={{ fontSize:'0.85rem', marginBottom:8 }}>
            {ar ? 'نظام إدارة العيادات من الجيل الجديد' : 'Next-Generation Clinic Management System'}
          </p>
          <p style={{ fontSize:'0.78rem', color:'rgba(255,255,255,0.18)' }}>
            © {new Date().getFullYear()} Nexora Care. {ar ? 'جميع الحقوق محفوظة.' : 'All rights reserved.'}
          </p>
        </div>
      </footer>
    </div>
  );
}
