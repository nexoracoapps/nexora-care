'use client';

import { useEffect, useState } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { useBranch } from '@/context/BranchContext';
import { usePermissions } from '@/context/PermissionsContext';
import type { Customer } from '@/types';

interface NotifConfig { smsEnabled: boolean; emailEnabled: boolean; }
interface BroadcastResult { emailSent: number; emailFailed: number; smsSent: number; smsFailed: number; }

export default function MessagesPage() {
  const { user } = useAuth();
  const { lang } = useLanguage();
  const { activeBranchId } = useBranch();
  const { canDo } = usePermissions();
  const isAr = lang === 'ar';

  const [customers,  setCustomers]  = useState<Customer[]>([]);
  const [config,     setConfig]     = useState<NotifConfig>({ smsEnabled: false, emailEnabled: false });
  const [selected,   setSelected]   = useState<Set<string>>(new Set());
  const [search,     setSearch]     = useState('');
  const [channels,   setChannels]   = useState<string[]>(['EMAIL']);
  const [subject,    setSubject]    = useState('');
  const [message,    setMessage]    = useState('');
  const [sending,    setSending]    = useState(false);
  const [result,     setResult]     = useState<BroadcastResult | null>(null);
  const [error,      setError]      = useState('');

  useEffect(() => {
    if (!user?.token) return;
    const headers = { Authorization: `Bearer ${user.token}` };
    const bq = activeBranchId ? `?branchId=${activeBranchId}` : '';
    fetch(`/api/customers${bq}`, { headers })
      .then(r => r.json())
      .then(d => setCustomers(Array.isArray(d) ? d : (d.items ?? [])))
      .catch(() => {});
    fetch('/api/notifications/config', { headers })
      .then(r => r.json())
      .then(d => setConfig(d))
      .catch(() => {});
  }, [user, activeBranchId]);

  const filtered = customers.filter(c =>
    (c.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (c.phone || '').includes(search) ||
    (c.email || '').toLowerCase().includes(search.toLowerCase())
  );

  const toggleCustomer = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected(prev => prev.size === customers.length ? new Set() : new Set(customers.map(c => c.id)));
  };

  const toggleChannel = (ch: string) => {
    setChannels(prev => prev.includes(ch) ? prev.filter(c => c !== ch) : [...prev, ch]);
  };

  const recipientCount = selected.size === 0 ? customers.length : selected.size;

  const handleSend = async () => {
    if (!message.trim()) { setError(isAr ? 'الرسالة مطلوبة' : 'Message is required.'); return; }
    if (channels.length === 0) { setError(isAr ? 'اختر قناة إرسال واحدة على الأقل' : 'Select at least one channel.'); return; }
    setSending(true); setError(''); setResult(null);
    try {
      const res = await fetch('/api/notifications/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user?.token}` },
        body: JSON.stringify({
          customerIds: selected.size > 0 ? [...selected] : [],
          channels,
          subject: subject || 'Message from Nexora Care',
          message,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message || (isAr ? 'فشل الإرسال' : 'Send failed.')); return; }
      setResult(data);
      setMessage(''); setSubject('');
    } catch {
      setError(isAr ? 'فشل الإرسال' : 'Send failed.');
    } finally {
      setSending(false);
    }
  };

  return (
    <ProtectedRoute roles={['ADMIN','MANAGER']} permKey="sendBroadcasts">
      <>
        <style dangerouslySetInnerHTML={{ __html: `
          .msg-wrap { max-width: 900px; }
          .msg-title {
            font-size: 22px; font-weight: 700; letter-spacing: -0.4px;
            background: var(--grad); -webkit-background-clip: text; -webkit-text-fill-color: transparent;
            margin-bottom: 4px;
          }
          .msg-sub { font-size: 13px; color: var(--text-sub); margin-bottom: 28px; }
          .msg-grid { display: grid; grid-template-columns: 1fr 1.4fr; gap: 20px; }
          @media (max-width: 800px) { .msg-grid { grid-template-columns: 1fr; } }
          .msg-card {
            background: #ffffff; border: 1px solid rgba(0,0,0,0.09);
            border-radius: 14px; padding: 22px; box-shadow: 0 2px 12px rgba(0,0,0,0.06);
          }
          .msg-card-title {
            font-size: 11px; font-weight: 700; text-transform: uppercase;
            letter-spacing: 1.1px; color: var(--text-muted);
            margin-bottom: 16px; display: flex; align-items: center; gap: 8px;
          }
          .msg-card-title::after { content: ''; flex: 1; height: 1px; background: rgba(0,0,0,0.07); }
          .msg-search {
            display: flex; align-items: center; gap: 8px;
            border: 1.5px solid rgba(0,0,0,0.09); border-radius: 9px;
            padding: 8px 12px; margin-bottom: 10px; background: rgba(0,0,0,0.02);
          }
          .msg-search input { border: none; background: none; outline: none; font-family: var(--font); font-size: 13.5px; color: var(--text); flex: 1; }
          .msg-search input::placeholder { color: var(--text-sub); }
          .msg-select-all {
            display: flex; align-items: center; justify-content: space-between;
            padding: 8px 4px; margin-bottom: 6px; font-size: 12px; font-weight: 600; color: var(--text-muted); cursor: pointer;
          }
          .msg-select-all button {
            background: rgba(var(--rose-rgb),0.08); border: none; cursor: pointer; font-size: 11.5px;
            font-weight: 700; color: var(--rose); font-family: var(--font);
            padding: 3px 8px; border-radius: 6px;
          }
          .msg-cust-list { max-height: 340px; overflow-y: auto; }
          .msg-cust-item { display: flex; align-items: center; gap: 10px; padding: 9px 10px; border-radius: 9px; cursor: pointer; transition: background 0.12s; }
          .msg-cust-item:hover { background: rgba(0,0,0,0.03); }
          .msg-cust-cb {
            width: 17px; height: 17px; border-radius: 5px; flex-shrink: 0;
            border: 2px solid rgba(0,0,0,0.15); background: #fff;
            display: flex; align-items: center; justify-content: center; transition: all 0.12s;
          }
          .msg-cust-cb.on { background: var(--rose); border-color: var(--rose); }
          .msg-cust-name { font-size: 13px; font-weight: 600; color: var(--text); }
          .msg-cust-meta { font-size: 11.5px; color: var(--text-sub); margin-top: 1px; }
          .msg-channels { display: flex; gap: 10px; margin-bottom: 16px; }
          .msg-ch-btn {
            flex: 1; display: flex; align-items: center; justify-content: center; gap: 7px;
            padding: 10px 8px; border-radius: 10px; cursor: pointer; border: 2px solid rgba(0,0,0,0.09);
            background: rgba(0,0,0,0.02); color: var(--text-muted);
            font-family: var(--font); font-size: 13px; font-weight: 600; transition: all 0.14s;
          }
          .msg-ch-btn.on { border-color: rgba(var(--rose-rgb),0.55); background: rgba(var(--rose-rgb),0.10); color: var(--rose); }
          .msg-ch-btn:disabled { opacity: 0.4; cursor: not-allowed; }
          .msg-field { margin-bottom: 14px; }
          .msg-label { display: block; font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.9px; color: var(--text-muted); margin-bottom: 6px; }
          .msg-input, .msg-textarea {
            width: 100%; box-sizing: border-box;
            background: rgba(0,0,0,0.02); border: 1.5px solid rgba(0,0,0,0.09);
            border-radius: 9px; padding: 10px 13px;
            font-family: var(--font); font-size: 13.5px; color: var(--text);
            outline: none; transition: border-color 0.15s, box-shadow 0.15s; resize: none;
          }
          .msg-input:focus, .msg-textarea:focus {
            border-color: var(--rose); box-shadow: 0 0 0 3px rgba(var(--rose-rgb),0.12); background: #fff;
          }
          .msg-textarea { height: 130px; line-height: 1.65; }
          .msg-count { font-size: 11px; color: var(--text-sub); text-align: right; margin-top: 4px; }
          .msg-send-btn {
            width: 100%; padding: 13px 20px; border: none; border-radius: 10px;
            background: var(--grad); color: #fff; font-family: var(--font); font-size: 14px; font-weight: 700;
            cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;
            box-shadow: 0 4px 18px rgba(var(--rose-rgb),0.28);
            transition: opacity 0.15s, transform 0.12s; margin-top: 4px;
          }
          .msg-send-btn:hover:not(:disabled) { opacity: 0.9; transform: translateY(-1px); }
          .msg-send-btn:disabled { opacity: 0.5; cursor: not-allowed; }
          .msg-notice { padding: 10px 14px; border-radius: 9px; font-size: 13px; font-weight: 500; margin-bottom: 14px; }
          .msg-notice.warn { background: rgba(234,88,12,0.08); border: 1px solid rgba(234,88,12,0.22); color: #c84008; }
          .msg-notice.err  { background: rgba(220,38,38,0.08); border: 1px solid rgba(220,38,38,0.22); color: #dc2626; }
          .msg-result {
            background: rgba(5,150,105,0.08); border: 1px solid rgba(5,150,105,0.22);
            border-radius: 10px; padding: 14px 16px; margin-bottom: 14px;
            font-size: 13px; color: #059669; line-height: 1.8;
          }
          .msg-result strong { font-weight: 700; }
        ` }} />

        <div className="msg-wrap">
          <div className="msg-title">📨 {isAr ? 'رسائل العملاء' : 'Customer Messages'}</div>
          <div className="msg-sub">
            {isAr ? 'أرسل رسائل SMS أو بريد إلكتروني لعملائك مباشرة من هنا' : 'Send SMS or email messages directly to your customers'}
          </div>

          <div className="msg-grid">
            {/* Left: Customer list */}
            <div className="msg-card">
              <div className="msg-card-title">{isAr ? 'اختر المستلمين' : 'Select Recipients'}</div>

              <div className="msg-search">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                <input
                  placeholder={isAr ? 'بحث…' : 'Search customers…'}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>

              <div className="msg-select-all">
                <span style={{ color: selected.size === 0 ? 'var(--rose)' : 'var(--text-muted)', fontWeight: selected.size === 0 ? 700 : 500 }}>
                  {selected.size === 0
                    ? (isAr ? `جميع العملاء (${customers.length})` : `All customers (${customers.length})`)
                    : (isAr ? `${selected.size} محدد` : `${selected.size} selected`)}
                </span>
                <button onClick={toggleAll}>
                  {selected.size === 0 ? (isAr ? 'تحديد كل' : 'Select all') : (isAr ? 'إلغاء الكل' : 'Clear all')}
                </button>
              </div>

              <div className="msg-cust-list">
                {filtered.map(c => {
                  const checked = selected.has(c.id);
                  return (
                    <div key={c.id} className="msg-cust-item" onClick={() => toggleCustomer(c.id)}>
                      <div className={`msg-cust-cb${checked ? ' on' : ''}`}>
                        {checked && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round"><path d="M20 6 9 17l-5-5"/></svg>}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="msg-cust-name">{c.name}</div>
                        <div className="msg-cust-meta">{c.phone}{c.email ? ` · ${c.email}` : ''}</div>
                      </div>
                      {!c.email && channels.includes('EMAIL') && (
                        <span title={isAr ? 'لا يوجد بريد إلكتروني' : 'No email'} style={{ fontSize: 11, color: '#f59e0b' }}>⚠</span>
                      )}
                    </div>
                  );
                })}
                {filtered.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '28px 0', color: 'var(--text-sub)', fontSize: 13 }}>
                    {isAr ? 'لا نتائج' : 'No customers found'}
                  </div>
                )}
              </div>
            </div>

            {/* Right: Compose */}
            <div className="msg-card">
              <div className="msg-card-title">{isAr ? 'إنشاء الرسالة' : 'Compose Message'}</div>

              {/* Channel selector */}
              <div className="msg-field">
                <div className="msg-label">{isAr ? 'قناة الإرسال' : 'Send via'}</div>
                <div className="msg-channels">
                  <button
                    className={`msg-ch-btn${channels.includes('EMAIL') ? ' on' : ''}`}
                    onClick={() => toggleChannel('EMAIL')}
                    disabled={!config.emailEnabled}
                    title={!config.emailEnabled ? (isAr ? 'البريد غير مفعّل (SendGrid)' : 'Email not configured (SendGrid)') : ''}
                  >
                    ✉️ {isAr ? 'بريد إلكتروني' : 'Email'}
                  </button>
                  <button
                    className={`msg-ch-btn${channels.includes('SMS') ? ' on' : ''}`}
                    onClick={() => toggleChannel('SMS')}
                    disabled={!config.smsEnabled}
                    title={!config.smsEnabled ? (isAr ? 'SMS غير مفعّل (Twilio)' : 'SMS not configured (Twilio)') : ''}
                  >
                    📱 SMS
                  </button>
                </div>
                {!config.emailEnabled && !config.smsEnabled && (
                  <div className="msg-notice warn">
                    ⚙️ {isAr
                      ? 'لم يتم إعداد SendGrid أو Twilio. أضف مفاتيح API إلى ملف البيئة.'
                      : 'Neither SendGrid nor Twilio is configured. Add API keys to .env.local.'}
                  </div>
                )}
              </div>

              {/* Subject (email only) */}
              {channels.includes('EMAIL') && (
                <div className="msg-field">
                  <label className="msg-label">{isAr ? 'الموضوع' : 'Subject'}</label>
                  <input
                    className="msg-input"
                    placeholder={isAr ? 'رسالة من Nexora Care' : 'Message from Nexora Care'}
                    value={subject}
                    onChange={e => setSubject(e.target.value)}
                    maxLength={120}
                  />
                </div>
              )}

              {/* Message body */}
              <div className="msg-field">
                <label className="msg-label">{isAr ? 'نص الرسالة' : 'Message'}</label>
                <textarea
                  className="msg-textarea"
                  placeholder={isAr ? 'اكتب رسالتك هنا…' : 'Write your message here…'}
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  maxLength={1000}
                />
                <div className="msg-count">{message.length} / 1000</div>
              </div>

              {error && <div className="msg-notice err">⚠ {error}</div>}

              {result && (
                <div className="msg-result">
                  ✅ {isAr ? 'تم الإرسال!' : 'Sent!'}<br />
                  {result.smsSent > 0 && <><strong>{result.smsSent}</strong> {isAr ? 'SMS بنجاح' : 'SMS delivered'}<br /></>}
                  {result.smsFailed > 0 && <><strong>{result.smsFailed}</strong> {isAr ? 'SMS فشل' : 'SMS failed'}<br /></>}
                  {result.emailSent > 0 && <><strong>{result.emailSent}</strong> {isAr ? 'بريد أُرسل' : 'emails delivered'}<br /></>}
                  {result.emailFailed > 0 && <><strong>{result.emailFailed}</strong> {isAr ? 'بريد فشل (لا يوجد عنوان)' : 'emails failed (no address)'}</>}
                </div>
              )}

              <button
                className="msg-send-btn"
                onClick={handleSend}
                disabled={sending || (!config.emailEnabled && !config.smsEnabled) || !canDo('sendBroadcasts')}
              >
                {sending
                  ? <>{isAr ? 'جاري الإرسال…' : 'Sending…'}</>
                  : <>📨 {isAr ? `إرسال إلى ${recipientCount} عميل` : `Send to ${recipientCount} customer${recipientCount !== 1 ? 's' : ''}`}</>}
              </button>
            </div>
          </div>
        </div>
      </>
    </ProtectedRoute>
  );
}
