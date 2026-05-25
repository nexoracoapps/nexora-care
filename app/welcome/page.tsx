'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import NexoraCareIcon from '@/components/NexoraCareIcon';

const SLIDES = [
  { url: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&w=900&q=75', headEn: 'Your Complete\nCare Platform', headAr: 'منصتك الشاملة\nلإدارة الرعاية', subEn: 'Everything you need to manage, grow and delight your clients', subAr: 'كل ما تحتاجه لإدارة وتنمية رضا عملائك' },
  { url: 'https://images.unsplash.com/photo-1551076805-e1869033e561?auto=format&w=900&q=75', headEn: 'Smart Appointment\nManagement', headAr: 'إدارة مواعيد\nذكية وفعّالة', subEn: 'Book, track and follow up with zero friction', subAr: 'احجز وتابع المواعيد بكل سلاسة ودقة' },
  { url: 'https://images.unsplash.com/photo-1582750433449-648ed127bb54?auto=format&w=900&q=75', headEn: 'Empower Your\nEntire Team', headAr: 'مكّن فريقك\nبالأدوات الصحيحة', subEn: 'Coordinate staff, services and branches seamlessly', subAr: 'نسّق الموظفين والخدمات والفروع بسلاسة' },
  { url: 'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?auto=format&w=900&q=75', headEn: 'Insights That\nDrive Growth', headAr: 'إحصاءات تدفع\nنحو النمو', subEn: 'Real-time reports to keep your business on track', subAr: 'تقارير فورية لإبقاء أعمالك في المسار الصحيح' },
];

const SERVICES = [
  { icon: '📅', grad: 'linear-gradient(135deg,#3b82f6,#1d4ed8)', titleEn: 'Appointments', titleAr: 'المواعيد', descEn: 'Smart scheduling that keeps your team organised and clients always on time.', descAr: 'جدولة ذكية تُبقي فريقك منظماً وعملاءك دائماً في الموعد.', list: ['Online Booking','Reminders & Follow-ups','Calendar Sync','Waitlist Management'], listAr: ['الحجز عبر الإنترنت','تذكيرات ومتابعات','مزامنة التقويم','إدارة قائمة الانتظار'] },
  { icon: '👥', grad: 'linear-gradient(135deg,#e53e5a,#9b5de5)', titleEn: 'Team & Staff', titleAr: 'الفريق والموظفون', descEn: 'Manage roles, schedules and performance across all your branches with ease.', descAr: 'أدِر الأدوار والجداول والأداء عبر جميع فروعك بسهولة.', list: ['Staff Profiles','Shift Scheduling','Absence Tracking','Performance Reports'], listAr: ['ملفات الموظفين','جدولة الدوام','تتبع الغيابات','تقارير الأداء'] },
  { icon: '📊', grad: 'linear-gradient(135deg,#10b981,#065f46)', titleEn: 'Reports & Insights', titleAr: 'التقارير والإحصاءات', descEn: 'Real-time analytics on revenue, appointments and client satisfaction.', descAr: 'تحليلات فورية حول الإيرادات والمواعيد ورضا العملاء.', list: ['Revenue Dashboard','Appointment Analytics','Client Retention','Branch Comparison'], listAr: ['لوحة الإيرادات','تحليلات المواعيد','الاحتفاظ بالعملاء','مقارنة الفروع'] },
];

// Type config — Specialist = clinical expert, Consultant = advisory, Provider = hands-on service
const TYPE_CFG: Record<string, { label: string; labelAr: string; desc: string; descAr: string; icon: string; grad: string; color: string }> = {
  DOCTOR:      { label: 'Specialist',   labelAr: 'متخصص',      desc: 'Clinical & medical expert',        descAr: 'خبير طبي وسريري',             icon: '🩺', grad: 'linear-gradient(135deg,#3b82f6,#1d4ed8)', color: '#60a5fa' },
  STYLIST:     { label: 'Consultant',   labelAr: 'مستشار',     desc: 'Personalised advisory & guidance', descAr: 'إرشاد واستشارة شخصية',          icon: '💼', grad: 'linear-gradient(135deg,#e53e5a,#9b5de5)', color: '#f472b6' },
  THERAPIST:   { label: 'Provider',     labelAr: 'مزوّد خدمة', desc: 'Hands-on therapeutic services',    descAr: 'خدمات علاجية عملية',            icon: '🧑‍⚕️', grad: 'linear-gradient(135deg,#10b981,#065f46)', color: '#34d399' },
  ESTHETICIAN: { label: 'Professional', labelAr: 'محترف',      desc: 'Certified care professional',      descAr: 'محترف رعاية معتمد',             icon: '✦',  grad: 'linear-gradient(135deg,#f59e0b,#b45309)', color: '#fbbf24' },
  NAIL_ARTIST: { label: 'Expert',       labelAr: 'خبير',       desc: 'Specialised care expert',          descAr: 'خبير رعاية متخصص',             icon: '⭐', grad: 'linear-gradient(135deg,#e53e5a,#9b5de5)', color: '#f472b6' },
};
const DEFAULT_TC = TYPE_CFG.THERAPIST;

interface Provider { id: string; name: string; type: string; bio?: string | null; photoUrl?: string | null; avgRating?: string | null; totalRatings: number; }
interface Review { id: string; rating: number; comment?: string | null; reviewerName: string; createdAt: string; }
interface Stats { specialists: number; clients: number; satisfaction: number; }

function Stars({ value = 0, size = 13, interactive = false, onRate }: { value?: number; size?: number; interactive?: boolean; onRate?: (n: number) => void }) {
  const [hover, setHover] = useState(0);
  const display = interactive ? (hover || value) : value;
  return (
    <span style={{ letterSpacing: 1, cursor: interactive ? 'pointer' : 'default' }}>
      {[1,2,3,4,5].map(i => (
        <span key={i}
          style={{ fontSize: size, color: i <= Math.round(display) ? '#f59e0b' : 'rgba(255,255,255,0.20)', transition: 'color 0.1s' }}
          onMouseEnter={() => interactive && setHover(i)}
          onMouseLeave={() => interactive && setHover(0)}
          onClick={() => interactive && onRate?.(i)}
        >★</span>
      ))}
    </span>
  );
}

function RateModal({ sp, lang, token, username, initialTab = 'reviews', onClose, onLoginToRate }: {
  sp: Provider; lang: string; token?: string; username?: string; initialTab?: 'reviews' | 'rate'; onClose: () => void; onLoginToRate: () => void;
}) {
  const isAr = lang === 'ar';
  const tc = TYPE_CFG[sp.type] || DEFAULT_TC;
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(true);
  const [tab, setTab] = useState<'reviews' | 'rate'>(initialTab);
  const [myRating, setMyRating] = useState(0);
  const [myComment, setMyComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitErr, setSubmitErr] = useState('');
  const avg = sp.avgRating ? parseFloat(sp.avgRating).toFixed(1) : null;

  const loadReviews = useCallback(() => {
    setLoadingReviews(true);
    fetch(`/api/public/providers/${sp.id}/ratings`)
      .then(r => r.json()).then(d => setReviews(Array.isArray(d) ? d : []))
      .catch(() => {}).finally(() => setLoadingReviews(false));
  }, [sp.id]);

  useEffect(() => { loadReviews(); }, [loadReviews]);

  const submitRating = async () => {
    if (!myRating) { setSubmitErr(isAr ? 'الرجاء اختيار تقييم' : 'Please select a rating'); return; }
    setSubmitting(true); setSubmitErr('');
    try {
      const res = await fetch(`/api/public/providers/${sp.id}/ratings`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ rating: myRating, comment: myComment }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      setSubmitted(true);
      loadReviews();
      setTimeout(() => { setTab('reviews'); setSubmitted(false); setMyRating(0); setMyComment(''); }, 1800);
    } catch (e: unknown) { setSubmitErr(e instanceof Error ? e.message : 'Error'); }
    finally { setSubmitting(false); }
  };

  return (
    <div style={{ position:'fixed',inset:0,zIndex:9000,background:'rgba(4,2,14,0.90)',backdropFilter:'blur(18px)',display:'flex',alignItems:'center',justifyContent:'center',padding:16,animation:'lp-fadein 0.18s ease' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:'#0f0c1e',border:'1px solid rgba(255,255,255,0.10)',borderRadius:24,width:'100%',maxWidth:480,maxHeight:'92vh',display:'flex',flexDirection:'column',boxShadow:'0 40px 90px rgba(0,0,0,0.80)',animation:'lp-popin 0.22s cubic-bezier(.34,1.56,.64,1)' }}>

        {/* Photo header */}
        <div style={{ position:'relative',height:220,overflow:'hidden',borderRadius:'24px 24px 0 0',flexShrink:0 }}>
          {sp.photoUrl
            ? <img src={sp.photoUrl} alt={sp.name} style={{ width:'100%',height:'100%',objectFit:'cover',objectPosition:'center top' }} />
            : <div style={{ width:'100%',height:'100%',background:tc.grad,display:'flex',alignItems:'center',justifyContent:'center',fontSize:72,fontWeight:800,color:'rgba(255,255,255,0.85)' }}>
                {(sp.name||'').split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase()}
              </div>
          }
          <div style={{ position:'absolute',inset:0,background:'linear-gradient(to bottom,transparent 30%,rgba(8,6,20,0.95) 100%)' }} />
          <button onClick={onClose} style={{ position:'absolute',top:12,right:12,width:34,height:34,borderRadius:'50%',border:'none',background:'rgba(0,0,0,0.55)',color:'rgba(255,255,255,0.80)',fontSize:20,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(8px)' }}>×</button>
          <div style={{ position:'absolute',bottom:16,left:18,right:18 }}>
            <div style={{ display:'inline-flex',alignItems:'center',gap:6,background:tc.grad,borderRadius:20,padding:'4px 12px',fontSize:10,fontWeight:700,color:'#fff',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:8 }}>
              {tc.icon} {isAr ? tc.labelAr : tc.label} · {isAr ? tc.descAr : tc.desc}
            </div>
            <div style={{ fontSize:20,fontWeight:800,color:'#fff',marginBottom:6 }}>{sp.name}</div>
            <div style={{ display:'flex',alignItems:'center',gap:8 }}>
              <Stars value={Math.round(parseFloat(avg||'0'))} size={16} />
              {avg ? <span style={{ fontSize:15,fontWeight:700,color:'#f59e0b' }}>{avg}</span>
                   : <span style={{ fontSize:12,color:'rgba(255,255,255,0.45)' }}>{isAr?'لا تقييمات بعد':'No ratings yet'}</span>}
              {sp.totalRatings>0 && <span style={{ fontSize:11,color:'rgba(255,255,255,0.35)' }}>({sp.totalRatings} {isAr?'تقييم':'reviews'})</span>}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display:'flex',borderBottom:'1px solid rgba(255,255,255,0.07)',flexShrink:0 }}>
          {(['reviews','rate'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ flex:1,padding:'13px 0',border:'none',background:'none',color:tab===t?'#fff':'rgba(255,255,255,0.40)',fontSize:13,fontWeight:700,cursor:'pointer',borderBottom:tab===t?'2px solid var(--rose)':'2px solid transparent',transition:'all 0.15s',fontFamily:'var(--font)' }}>
              {t==='reviews' ? (isAr?`💬 التقييمات (${reviews.length})`:`💬 Reviews (${reviews.length})`) : (isAr?'⭐ قيّم':'⭐ Rate')}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={{ flex:1,overflowY:'auto',padding:'18px 20px 20px' }}>

          {/* Reviews tab */}
          {tab==='reviews' && (<>
            {sp.bio && <p style={{ fontSize:13,lineHeight:1.8,color:'rgba(232,244,250,0.65)',marginBottom:16,padding:'12px 14px',background:'rgba(255,255,255,0.04)',borderRadius:10 }}>{sp.bio}</p>}
            {loadingReviews && <div style={{ textAlign:'center',padding:'28px 0',color:'rgba(232,244,250,0.35)',fontSize:13 }}>{isAr?'جاري التحميل…':'Loading…'}</div>}
            {!loadingReviews && reviews.length===0 && (
              <div style={{ textAlign:'center',padding:'32px 20px',background:'rgba(255,255,255,0.025)',borderRadius:14,border:'1px dashed rgba(255,255,255,0.08)',color:'rgba(232,244,250,0.40)',fontSize:13,lineHeight:1.7 }}>
                ✨ {isAr?'كن أول من يقيّم هذا المتخصص':'Be the first to leave a review'}
              </div>
            )}
            {reviews.map(r => (
              <div key={r.id} style={{ background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:12,padding:'13px 16px',marginBottom:10 }}>
                <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:6 }}>
                  <div style={{ display:'flex',alignItems:'center',gap:8 }}>
                    <div style={{ width:28,height:28,borderRadius:'50%',background:'linear-gradient(135deg,var(--rose),#9b5de5)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,color:'#fff',flexShrink:0 }}>
                      {(r.reviewerName||'A').slice(0,1).toUpperCase()}
                    </div>
                    <span style={{ fontSize:13,fontWeight:700,color:'rgba(232,244,250,0.90)' }}>{r.reviewerName||'Anonymous'}</span>
                  </div>
                  <div style={{ display:'flex',alignItems:'center',gap:6 }}>
                    <Stars value={r.rating} size={12} />
                    <span style={{ fontSize:12,fontWeight:700,color:'#f59e0b' }}>{r.rating}.0</span>
                  </div>
                </div>
                {r.comment && <div style={{ fontSize:13,color:'rgba(232,244,250,0.65)',lineHeight:1.7,paddingLeft:36 }}>{r.comment}</div>}
                <div style={{ fontSize:11,color:'rgba(232,244,250,0.25)',marginTop:6,paddingLeft:36 }}>{new Date(r.createdAt).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</div>
              </div>
            ))}
          </>)}

          {/* Rate tab */}
          {tab==='rate' && (<>
            {!token ? (
              <div style={{ textAlign:'center',padding:'28px 16px' }}>
                <div style={{ fontSize:48,marginBottom:16 }}>🔐</div>
                <div style={{ fontSize:16,fontWeight:700,color:'rgba(232,244,250,0.90)',marginBottom:10 }}>{isAr?'تسجيل الدخول مطلوب':'Sign in Required'}</div>
                <div style={{ fontSize:13,color:'rgba(232,244,250,0.50)',marginBottom:24,lineHeight:1.7 }}>{isAr?'يجب تسجيل الدخول لتتمكن من تقييم هذا المتخصص.':'You need to be signed in to rate this specialist.'}</div>
                <button onClick={onLoginToRate} style={{ width:'100%',padding:14,border:'none',borderRadius:12,background:'linear-gradient(135deg,var(--rose),#9b5de5)',color:'#fff',fontFamily:'var(--font)',fontSize:15,fontWeight:700,cursor:'pointer',boxShadow:'0 6px 24px rgba(229,62,90,0.40)' }}>
                  ⭐ {isAr?'سجّل دخول للتقييم':'Sign in to Rate'}
                </button>
              </div>
            ) : submitted ? (
              <div style={{ textAlign:'center',padding:'36px 16px' }}>
                <div style={{ fontSize:52,marginBottom:14 }}>🎉</div>
                <div style={{ fontSize:17,fontWeight:700,color:'rgba(232,244,250,0.95)',marginBottom:8 }}>{isAr?'شكراً على تقييمك!':'Thank you for your review!'}</div>
                <div style={{ fontSize:13,color:'rgba(232,244,250,0.50)' }}>{isAr?'تمت إضافة تقييمك.':'Your rating has been saved.'}</div>
              </div>
            ) : (
              <div>
                <div style={{ fontSize:13,color:'rgba(232,244,250,0.65)',marginBottom:18 }}>
                  {isAr?`تقييمك لـ ${sp.name}`:`Rate ${sp.name}`}
                  {username && <span style={{ color:'rgba(232,244,250,0.35)',marginLeft:6 }}>· @{username}</span>}
                </div>
                <div style={{ textAlign:'center',marginBottom:24 }}>
                  <div style={{ marginBottom:8 }}><Stars value={myRating} size={40} interactive onRate={setMyRating} /></div>
                  <div style={{ fontSize:13,color:myRating?'#f59e0b':'rgba(232,244,250,0.35)',fontWeight:600 }}>
                    {myRating ? ['','Poor','Fair','Good','Very Good','Excellent'][myRating] : (isAr?'اختر تقييمك':'Tap a star to rate')}
                  </div>
                </div>
                <textarea
                  placeholder={isAr?'اترك تعليقاً (اختياري)…':'Leave a comment (optional)…'}
                  value={myComment} onChange={e => setMyComment(e.target.value)}
                  rows={4}
                  style={{ width:'100%',padding:'12px 14px',background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.10)',borderRadius:12,color:'rgba(232,244,250,0.90)',fontFamily:'var(--font)',fontSize:13,resize:'none',outline:'none',boxSizing:'border-box',transition:'border-color 0.2s',marginBottom:8,lineHeight:1.7 }}
                  onFocus={e => e.target.style.borderColor='rgba(229,62,90,0.50)'}
                  onBlur={e => e.target.style.borderColor='rgba(255,255,255,0.10)'}
                />
                {submitErr && <div style={{ fontSize:12,color:'#f87171',marginBottom:10,padding:'8px 12px',background:'rgba(248,113,113,0.10)',borderRadius:8 }}>⚠ {submitErr}</div>}
                <button onClick={submitRating} disabled={submitting||!myRating} style={{ width:'100%',padding:14,border:'none',borderRadius:12,background:myRating?'linear-gradient(135deg,var(--rose),#9b5de5)':'rgba(255,255,255,0.08)',color:myRating?'#fff':'rgba(255,255,255,0.30)',fontFamily:'var(--font)',fontSize:15,fontWeight:700,cursor:myRating?'pointer':'not-allowed',transition:'all 0.2s',boxShadow:myRating?'0 6px 24px rgba(229,62,90,0.35)':'none' }}>
                  {submitting ? '…' : (isAr?'إرسال التقييم':'Submit Review')}
                </button>
              </div>
            )}
          </>)}
        </div>
      </div>
    </div>
  );
}

function WelcomePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { lang, toggleLang } = useLanguage();
  const { user } = useAuth();
  const isAr = lang === 'ar';

  const [cur, setCur] = useState(0);
  const [prev, setPrev] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [stats, setStats] = useState<Stats>({ specialists: 0, clients: 0, satisfaction: 98 });
  const [filter, setFilter] = useState('ALL');
  const [rateTarget, setRateTarget] = useState<{ sp: Provider; tab: 'reviews' | 'rate' } | null>(null);

  const goTo = useCallback((idx: number) => {
    if (busy) return;
    setPrev(cur); setBusy(true); setCur(idx);
    setTimeout(() => { setPrev(null); setBusy(false); }, 1200);
  }, [cur, busy]);

  useEffect(() => { const id = setInterval(() => goTo((cur + 1) % SLIDES.length), 6000); return () => clearInterval(id); }, [cur, goTo]);
  useEffect(() => { const fn = () => setScrolled(window.scrollY > 60); window.addEventListener('scroll', fn, { passive: true }); return () => window.removeEventListener('scroll', fn); }, []);

  const fetchProviders = useCallback(() => {
    fetch('/api/public/providers', { cache: 'no-store' }).then(r => r.json()).then(d => { if (Array.isArray(d)) setProviders(d); }).catch(() => {});
    fetch('/api/public/stats').then(r => r.json()).then(d => { if (d.specialists !== undefined) setStats(d); }).catch(() => {});
  }, []);

  useEffect(() => {
    fetchProviders();
    // Re-fetch when the tab becomes visible again (user switches back from admin)
    const onVisibility = () => { if (document.visibilityState === 'visible') fetchProviders(); };
    document.addEventListener('visibilitychange', onVisibility);
    // Re-fetch instantly when the providers admin page broadcasts a change
    const bc = new BroadcastChannel('nexora-providers');
    bc.onmessage = () => fetchProviders();
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      bc.close();
    };
  }, [fetchProviders]);

  // Auto-open modal when ?rate=ID is in URL
  useEffect(() => {
    const rateId = searchParams.get('rate');
    if (rateId && providers.length > 0) {
      const sp = providers.find(p => p.id === rateId);
      if (sp) {
        setRateTarget({ sp, tab: 'rate' });
        setTimeout(() => document.getElementById('lp-team')?.scrollIntoView({ behavior: 'smooth' }), 300);
      }
    }
  }, [searchParams, providers]);

  const types = (['DOCTOR','STYLIST','THERAPIST'] as const).filter(t => providers.some(p => p.type === t));
  const visible = filter === 'ALL' ? providers : providers.filter(p => p.type === filter);
  const sl = SLIDES[cur];

  const openRate = (sp: Provider, tab: 'reviews' | 'rate' = 'reviews') => {
    setRateTarget({ sp, tab });
  };

  const handleLoginToRate = (sp: Provider) => {
    const returnUrl = `/welcome?rate=${sp.id}`;
    router.push(`/login?returnUrl=${encodeURIComponent(returnUrl)}`);
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        *, *::before, *::after { box-sizing: border-box; }
        html { scroll-behavior: smooth; }
        body { margin: 0; background: #08060f; font-family: var(--font, 'Inter', sans-serif); }

        @keyframes lp-fadein { from { opacity: 0; } }
        @keyframes lp-popin  { from { opacity: 0; transform: scale(0.93) translateY(16px); } }
        @keyframes lp-up     { from { opacity: 0; transform: translateY(22px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes lp-kb     { from { transform: scale(1.0); } to { transform: scale(1.10) translate(-1%,-0.5%); } }
        @keyframes lp-pulse  { 0%,100% { opacity:.25; } 50% { opacity:.9; } }
        @keyframes count-up  { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }

        .lp-nav {
          position:fixed;top:0;left:0;right:0;z-index:200;
          display:flex;align-items:center;justify-content:space-between;
          padding:20px 52px;transition:background 0.35s,backdrop-filter 0.35s,padding 0.25s,border-color 0.35s;
          border-bottom:1px solid transparent;
        }
        .lp-nav.scrolled { background:rgba(8,6,15,0.85);backdrop-filter:blur(24px);padding:13px 52px;border-bottom-color:rgba(255,255,255,0.06); }
        .lp-logo { display:flex;align-items:center;gap:12px;cursor:pointer; }
        .lp-logo-name { font-size:17px;font-weight:800;letter-spacing:-0.3px;background:linear-gradient(135deg,#ff7096,#fff);-webkit-background-clip:text;-webkit-text-fill-color:transparent; }
        .lp-logo-tag  { font-size:10px;color:rgba(232,244,250,0.40);font-weight:500;letter-spacing:0.4px; }
        .lp-nav-r { display:flex;align-items:center;gap:10px; }
        .lp-nav-lang { background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.12);border-radius:8px;color:rgba(232,244,250,0.70);font-family:inherit;font-size:11px;font-weight:700;letter-spacing:0.5px;padding:7px 12px;cursor:pointer;transition:all 0.15s; }
        .lp-nav-lang:hover { background:rgba(229,62,90,0.15);border-color:rgba(229,62,90,0.32);color:#ff7096; }
        .lp-nav-cta { background:linear-gradient(135deg,#e53e5a,#9b5de5);border:none;border-radius:9px;color:#fff;font-family:inherit;font-size:13.5px;font-weight:700;padding:10px 22px;cursor:pointer;box-shadow:0 6px 24px rgba(229,62,90,0.38);transition:opacity 0.15s,transform 0.13s; }
        .lp-nav-cta:hover { opacity:0.88;transform:translateY(-1px); }

        .lp-hero { position:relative;height:100vh;min-height:580px;display:flex;align-items:center;justify-content:center;overflow:hidden; }
        .lp-hero-bg { position:absolute;inset:0;z-index:0; }
        .lp-hero-img { position:absolute;inset:0;background-size:cover;background-position:center;opacity:0;transition:opacity 1.2s ease; }
        .lp-hero-img.active { opacity:1;animation:lp-kb 10s ease-in-out forwards; }
        .lp-hero-img.out { opacity:0; }
        .lp-hero-ov { position:absolute;inset:0;z-index:1;background:linear-gradient(to bottom,rgba(6,14,40,0.62) 0%,rgba(6,14,40,0.32) 38%,rgba(6,14,40,0.90) 100%),linear-gradient(to right,rgba(6,14,40,0.42) 0%,transparent 55%); }
        .lp-hero-body { position:relative;z-index:2;text-align:center;padding:0 24px;max-width:820px; }
        .lp-hero-badge { display:inline-flex;align-items:center;gap:8px;background:rgba(229,62,90,0.18);border:1px solid rgba(229,62,90,0.36);border-radius:20px;padding:6px 20px;font-size:10.5px;font-weight:700;letter-spacing:1.8px;text-transform:uppercase;color:#ff7096;margin-bottom:22px;backdrop-filter:blur(12px);animation:lp-up 0.7s ease both; }
        .lp-hero-title { font-size:clamp(38px,7vw,78px);font-weight:900;color:#fff;line-height:1.08;letter-spacing:-2.5px;margin-bottom:20px;text-shadow:0 6px 40px rgba(0,0,0,0.50);white-space:pre-line;animation:lp-up 0.7s ease 0.12s both; }
        .lp-hero-title .hl { background:linear-gradient(135deg,#ff7096,#c084fc);-webkit-background-clip:text;-webkit-text-fill-color:transparent; }
        .lp-hero-sub { font-size:clamp(15px,2vw,18px);color:rgba(255,255,255,0.72);line-height:1.75;margin-bottom:38px;animation:lp-up 0.7s ease 0.22s both; }
        .lp-hero-btns { display:flex;gap:14px;justify-content:center;flex-wrap:wrap;animation:lp-up 0.7s ease 0.32s both; }
        .lp-btn-main { background:linear-gradient(135deg,#e53e5a,#9b5de5);color:#fff;border:none;border-radius:12px;font-family:inherit;font-size:15px;font-weight:700;padding:15px 32px;cursor:pointer;box-shadow:0 8px 32px rgba(229,62,90,0.44);transition:transform 0.15s,box-shadow 0.18s; }
        .lp-btn-main:hover { transform:translateY(-2px);box-shadow:0 14px 44px rgba(229,62,90,0.60); }
        .lp-btn-ghost { background:rgba(255,255,255,0.10);color:rgba(232,244,250,0.90);border:1.5px solid rgba(255,255,255,0.22);border-radius:12px;font-family:inherit;font-size:15px;font-weight:600;padding:14px 32px;cursor:pointer;backdrop-filter:blur(10px);transition:all 0.15s; }
        .lp-btn-ghost:hover { background:rgba(255,255,255,0.18);border-color:rgba(255,255,255,0.40);color:#fff; }
        .lp-dots { position:absolute;bottom:34px;left:50%;transform:translateX(-50%);z-index:3;display:flex;gap:9px;align-items:center; }
        .lp-dot { border:none;cursor:pointer;padding:0;border-radius:20px;transition:all 0.35s; }
        .lp-dot.on  { width:32px;height:6px;background:linear-gradient(90deg,#e53e5a,#9b5de5); }
        .lp-dot.off { width:6px;height:6px;background:rgba(255,255,255,0.30); }
        .lp-dot.off:hover { background:rgba(255,255,255,0.60); }
        .lp-scroll-hint { position:absolute;bottom:34px;right:52px;z-index:3;display:flex;flex-direction:column;align-items:center;gap:7px;color:rgba(255,255,255,0.40);font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase; }
        .lp-scroll-line { width:1px;height:44px;background:linear-gradient(to bottom,rgba(255,255,255,0.45),transparent);animation:lp-pulse 2s ease-in-out infinite; }

        /* sections */
        .lp-sec { max-width:1200px;margin:0 auto;padding:90px 52px; }
        .lp-badge { display:inline-flex;align-items:center;gap:7px;background:rgba(229,62,90,0.14);border:1px solid rgba(229,62,90,0.26);border-radius:20px;padding:5px 15px;font-size:10.5px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#ff7096;margin-bottom:16px; }
        .lp-h2 { font-size:clamp(26px,3.8vw,46px);font-weight:900;color:#f0f4ff;line-height:1.12;letter-spacing:-0.8px;margin-bottom:14px; }
        .lp-h2 span { background:linear-gradient(135deg,#ff7096,#c084fc);-webkit-background-clip:text;-webkit-text-fill-color:transparent; }
        .lp-desc { font-size:15px;color:rgba(232,244,250,0.60);line-height:1.8;max-width:580px; }

        /* about */
        .lp-about-wrap { background:linear-gradient(160deg,rgba(229,62,90,0.07) 0%,rgba(155,93,229,0.05) 60%,transparent 100%);border-top:1px solid rgba(229,62,90,0.10);border-bottom:1px solid rgba(155,93,229,0.08); }
        .lp-about-grid { max-width:1200px;margin:0 auto;padding:90px 52px;display:grid;grid-template-columns:1fr 1fr;gap:70px;align-items:center; }
        @media(max-width:820px){.lp-about-grid{grid-template-columns:1fr;gap:44px;}}
        .lp-about-desc { font-size:15px;line-height:1.9;color:rgba(232,244,250,0.68);margin-bottom:22px; }
        .lp-quote { padding-left:18px;margin-top:4px;border-left:3px solid #e53e5a;font-size:14px;color:rgba(232,244,250,0.52);font-style:italic;line-height:1.75; }
        .lp-stats-grid { display:grid;grid-template-columns:1fr 1fr;gap:18px; }
        .lp-stat { background:rgba(255,255,255,0.04);border:1px solid rgba(229,62,90,0.15);border-radius:20px;padding:28px 24px;position:relative;overflow:hidden;transition:transform 0.2s,border-color 0.2s;animation:count-up 0.6s ease both; }
        .lp-stat:hover { transform:translateY(-4px);border-color:rgba(229,62,90,0.32);background:rgba(229,62,90,0.06); }
        .lp-stat-top { position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(135deg,#e53e5a,#9b5de5);opacity:0.60;transition:opacity 0.2s; }
        .lp-stat:hover .lp-stat-top { opacity:1; }
        .lp-stat-n { font-size:40px;font-weight:900;line-height:1;background:linear-gradient(135deg,#ff7096,#c084fc);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:8px; }
        .lp-stat-l { font-size:12px;color:rgba(232,244,250,0.60);font-weight:700;text-transform:uppercase;letter-spacing:0.8px; }

        /* services */
        .lp-svc-grid { display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:22px;margin-top:46px; }
        .lp-svc-card { background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:22px;padding:34px 28px;position:relative;overflow:hidden;transition:transform 0.22s,border-color 0.22s,box-shadow 0.22s; }
        .lp-svc-card:hover { transform:translateY(-6px);border-color:rgba(229,62,90,0.24);box-shadow:0 22px 60px rgba(0,0,0,0.42),0 0 0 1px rgba(229,62,90,0.10); }
        .lp-svc-top { position:absolute;top:0;left:0;right:0;height:3px;opacity:0.70;border-radius:22px 22px 0 0;transition:opacity 0.2s; }
        .lp-svc-card:hover .lp-svc-top { opacity:1; }
        .lp-svc-ico { width:58px;height:58px;border-radius:16px;display:flex;align-items:center;justify-content:center;font-size:28px;margin-bottom:22px;box-shadow:0 8px 24px rgba(0,0,0,0.32); }
        .lp-svc-title { font-size:19px;font-weight:800;color:#f0f4ff;letter-spacing:-0.3px;margin-bottom:10px; }
        .lp-svc-desc  { font-size:13px;color:rgba(232,244,250,0.58);line-height:1.8;margin-bottom:22px; }
        .lp-svc-list  { list-style:none;display:flex;flex-direction:column;gap:9px;padding:0;margin:0; }
        .lp-svc-li    { display:flex;align-items:center;gap:10px;font-size:13px;color:rgba(232,244,250,0.72); }
        .lp-svc-dot   { width:5px;height:5px;border-radius:50%;flex-shrink:0; }

        /* team */
        .lp-team-wrap { background:linear-gradient(180deg,rgba(155,93,229,0.06) 0%,transparent 80%);border-top:1px solid rgba(155,93,229,0.10); }
        .lp-team-top  { display:flex;align-items:flex-end;justify-content:space-between;gap:24px;flex-wrap:wrap;margin-bottom:36px; }
        .lp-filters   { display:flex;gap:8px;flex-wrap:wrap; }
        .lp-flt { padding:8px 18px;border-radius:20px;border:1px solid rgba(255,255,255,0.10);background:rgba(255,255,255,0.05);color:rgba(232,244,250,0.60);font-family:inherit;font-size:12.5px;font-weight:600;cursor:pointer;transition:all 0.15s; }
        .lp-flt:hover { background:rgba(229,62,90,0.12);border-color:rgba(229,62,90,0.26);color:#ff7096; }
        .lp-flt.on { background:linear-gradient(135deg,#e53e5a,#9b5de5);border-color:transparent;color:#fff;box-shadow:0 4px 14px rgba(229,62,90,0.32); }
        .lp-team-grid { display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:22px; }

        /* provider card */
        .lp-tc { background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:20px;overflow:hidden;display:flex;flex-direction:column;transition:transform 0.22s,border-color 0.22s,box-shadow 0.22s; }
        .lp-tc:hover { transform:translateY(-6px);border-color:rgba(229,62,90,0.28);box-shadow:0 22px 56px rgba(0,0,0,0.44); }
        .lp-tc-photo-wrap { position:relative;width:100%;height:200px;overflow:hidden;flex-shrink:0; }
        .lp-tc-photo { width:100%;height:100%;object-fit:cover;object-position:center top;display:block;transition:transform 0.4s ease; }
        .lp-tc:hover .lp-tc-photo { transform:scale(1.06); }
        .lp-tc-photo-fallback { width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:52px;font-weight:800;color:rgba(255,255,255,0.85);letter-spacing:-1px; }
        .lp-tc-photo-scrim { position:absolute;bottom:0;left:0;right:0;height:80px;background:linear-gradient(to bottom,transparent,rgba(8,6,15,0.80));pointer-events:none; }
        .lp-tc-type-badge { position:absolute;bottom:12px;left:14px;display:inline-flex;align-items:center;gap:5px;padding:4px 11px;border-radius:20px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#fff; }
        .lp-tc-body { padding:18px 18px 20px;display:flex;flex-direction:column;flex:1; }
        .lp-tc-name { font-size:15px;font-weight:700;color:#f0f4ff;letter-spacing:-0.2px;margin-bottom:8px; }
        .lp-tc-bio  { font-size:12px;line-height:1.75;color:rgba(232,244,250,0.55);flex:1;margin-bottom:14px;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden; }
        .lp-tc-avg  { font-size:13px;font-weight:700;color:#f59e0b; }
        .lp-tc-cnt  { font-size:11px;color:rgba(232,244,250,0.35); }
        .lp-tc-action { display:flex;align-items:center;justify-content:center;gap:6px;padding:9px 14px;border-radius:10px;border:none;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer;transition:all 0.15s;flex:1; }
        .lp-tc-action.review { background:rgba(255,255,255,0.07);color:rgba(232,244,250,0.75);border:1px solid rgba(255,255,255,0.10); }
        .lp-tc-action.review:hover { background:rgba(255,255,255,0.12);color:#f0f4ff; }
        .lp-tc-action.rate { background:linear-gradient(135deg,rgba(229,62,90,0.20),rgba(155,93,229,0.20));color:#ff7096;border:1px solid rgba(229,62,90,0.28); }
        .lp-tc-action.rate:hover { background:linear-gradient(135deg,rgba(229,62,90,0.35),rgba(155,93,229,0.35));border-color:rgba(229,62,90,0.50); }

        /* type legend */
        .lp-type-legend { display:flex;gap:12px;flex-wrap:wrap;margin-top:32px; }
        .lp-type-pill { display:flex;align-items:center;gap:8px;padding:8px 14px;border-radius:12px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08); }
        .lp-type-dot  { width:10px;height:10px;border-radius:50%;flex-shrink:0; }

        /* footer */
        .lp-footer-wrap { border-top:1px solid rgba(255,255,255,0.06);margin-top:20px; }
        .lp-footer { max-width:1200px;margin:0 auto;padding:40px 52px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:20px; }
        .lp-foot-name { font-size:15px;font-weight:700;background:linear-gradient(135deg,#ff7096,#fff);-webkit-background-clip:text;-webkit-text-fill-color:transparent; }
        .lp-foot-tag  { font-size:10.5px;color:rgba(232,244,250,0.30);margin-top:2px; }
        .lp-foot-copy { font-size:12px;color:rgba(232,244,250,0.28); }
        .lp-social-btn { width:40px;height:40px;border-radius:11px;display:flex;align-items:center;justify-content:center;border:1px solid rgba(255,255,255,0.10);background:rgba(255,255,255,0.05);color:rgba(232,244,250,0.60);text-decoration:none;transition:all 0.18s; }
        .lp-social-btn:hover { transform:translateY(-2px);border-color:rgba(229,62,90,0.32);color:#ff7096;background:rgba(229,62,90,0.12); }
        .lp-foot-cta { background:rgba(229,62,90,0.13);border:1px solid rgba(229,62,90,0.26);border-radius:9px;color:#ff7096;font-family:inherit;font-size:13px;font-weight:600;padding:9px 20px;cursor:pointer;transition:background 0.15s; }
        .lp-foot-cta:hover { background:rgba(229,62,90,0.24); }

        @media(max-width:640px){
          .lp-nav,.lp-nav.scrolled{padding:14px 18px;}
          .lp-sec{padding:56px 18px;}
          .lp-about-grid{padding:56px 18px;}
          .lp-footer{padding:32px 18px;flex-direction:column;align-items:flex-start;gap:16px;}
          .lp-hero-title{letter-spacing:-1.5px;}
          .lp-scroll-hint{display:none;}
          .lp-h2{font-size:clamp(24px,6vw,38px);}
          .lp-stats-grid{grid-template-columns:1fr 1fr;gap:12px;}
          .lp-stat{padding:20px 16px;}
          .lp-svc-grid{grid-template-columns:1fr!important;}
          .lp-team-top{flex-direction:column;align-items:flex-start;gap:14px;}
          .lp-filters{gap:6px;}
          .lp-flt{padding:7px 14px;font-size:12px;}
          .lp-team-grid{grid-template-columns:1fr 1fr;gap:12px;}
          .lp-tc{min-width:0;max-width:none;height:auto;scroll-snap-align:unset;flex-shrink:1;}
          .lp-tc:hover{transform:none;}
          .lp-tc-photo-wrap{position:relative;height:150px;width:100%;}
          .lp-tc-photo-scrim{height:80px;}
          .lp-tc-type-badge{font-size:9px;padding:3px 8px;}
          .lp-tc-body{position:relative;padding:12px 12px 14px;}
          .lp-tc-name{font-size:13px;}
          .lp-tc-bio{display:none;}
          .lp-tc-actions{gap:6px;}
          .lp-tc-action{padding:9px 8px;font-size:11px;}
          .lp-type-legend{gap:8px;}
          .lp-type-pill{padding:6px 10px;font-size:11.5px;}
          .lp-nav-cta{font-size:12px;padding:8px 14px;}
        }
        @media(max-width:380px){
          .lp-team-grid{grid-template-columns:1fr;}
          .lp-tc-photo-wrap{height:180px;}
        }
      `}} />

      {/* NAV */}
      <nav className={`lp-nav${scrolled?' scrolled':''}`}>
        <div className="lp-logo" onClick={() => window.scrollTo({ top:0, behavior:'smooth' })}>
          <div style={{ background:'none',boxShadow:'none' }}><NexoraCareIcon size={40} /></div>
          <div><div className="lp-logo-name">Nexora Care</div></div>
        </div>
        <div className="lp-nav-r">
          <button className="lp-nav-lang" onClick={toggleLang}>{lang==='en'?'AR':'EN'}</button>
          <button className="lp-nav-cta" onClick={() => router.push('/login')}>{isAr?'تسجيل الدخول ←':'Sign In →'}</button>
        </div>
      </nav>

      {/* HERO */}
      <section className="lp-hero">
        <div className="lp-hero-bg">
          {SLIDES.map((s,i) => <div key={i} className={`lp-hero-img${i===cur?' active':''}${i===prev?' out':''}`} style={{ backgroundImage:`url(${s.url})` }} />)}
        </div>
        <div className="lp-hero-ov" />
        <div className="lp-hero-body" key={cur}>
          <div className="lp-hero-title">
            {(isAr?sl.headAr:sl.headEn).split('\n').map((line,i) => i===0?<span key={i}>{line}</span>:<span key={i}><br/><span className="hl">{line}</span></span>)}
          </div>
          <div className="lp-hero-sub">{isAr?sl.subAr:sl.subEn}</div>
          <div className="lp-hero-btns">
            <button className="lp-btn-main" onClick={() => document.getElementById('lp-team')?.scrollIntoView({ behavior:'smooth' })}>{isAr?'👥 تعرّف على فريقنا':'👥 Meet Our Team'}</button>
          </div>
        </div>
        <div className="lp-dots">{SLIDES.map((_,i) => <button key={i} className={`lp-dot ${i===cur?'on':'off'}`} onClick={() => goTo(i)} aria-label={`Slide ${i+1}`} />)}</div>
        <div className="lp-scroll-hint"><div className="lp-scroll-line" /><span>Scroll</span></div>
      </section>

      {/* ABOUT + STATS */}
      <div className="lp-about-wrap">
        <div className="lp-about-grid">
          <div>
            <div className="lp-badge"><NexoraCareIcon size={14} />{isAr?'عن مركزنا':'About Nexora Care'}</div>
            <h2 className="lp-h2">{isAr?<>{'مركز رعاية '}<span>متميز</span>{' يعكس قيمك'}</>:<>A care centre built<br/>on <span>expertise & trust</span></>}</h2>
            <p className="lp-about-desc">{isAr?'في نيكسورا كير، نجمع بين أحدث التقنيات والعناية الشخصية المتميزة لتقديم تجربة رعاية استثنائية. فريقنا من المتخصصين المعتمدين يلتزم بتقديم نتائج مبهرة.':'At Nexora Care, we blend cutting-edge tools with dedicated personal attention to deliver an exceptional care experience. Our certified team is committed to outstanding results.'}</p>
            <blockquote className="lp-quote">{isAr?'"نؤمن أن الرعاية الحقيقية تبدأ بالثقة — مهمتنا بناء تلك الثقة يوماً بعد يوم."':'"We believe great care starts with trust — our mission is building that trust, one interaction at a time."'}</blockquote>
          </div>
          <div className="lp-stats-grid">
            {[
              { n:`${stats.specialists || providers.length || 5}+`, l:isAr?'متخصص معتمد':'Certified Specialists', delay:'0s' },
              { n:'10+',                                             l:isAr?'سنوات خبرة':'Years of Excellence',   delay:'0.1s' },
              { n:`${stats.clients > 0 ? (stats.clients > 1000 ? Math.floor(stats.clients/1000)+'K' : stats.clients) : '5K'}+`, l:isAr?'عميل سعيد':'Happy Clients', delay:'0.2s' },
              { n:`${stats.satisfaction}%`,                          l:isAr?'رضا العملاء':'Client Satisfaction',  delay:'0.3s' },
            ].map(s => (
              <div key={s.l} className="lp-stat" style={{ animationDelay:s.delay }}>
                <div className="lp-stat-top" />
                <div className="lp-stat-n">{s.n}</div>
                <div className="lp-stat-l">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* SERVICES */}
      <div className="lp-sec">
        <div className="lp-badge">✨ {isAr?'خدماتنا':'Our Services'}</div>
        <h2 className="lp-h2">{isAr?<>{'كل ما تحتاجه في '}<span>مكان واحد</span></>:<>Everything you need,<br/><span>under one roof</span></>}</h2>
        <p className="lp-desc">{isAr?'مجموعة شاملة من خدمات الرعاية المتكاملة مصممة لرفاهيتك الكاملة.':'A full spectrum of premium care services, curated for your wellbeing.'}</p>
        <div className="lp-svc-grid">
          {SERVICES.map((svc,i) => (
            <div key={i} className="lp-svc-card">
              <div className="lp-svc-top" style={{ background:svc.grad }} />
              <div className="lp-svc-ico" style={{ background:svc.grad }}>{svc.icon}</div>
              <div className="lp-svc-title">{isAr?svc.titleAr:svc.titleEn}</div>
              <div className="lp-svc-desc">{isAr?svc.descAr:svc.descEn}</div>
              <ul className="lp-svc-list">{(isAr?svc.listAr:svc.list).map((item,j) => <li key={j} className="lp-svc-li"><span className="lp-svc-dot" style={{ background:svc.grad }} />{item}</li>)}</ul>
            </div>
          ))}
        </div>
      </div>

      {/* TEAM */}
      <div className="lp-team-wrap" id="lp-team">
        <div className="lp-sec">
          <div className="lp-team-top">
            <div>
              <div className="lp-badge">👥 {isAr?'فريقنا':'Our Team'}</div>
              <h2 className="lp-h2" style={{ marginBottom:0 }}>{isAr?<>{'تعرّف على '}<span>متخصصينا</span></>:<>Meet our <span>specialists</span></>}</h2>
            </div>
            <div className="lp-filters">
              {(['ALL',...types] as string[]).map(type => {
                const tc = TYPE_CFG[type];
                const label = type==='ALL' ? (isAr?'الكل':'All') : `${tc.icon} ${isAr?tc.labelAr:tc.label}`;
                return <button key={type} className={`lp-flt${filter===type?' on':''}`} onClick={() => setFilter(type)} title={tc ? (isAr?tc.descAr:tc.desc) : ''}>{label}</button>;
              })}
            </div>
          </div>

          {/* Type legend */}
          {types.length > 0 && (
            <div className="lp-type-legend" style={{ marginBottom:32 }}>
              {types.map(t => { const tc = TYPE_CFG[t]; return (
                <div key={t} className="lp-type-pill">
                  <div className="lp-type-dot" style={{ background:tc.color }} />
                  <span style={{ fontSize:12,fontWeight:700,color:'rgba(232,244,250,0.85)' }}>{tc.icon} {isAr?tc.labelAr:tc.label}</span>
                  <span style={{ fontSize:11,color:'rgba(232,244,250,0.45)' }}>— {isAr?tc.descAr:tc.desc}</span>
                </div>
              );})}
            </div>
          )}

          <div className="lp-team-grid">
            {visible.map(sp => {
              const tc = TYPE_CFG[sp.type] || DEFAULT_TC;
              const initials = (sp.name||'').split(' ').map((w:string)=>w[0]).slice(0,2).join('').toUpperCase();
              const avg = sp.avgRating ? parseFloat(sp.avgRating).toFixed(1) : null;
              return (
                <div key={sp.id} className="lp-tc">
                  <div className="lp-tc-photo-wrap" onClick={() => openRate(sp, 'reviews')} style={{ cursor:'pointer' }}>
                    {sp.photoUrl && <img src={sp.photoUrl} alt={sp.name} className="lp-tc-photo" onError={e => { (e.currentTarget as HTMLImageElement).style.display='none'; const fb=e.currentTarget.parentElement?.querySelector<HTMLElement>('.lp-tc-photo-fallback'); if(fb)fb.style.display='flex'; }} />}
                    <div className="lp-tc-photo-fallback" style={{ background:tc.grad, display:sp.photoUrl?'none':'flex' }}>{initials}</div>
                    <div className="lp-tc-photo-scrim" />
                    <div className="lp-tc-type-badge" style={{ background:tc.grad }}>{tc.icon} {isAr?tc.labelAr:tc.label}</div>
                  </div>
                  <div className="lp-tc-body">
                    <div className="lp-tc-name">{sp.name}</div>
                    {sp.bio && <p className="lp-tc-bio">{sp.bio}</p>}
                    <div style={{ display:'flex',alignItems:'center',gap:6,marginBottom:12 }}>
                      <Stars value={Math.round(parseFloat(avg||'0'))} />
                      {avg ? <span className="lp-tc-avg">{avg}</span> : <span style={{ fontSize:11,color:'rgba(232,244,250,0.38)' }}>{isAr?'لا تقييمات':'No ratings yet'}</span>}
                      {sp.totalRatings>0 && <span className="lp-tc-cnt">({sp.totalRatings})</span>}
                    </div>
                    <div className="lp-tc-actions" style={{ display:'flex',gap:8 }}>
                      <button className="lp-tc-action review" onClick={() => openRate(sp, 'reviews')}>💬 {isAr?'التقييمات':'Reviews'}</button>
                      <button className="lp-tc-action rate" onClick={() => openRate(sp, 'rate')}>⭐ {isAr?'قيّم':'Rate'}</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {visible.length===0 && (
            <div style={{ textAlign:'center',padding:'52px 0',color:'rgba(232,244,250,0.30)',fontSize:14 }}>{isAr?'جاري التحميل…':'Loading team…'}</div>
          )}
        </div>
      </div>

      {/* RATE/REVIEW MODAL */}
      {rateTarget && (
        <RateModal
          sp={rateTarget.sp}
          lang={lang}
          token={user?.token}
          username={user?.username}
          initialTab={rateTarget.tab}
          onClose={() => { setRateTarget(null); router.replace('/welcome'); }}
          onLoginToRate={() => { handleLoginToRate(rateTarget.sp); setRateTarget(null); }}
        />
      )}

      {/* FOOTER */}
      <footer className="lp-footer-wrap">
        <div className="lp-footer">
          <div style={{ display:'flex',alignItems:'center',gap:12 }}>
            <NexoraCareIcon size={38} />
            <div><div className="lp-foot-name">Nexora Care</div><div className="lp-foot-tag">{isAr?'منصة نيكسورا كير':'Nexora Care Platform'}</div></div>
          </div>
          <div style={{ display:'flex',alignItems:'center',gap:10 }}>
            <a className="lp-social-btn" href="https://wa.me/962790891028" target="_blank" rel="noopener noreferrer" aria-label="WhatsApp">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.890-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            </a>
            <a className="lp-social-btn" href="https://www.instagram.com/medowahbeh/" target="_blank" rel="noopener noreferrer" aria-label="Instagram">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
            </a>
          </div>
          <div className="lp-foot-copy">© {new Date().getFullYear()} Nexora Care. {isAr?'جميع الحقوق محفوظة.':'All rights reserved.'}</div>
        </div>
      </footer>
    </>
  );
}

export default function WelcomePage() {
  return (
    <Suspense>
      <WelcomePageInner />
    </Suspense>
  );
}
