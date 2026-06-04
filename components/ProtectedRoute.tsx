'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { usePermissions, type PermissionKey } from '@/context/PermissionsContext';
import { useLanguage } from '@/context/LanguageContext';

interface Props {
  children: React.ReactNode;
  adminOnly?: boolean;
  roles?: string[];
  permKey?: PermissionKey;
  /** OR logic – access granted if user has ANY of these keys */
  permKeys?: PermissionKey[];
}

export default function ProtectedRoute({ children, adminOnly = false, roles, permKey, permKeys }: Props) {
  const { user, isLoading } = useAuth();
  const { canDo, loading: permLoading, initialized: permInitialized } = usePermissions();
  const { isRTL } = useLanguage();
  const router = useRouter();

  const checkAccess = (canDoFn: (k: PermissionKey) => boolean) => {
    // roles is always a hard gate first
    const roleAllowed = roles ? roles.includes(user!.role) : (!adminOnly || user!.role === 'ADMIN');
    if (!roleAllowed) return false;
    if (permKeys && permKeys.length > 0) return permKeys.some(k => canDoFn(k));
    if (permKey) return canDoFn(permKey);
    return true;
  };

  // Redirect to login when unauthenticated; redirect to home page when access is denied.
  useEffect(() => {
    if (isLoading || (permLoading && !permInitialized)) return;
    if (!user) { router.replace('/login'); return; }
    if (!checkAccess(canDo)) {
      router.replace(user.role === 'STAFF' ? '/customers' : '/dashboard');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isLoading, permLoading, permInitialized, adminOnly, roles, permKey, permKeys, router, canDo]);

  // Only block on auth loading (reading localStorage) — never block on permissions
  // loading after first init, as that caused a full-screen spinner on every navigation.
  if (isLoading) return null;
  if (!user) return null;
  // While permissions are still loading use DEFAULT_PERMISSIONS (already the initial state).
  // The redirect effect above will correct access once permissions resolve.
  if (permInitialized && !checkAccess(canDo)) return null;

  return <>{children}</>;
}
