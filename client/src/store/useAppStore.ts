import { create } from 'zustand';
import type { User, FinancialGroup, GroupRole } from '../types/index.js';

interface AppState {
  user: User | null;
  csrfToken: string | null;
  activeGroup: FinancialGroup | null;
  activeGroupRole: GroupRole;
  activeTab: 'dashboard' | 'ledger' | 'settings' | 'admin';
  isActivityDrawerOpen: boolean;
  isSidebarOpen: boolean;
  isImmersive: boolean;
  
  setUser: (user: User | null) => void;
  setCsrfToken: (token: string | null) => void;
  setActiveGroup: (group: FinancialGroup | null) => void;
  setActiveTab: (tab: 'dashboard' | 'ledger' | 'settings' | 'admin') => void;
  toggleActivityDrawer: () => void;
  setActivityDrawerOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  toggleImmersive: () => void;
  setImmersive: (open: boolean) => void;
  logout: () => void;
}

const getStorageItem = (key: string, defaultValue: string): string => {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      return localStorage.getItem(key) ?? defaultValue;
    } catch {
      return defaultValue;
    }
  }
  return defaultValue;
};

const setStorageItem = (key: string, value: string) => {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Ignore
    }
  }
};

export const useAppStore = create<AppState>((set) => ({
  user: null,
  csrfToken: null,
  activeGroup: null,
  activeGroupRole: 'VIEWER',
  activeTab: 'dashboard',
  isActivityDrawerOpen: false,
  isSidebarOpen: getStorageItem('cashflash_sidebar', 'true') !== 'false',
  isImmersive: getStorageItem('cashflash_immersive', 'false') === 'true',

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
  toggleSidebar: () =>
    set((state) => {
      const next = !state.isSidebarOpen;
      setStorageItem('cashflash_sidebar', String(next));
      return { isSidebarOpen: next };
    }),
  setSidebarOpen: (isSidebarOpen) => {
    setStorageItem('cashflash_sidebar', String(isSidebarOpen));
    set({ isSidebarOpen });
  },
  toggleImmersive: () =>
    set((state) => {
      const next = !state.isImmersive;
      setStorageItem('cashflash_immersive', String(next));
      return { isImmersive: next };
    }),
  setImmersive: (isImmersive) => {
    setStorageItem('cashflash_immersive', String(isImmersive));
    set({ isImmersive });
  },
  logout: () =>
    set({
      user: null,
      csrfToken: null,
      activeGroup: null,
      activeGroupRole: 'VIEWER',
      activeTab: 'dashboard',
    }),
}));
