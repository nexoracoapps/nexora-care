'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
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
  const pathname = usePathname();

  const [permissions, setPermissions] = useState<AllPermissions>(DEFAULT_PERMISSIONS);
  const [loading, setLoading]       = useState(true);
  const [initialized, setInitialized] = useState(false);

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
    if (!token) { setInitialized(false); setLoading(true); return; }
    setLoading(true);
    fetchAndApply(token).finally(() => { setLoading(false); setInitialized(true); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (token && initialized) fetchAndApply(token);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    const onFocus = () => { if (token) fetchAndApply(token); };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const canDo = (action: PermissionKey): boolean => {
    if (!user) return false;
    const role = user.role ?? 'STAFF';
    if (role === 'ADMIN') return true;
    return permissions[role]?.[action] ?? false;
  };

  const reload = () => { if (token) fetchAndApply(token); };

  return (
    <PermissionsContext.Provider value={{ permissions, canDo, loading, initialized, reload }}>
      {children}
    </PermissionsContext.Provider>
  );
}

export const usePermissions = () => useContext(PermissionsContext);
