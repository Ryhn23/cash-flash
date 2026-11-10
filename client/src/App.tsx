import React, { useEffect, useState, Suspense } from 'react';
import clsx from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { useAppStore } from './store/useAppStore.js';
import { api } from './api/client.js';
import { LoginPage } from './pages/LoginPage.js';
import { Sidebar } from './components/layout/Sidebar.js';
import { TopHeader } from './components/layout/TopHeader.js';
import type { AnalyticsReport } from './types/index.js';

// Lazy-loaded route views to optimize initial bundle size
const DashboardPage = React.lazy(() =>
  import('./pages/DashboardPage.js').then((m) => ({ default: m.DashboardPage }))
);
const LedgerPage = React.lazy(() =>
  import('./pages/LedgerPage.js').then((m) => ({ default: m.LedgerPage }))
);
const GroupSettingsView = React.lazy(() =>
  import('./components/settings/GroupSettingsView.js').then((m) => ({ default: m.GroupSettingsView }))
);
const AdminManagementView = React.lazy(() =>
  import('./components/admin/AdminManagementView.js').then((m) => ({ default: m.AdminManagementView }))
);
const ActivityFeedDrawer = React.lazy(() =>
  import('./components/audit/ActivityFeedDrawer.js').then((m) => ({ default: m.ActivityFeedDrawer }))
);

const ViewSuspenseFallback: React.FC = () => (
  <div className="py-24 flex flex-col items-center justify-center text-slate-400">
    <i className="fa-solid fa-circle-notch fa-spin text-2xl text-[#1E1B4B] mb-2" />
    <span className="text-xs font-semibold font-mono text-slate-500">Memuat tampilan...</span>
  </div>
);

export const App: React.FC = () => {
  const { user, setUser, setCsrfToken, activeTab, activeGroup, isSidebarOpen, isImmersive } = useAppStore();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Check existing session on boot
  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await api.get<{ success: boolean; user: any; csrfToken?: string }>('/api/auth/me');
        if (res.user) {
          setUser(res.user);
          if (res.csrfToken) {
            setCsrfToken(res.csrfToken);
          }
        }
      } catch {
        setUser(null);
      } finally {
        setIsCheckingAuth(false);
      }
    }
    checkAuth();
  }, [setUser, setCsrfToken]);

  // Query analytics for telemetry status indicators in TopHeader & Sidebar
  const { data: analyticsData } = useQuery<{ success: boolean } & AnalyticsReport>({
    queryKey: ['analytics', activeGroup?.id],
    queryFn: () => (activeGroup ? api.get(`/api/groups/${activeGroup.id}/analytics`) : Promise.reject('No group')),
    enabled: !!activeGroup,
  });

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center text-slate-500">
        <div className="w-10 h-10 rounded bg-[#1E1B4B] text-white flex items-center justify-center font-bold mb-3 shadow-none no-gradient">
          <i className="fa-solid fa-receipt text-lg" />
        </div>
        <i className="fa-solid fa-circle-notch fa-spin text-xl text-[#1E1B4B]" />
        <span className="text-xs font-semibold text-slate-600 mt-2 font-mono">Memeriksa sesi pengguna...</span>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  const canManage = activeGroup?.userRole === 'GROUP_MANAGER' || user.systemRole === 'SUPER_ADMIN';

  const reconciliationStatus = analyticsData?.kpis?.reconciliationStatus;
  const remainingPercentage = analyticsData?.kpis?.remainingPercentage ?? 100;
  const anomalyCount = analyticsData?.kpis?.needsReviewCount ?? 0;

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex text-[#0B1C30] selection:bg-[#1E1B4B] selection:text-white">
      {/* 1. Persistent Operational Sidebar (260px desktop, 64px tablet icon rail, mobile drawer) */}
      <Sidebar
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        anomalyCount={anomalyCount}
      />

      {/* 2. Main Fluid Data Workspace: dynamically offset by sidebar */}
      <div
        className={clsx(
          'flex-1 flex flex-col min-w-0 transition-all duration-200 ease-in-out',
          isSidebarOpen ? 'md:pl-16 lg:pl-[260px]' : 'pl-0'
        )}
      >
        <TopHeader
          onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
          reconciliationStatus={reconciliationStatus}
          remainingPercentage={remainingPercentage}
        />

        <main
          className={clsx(
            'flex-1 w-full transition-all duration-200',
            isImmersive ? 'max-w-none px-3 sm:px-6 py-4' : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6'
          )}
        >
          <Suspense fallback={<ViewSuspenseFallback />}>
            <AnimatePresence mode="wait">
              {activeTab === 'dashboard' && (
                <motion.div
                  key="dashboard"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.15 }}
                >
                  <DashboardPage />
                </motion.div>
              )}

              {activeTab === 'ledger' && (
                <motion.div
                  key="ledger"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.15 }}
                >
                  <LedgerPage />
                </motion.div>
              )}

              {activeTab === 'settings' && (
                <motion.div
                  key="settings"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.15 }}
                >
                  {activeGroup ? (
                    <GroupSettingsView group={activeGroup} canManage={canManage} />
                  ) : (
                    <div className="py-20 text-center max-w-md mx-auto px-4">
                      <div className="w-12 h-12 rounded bg-slate-100 text-slate-400 mx-auto flex items-center justify-center text-xl mb-3">
                        <i className="fa-solid fa-sliders" />
                      </div>
                      <h3 className="text-base font-bold text-slate-800 font-heading">Belum Ada Grup Keuangan</h3>
                      <p className="text-xs text-slate-500 mt-1.5 font-sans">
                        Pilih grup keuangan aktif terlebih dahulu untuk mengakses pengaturan grup.
                      </p>
                    </div>
                  )}
                </motion.div>
              )}

              {activeTab === 'admin' && user.systemRole === 'SUPER_ADMIN' && (
                <motion.div
                  key="admin"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.15 }}
                >
                  <AdminManagementView />
                </motion.div>
              )}
            </AnimatePresence>
          </Suspense>
        </main>
      </div>

      {/* Slide-over Activity Feed and Audit Trail Drawer */}
      <Suspense fallback={null}>
        <ActivityFeedDrawer />
      </Suspense>
    </div>
  );
};

