'use client';

import { useState, useEffect, useCallback } from 'react';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { getAllQueued, type QueuedRequest } from '@/lib/offlineQueue';
import { useLanguage } from '@/context/LanguageContext';

function itemLabel(item: QueuedRequest, lang: string): string {
  try {
    const b = item.body ? JSON.parse(item.body) : {};
    if (item.url.includes('/actions')) {
      const en: Record<string, string> = {
        complete: 'Mark appointment complete', 'no-show': 'Mark as no-show',
        cancel: 'Cancel appointment', 'start-service': 'Start service',
        deliver: 'Service delivered', 'partial-deliver': 'Partial delivery',
        'not-deliver': 'Service not delivered',
        pay: b.amount ? `Record payment · ${b.amount}` : 'Record payment',
        unpay: 'Revert payment', reschedule: 'Reschedule appointment',
      };
      const ar: Record<string, string> = {
        complete: 'إكمال الموعد', 'no-show': 'تسجيل غياب',
        cancel: 'إلغاء الموعد', 'start-service': 'بدء الخدمة',
        deliver: 'تسليم الخدمة', 'partial-deliver': 'تسليم جزئي',
        'not-deliver': 'لم يتم التسليم',
        pay: b.amount ? `تسجيل دفعة · ${b.amount}` : 'تسجيل الدفع',
        unpay: 'التراجع عن الدفع', reschedule: 'إعادة جدولة الموعد',
      };
      return (lang === 'ar' ? ar : en)[b.action] ?? (lang === 'ar' ? 'تحديث موعد' : 'Update appointment');
    }
    if (item.url.includes('/whatsapp')) {
      return lang === 'ar' ? `واتساب ← ${b.phone ?? ''}` : `WhatsApp → ${b.phone ?? 'customer'}`;
    }
    return lang === 'ar' ? 'طلب معلّق' : 'Pending request';
  } catch { return lang === 'ar' ? 'تغيير معلّق' : 'Pending change'; }
}

function itemIcon(item: QueuedRequest): string {
  try {
    const b = item.body ? JSON.parse(item.body) : {};
    if (item.url.includes('/actions')) {
      return ({ complete: '✅', 'no-show': '⚠️', cancel: '⊘', 'start-service': '▶️',
        deliver: '📦', 'partial-deliver': '📦', 'not-deliver': '✗',
        pay: '💳', unpay: '↩', reschedule: '📅' } as Record<string, string>)[b.action] ?? '🔄';
    }
    if (item.url.includes('/whatsapp')) return '💬';
  } catch { /* */ }
  return '🔄';
}

