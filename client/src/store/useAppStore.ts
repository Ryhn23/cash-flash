import { create } from 'zustand';
import type { User, FinancialGroup, GroupRole } from '../types/index.js';

interface AppState {
  user: User | null;
  csrfToken: string | null;
  activeGroup: FinancialGroup | null;
  activeGroupRole: GroupRole;
  activeTab: 'dashboard' | 'ledger' | 'settings' | 'admin';
  isActivityDrawerOpen: boolean;
  isImmersiveMode: boolean;
  isSidebarVisible: boolean;
  
  setUser: (user: User | null) => void;
  setCsrfToken: (token: string | null) => void;
  setActiveGroup: (group: FinancialGroup | null) => void;
  setActiveTab: (tab: 'dashboard' | 'ledger' | 'settings' | 'admin') => void;
  toggleActivityDrawer: () => void;
  setActivityDrawerOpen: (open: boolean) => void;
  toggleImmersiveMode: () => void;
  toggleSidebar: () => void;
  setSidebarVisible: (visible: boolean) => void;
  logout: () => void;
}

const getStoredBool = (key: string, defaultValue: boolean): boolean => {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const val = window.localStorage.getItem(key);
      if (val !== null) return val === 'true';
    } catch {
      // ignore
    }
  }
  return defaultValue;
};

const setStoredBool = (key: string, value: boolean) => {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(key, String(value));
    } catch {
      // ignore
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
  isImmersiveMode: getStoredBool('nextcash_immersive', false),
  isSidebarVisible: getStoredBool('nextcash_sidebar', true),

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
  
  toggleImmersiveMode: () =>
    set((state) => {
      const next = !state.isImmersiveMode;
      setStoredBool('nextcash_immersive', next);
      return { isImmersiveMode: next };
    }),

  toggleSidebar: () =>
    set((state) => {
      const next = !state.isSidebarVisible;
      setStoredBool('nextcash_sidebar', next);
      return { isSidebarVisible: next };
    }),

  setSidebarVisible: (visible) => {
    setStoredBool('nextcash_sidebar', visible);
    set({ isSidebarVisible: visible });
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
