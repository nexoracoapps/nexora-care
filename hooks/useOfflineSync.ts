'use client';

import { useState, useEffect, useCallback } from 'react';
import { getAllQueued, dequeue, count } from '@/lib/offlineQueue';
import toast from 'react-hot-toast';

export function useOfflineSync() {
  const [isOnline, setIsOnline]       = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing]           = useState(false);

  const refreshCount = useCallback(async () => {
    if (typeof indexedDB === 'undefined') return;
    try { setPendingCount(await count()); } catch { /* ignore */ }
  }, []);

  const sync = useCallback(async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      const queued = await getAllQueued();
      if (queued.length === 0) { setSyncing(false); return; }
      window.dispatchEvent(new CustomEvent('nexora-sync-start'));
      let succeeded = 0;
      let failed    = 0;
      for (const item of queued) {
        try {
          const res = await fetch(item.url, {
            method:  item.method,
            headers: item.headers,
            body:    item.body,
          });
          if (res.ok || res.status < 500) {
            await dequeue(item.id);
            succeeded++;
          } else {
            failed++;
          }
        } catch {
          failed++;
        }
      }
      if (succeeded > 0) {
        toast.success(`✅ Synced ${succeeded} offline change${succeeded > 1 ? 's' : ''}`);
        window.dispatchEvent(new CustomEvent('nexora-sync-complete'));
      }
      if (failed > 0)    toast.error(`${failed} change${failed > 1 ? 's' : ''} could not sync — will retry`);
    } finally {
      setSyncing(false);
      await refreshCount();
    }
  }, [syncing, refreshCount]);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    refreshCount();

    const goOnline  = () => { setIsOnline(true);  sync(); };
    const goOffline = () => { setIsOnline(false); };

    window.addEventListener('online',  goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online',  goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, [refreshCount, sync]);

  return { isOnline, pendingCount, syncing, sync, refreshCount };
}
