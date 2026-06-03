'use client';

import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { useAuth } from './AuthContext';
import {
  DEFAULT_PERMISSIONS,
  type AllPermissions,
  type PermissionKey,
} from '@/lib/permissions';

// Re-export types so existing imports from this file keep working
export type { AllPermissions, PermissionKey };
export { DEFAULT_PERMISSIONS as DEFAULT };

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

  const [permissions, setPermissions] = useState<AllPermissions>(DEFAULT_PERMISSIONS);
  // Start as initialized with default permissions so ProtectedRoute never blocks on loading.
  // The fetch below replaces defaults with DB-stored values silently in the background.
  const [loading, setLoading]         = useState(false);
  const [initialized, setInitialized] = useState(true);

  const fetchAndApply = async (authToken: string) => {
    try {
      const res = await fetch('/api/permissions', {
        headers: { Authorization: `Bearer ${authToken}` },
        cache: 'no-store',
      });
      if (res.ok) setPermissions(await res.json());
    } catch {}
  };

  useEffect(() => {
    if (!token) { setInitialized(false); setPermissions(DEFAULT_PERMISSIONS); return; }
    fetchAndApply(token).finally(() => setInitialized(true));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Re-sync permissions when window regains focus on a different page
  // (removed per-navigation refetch — it caused unnecessary re-renders on every nav)

  useEffect(() => {
    const onFocus = () => { if (token) fetchAndApply(token); };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const canDo = useCallback((action: PermissionKey): boolean => {
    if (!user) return false;
    const role = user.role ?? 'STAFF';
    if (role === 'ADMIN') return true;
    return permissions[role]?.[action] ?? false;
  }, [user, permissions]);

  const reload = useCallback(() => { if (token) fetchAndApply(token); }, [token]);

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
