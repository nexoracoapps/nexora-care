'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import type { Branch } from '@/types';
import { useAuth } from './AuthContext';

interface BranchContextValue {
  branches: Branch[];
  activeBranchId: string | null;
  setActiveBranchId: (id: string | null) => void;
  activeBranch: Branch | null;
  refreshBranches: () => Promise<void>;
}

const BranchContext = createContext<BranchContextValue>({
  branches: [],
  activeBranchId: null,
  setActiveBranchId: () => {},
  activeBranch: null,
  refreshBranches: async () => {},
});

function resolveInitialBranch(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    // Read saved user to check role and branchId
    const raw = localStorage.getItem('nexora-user') || sessionStorage.getItem('nexora-user');
    const userData = raw ? JSON.parse(raw) : null;

    // STAFF always use their assigned branch — no choice
    if (userData?.role === 'STAFF') return userData.branchId ?? null;

    // Admin/Manager: use their saved branch choice
    const saved = localStorage.getItem('nexora-branch');
    if (!saved || saved === 'all') return null;
    return saved;
  } catch {
    return null;
  }
}

function loadCachedBranches(): Branch[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem('nexora-branches-cache');
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function BranchProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  // Seed from cache so the branch selector never flashes empty on navigation
  const [branches, setBranches] = useState<Branch[]>(loadCachedBranches);
  // Initialise synchronously so the very first page fetch uses the correct filter
  const [activeBranchId, setActiveBranchIdState] = useState<string | null>(resolveInitialBranch);

  const fetchBranches = async () => {
    if (!user?.token) return;
    try {
      const res = await fetch('/api/branches', {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      if (res.ok) {
        const data: Branch[] = await res.json();
        setBranches(data);
        try { localStorage.setItem('nexora-branches-cache', JSON.stringify(data)); } catch {}
      }
    } catch { /* ignore */ }
  };

  // Re-evaluate when user changes (login / logout / role switch)
  useEffect(() => {
    if (!user) return;

    let initial: string | null;
    if (user.role === 'STAFF') {
      // Staff always see their branch — ignore any saved admin preference
      initial = user.branchId;
    } else {
      const saved = localStorage.getItem('nexora-branch');
      if (saved === 'all') {
        // User explicitly chose All Branches — honour it
        initial = null;
      } else if (saved) {
        // User chose a specific branch
        initial = saved;
      } else {
        // Never chosen before: default to user's own branch (or null = All)
        initial = user.branchId;
        if (initial) localStorage.setItem('nexora-branch', initial);
      }
    }

    setActiveBranchIdState(initial);
    fetchBranches();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const setActiveBranchId = (id: string | null) => {
    setActiveBranchIdState(id);
    localStorage.setItem('nexora-branch', id ?? 'all');
  };

  const activeBranch = branches.find(b => b.id === activeBranchId) ?? null;

  return (
    <BranchContext.Provider value={{
      branches,
      activeBranchId,
      setActiveBranchId,
      activeBranch,
      refreshBranches: fetchBranches,
    }}>
      {children}
    </BranchContext.Provider>
  );
}

export const useBranch = () => useContext(BranchContext);
