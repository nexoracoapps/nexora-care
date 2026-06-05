'use client';

import { createContext, useContext, useEffect, useLayoutEffect, useState, useCallback, useMemo } from 'react';
import { useAuth } from './AuthContext';
import {
  DEFAULT_PERMISSIONS,
  type AllPermissions,
  type PermissionKey,
} from '@/lib/permissions';

// Re-export types so existing imports from this file keep working
export type { AllPermissions, PermissionKey };
export { DEFAULT_PERMISSIONS as DEFAULT };

// Same pattern as AuthContext — layoutEffect on client (before paint), effect on server (SSR-safe)
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

const CACHE_KEY = 'nexora-permissions-cache';

function readCached(): AllPermissions {
  if (typeof window === 'undefined') return DEFAULT_PERMISSIONS;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return DEFAULT_PERMISSIONS;
}

interface PermissionsContextValue {
  permissions: AllPermissions;
  canDo: (action: PermissionKey) => boolean;
  loading: boolean;
  initialized: boolean;
  reload: () => void;
}

const PermissionsContext = createContext<PermissionsContextValue>({
  permissions: DEFAULT_PERMISSIONS,
  canDo: () => false,
  loading: true,
  initialized: false,
  reload: () => {},
});

export function PermissionsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const token = user?.token ?? null;

  // Start with DEFAULT_PERMISSIONS so server-render and initial client-render match
  // (avoids React hydration mismatch). useIsomorphicLayoutEffect immediately replaces
  // this with the localStorage cache before the first paint — the sidebar never flashes
  // "all items → fewer items" that occurred when DEFAULT differed from DB permissions.
  const [permissions, setPermissions] = useState<AllPermissions>(DEFAULT_PERMISSIONS);
  const [loading, setLoading]         = useState(false);
  const [initialized, setInitialized] = useState(true);

  // Runs synchronously before the first paint on the client. If the user has logged in
  // before, cached DB permissions are applied immediately so the first visual render
  // shows the correct nav items with zero flash.
  useIsomorphicLayoutEffect(() => {
    setPermissions(readCached());
  }, []);

  const fetchAndApply = useCallback(async (authToken: string) => {
    try {
      const res = await fetch('/api/permissions', {
        headers: { Authorization: `Bearer ${authToken}` },
        cache: 'no-store',
      });
      if (res.ok) {
        const data: AllPermissions = await res.json();
        setPermissions(data);
        // Update cache so the next page load renders with correct permissions immediately.
        try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch {}
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (!token) {
      setInitialized(false);
      setPermissions(DEFAULT_PERMISSIONS);
      // Clear cache on logout so a different user starts fresh.
      try { localStorage.removeItem(CACHE_KEY); } catch {}
      return;
    }
    fetchAndApply(token).finally(() => setInitialized(true));
  }, [token, fetchAndApply]);

  // Re-fetch when the window regains focus (e.g. admin changed permissions in another tab).
  useEffect(() => {
    const onFocus = () => { if (token) fetchAndApply(token); };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [token, fetchAndApply]);

  const canDo = useCallback((action: PermissionKey): boolean => {
    if (!user) return false;
    const role = user.role ?? 'STAFF';
    if (role === 'ADMIN') return true;
    return permissions[role]?.[action] ?? false;
  }, [user, permissions]);

  const reload = useCallback(() => { if (token) fetchAndApply(token); }, [token, fetchAndApply]);

  const value = useMemo(
    () => ({ permissions, canDo, loading, initialized, reload }),
    [permissions, canDo, loading, initialized, reload]
  );

  return (
    <PermissionsContext.Provider value={value}>
      {children}
    </PermissionsContext.Provider>
  );
}

export const usePermissions = () => useContext(PermissionsContext);
