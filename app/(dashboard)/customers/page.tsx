'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { ALL_COUNTRIES, DIAL_CODE_MAP, flagEmoji } from '@/lib/countryDialCodes';
import toast from 'react-hot-toast';
import { swrGet, swrSet, swrBust } from '@/lib/swrCache';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/context/AuthContext';
import { useBranch } from '@/context/BranchContext';
import { useMusic } from '@/context/MusicContext';
import { useLanguage } from '@/context/LanguageContext';
import { usePermissions } from '@/context/PermissionsContext';
import type { Customer, Branch, Appointment, CallLog } from '@/types';
import Icon from '@/components/ui/Icon';

type ModalType = 'create' | 'edit' | 'history' | 'whatsapp' | 'call-log' | 'delete' | 'email' | 'sms' | 'broadcast' | null;

function PhonePrefix({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', h);
    document.addEventListener('keydown', k);
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('keydown', k); };
  }, []);
  const q = search.toLowerCase();
  const filtered = useMemo(() =>
    q ? ALL_COUNTRIES.filter(([iso,,name]) => name.toLowerCase().includes(q) || iso.toLowerCase().includes(q))
      : ALL_COUNTRIES,
  [q]);
  const sel = ALL_COUNTRIES.find(([iso]) => iso === value);
  return (
    <div ref={ref} style={{ position:'relative', display:'flex', alignItems:'stretch' }}>
      <button
        type="button"
        onClick={() => { setOpen(o => !o); setSearch(''); }}
        style={{ border:'none', borderRight:'1px solid var(--border)', background:'var(--bg-elevated)', padding:'0 10px', fontSize:14, fontFamily:'var(--font)', color:'var(--text)', cursor:'pointer', minWidth:100, outline:'none', display:'flex', alignItems:'center', gap:6, whiteSpace:'nowrap', borderRadius:'9px 0 0 9px' }}
      >
        {sel
          ? <><span style={{fontSize:20,lineHeight:1}}>{flagEmoji(sel[0])}</span><span style={{fontSize:12,color:'var(--text-sub)'}}>+{sel[1]}</span></>
          : <span style={{color:'var(--text-sub)',fontSize:13}}>+?</span>}
        <span style={{ fontSize:9, opacity:0.35, marginLeft:'auto' }}>▼</span>
      </button>
      {open && (
        <div style={{ position:'absolute', top:'calc(100% + 4px)', left:0, zIndex:9999, background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:12, boxShadow:'0 8px 32px rgba(0,0,0,0.18)', width:280, maxHeight:320, overflow:'hidden', display:'flex', flexDirection:'column' }}>
          <div style={{ padding:'10px', borderBottom:'1px solid var(--border)', flexShrink:0 }}>
            <input
              autoFocus
              placeholder="Search country…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width:'100%', border:'1px solid var(--border)', borderRadius:8, padding:'7px 10px', fontSize:13, fontFamily:'var(--font)', outline:'none', background:'var(--bg-elevated)', color:'var(--text)', boxSizing:'border-box' }}
            />
          </div>
          <div style={{ overflowY:'auto', flex:1 }}>
            {!q && (
              <button type="button" onClick={() => { onChange(''); setOpen(false); }}
                style={{ width:'100%', padding:'8px 14px', border:'none', background:'transparent', cursor:'pointer', textAlign:'left', fontSize:13, fontFamily:'var(--font)', color:'var(--text-sub)' }}>
                — No country
              </button>
            )}
            {filtered.map(([iso, dc, name]) => (
              <button key={iso} type="button" onClick={() => { onChange(iso); setOpen(false); setSearch(''); }}
                style={{ width:'100%', padding:'8px 14px', border:'none', background: value===iso ? 'rgba(var(--rose-rgb),0.08)' : 'transparent', cursor:'pointer', textAlign:'left', fontFamily:'var(--font)', color: value===iso ? 'var(--rose)' : 'var(--text)', display:'flex', alignItems:'center', gap:10 }}
                onMouseEnter={e => { if (value!==iso) (e.currentTarget as HTMLButtonElement).style.background='var(--bg-elevated)'; }}
                onMouseLeave={e => { if (value!==iso) (e.currentTarget as HTMLButtonElement).style.background='transparent'; }}
              >
                <span style={{ fontSize:22, lineHeight:1, flexShrink:0 }}>{flagEmoji(iso)}</span>
                <span style={{ flex:1, fontSize:13 }}>{name}</span>
                <span style={{ fontSize:12, color:'var(--text-sub)', flexShrink:0 }}>+{dc}</span>
              </button>
            ))}
            {filtered.length === 0 && <p style={{ padding:'16px', fontSize:13, color:'var(--text-sub)', textAlign:'center', margin:0 }}>No results</p>}
          </div>
        </div>
      )}
    </div>
  );
}


