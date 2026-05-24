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
}

export default function ProtectedRoute({ children, adminOnly = false, roles, permKey }: Props) {
  const { user, isLoading } = useAuth();
  const { canDo, loading: permLoading, initialized: permInitialized } = usePermissions();
  const { isRTL } = useLanguage();
  const router = useRouter();

  // Redirect to login when unauthenticated; redirect to home page when access is denied.
  useEffect(() => {
    if (isLoading || (permLoading && !permInitialized)) return;
    if (!user) { router.replace('/login'); return; }
    const roleAllowed = roles ? roles.includes(user.role) : (!adminOnly || user.role === 'ADMIN');
    const hasAccess = permKey ? canDo(permKey) : roleAllowed;
    if (!hasAccess) {
      router.replace(user.role === 'STAFF' ? '/customers' : '/dashboard');
    }
  }, [user, isLoading, permLoading, permInitialized, adminOnly, roles, permKey, router, canDo]);

  if (isLoading || (permLoading && !permInitialized)) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div className="spin" style={{ fontSize: '2rem' }}>⟳</div>
      </div>
    );
  }

  if (!user) return null;

  const roleAllowed = roles ? roles.includes(user.role) : (!adminOnly || user.role === 'ADMIN');
  const hasAccess = permKey ? canDo(permKey) : roleAllowed;

  if (!hasAccess) return null;

  return <>{children}</>;
}
