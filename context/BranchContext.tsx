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

export function BranchProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [activeBranchId, setActiveBranchIdState] = useState<string | null>(null);

  const fetchBranches = async () => {
    if (!user?.token) return;
    try {
      const res = await fetch('/api/branches', {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setBranches(data);
      }
    } catch { /* ignore */ }
  };

  useEffect(() => {
    if (user) {
      const saved = localStorage.getItem('nexora-branch');
      let initial: string | null;
      if (user.role === 'STAFF') {
        initial = user.branchId;
      } else if (saved === null) {
        // Never chose — default to their assigned branch
        initial = user.branchId;
      } else if (saved === 'all') {
        initial = null;
      } else {
        initial = saved;
      }
      setActiveBranchIdState(initial);
      fetchBranches();
    }
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
