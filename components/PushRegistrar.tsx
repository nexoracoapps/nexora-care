'use client';

import { usePushNotifications } from '@/hooks/usePushNotifications';

/** Invisible component — registers service worker + push subscription once logged in */
export default function PushRegistrar() {
  usePushNotifications();
  return null;
}
