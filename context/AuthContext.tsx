'use client';

import { createContext, useContext, useEffect, useLayoutEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { AuthUser } from '@/types';
import { swrClear } from '@/lib/swrCache';

// useLayoutEffect on client (before paint = no flash), useEffect on server (SSR safe)
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

interface AuthContextValue {
  user: AuthUser | null;
  login: (user: AuthUser, remember?: boolean) => void;
  logout: () => void;
  updateUser: (data: Partial<AuthUser>) => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  login: () => {},
  logout: () => {},
  updateUser: () => {},
  isLoading: true,
});

function readStoredUser(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('nexora-user') || sessionStorage.getItem('nexora-user');
    if (!raw) return null;
    const parsed: AuthUser = JSON.parse(raw);
    if (parsed.token) {
      const payload = JSON.parse(atob(parsed.token.split('.')[1]));
      if (payload.exp && Date.now() / 1000 > payload.exp) {
        localStorage.removeItem('nexora-user');
        sessionStorage.removeItem('nexora-user');
        return null;
      }
    }
    return parsed;
  } catch { return null; }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Start null+loading=true on both server and client → no hydration mismatch.
  // useIsomorphicLayoutEffect runs before paint on the client: sets user from
  // localStorage and clears isLoading so ProtectedRoute never sees a false null.
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useIsomorphicLayoutEffect(() => {
    setUser(readStoredUser());
    setIsLoading(false);
  }, []);

  const login = useCallback((userData: AuthUser, remember = false) => {
    setUser(userData);
    if (remember) {
      localStorage.setItem('nexora-user', JSON.stringify(userData));
      sessionStorage.removeItem('nexora-user');
    } else {
      sessionStorage.setItem('nexora-user', JSON.stringify(userData));
      localStorage.removeItem('nexora-user');
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem('nexora-user');
    sessionStorage.removeItem('nexora-user');
    swrClear();
    router.push('/login');
  }, [router]);

  const updateUser = useCallback((data: Partial<AuthUser>) => {
    setUser(prev => {
      if (!prev) return prev;
      const updated = { ...prev, ...data };
      const stored = localStorage.getItem('nexora-user')
        ? localStorage
        : sessionStorage;
      stored.setItem('nexora-user', JSON.stringify(updated));
      return updated;
    });
  }, []);

  // When the device comes back online or the tab regains focus, validate the
  // stored token against the server. If the password was changed on another
  // device, tokenVersion will have been incremented and the server returns 401.
  useEffect(() => {
    if (!user?.token) return;
    const validate = async () => {
      if (typeof navigator === 'undefined' || !navigator.onLine) return;
      try {
        const res = await fetch('/api/auth/profile', {
          headers: { Authorization: `Bearer ${user.token}` },
        });
        if (res.status === 401) {
          localStorage.removeItem('nexora-user');
          sessionStorage.removeItem('nexora-user');
          setUser(null);
          swrClear();
          // Store a reason so the login page can show a helpful message
          sessionStorage.setItem('nexora-logout-reason', 'password_changed');
          router.push('/login');
        }
      } catch { /* offline — skip */ }
    };
    window.addEventListener('online', validate);
    window.addEventListener('focus', validate);
    return () => {
      window.removeEventListener('online', validate);
      window.removeEventListener('focus', validate);
    };
  }, [user?.token, router]);

  return (
    <AuthContext.Provider value={{ user, login, logout, updateUser, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
