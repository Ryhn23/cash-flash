import { create } from 'zustand';
import type { User, FinancialGroup, GroupRole } from '../types/index.js';

interface AppState {
  user: User | null;
  csrfToken: string | null;
  activeGroup: FinancialGroup | null;
  activeGroupRole: GroupRole;
  activeTab: 'dashboard' | 'ledger' | 'settings' | 'admin';
  isActivityDrawerOpen: boolean;
  
  setUser: (user: User | null) => void;
  setCsrfToken: (token: string | null) => void;
  setActiveGroup: (group: FinancialGroup | null) => void;
  setActiveTab: (tab: 'dashboard' | 'ledger' | 'settings' | 'admin') => void;
  toggleActivityDrawer: () => void;
  setActivityDrawerOpen: (open: boolean) => void;
  logout: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  user: null,
  csrfToken: null,
  activeGroup: null,
  activeGroupRole: 'VIEWER',
  activeTab: 'dashboard',
  isActivityDrawerOpen: false,

  setUser: (user) => set({ user }),
  setCsrfToken: (csrfToken) => set({ csrfToken }),
  setActiveGroup: (group) =>
    set({
      activeGroup: group,
      activeGroupRole: group?.userRole || 'VIEWER',
    }),
  setActiveTab: (activeTab) => set({ activeTab }),
  toggleActivityDrawer: () =>
    set((state) => ({ isActivityDrawerOpen: !state.isActivityDrawerOpen })),
  setActivityDrawerOpen: (open) => set({ isActivityDrawerOpen: open }),
  logout: () =>
    set({
      user: null,
      csrfToken: null,
      activeGroup: null,
      activeGroupRole: 'VIEWER',
      activeTab: 'dashboard',
    }),
}));
