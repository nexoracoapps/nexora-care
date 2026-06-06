'use client';

import { useEffect, useCallback } from 'react';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useAuth } from '@/context/AuthContext';
import { useBranch } from '@/context/BranchContext';
import { swrGet, swrSet } from '@/lib/swrCache';

const ALL_PAGES = [
  '/dashboard', '/appointments', '/customers', '/calendar',
  '/prescriptions', '/medicines', '/services', '/users',
  '/providers', '/branches', '/payments', '/reports',
  '/revenue', '/roles', '/permissions', '/staff-absence',
  '/backup', '/messages', '/call-logs', '/profile',
];

const CACHE_NAME = 'nexora-shell-v10';

// API endpoints to pre-warm so all pages work offline immediately after login
const STATIC_API = ['/api/services', '/api/medicines', '/api/permissions'];
const BRANCH_API  = ['/api/appointments', '/api/customers', '/api/providers', '/api/branches'];

export default function PushRegistrar() {
  usePushNotifications();
  const { user } = useAuth();
  const { activeBranchId } = useBranch();

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

  // Pre-warm SWR / API cache so data is available offline right after login
  const warmApiData = useCallback(() => {
    if (!user?.token) return;
    const auth = { Authorization: `Bearer ${user.token}` };
    const bq = activeBranchId ? `?branchId=${activeBranchId}` : '';
    const endpoints = [
      ...STATIC_API,
      ...BRANCH_API.map(e => `${e}${bq}`),
    ];
    endpoints.forEach(endpoint => {
      if (swrGet(endpoint)) return; // already cached — skip
      fetch(endpoint, { headers: auth })
        .then(res => { if (res.ok) return res.json(); })
        .then(data => { if (data) swrSet(endpoint, data); })
        .catch(() => {});
    });
  }, [user?.token, activeBranchId]);

  // Warm HTML shell + API data on login
  useEffect(() => {
    if (!user?.token) return;
    navigator.serviceWorker?.ready
      .then(() => { warmCache(); warmApiData(); })
      .catch(() => { warmCache(); warmApiData(); });
  }, [user?.token, warmCache, warmApiData]);

  // Re-warm after every SW update (fires on controllerchange)
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const handler = () => { setTimeout(() => { warmCache(); warmApiData(); }, 500); };
    navigator.serviceWorker.addEventListener('controllerchange', handler);
    return () => navigator.serviceWorker.removeEventListener('controllerchange', handler);
  }, [warmCache, warmApiData]);

  return null;
}
