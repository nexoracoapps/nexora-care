'use client';

import { useEffect, useCallback } from 'react';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useAuth } from '@/context/AuthContext';

const ALL_PAGES = [
  '/dashboard', '/appointments', '/customers', '/calendar',
  '/prescriptions', '/medicines', '/services', '/users',
  '/providers', '/branches', '/payments', '/reports',
  '/revenue', '/roles', '/permissions', '/staff-absence',
  '/backup', '/messages', '/call-logs', '/profile',
];

const CACHE_NAME = 'nexora-shell-v8';

export default function PushRegistrar() {
  usePushNotifications();
  const { user } = useAuth();

  const warmCache = useCallback(() => {
    if (!user?.token || !('serviceWorker' in navigator) || !('caches' in window)) return;
    caches.open(CACHE_NAME).then(cache => {
      ALL_PAGES.forEach(path => {
        fetch(path, { credentials: 'same-origin', headers: { Accept: 'text/html' } })
          .then(res => { if (res.ok) cache.put(path, res); })
          .catch(() => {});
      });
    }).catch(() => {});
  }, [user?.token]);

  // Warm cache on login
  useEffect(() => {
    if (!user?.token) return;
    navigator.serviceWorker?.ready.then(warmCache).catch(() => {});
  }, [user?.token, warmCache]);

  // Re-warm cache whenever a NEW service worker takes control
  // (fires after every SW update — ensures fresh cache after deployments)
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const handler = () => {
      // New SW activated — old cache was cleared, refill it
      setTimeout(warmCache, 500); // small delay for SW to finish activating
    };
    navigator.serviceWorker.addEventListener('controllerchange', handler);
    return () => navigator.serviceWorker.removeEventListener('controllerchange', handler);
  }, [warmCache]);

  return null;
}
