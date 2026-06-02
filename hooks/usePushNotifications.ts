'use client';

import { useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

export function usePushNotifications() {
  const { user } = useAuth();
  const subscribedRef = useRef(false);

  useEffect(() => {
    if (!user?.token || subscribedRef.current) return;
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

    subscribedRef.current = true;

    const register = async () => {
      try {
        // 1. Register the service worker and check for updates
        const reg = await navigator.serviceWorker.register('/sw.js');
        reg.update().catch(() => {}); // force check for new SW version
        await navigator.serviceWorker.ready;

        // 2. Check existing subscription
        let sub = await reg.pushManager.getSubscription();

        // 3. If no subscription, request permission then subscribe
        if (!sub) {
          const perm = await Notification.requestPermission();
          if (perm !== 'granted') return;

          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
          });
        }

        // 4. Save subscription to our API
        await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${user.token}`,
          },
          body: JSON.stringify(sub.toJSON()),
        });
      } catch (err) {
        console.warn('[Push] Registration failed:', err);
      }
    };

    register();
  }, [user?.token]);
}