export default function OfflineBanner() {
  const { isOnline, pendingCount, syncing, sync, refreshCount } = useOfflineSync();
  const { lang } = useLanguage();
  const isAr = lang === 'ar';

  const [expanded, setExpanded]         = useState(false);
  const [items, setItems]               = useState<QueuedRequest[]>([]);
  const [syncedItems, setSyncedItems]   = useState<QueuedRequest[]>([]);
  const [showConfirm, setShowConfirm]   = useState(false);

  const loadItems = useCallback(async () => {
    try { setItems(await getAllQueued()); } catch { /* ignore */ }
  }, []);

  // Refresh queue list whenever count changes or panel opens
  useEffect(() => { if (pendingCount > 0 || expanded) loadItems(); }, [pendingCount, expanded, loadItems]);

  // Capture items before sync so we can show the confirmation list
  useEffect(() => {
    const handleBefore = () => { loadItems().then(() => setItems(prev => { setSyncedItems(prev); return prev; })); };
    const handleDone = async () => {
      await refreshCount();
      setExpanded(false);
      setShowConfirm(true);
      setTimeout(() => setShowConfirm(false), 6000);
    };
    window.addEventListener('nexora-sync-start', handleBefore);
    window.addEventListener('nexora-sync-complete', handleDone);
    return () => {
      window.removeEventListener('nexora-sync-start', handleBefore);
      window.removeEventListener('nexora-sync-complete', handleDone);
    };
  }, [loadItems, refreshCount]);

  // Nothing to show
  if (isOnline && pendingCount === 0 && !showConfirm) return null;

  /* ── Sync confirmation overlay ── */
  if (showConfirm) {
    return (
      <div style={{
        position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
        zIndex: 9999, minWidth: 280, maxWidth: 360,
        background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.35)',
        borderRadius: 16, boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        backdropFilter: 'blur(14px)', padding: '16px 20px',
        animation: 'nexora-slide-up 0.3s ease',
      }}>
        <style>{`@keyframes nexora-slide-up{from{opacity:0;transform:translateX(-50%) translateY(16px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}`}</style>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: syncedItems.length > 0 ? 10 : 0 }}>
          <span style={{ fontSize: 20 }}>✅</span>
          <span style={{ fontWeight: 700, color: '#10b981', fontSize: '0.9rem' }}>
            {isAr ? 'تمت المزامنة بنجاح!' : 'All changes synced!'}
          </span>
          <button onClick={() => setShowConfirm(false)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#10b981', fontSize: 16, lineHeight: 1 }}>✕</button>
        </div>
        {syncedItems.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {syncedItems.map(item => (
              <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem', color: '#6ee7b7' }}>
                <span>{itemIcon(item)}</span>
                <span>{itemLabel(item, lang)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  /* ── Offline / pending banner ── */
  return (
    <>
      <style>{`@keyframes nexora-slide-up{from{opacity:0;transform:translateX(-50%) translateY(16px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}`}</style>

      {/* Queue list panel */}
      {expanded && items.length > 0 && (
        <div style={{
          position: 'fixed', bottom: 72, left: '50%', transform: 'translateX(-50%)',
          zIndex: 9998, minWidth: 280, maxWidth: 360,
          background: 'var(--bg-surface)', border: '1px solid var(--border)',
          borderRadius: 14, boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
          backdropFilter: 'blur(14px)', overflow: 'hidden',
          animation: 'nexora-slide-up 0.2s ease',
        }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--text)' }}>
              {isAr ? `التغييرات المعلّقة (${items.length})` : `Pending changes (${items.length})`}
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {isAr ? 'ستُرسل عند عودة الاتصال' : 'Will sync when online'}
            </span>
          </div>
          <div style={{ maxHeight: 220, overflowY: 'auto' }}>
            {items.map((item, i) => (
              <div key={item.id} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 16px',
                borderBottom: i < items.length - 1 ? '1px solid var(--border)' : 'none',
              }}>
                <span style={{ fontSize: 16, flexShrink: 0 }}>{itemIcon(item)}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {itemLabel(item, lang)}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 1 }}>
                    {new Date(item.timestamp).toLocaleTimeString(isAr ? 'ar-SA' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                <span style={{ fontSize: 11, color: '#f59e0b', fontWeight: 600, flexShrink: 0 }}>
                  {isAr ? 'معلّق' : 'queued'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bottom pill */}
      <div style={{
        position: 'fixed', bottom: 16, left: '50%', transform: 'translateX(-50%)',
        zIndex: 9999, display: 'flex', alignItems: 'center', gap: 8,
        padding: '9px 14px', borderRadius: 50, fontWeight: 600, fontSize: '0.82rem',
        boxShadow: '0 4px 20px rgba(0,0,0,0.35)', border: '1px solid',
        backdropFilter: 'blur(12px)', whiteSpace: 'nowrap',
        background: isOnline ? 'rgba(234,179,8,0.15)' : 'rgba(239,68,68,0.12)',
        borderColor: isOnline ? 'rgba(234,179,8,0.4)' : 'rgba(239,68,68,0.35)',
        color: isOnline ? '#fbbf24' : '#f87171',
        animation: 'nexora-slide-up 0.3s ease',
      }}>
        <span style={{ fontSize: 15 }}>{isOnline ? '🔄' : '📡'}</span>
        <span>
          {isOnline
            ? (isAr ? `${pendingCount} تغيير بانتظار المزامنة` : `${pendingCount} change${pendingCount !== 1 ? 's' : ''} pending sync`)
            : (isAr ? 'أنت غير متصل' : 'You\'re offline')}
          {pendingCount > 0 && !isOnline && (
            <span style={{ opacity: 0.75 }}> · {isAr ? `${pendingCount} محفوظ` : `${pendingCount} saved`}</span>
          )}
        </span>

        {/* View / hide queue list */}
        {pendingCount > 0 && (
          <button
            onClick={() => setExpanded(v => !v)}
            style={{
              background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: 20, padding: '2px 10px', cursor: 'pointer',
              color: 'inherit', fontWeight: 700, fontSize: '0.75rem',
              display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            {expanded
              ? (isAr ? '▲ إخفاء' : '▲ Hide')
              : (isAr ? '▼ عرض' : '▼ View')}
          </button>
        )}

        {/* Manual sync (only when online) */}
        {isOnline && pendingCount > 0 && (
          <button
            onClick={sync}
            disabled={syncing}
            style={{
              background: 'rgba(234,179,8,0.25)', border: '1px solid rgba(234,179,8,0.4)',
              borderRadius: 20, padding: '2px 12px', cursor: 'pointer',
              color: '#fbbf24', fontWeight: 700, fontSize: '0.75rem',
            }}
          >
            {syncing ? (isAr ? '⏳ جارٍ…' : '⏳ Syncing…') : (isAr ? 'مزامنة الآن' : 'Sync now')}
          </button>
        )}
      </div>
    </>
  );
}
