'use client';

/**
 * Patches window.fetch once so that ANY mutation (non-GET) that fails with a
 * network error throws a friendly Error instead of a raw TypeError.
 * Every existing catch block that does `toast.error(e.message)` will then
 * automatically show the right message in the user's language.
 *
 * Also handles unhandledrejection so pages that have no try/catch at all
 * (e.g. services/save, branches/save) still show a visible toast rather
 * than a silent failure.
 */

import { useEffect } from 'react';
import toast from 'react-hot-toast';
import { useLanguage } from '@/context/LanguageContext';

function offlineMsg(lang: string) {
  return lang === 'ar'
    ? 'لا يوجد اتصال بالإنترنت — يرجى الاتصال والمحاولة مجدداً'
    : "You're offline — reconnect and try again";
}

export default function OfflineGuard() {
  const { lang } = useLanguage();

  useEffect(() => {
    const original = window.fetch.bind(window);

    // Normalise network TypeErrors so every catch block sees a friendly message
    window.fetch = async function guardedFetch(input, init) {
      const method = ((init?.method) ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
      const isMutation = method !== 'GET';

      // Proactive: don't even attempt the call if already offline
      if (isMutation && !navigator.onLine) {
        throw Object.assign(new Error(offlineMsg(lang)), { offline: true });
      }

      try {
        return await original(input, init);
      } catch (err) {
        // Network-level failure → friendly error
        if (isMutation && err instanceof TypeError) {
          throw Object.assign(new Error(offlineMsg(lang)), { offline: true });
        }
        throw err;
      }
    };

    // Safety net: show a toast for any rejection that slipped through without a catch
    const handleUnhandled = (e: PromiseRejectionEvent) => {
      const err = e.reason;
      if (!err) return;
      const isOffline = (err as any)?.offline || (!navigator.onLine && err instanceof TypeError);
      const isFetchError = err instanceof TypeError && (err.message?.toLowerCase().includes('fetch') || err.message?.toLowerCase().includes('network'));
      if (isOffline || isFetchError) {
        e.preventDefault();
        toast.error(offlineMsg(lang), { id: 'offline-guard' });
      }
    };

    window.addEventListener('unhandledrejection', handleUnhandled);
    return () => {
      window.fetch = original;
      window.removeEventListener('unhandledrejection', handleUnhandled);
    };
  }, [lang]);

  return null;
}
