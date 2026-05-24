'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { AuthUser } from '@/types';

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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const raw =
      localStorage.getItem('nexora-user') ||
      sessionStorage.getItem('nexora-user');
    if (raw) {
      try {
        const parsed: AuthUser = JSON.parse(raw);
        // Check JWT expiry without a library: decode the payload
        if (parsed.token) {
          const payload = JSON.parse(atob(parsed.token.split('.')[1]));
          if (payload.exp && Date.now() / 1000 > payload.exp) {
            localStorage.removeItem('nexora-user');
            sessionStorage.removeItem('nexora-user');
          } else {
            setUser(parsed);
          }
        } else {
          setUser(parsed);
        }
      } catch { /* ignore */ }
    }
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

  return (
    <AuthContext.Provider value={{ user, login, logout, updateUser, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
