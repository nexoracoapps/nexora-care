'use client';

import { useOfflineSync } from '@/hooks/useOfflineSync';

export default function OfflineBanner() {
  const { isOnline, pendingCount, syncing, sync } = useOfflineSync();

  if (isOnline && pendingCount === 0) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: 16,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '10px 18px',
      borderRadius: 12,
      fontWeight: 600,
      fontSize: '0.85rem',
      boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
      border: '1px solid',
      backdropFilter: 'blur(12px)',
      background: isOnline ? 'rgba(234,179,8,0.15)' : 'rgba(239,68,68,0.15)',
      borderColor: isOnline ? 'rgba(234,179,8,0.4)' : 'rgba(239,68,68,0.4)',
      color: isOnline ? '#fbbf24' : '#f87171',
      whiteSpace: 'nowrap',
    }}>
      {isOnline ? (
        <>
          <span>🔄</span>
          <span>{pendingCount} change{pendingCount > 1 ? 's' : ''} pending sync</span>
          <button
            onClick={sync}
            disabled={syncing}
            style={{ marginLeft: 4, background: 'rgba(234,179,8,0.2)', border: '1px solid rgba(234,179,8,0.4)', borderRadius: 8, padding: '3px 10px', cursor: 'pointer', color: '#fbbf24', fontWeight: 700, fontSize: '0.82rem' }}
          >
            {syncing ? '⏳ Syncing…' : 'Sync now'}
          </button>
        </>
      ) : (
        <>
          <span>📡</span>
          <span>You&apos;re offline — changes will sync when back online</span>
          {pendingCount > 0 && <span style={{ opacity: 0.7 }}>({pendingCount} queued)</span>}
        </>
      )}
    </div>
  );
}