export default function CustomersPage() {
  const { user } = useAuth();
  const { activeBranchId, branches } = useBranch();
  const { muteForCall, unmuteAfterCall } = useMusic();
  const { t, lang } = useLanguage();
  const { canDo } = usePermissions();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<ModalType>(null);
  const [selected, setSelected] = useState<Customer | null>(null);
  const [history, setHistory] = useState<Appointment[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [prescriptions, setPrescriptions] = useState<Record<string, unknown>[]>([]);
  const [historyTab, setHistoryTab] = useState<'appointments' | 'prescriptions'>('appointments');
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [form, setForm] = useState({ name: '', phone: '', email: '', country: '', branchId: '' });

  const headers = { Authorization: `Bearer ${user?.token}`, 'Content-Type': 'application/json' };

  const WA_TEMPLATES = [
    { name: t('waReminderName'), icon: '🔔', getText: (n: string) => lang === 'ar' ? `مرحباً ${n}! 👋 هذا تذكير بموعدك القادم في NexoraCare. أخبرنا إن أردت إعادة الجدولة. نتطلع لرؤيتك! ✨` : `Hi ${n}! 👋 This is a reminder for your upcoming appointment at NexoraCare. Please let us know if you need to reschedule. We look forward to seeing you! ✨` },
    { name: t('waBookName'),     icon: '📅', getText: (n: string) => lang === 'ar' ? `مرحباً ${n}! نود رؤيتك مجدداً في NexoraCare. هل أنت مستعد لحجز موعدك القادم؟ احجز الآن: [رابط] 💆` : `Hi ${n}! We'd love to see you again at NexoraCare. Ready to book your next appointment? Click here to schedule: [link] 💆` },
    { name: t('waOfferName'),    icon: '🎁', getText: (n: string) => lang === 'ar' ? `مرحباً ${n}! 🎉 لدينا عرض حصري خصيصاً لك! احصل على خصم 20% على زيارتك القادمة. اتصل بنا أو احجز عبر الإنترنت. المقاعد محدودة!` : `Hi ${n}! 🎉 We have an exclusive offer just for you! Get 20% off your next visit this week. Call us or book online. Limited slots available!` },
  ];

  const load = useCallback(async () => {
    if (!user?.token) return;
    const q = new URLSearchParams();
    if (activeBranchId) q.set('branchId', activeBranchId);
    if (search) q.set('search', search);
    const ck = `/api/customers?${q}`;
    const stale = swrGet<Customer[]>(ck);
    if (stale) { setCustomers(stale); setLoading(false); } else setLoading(true);
    try {
      const res = await fetch(ck, { headers: { Authorization: `Bearer ${user.token}` } });
      if (res.ok) { const d = await res.json(); setCustomers(d); swrSet(ck, d); }
    } catch { /* ignore */ }
    setLoading(false);
  }, [user, activeBranchId, search]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const onMouse = (e: MouseEvent) => {
      if (!(e.target as Element).closest('.dd-wrap')) setOpenDropdown(null);
    };
    const onScroll = () => setOpenDropdown(null);
    document.addEventListener('mousedown', onMouse);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', onMouse);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, []);

  useEffect(() => {
    if (!user?.token) return;
    fetch('/api/notifications/config', { headers: { Authorization: `Bearer ${user.token}` } })
      .then(r => r.json()).then(d => setNotifConfig(d)).catch(() => {});
  }, [user]);

  const openCreate = () => {
    setSelected(null);
    setForm({ name: '', phone: '', email: '', country: '', branchId: activeBranchId || '' });
    setModal('create');
  };

  const openEdit = (c: Customer) => {
    setSelected(c);
    let localPhone = c.phone || '';
    let country = c.country || '';
    if (country && DIAL_CODE_MAP[country]) {
      const dc = DIAL_CODE_MAP[country];
      if (localPhone.startsWith(dc)) localPhone = localPhone.slice(dc.length);
    } else if (localPhone) {
      const sorted = Object.entries(DIAL_CODE_MAP).sort((a, b) => b[1].length - a[1].length);
      for (const [iso, dc] of sorted) {
        if (localPhone.startsWith(dc)) { country = iso; localPhone = localPhone.slice(dc.length); break; }
      }
    }
    setForm({ name: c.name, phone: localPhone, email: c.email || '', country, branchId: c.branchId || '' });
    setModal('edit');
  };

  const openHistory = async (c: Customer) => {
    setSelected(c);
    setHistory([]);
    setPrescriptions([]);
    setHistoryLoading(true);
    setHistoryTab('appointments');
    setModal('history');
    try {
      const [apptRes, rxRes] = await Promise.all([
        fetch(`/api/customers/${c.id}/appointments`, { headers: { Authorization: `Bearer ${user?.token}` } }),
        fetch(`/api/prescriptions?customerId=${c.id}`, { headers: { Authorization: `Bearer ${user?.token}` } }),
      ]);
      if (apptRes.ok) setHistory(await apptRes.json());
      if (rxRes.ok) setPrescriptions(await rxRes.json());
    } finally {
      setHistoryLoading(false);
    }
  };

  const openCallLog = async (c: Customer) => {
    setSelected(c);
    setModal('call-log');
    const res = await fetch(`/api/call-logs?customerId=${c.id}`, { headers: { Authorization: `Bearer ${user?.token}` } });
    if (res.ok) setCallLogs(await res.json());
  };

  const save = async () => {
    if (!form.name) return toast.error('Name is required');
    try {
      const url = selected ? `/api/customers/${selected.id}` : '/api/customers';
      const method = selected ? 'PUT' : 'POST';
      const dialCode = form.country ? (DIAL_CODE_MAP[form.country] ?? '') : '';
      const phone = form.phone ? `${dialCode}${form.phone}` : '';
      const res = await fetch(url, { method, headers, body: JSON.stringify({ ...form, phone }) });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success(selected ? 'Customer updated' : 'Customer created');
      setModal(null);
      swrBust('/api/customers');
      load();
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Error'); }
  };

  const [deleting, setDeleting] = useState(false);

  // ── Messaging / call-logs state ──────────────────────────────
  const [view, setView] = useState<'customers' | 'calls'>('customers');
  const [allCallLogs, setAllCallLogs] = useState<CallLog[]>([]);
  const [allCallsLoading, setAllCallsLoading] = useState(false);
  const [allCallsSearch, setAllCallsSearch] = useState('');
  const [clearingLogs, setClearingLogs] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [notifConfig, setNotifConfig] = useState({ smsEnabled: false, emailEnabled: false });
  const [msgSubject, setMsgSubject] = useState('');
  const [msgBody, setMsgBody] = useState('');
  const [msgChannels, setMsgChannels] = useState<string[]>(['EMAIL']);
  const [msgSending, setMsgSending] = useState(false);
  const [msgResult, setMsgResult] = useState<{ emailSent?: number; emailFailed?: number; smsSent?: number; smsFailed?: number } | null>(null);
  const [msgError, setMsgError] = useState('');
  const [broadcastSel, setBroadcastSel] = useState<Set<string>>(new Set());
  const [broadcastSearch, setBroadcastSearch] = useState('');
  const [waSending, setWaSending] = useState(false);
  const [waError, setWaError] = useState('');
  const [waResult, setWaResult] = useState(false);
  const [waPhone, setWaPhone] = useState('');
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  // ── Voice call state ─────────────────────────────────────────
  const [callCustomer, setCallCustomer] = useState<Customer | null>(null);
  const [callStatus, setCallStatus] = useState<'idle' | 'connecting' | 'ringing' | 'in-call' | 'ended'>('idle');
  const [callSeconds, setCallSeconds] = useState(0);
  const [callSid, setCallSid] = useState<string | null>(null);
  const callTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const callPollRef  = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if ((callStatus !== 'ringing' && callStatus !== 'in-call') || !callSid) {
      if (callPollRef.current) { clearInterval(callPollRef.current); callPollRef.current = null; }
      return;
    }
    callPollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/calls/check?callSid=${callSid}`, {
          headers: { Authorization: `Bearer ${user?.token}` },
        });
        if (!res.ok) return;
        const { active, status } = await res.json();

        if (status === 'in-progress' && callStatus === 'ringing') {
          // Other side answered — start timer now
          setCallStatus('in-call');
          setCallSeconds(0);
          if (callTimerRef.current) clearInterval(callTimerRef.current);
          callTimerRef.current = setInterval(() => setCallSeconds(s => s + 1), 1000);
        }

        if (!active) {
          if (callPollRef.current)  { clearInterval(callPollRef.current);  callPollRef.current  = null; }
          if (callTimerRef.current) { clearInterval(callTimerRef.current); callTimerRef.current = null; }
          unmuteAfterCall();
          setCallStatus('ended');
          setCallSid(null);
          toast('Call ended', { icon: '📵' });
          setTimeout(() => { setCallStatus('idle'); setCallCustomer(null); setCallSeconds(0); }, 2000);
        }
      } catch { /* ignore */ }
    }, 3000);
    return () => { if (callPollRef.current) { clearInterval(callPollRef.current); callPollRef.current = null; } };
  }, [callStatus, callSid, user]);

  const confirmDelete = (c: Customer) => {
    setSelected(c);
    setModal('delete');
  };

  const deleteCustomer = async () => {
    if (!selected) return;
    setDeleting(true);
    const res = await fetch(`/api/customers/${selected.id}`, { method: 'DELETE', headers });
    setDeleting(false);
    if (res.ok) { toast.success('Customer deleted'); setModal(null); swrBust('/api/customers'); load(); }
    else toast.error('Failed to delete');
  };

  const loadAllCallLogs = async () => {
    if (!user?.token) return;
    setAllCallsLoading(true);
    try {
      const res = await fetch('/api/call-logs', { headers: { Authorization: `Bearer ${user.token}` } });
      if (res.ok) setAllCallLogs(await res.json());
    } finally { setAllCallsLoading(false); }
  };

  const clearAllCallLogs = async () => {
    setClearingLogs(true);
    try {
      const res = await fetch('/api/call-logs', { method: 'DELETE', headers: { Authorization: `Bearer ${user?.token}` } });
      if (res.ok) { setAllCallLogs([]); toast.success('All call logs cleared'); }
      else toast.error('Failed to clear logs');
    } catch { toast.error('Failed to clear logs'); }
    finally { setClearingLogs(false); setConfirmClear(false); }
  };

  const switchView = (v: 'customers' | 'calls') => {
    setView(v);
    if (v === 'calls') loadAllCallLogs();
  };

  const openMsg = (c: Customer, type: 'email' | 'sms') => {
    setSelected(c);
    setMsgSubject(''); setMsgBody(''); setMsgError(''); setMsgResult(null);
    setMsgChannels([type === 'email' ? 'EMAIL' : 'SMS']);
    setModal(type);
  };

  const openBroadcast = () => {
    setBroadcastSel(new Set()); setBroadcastSearch('');
    setMsgSubject(''); setMsgBody(''); setMsgChannels(['EMAIL']);
    setMsgError(''); setMsgResult(null);
    setModal('broadcast');
  };

  const sendMsg = async (channel: string) => {
    if (!msgBody.trim()) { setMsgError('Message is required'); return; }
    setMsgSending(true); setMsgError(''); setMsgResult(null);
    try {
      const res = await fetch('/api/notifications/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user?.token}` },
        body: JSON.stringify({
          customerIds: selected ? [selected.id] : [],
          channels: [channel],
          subject: msgSubject || 'Message from Nexora Care',
          message: msgBody,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setMsgError(data.error || data.message || 'Send failed'); return; }
      setMsgResult(data);
      setMsgBody(''); setMsgSubject('');
      toast.success('Message sent!');
      setTimeout(() => setModal(null), 1500);
    } catch { setMsgError('Send failed'); }
    finally { setMsgSending(false); }
  };

  const handleBroadcast = async () => {
    if (!msgBody.trim()) { setMsgError('Message is required'); return; }
    if (msgChannels.length === 0) { setMsgError('Select at least one channel'); return; }
    setMsgSending(true); setMsgError(''); setMsgResult(null);
    try {
      const res = await fetch('/api/notifications/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user?.token}` },
        body: JSON.stringify({
          customerIds: broadcastSel.size > 0 ? [...broadcastSel] : [],
          channels: msgChannels,
          subject: msgSubject || 'Message from Nexora Care',
          message: msgBody,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setMsgError(data.error || data.message || 'Send failed'); return; }
      setMsgResult(data);
      setMsgBody(''); setMsgSubject('');
    } catch { setMsgError('Send failed'); }
    finally { setMsgSending(false); }
  };

  const sendWhatsApp = async (phone: string, message: string) => {
    setWaSending(true); setWaError(''); setWaResult(false);
    try {
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user?.token}` },
        body: JSON.stringify({ phone, message }),
      });
      const data = await res.json();
      if (!res.ok) { setWaError(data.error || data.message || 'Failed to send'); return; }
      setWaResult(true);
      toast.success('WhatsApp message sent!');
      setTimeout(() => setModal(null), 1500);
    } catch { setWaError('Failed to send'); }
    finally { setWaSending(false); }
  };

  const logCall = async (c: Customer) => {
    const duration = Math.floor(Math.random() * 180) + 30;
    await fetch('/api/call-logs', {
      method: 'POST', headers,
      body: JSON.stringify({ customerId: c.id, customerName: c.name, durationSeconds: duration, status: 'COMPLETED' }),
    });
    toast.success(`Call logged: ${duration}s`);
  };

  const startCall = async (c: Customer) => {
    if (!c.phone) return toast.error('No phone number');
    setCallCustomer(c);
    setCallStatus('connecting');
    setCallSeconds(0);
    muteForCall();
    try {
      const res = await fetch('/api/calls/make', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user?.token}` },
        body: JSON.stringify({ customerId: c.id, phone: c.phone, customerName: c.name }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'Call failed'); setCallStatus('idle'); setCallCustomer(null); return; }
      setCallSid(data.callSid);
      setCallStatus('ringing');
      toast.success('Ringing — waiting for the other side to answer…');
    } catch {
      toast.error('Failed to start call');
      setCallStatus('idle');
      setCallCustomer(null);
    }
  };

  const endCall = async (c: Customer) => {
    if (callTimerRef.current) { clearInterval(callTimerRef.current); callTimerRef.current = null; }
    if (callPollRef.current)  { clearInterval(callPollRef.current);  callPollRef.current  = null; }
    unmuteAfterCall();
    if (callSid) {
      try {
        const res = await fetch('/api/calls/end', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user?.token}` },
          body: JSON.stringify({ callSid }),
        });
        if (!res.ok) {
          const d = await res.json();
          toast.error(d.error || 'Could not end call on Twilio');
        }
      } catch { /* call may have already ended naturally */ }
    }
    setCallStatus('ended');
    setCallSid(null);
    setTimeout(() => { setCallStatus('idle'); setCallCustomer(null); setCallSeconds(0); }, 2000);
    toast.success('Call ended');
  };

  const filtered = customers.filter(c =>
    !search ||
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.phone?.includes(search) ||
    c.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <ProtectedRoute permKey="manageCustomers">
      <div>
        <div className="page-header">
          <div>
            <h1 className="page-title">{t('customers')}</h1>
            <p className="page-sub">{filtered.length} {t('customers').toLowerCase()}</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {canDo('sendBroadcasts') && <button className="btn btn-secondary" onClick={openBroadcast}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
              </svg>
              {t('broadcast')}
            </button>}
            {canDo('createCustomers') && <button className="action-btn action-btn-add" onClick={openCreate}><Icon name="add" size={15} /> {t('addClient')}</button>}
          </div>
        </div>

        {/* Tab toggle */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'var(--bg-elevated)', borderRadius: 10, padding: 4, width: 'fit-content' }}>
          {(['customers', ...((canDo('viewCallLogs') || canDo('clearCallLogs')) ? ['calls'] : [])] as const).map(v => (
            <button key={v} onClick={() => switchView(v as 'customers' | 'calls')} style={{
              padding: '7px 18px', borderRadius: 8, border: 'none', cursor: 'pointer',
              fontFamily: 'var(--font)', fontSize: '0.85rem', fontWeight: 600,
              background: view === v ? 'var(--bg-surface)' : 'transparent',
              color: view === v ? 'var(--text)' : 'var(--text-sub)',
              boxShadow: view === v ? '0 1px 6px rgba(0,0,0,0.10)' : 'none',
              transition: 'all 0.15s',
            }}>
              {v === 'customers' ? `👥 ${t('customers')}` : `📞 ${t('allCalls')}`}
            </button>
          ))}
        </div>

        {view === 'calls' ? (
          /* ── All Calls view ── */
          <div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
              <div className="search-wrap" style={{ flex: 1 }}>
                <span className="search-icon"><Icon name="search" size={15} /></span>
                <input className="search-input" placeholder={t('searchClients')}
                  value={allCallsSearch} onChange={e => setAllCallsSearch(e.target.value)} />
              </div>
              {allCallLogs.length > 0 && canDo('clearCallLogs') && (
                confirmClear ? (
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span style={{ fontSize: 13, color: 'var(--text-sub)', whiteSpace: 'nowrap' }}>{t('clearAll')}?</span>
                    <button className="btn btn-sm" onClick={clearAllCallLogs} disabled={clearingLogs}
                      style={{ background: '#e53e5a', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 14px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                      {clearingLogs ? t('clearing') : t('yesClear')}
                    </button>
                    <button className="btn btn-secondary btn-sm" onClick={() => setConfirmClear(false)}
                      style={{ borderRadius: 8, padding: '6px 12px', fontSize: 13 }}>
                      {t('cancel')}
                    </button>
                  </div>
                ) : (
                  <button className="btn btn-secondary" onClick={() => setConfirmClear(true)}
                    style={{ whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6, color: '#e53e5a', borderColor: 'rgba(229,62,90,0.3)' }}>
                    <Icon name="delete" size={14} /> {t('clearAll')}
                  </button>
                )
              )}
            </div>
            {allCallsLoading ? (
              <div className="skeleton" style={{ height: 300 }} />
            ) : (
              <div className="table-wrap">
                <table className="glass-table">
                  <thead><tr>
                    <th>{t('customer')}</th><th>{t('dateTime')}</th><th>{t('duration')}</th><th>{t('status')}</th>
                  </tr></thead>
                  <tbody>
                    {allCallLogs
                      .filter(l => !allCallsSearch ||
                        (l.customerName || '').toLowerCase().includes(allCallsSearch.toLowerCase()))
                      .map(l => (
                        <tr key={l.id}>
                          <td style={{ fontWeight: 600 }}>{l.customerName || '—'}</td>
                          <td style={{ color: 'var(--text-sub)', fontSize: '0.875rem' }}>
                            {new Date(l.startedAt).toLocaleString(lang === 'ar' ? 'ar-SA' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td style={{ color: 'var(--text-muted)' }}>
                            {l.durationSeconds ? `${Math.floor(l.durationSeconds / 60)}m ${l.durationSeconds % 60}s` : '—'}
                          </td>
                          <td>
                            <span className={`badge badge-${l.status === 'COMPLETED' ? 'paid' : l.status === 'NO_ANSWER' ? 'no-show' : 'cancelled'}`}>
                              {l.status.replace('_', ' ')}
                            </span>
                          </td>
                        </tr>
                      ))}
                    {allCallLogs.length === 0 && (
                      <tr><td colSpan={4} style={{ textAlign: 'center', padding: 40, color: 'var(--text-sub)' }}>{t('noCallLogs')}</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          /* ── Customers view ── */
          <><div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
          <div className="search-wrap">
            <span className="search-icon"><Icon name="search" size={15} /></span>
            <input
              className="search-input"
              placeholder={t('searchClients')}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="skeleton" style={{ height: '400px' }} />
        ) : (
          <div className="table-wrap">
            <table className="glass-table">
              <thead>
                <tr>
                  <th>{t('customer')}</th>
                  <th>{t('phone')}</th>
                  <th>{t('email')}</th>
                  <th>{t('branch')}</th>
                  <th>{t('visits')}</th>
                  <th>{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-sub)' }}>{t('noClients')}</td></tr>
                ) : filtered.map(c => (
                  <tr key={c.id}>
                    <td data-label="Customer">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div className="avatar" style={{ width: 36, height: 36 }}>
                          {c.name.slice(0, 2).toUpperCase()}
                        </div>
                        <span style={{ fontWeight: 600 }}>{c.name}</span>
                      </div>
                    </td>
                    <td data-label="Phone" style={{ color: 'var(--text-muted)' }}>
                      {c.phone ? (
                        <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
                          {c.country && (
                            <span style={{ display:'flex', alignItems:'center', gap:5, fontSize:12, color:'var(--text-sub)' }}>
                              <span style={{ fontSize:17, lineHeight:1 }}>{flagEmoji(c.country)}</span>
                              <span>{(() => { try { return new Intl.DisplayNames([lang === 'ar' ? 'ar' : 'en'], { type:'region' }).of(c.country) ?? c.country; } catch { return c.country; } })()}</span>
                            </span>
                          )}
                          <span style={{ fontSize:13 }}>{c.phone}</span>
                        </div>
                      ) : '—'}
                    </td>
                    <td data-label="Email" style={{ color: 'var(--text-sub)', fontSize: '0.875rem' }}>{c.email || '—'}</td>
                    <td data-label="Branch">
                      {c.branch?.name ? (
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 6,
                          padding: '4px 12px', borderRadius: 20,
                          background: 'var(--bg-elevated)',
                          border: '1px solid var(--border)',
                          fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-sub)',
                        }}>
                          <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--rose-light)', flexShrink: 0 }} />
                          {lang === 'ar' && (c.branch as any).nameAr ? (c.branch as any).nameAr : c.branch.name}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>—</span>
                      )}
                    </td>
                    <td data-label="Visits">
                      <span style={{
                        background: 'var(--grad-soft)', color: 'var(--rose)',
                        padding: '3px 10px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 600,
                      }}>
                        {c._count?.appointments ?? 0}
                      </span>
                    </td>
                    <td data-label="Actions">
                      <div className="dd-wrap" style={{ display: 'inline-block' }}>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={(e) => {
                            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                            const dropdownWidth = 185;
                            const dropMaxH = 280;
                            let left = rect.left;
                            if (left + dropdownWidth > window.innerWidth - 8) left = window.innerWidth - dropdownWidth - 8;
                            if (left < 8) left = 8;
                            const spaceBelow = window.innerHeight - rect.bottom - 8;
                            const top = spaceBelow < dropMaxH ? Math.max(8, rect.top - dropMaxH) : rect.bottom + 4;
                            setDropdownPos({ top, left });
                            setOpenDropdown(openDropdown === c.id ? null : c.id);
                          }}
                          style={{ padding: '4px 10px', fontWeight: 700, fontSize: '1rem', letterSpacing: 2, lineHeight: 1 }}
                        >
                          •••
                        </button>
                        {openDropdown === c.id && (
                          <div style={{
                            position: 'fixed', top: dropdownPos.top, left: dropdownPos.left, zIndex: 9999,
                            background: 'var(--bg-surface)', border: '1px solid var(--border)',
                            borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.14)',
                            minWidth: 175, padding: '4px 0', overflow: 'hidden', direction: 'ltr',
                          }}>
                            {([
                              ...(canDo('editCustomers') ? [{ id: 'edit', label: t('edit'), isEdit: true, color: 'var(--text)', action: () => { openEdit(c); setOpenDropdown(null); } }] : []),
                              { id: 'history', label: `📋  ${t('history')}`, color: 'var(--text)', action: () => { openHistory(c); setOpenDropdown(null); } },
                              ...(c.phone && canDo('sendWhatsApp') ? [
                                { id: 'whatsapp', label: 'WhatsApp', icon: true, color: '#25D366', action: () => { setSelected(c); setWaSending(false); setWaError(''); setWaResult(false); setWaPhone(c.phone || ''); setModal('whatsapp'); setOpenDropdown(null); } },
                              ] : []),
                              ...(c.phone && canDo('sendSMS') ? [
                                { id: 'sms', label: `📱  SMS`, color: '#0284c7', action: () => { openMsg(c, 'sms'); setOpenDropdown(null); } },
                              ] : []),
                              ...(c.phone && canDo('makePhoneCalls') ? [
                                { id: 'call', label: callStatus !== 'idle' ? `📞  ${t('callOnCall')}` : `📞  ${t('callLogsNav')}`, color: callStatus !== 'idle' ? 'var(--text-sub)' : 'var(--text)', action: () => { if (callStatus === 'idle') { startCall(c); setOpenDropdown(null); } } },
                              ] : []),
                              ...(c.email && canDo('sendEmail') ? [
                                { id: 'email', label: `✉️  ${t('email')}`, color: '#7b5ea8', action: () => { openMsg(c, 'email'); setOpenDropdown(null); } },
                              ] : []),
                            ] as { id: string; label: string; icon?: boolean; isEdit?: boolean; color: string; action: () => void }[]).map(item => (
                              <button key={item.id} onClick={item.action}
                                style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', padding: '9px 16px', border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'var(--font)', fontSize: 13, fontWeight: 500, color: item.color, transition: 'background 0.1s' }}
                                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-elevated)')}
                                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                              >
                                {item.icon && <svg width="14" height="14" viewBox="0 0 24 24" fill="#25D366" style={{ flexShrink: 0 }}><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.107.549 4.09 1.514 5.814L.057 23.886a.5.5 0 0 0 .611.611l6.123-1.463A11.945 11.945 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818c-1.93 0-3.738-.548-5.267-1.498l-.378-.226-3.912.934.964-3.84-.247-.395A9.817 9.817 0 0 1 2.182 12c0-5.426 4.392-9.818 9.818-9.818 5.426 0 9.818 4.392 9.818 9.818 0 5.426-4.392 9.818-9.818 9.818z"/></svg>}
                                {item.isEdit && <Icon name="edit" size={14} />}
                                {item.label}
                              </button>
                            ))}
                            {canDo('deleteCustomers') && (
                              <>
                                <div style={{ borderTop: '1px solid var(--border)', margin: '4px 0' }} />
                                <button onClick={() => { confirmDelete(c); setOpenDropdown(null); }}
                                  style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', padding: '9px 16px', border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'var(--font)', fontSize: 13, fontWeight: 500, color: '#e53e5a', transition: 'background 0.1s' }}
                                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(229,62,90,0.07)')}
                                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                >
                                  <Icon name="delete" size={14} />  {t('delete')}
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        </>
        )}

        {/* ── Modals (outside view toggle so they render in both views) ── */}

        {/* Create/Edit Modal */}
        {(modal === 'create' || modal === 'edit') && (
          <div className="modal-overlay">
            <div className="modal">
              <div className="modal-header">
                <h2 className="modal-title">{modal === 'create' ? t('addClient') : t('editClient')}</h2>
                <button className="modal-close" onClick={() => setModal(null)}>✕</button>
              </div>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">{t('name')} *</label>
                  <input className="form-input" type="text" placeholder={t('clientName')}
                    value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">{t('phone')}</label>
                    <div style={{ display:'flex', border:'1px solid var(--border)', borderRadius:10, background:'var(--bg-surface)' }}>
                      <PhonePrefix value={form.country} onChange={v => setForm(f => ({ ...f, country: v }))} />
                      <input
                        type="tel"
                        placeholder="790891028"
                        value={form.phone}
                        onChange={e => setForm(f => ({ ...f, phone: e.target.value.replace(/\D/g, '') }))}
                        style={{ border:'none', outline:'none', flex:1, padding:'10px 12px', background:'transparent', fontSize:14, fontFamily:'var(--font)', color:'var(--text)', borderRadius:'0 9px 9px 0' }}
                      />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">{t('email')}</label>
                    <input className="form-input" type="email" placeholder={t('emailPlaceholder')}
                      value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                  </div>
                </div>
                {canDo('branchSwitching') && branches.length > 0 && (
                  <div className="form-group">
                    <label className="form-label">{t('branch')}</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                      <button
                        type="button"
                        onClick={() => setForm(f => ({ ...f, branchId: '' }))}
                        style={{
                          padding: '7px 16px', borderRadius: 20, border: '1.5px solid',
                          borderColor: !form.branchId ? 'var(--rose)' : 'var(--border)',
                          background: !form.branchId ? 'rgba(var(--rose-rgb),0.10)' : 'var(--bg-elevated)',
                          color: !form.branchId ? 'var(--rose)' : 'var(--text-sub)',
                          fontFamily: 'var(--font)', fontSize: 13, fontWeight: 600,
                          cursor: 'pointer', transition: 'all 0.15s',
                        }}
                      >
                        {t('noBranch')}
                      </button>
                      {branches.map((b, i) => {
                        const colors = ['#7B5EA8','#C4788C','#0284c7','#059669','#d97706'];
                        const color = colors[i % colors.length];
                        const active = form.branchId === b.id;
                        return (
                          <button
                            key={b.id}
                            type="button"
                            onClick={() => setForm(f => ({ ...f, branchId: b.id }))}
                            style={{
                              padding: '7px 16px', borderRadius: 20, border: '1.5px solid',
                              borderColor: active ? color : 'var(--border)',
                              background: active ? `${color}18` : 'var(--bg-elevated)',
                              color: active ? color : 'var(--text-sub)',
                              fontFamily: 'var(--font)', fontSize: 13, fontWeight: 600,
                              cursor: 'pointer', transition: 'all 0.15s',
                              display: 'flex', alignItems: 'center', gap: 7,
                            }}
                          >
                            <span style={{
                              width: 8, height: 8, borderRadius: '50%',
                              background: active ? color : 'var(--text-muted)',
                              flexShrink: 0, transition: 'background 0.15s',
                            }} />
                            {lang === 'ar' && (b as any).nameAr ? (b as any).nameAr : b.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setModal(null)}>{t('cancel')}</button>
                <button className="btn btn-primary" onClick={save}>
                  {modal === 'create' ? t('addClient') : t('saveChanges')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* History Modal */}
        {modal === 'history' && selected && (
          <div className="modal-overlay" style={{ padding: '16px' }}>
            <div className="modal modal-lg" style={{ maxHeight: 'calc(100vh - 40px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div className="modal-header" style={{ flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--grad)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.85rem', color: '#fff', flexShrink: 0 }}>
                    {selected.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h2 className="modal-title" style={{ margin: 0, fontSize: '0.95rem' }}>{selected.name}</h2>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{selected.phone || ''}</div>
                  </div>
                </div>
                <button className="modal-close" onClick={() => setModal(null)}>✕</button>
              </div>

              {/* Tabs */}
              <div style={{ display: 'flex', gap: 2, padding: '0 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
                {(['appointments', 'prescriptions'] as const).map(tab => (
                  <button key={tab} onClick={() => setHistoryTab(tab)} style={{ padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', fontWeight: historyTab === tab ? 700 : 400, color: historyTab === tab ? 'var(--rose)' : 'var(--text-muted)', borderBottom: historyTab === tab ? '2px solid var(--rose)' : '2px solid transparent', marginBottom: -1, fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                    {tab === 'appointments' ? `📅 ${t('history')} (${history.length})` : `💊 Prescriptions (${prescriptions.length})`}
                  </button>
                ))}
              </div>

              {/* Scrollable body */}
              <div className="modal-body" style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
                {historyLoading ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 80, borderRadius: 12, opacity: 1 - i * 0.15 }} />)}
                  </div>
                ) : historyTab === 'appointments' ? (
                  history.length === 0 ? (
                    <div className="empty-state"><div className="empty-state-icon">📭</div><div className="empty-state-title">{t('noAppointmentHistory')}</div></div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {history.map(a => {
                        const appt = a as Appointment & { serviceProvider?: { name: string }; notes?: string };
                        const statusColor: Record<string, string> = { SCHEDULED: '#0891b2', COMPLETED: '#059669', CANCELLED: '#e53e5a', NO_SHOW: '#f59e0b' };
                        const sColor = statusColor[a.status] || 'var(--text-muted)';
                        return (
                          <div key={a.id} style={{ background: 'var(--bg-elevated)', borderRadius: 14, padding: '13px 16px', border: '1px solid var(--border)', borderLeft: `3px solid ${sColor}` }}>
                            {/* Row 1: date + badges */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                              <span style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text)' }}>
                                📅 {new Date(a.dateTime).toLocaleString(lang === 'ar' ? 'ar-SA' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </span>
                              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                <span className={`badge badge-${a.status.toLowerCase().replace('_', '-')}`}>{a.status.replace('_', ' ')}</span>
                                <span className={`badge ${a.paymentStatus === 'PAID' ? 'badge-paid' : 'badge-unpaid'}`}>{a.paymentStatus}</span>
                              </div>
                            </div>
                            {/* Row 2: service + specialist */}
                            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: '0.82rem', color: 'var(--text-sub)' }}>
                              {a.service?.name && (
                                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <span style={{ opacity: 0.6 }}>✦</span> {a.service.name}
                                </span>
                              )}
                              {appt.serviceProvider?.name && (
                                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <span style={{ opacity: 0.6 }}>👤</span> {appt.serviceProvider.name}
                                </span>
                              )}
                            </div>
                            {/* Row 3: notes */}
                            {appt.notes && (
                              <div style={{ marginTop: 8, fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic', paddingTop: 7, borderTop: '1px solid var(--border)' }}>
                                📝 {appt.notes}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )
                ) : (
                  prescriptions.length === 0 ? (
                    <div className="empty-state"><div className="empty-state-icon">💊</div><div className="empty-state-title">No prescriptions yet</div></div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {(prescriptions as Array<Record<string, unknown>>).map((rx) => {
                        const p = rx as { id: string; createdAt: string; notes?: string; appointment?: { service?: { name: string } }; items: Array<{ medicine?: { name: string; nameAr?: string }; dosage?: string; frequency?: string; duration?: string }> };
                        return (
                          <div key={p.id} style={{ background: 'var(--bg-elevated)', borderRadius: 14, padding: '13px 16px', border: '1px solid var(--border)', borderLeft: '3px solid #7c3aed' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, gap: 8, flexWrap: 'wrap' }}>
                              <span style={{ fontWeight: 700, fontSize: '0.88rem' }}>
                                💊 {new Date(p.createdAt).toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US', { dateStyle: 'medium' })}
                              </span>
                              {p.appointment?.service && (
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', background: 'rgba(124,58,237,0.08)', borderRadius: 6, padding: '2px 9px', border: '1px solid rgba(124,58,237,0.15)' }}>
                                  {p.appointment.service.name}
                                </span>
                              )}
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                              {p.items.map((item, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(124,58,237,0.07)', borderRadius: 20, padding: '4px 10px', border: '1px solid rgba(124,58,237,0.15)' }}>
                                  <span style={{ color: '#7c3aed', fontWeight: 700, fontSize: '0.8rem' }}>{item.medicine?.name}</span>
                                  {item.dosage && <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>· {item.dosage}</span>}
                                  {item.frequency && <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>· {item.frequency}</span>}
                                  {item.duration && <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>· {item.duration}</span>}
                                </div>
                              ))}
                            </div>
                            {p.notes && <div style={{ marginTop: 9, fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic', borderTop: '1px solid var(--border)', paddingTop: 8 }}>📝 {p.notes}</div>}
                          </div>
                        );
                      })}
                    </div>
                  )
                )}
              </div>

              <div className="modal-footer" style={{ flexShrink: 0 }}>
                <button className="btn btn-secondary" onClick={() => setModal(null)}>{t('close')}</button>
              </div>
            </div>
          </div>
        )}

        {/* WhatsApp Templates Modal */}
        {modal === 'whatsapp' && selected && (
          <div className="modal-overlay">
            <div className="modal">
              <div className="modal-header">
                <h2 className="modal-title" style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ color:'#25D366', display:'flex' }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.890-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                  </span>
                  {t('sendWhatsapp')}
                </h2>
                <button className="modal-close" onClick={() => setModal(null)}>✕</button>
              </div>
              <div className="modal-body">
                <div className="form-group" style={{ marginBottom: 14 }}>
                  <label className="form-label">{t('sendToPhone')}</label>
                  <input className="form-input" value={waPhone} disabled style={{ opacity: 0.7 }} />
                </div>
                {WA_TEMPLATES.map(tpl => (
                  <div key={tpl.name} style={{
                    background: 'var(--bg-elevated)',
                    borderRadius: '10px', padding: '14px',
                    cursor: 'pointer', transition: 'all 0.15s',
                    border: '1px solid var(--border)',
                    marginBottom: 8,
                  }}
                    onClick={() => {
                      const digits = waPhone.replace(/\D/g, '').replace(/^00/, '');
                      if (!digits) return toast.error(lang === 'ar' ? 'لا يوجد رقم هاتف' : 'No phone number');
                      const text = encodeURIComponent(tpl.getText(selected.name));
                      window.open(`https://wa.me/${digits}?text=${text}`, '_blank');
                      setModal(null);
                    }}
                  >
                    <div style={{ fontWeight: 600, marginBottom: '6px', color: 'var(--text)' }}>
                      {tpl.icon} {tpl.name}
                    </div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-sub)', lineHeight: 1.5 }}>
                      {tpl.getText(selected.name)}
                    </div>
                  </div>
                ))}
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setModal(null)}>{t('cancel')}</button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {modal === 'delete' && selected && (
          <div className="modal-overlay" style={{ backdropFilter: 'blur(6px)' }}>
            <div style={{
              background: 'var(--bg-surface,#fff)',
              borderRadius: 24, width: '100%', maxWidth: 380,
              boxShadow: '0 24px 80px rgba(0,0,0,0.18), 0 0 0 1px rgba(229,62,90,0.12)',
              overflow: 'hidden',
              animation: 'del-pop 0.22s cubic-bezier(.34,1.56,.64,1)',
            }}>
              <style dangerouslySetInnerHTML={{ __html: `
                @keyframes del-pop { from { opacity:0; transform:scale(0.88) translateY(16px); } to { opacity:1; transform:scale(1) translateY(0); } }
                @keyframes del-shake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-5px)} 40%{transform:translateX(5px)} 60%{transform:translateX(-3px)} 80%{transform:translateX(3px)} }
              `}} />
              {/* Red top band */}
              <div style={{ height: 5, background: 'linear-gradient(90deg,#e53e5a,#ff6b81)' }} />
              <div style={{ padding: '32px 28px 28px', textAlign: 'center' }}>
                {/* Icon */}
                <div style={{
                  width: 68, height: 68, borderRadius: '50%', margin: '0 auto 20px',
                  background: 'linear-gradient(135deg,rgba(229,62,90,0.14),rgba(229,62,90,0.06))',
                  border: '1.5px solid rgba(229,62,90,0.22)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  animation: 'del-shake 0.55s cubic-bezier(.36,.07,.19,.97) 0.2s both',
                }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#e53e5a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                  </svg>
                </div>
                {/* Title */}
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', marginBottom: 6, letterSpacing: -0.3 }}>
                  {t('deleteCustomer')}
                </div>
                {/* Subtitle */}
                <div style={{ fontSize: 13.5, color: 'var(--text-sub)', lineHeight: 1.65, marginBottom: 16 }}>
                  {t('deleteWarning')}
                </div>
                {/* Name chip */}
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  background: 'rgba(229,62,90,0.07)', border: '1px solid rgba(229,62,90,0.18)',
                  borderRadius: 30, padding: '6px 16px', marginBottom: 18,
                }}>
                  <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'linear-gradient(135deg,#e53e5a,#ff6b81)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: '#fff' }}>
                    {selected.name.slice(0,2).toUpperCase()}
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#e53e5a' }}>{selected.name}</span>
                </div>
                {/* Warning */}
                <div style={{
                  display: 'flex', alignItems: 'flex-start', gap: 9,
                  background: 'rgba(229,62,90,0.05)', border: '1px solid rgba(229,62,90,0.13)',
                  borderRadius: 10, padding: '10px 14px', marginBottom: 26, textAlign: 'left',
                }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#e53e5a" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 1 }}>
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                  </svg>
                  <span style={{ fontSize: 12, color: 'var(--text-sub)', lineHeight: 1.6 }}>
                    {t('deleteWarningText')}
                  </span>
                </div>
                {/* Buttons */}
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    onClick={() => setModal(null)} disabled={deleting}
                    style={{
                      flex: 1, padding: '12px', border: '1.5px solid var(--border)', borderRadius: 12,
                      background: 'transparent', color: 'var(--text-muted)', fontFamily: 'var(--font)',
                      fontSize: 14, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.04)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    {t('cancel')}
                  </button>
                  <button
                    onClick={deleteCustomer} disabled={deleting}
                    style={{
                      flex: 1, padding: '12px', border: 'none', borderRadius: 12,
                      background: 'linear-gradient(135deg,#e53e5a,#c0392b)',
                      color: '#fff', fontFamily: 'var(--font)', fontSize: 14, fontWeight: 700,
                      cursor: deleting ? 'not-allowed' : 'pointer', opacity: deleting ? 0.7 : 1,
                      boxShadow: '0 4px 18px rgba(229,62,90,0.35)', transition: 'all 0.15s',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                    }}
                    onMouseEnter={e => { if (!deleting) { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)'; (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 6px 24px rgba(229,62,90,0.50)'; }}}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = ''; (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 18px rgba(229,62,90,0.35)'; }}
                  >
                    {deleting ? (
                      <><span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.35)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.65s linear infinite', display: 'inline-block' }} /> {t('deleting')}</>
                    ) : (
                      <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg> {t('delete')}</>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Call Log Modal */}
        {modal === 'call-log' && selected && (
          <div className="modal-overlay">
            <div className="modal">
              <div className="modal-header">
                <h2 className="modal-title">📞 {selected.name} — {t('callLogsNav')}</h2>
                <button className="modal-close" onClick={() => setModal(null)}>✕</button>
              </div>
              <div className="modal-body">
                {callLogs.length === 0 ? (
                  <div className="empty-state"><div className="empty-state-icon">📵</div><div className="empty-state-title">{t('noCallHistory')}</div></div>
                ) : callLogs.map(log => (
                  <div key={log.id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '10px 0', borderBottom: '1px solid var(--border)',
                  }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>
                        {new Date(log.startedAt).toLocaleString(lang === 'ar' ? 'ar-SA' : 'en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-sub)' }}>
                        {log.durationSeconds ? `${Math.floor(log.durationSeconds / 60)}m ${log.durationSeconds % 60}s` : t('unknownDuration')}
                      </div>
                    </div>
                    <span className={`badge badge-${log.status === 'COMPLETED' ? 'paid' : log.status === 'NO_ANSWER' ? 'no-show' : 'cancelled'}`}>
                      {log.status.replace('_', ' ')}
                    </span>
                  </div>
                ))}
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setModal(null)}>{t('close')}</button>
              </div>
            </div>
          </div>
        )}
        {/* ── Email Modal ── */}
        {modal === 'email' && selected && (
          <div className="modal-overlay">
            <div className="modal">
              <div className="modal-header">
                <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--rose)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
                  </svg>
                  {t('emailTo')} {selected.name}
                </h2>
                <button className="modal-close" onClick={() => setModal(null)}>✕</button>
              </div>
              <div className="modal-body">
                {!notifConfig.emailEnabled && (
                  <div style={{ background: 'rgba(234,88,12,0.08)', border: '1px solid rgba(234,88,12,0.22)', borderRadius: 9, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: '#c84008' }}>
                    ⚙️ {t('emailNotConfigured')}
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label">{t('to')}</label>
                  <input className="form-input" value={selected.email || ''} disabled style={{ opacity: 0.7 }} />
                </div>
                <div className="form-group">
                  <label className="form-label">{t('subject')}</label>
                  <input className="form-input" placeholder={t('msgPlaceholder')}
                    value={msgSubject} onChange={e => setMsgSubject(e.target.value)} maxLength={120} />
                </div>
                <div className="form-group">
                  <label className="form-label">{t('message')}</label>
                  <textarea className="form-textarea" rows={5} placeholder="…"
                    value={msgBody} onChange={e => setMsgBody(e.target.value)} maxLength={1000} />
                  <div style={{ fontSize: 11, color: 'var(--text-sub)', textAlign: 'right', marginTop: 3 }}>{msgBody.length}/1000</div>
                </div>
                {msgError && <div style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.22)', borderRadius: 9, padding: '10px 14px', fontSize: 13, color: '#dc2626', marginBottom: 8 }}>⚠ {msgError}</div>}
                {msgResult && <div style={{ background: 'rgba(5,150,105,0.08)', border: '1px solid rgba(5,150,105,0.22)', borderRadius: 9, padding: '10px 14px', fontSize: 13, color: '#059669', marginBottom: 8 }}>✅ {t('sentSuccess')}</div>}
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setModal(null)}>{t('cancel')}</button>
                <button className="btn btn-primary" onClick={() => sendMsg('EMAIL')} disabled={msgSending}>
                  {msgSending ? t('sending') : t('sendEmail')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── SMS Modal ── */}
        {modal === 'sms' && selected && (
          <div className="modal-overlay">
            <div className="modal">
              <div className="modal-header">
                <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0284c7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                  {t('smsTo')} {selected.name}
                </h2>
                <button className="modal-close" onClick={() => setModal(null)}>✕</button>
              </div>
              <div className="modal-body">
                {!notifConfig.smsEnabled && (
                  <div style={{ background: 'rgba(234,88,12,0.08)', border: '1px solid rgba(234,88,12,0.22)', borderRadius: 9, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: '#c84008' }}>
                    ⚙️ {t('smsNotConfigured')}
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label">{t('to')}</label>
                  <input className="form-input" value={selected.phone || ''} disabled style={{ opacity: 0.7 }} />
                </div>
                <div className="form-group">
                  <label className="form-label">{t('message')}</label>
                  <textarea className="form-textarea" rows={4} placeholder="…"
                    value={msgBody} onChange={e => setMsgBody(e.target.value)} maxLength={160} />
                  <div style={{ fontSize: 11, color: 'var(--text-sub)', textAlign: 'right', marginTop: 3 }}>{msgBody.length}/160</div>
                </div>
                {msgError && <div style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.22)', borderRadius: 9, padding: '10px 14px', fontSize: 13, color: '#dc2626', marginBottom: 8 }}>⚠ {msgError}</div>}
                {msgResult && <div style={{ background: 'rgba(5,150,105,0.08)', border: '1px solid rgba(5,150,105,0.22)', borderRadius: 9, padding: '10px 14px', fontSize: 13, color: '#059669', marginBottom: 8 }}>✅ {t('sentSuccess')}</div>}
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setModal(null)}>{t('cancel')}</button>
                <button className="btn btn-primary" onClick={() => sendMsg('SMS')} disabled={msgSending}>
                  {msgSending ? t('sending') : t('sendSms')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Broadcast Modal ── */}
        {modal === 'broadcast' && (
          <div className="modal-overlay">
            <div className="modal modal-lg">
              <div className="modal-header">
                <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--rose)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
                  </svg>
                  {t('broadcastMessage')}
                </h2>
                <button className="modal-close" onClick={() => setModal(null)}>✕</button>
              </div>
              <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: 20 }}>
                {/* Left: recipient picker */}
                <div>
                  <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 10 }}>{t('selectRecipients')}</div>
                  <div className="search-wrap" style={{ marginBottom: 10 }}>
                    <span className="search-icon"><Icon name="search" size={15} /></span>
                    <input className="search-input" style={{ minWidth: 0 }} placeholder={t('searchClients')}
                      value={broadcastSearch} onChange={e => setBroadcastSearch(e.target.value)} />
                  </div>
                  <div style={{ fontSize: 12, color: broadcastSel.size === 0 ? 'var(--rose)' : 'var(--text-muted)', fontWeight: 600, marginBottom: 6 }}>
                    {broadcastSel.size === 0 ? `${t('allCustomersLabel')} (${customers.length})` : `${broadcastSel.size} ${t('nSelected')}`}
                    {broadcastSel.size > 0 && (
                      <button onClick={() => setBroadcastSel(new Set())} style={{ marginLeft: 8, background: 'rgba(var(--rose-rgb),0.10)', border: 'none', borderRadius: 5, padding: '2px 8px', fontSize: 11, color: 'var(--rose)', cursor: 'pointer', fontFamily: 'var(--font)', fontWeight: 700 }}>{t('clearSelection')}</button>
                    )}
                  </div>
                  <div style={{ maxHeight: 260, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {customers.filter(c => !broadcastSearch || c.name.toLowerCase().includes(broadcastSearch.toLowerCase()) || (c.phone || '').includes(broadcastSearch)).map(c => {
                      const checked = broadcastSel.has(c.id);
                      return (
                        <div key={c.id} onClick={() => setBroadcastSel(prev => { const n = new Set(prev); n.has(c.id) ? n.delete(c.id) : n.add(c.id); return n; })}
                          style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 10px', borderRadius: 8, cursor: 'pointer', background: checked ? 'rgba(var(--rose-rgb),0.08)' : 'transparent', transition: 'background 0.12s' }}>
                          <div style={{ width: 16, height: 16, borderRadius: 4, flexShrink: 0, border: `2px solid ${checked ? 'var(--rose)' : 'rgba(0,0,0,0.18)'}`, background: checked ? 'var(--rose)' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.12s' }}>
                            {checked && <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round"><path d="M20 6 9 17l-5-5"/></svg>}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{c.name}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-sub)' }}>{c.phone}{c.email ? ` · ${c.email}` : ''}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                {/* Right: compose */}
                <div>
                  <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 10 }}>{t('compose')}</div>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                    {['EMAIL', 'SMS'].map(ch => (
                      <button key={ch} onClick={() => setMsgChannels(prev => prev.includes(ch) ? prev.filter(c => c !== ch) : [...prev, ch])}
                        disabled={ch === 'EMAIL' ? !notifConfig.emailEnabled : !notifConfig.smsEnabled}
                        style={{ flex: 1, padding: '9px', borderRadius: 9, border: `2px solid ${msgChannels.includes(ch) ? 'rgba(var(--rose-rgb),0.55)' : 'rgba(0,0,0,0.09)'}`, background: msgChannels.includes(ch) ? 'rgba(var(--rose-rgb),0.10)' : 'rgba(0,0,0,0.02)', color: msgChannels.includes(ch) ? 'var(--rose)' : 'var(--text-muted)', fontFamily: 'var(--font)', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: (ch === 'EMAIL' ? !notifConfig.emailEnabled : !notifConfig.smsEnabled) ? 0.4 : 1, transition: 'all 0.14s' }}>
                        {ch === 'EMAIL' ? `✉️ ${t('sendEmail')}` : `📱 ${t('sendSms')}`}
                      </button>
                    ))}
                  </div>
                  {msgChannels.includes('EMAIL') && (
                    <div className="form-group">
                      <label className="form-label">{t('subject')}</label>
                      <input className="form-input" placeholder="Message from Nexora Care"
                        value={msgSubject} onChange={e => setMsgSubject(e.target.value)} maxLength={120} />
                    </div>
                  )}
                  <div className="form-group">
                    <label className="form-label">{t('message')}</label>
                    <textarea className="form-textarea" rows={5} placeholder={`${t('message')}…`}
                      value={msgBody} onChange={e => setMsgBody(e.target.value)} maxLength={1000} />
                    <div style={{ fontSize: 11, color: 'var(--text-sub)', textAlign: 'right', marginTop: 3 }}>{msgBody.length}/1000</div>
                  </div>
                  {msgError && <div style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.22)', borderRadius: 9, padding: '10px 14px', fontSize: 13, color: '#dc2626', marginBottom: 8 }}>⚠ {msgError}</div>}
                  {msgResult && (
                    <div style={{ background: 'rgba(5,150,105,0.08)', border: '1px solid rgba(5,150,105,0.22)', borderRadius: 9, padding: '10px 14px', fontSize: 13, color: '#059669', marginBottom: 8, lineHeight: 1.8 }}>
                      ✅ {t('sentSuccess')}{msgResult.smsSent ? <> · <strong>{msgResult.smsSent}</strong> {t('smsDelivered')}</> : ''}{msgResult.emailSent ? <> · <strong>{msgResult.emailSent}</strong> {t('emailsDelivered')}</> : ''}
                    </div>
                  )}
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setModal(null)}>{t('close')}</button>
                <button className="btn btn-primary" onClick={handleBroadcast} disabled={msgSending || msgChannels.length === 0}>
                  {msgSending ? t('sending') : `${t('sendTo')} ${broadcastSel.size === 0 ? `${t('allOf')} ${customers.length}` : broadcastSel.size} ${t('customers').toLowerCase()}`}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* ── Active Call Widget ── */}
      {callStatus !== 'idle' && callCustomer && (
        <div className="call-widget-mobile" style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
          background: callStatus === 'in-call' ? 'linear-gradient(135deg,#059669,#047857)' : 'linear-gradient(135deg,#1a1a2e,#16213e)',
          borderRadius: 20, padding: '18px 22px', minWidth: 260,
          boxShadow: '0 12px 48px rgba(0,0,0,0.35)',
          color: '#fff', fontFamily: 'var(--font)',
          animation: 'slideUp 0.25s ease',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700 }}>
              {callCustomer.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{callCustomer.name}</div>
              <div style={{ fontSize: 12, opacity: 0.75 }}>{callCustomer.phone}</div>
            </div>
          </div>
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 4 }}>
              {callStatus === 'connecting' && `📡 ${t('callConnecting')}`}
              {callStatus === 'ringing' && `🔔 ${t('callRinging')}`}
              {callStatus === 'in-call' && `🟢 ${t('callOnCall')}`}
              {callStatus === 'ended' && `✅ ${t('callEnded')}`}
            </div>
            {callStatus === 'in-call' && (
              <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: 2, fontVariantNumeric: 'tabular-nums' }}>
                {String(Math.floor(callSeconds / 60)).padStart(2, '0')}:{String(callSeconds % 60).padStart(2, '0')}
              </div>
            )}
          </div>
          {(callStatus === 'connecting' || callStatus === 'ringing' || callStatus === 'in-call') && (
            <button
              onClick={() => endCall(callCustomer)}
              style={{ width: '100%', padding: '11px', borderRadius: 12, border: 'none', background: '#e53e5a', color: '#fff', fontFamily: 'var(--font)', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>
              {t('endCall')}
            </button>
          )}
        </div>
      )}
    </ProtectedRoute>
  );
}
