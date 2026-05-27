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
    const roleAllowed = roles ? roles.includes(user!.role) : (!adminOnly || user!.role === 'ADMIN');
    if (permKeys && permKeys.length > 0) return permKeys.some(k => canDoFn(k));
    if (permKey) return canDoFn(permKey);
    return roleAllowed;
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

  if (isLoading || (permLoading && !permInitialized)) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div className="spin" style={{ fontSize: '2rem' }}>⟳</div>
      </div>
    );
  }

  if (!user) return null;
  if (!checkAccess(canDo)) return null;

  return <>{children}</>;
}
