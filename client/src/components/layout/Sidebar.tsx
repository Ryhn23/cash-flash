import React from 'react';
import { useAppStore } from '../../store/useAppStore.js';
import { WorkspaceSwitcher } from './WorkspaceSwitcher.js';
import { api } from '../../api/client.js';
import clsx from 'clsx';

export interface SidebarProps {
  isMobileOpen: boolean;
  onCloseMobile: () => void;
  anomalyCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({ isMobileOpen, onCloseMobile, anomalyCount = 0 }) => {
  const { user, activeTab, setActiveTab, activeGroup, toggleActivityDrawer, logout, isSidebarOpen, toggleSidebar } = useAppStore();

  const handleLogout = async () => {
    try {
      await api.post('/api/auth/logout');
    } catch {
      // Ignore
    }
    logout();
  };

  const navItems = [
    {
      id: 'dashboard',
      label: 'Ringkasan',
      icon: 'fa-solid fa-chart-pie',
    },
    {
      id: 'ledger',
      label: 'Buku Kas Belanja',
      icon: 'fa-solid fa-table-list',
      badge: anomalyCount > 0 ? `${anomalyCount}` : undefined,
      badgeColor: 'text-amber-600 font-mono text-xs font-semibold',
    },
    {
      id: 'settings',
      label: 'Pengaturan Grup',
      icon: 'fa-solid fa-sliders',
    },
  ];

  if (user?.systemRole === 'SUPER_ADMIN') {
    navItems.push({
      id: 'admin',
      label: 'Konsol Admin',
      icon: 'fa-solid fa-shield-halved',
    });
  }

  const sidebarContent = (
    <div className="flex flex-col h-full bg-white border-r border-[#E2E8F0]">
      {/* 1. Terminal Header */}
      <div className="h-14 px-4 border-b border-[#E2E8F0] flex items-center justify-between bg-white shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded bg-[#1E1B4B] text-white flex items-center justify-center font-bold no-gradient shadow-none">
            <i className="fa-solid fa-receipt text-xs" />
          </div>
          <div className="hidden lg:flex items-center gap-1.5">
            <span className="font-heading font-bold text-sm tracking-tight text-[#0F172A]">
              Next<span className="text-[#3730A3]">-Cash</span>
            </span>
          </div>
        </div>

        {/* Desktop collapse button */}
        <button
          type="button"
          onClick={toggleSidebar}
          className="hidden lg:flex p-1.5 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-100 transition-colors"
          title="Sembunyikan Sidebar"
          aria-label="Sembunyikan Sidebar"
        >
          <i className="fa-solid fa-chevron-left text-xs" />
        </button>

        {/* Mobile close button */}
        <button
          type="button"
          onClick={onCloseMobile}
          className="lg:hidden p-1.5 text-slate-400 hover:text-slate-700 rounded"
          title="Tutup Menu"
          aria-label="Tutup Menu"
        >
          <i className="fa-solid fa-xmark text-sm" />
        </button>
      </div>

      {/* 2. Workspace Selector */}
      <div className="p-3 border-b border-[#E2E8F0] bg-[#FAFAFA]">
        <div className="hidden lg:block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5 px-1 label-sm">
          Grup Keuangan
        </div>
        <WorkspaceSwitcher />
      </div>

      {/* 3. Navigation Links */}
      <nav className="flex-1 p-2.5 space-y-1 overflow-y-auto">
        <div className="hidden lg:block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2 px-2.5 label-sm">
          Menu
        </div>

        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id as any);
                onCloseMobile();
              }}
              className={clsx(
                'w-full flex items-center gap-2.5 px-3 py-2 rounded transition-all text-left text-xs font-medium select-none group',
                isActive
                  ? 'bg-[#1E1B4B] text-white shadow-none font-semibold'
                  : 'text-[#475569] hover:bg-[#F8FAFC] hover:text-[#0F172A]'
              )}
              title={item.label}
            >
              <i
                className={clsx(
                  item.icon,
                  'text-xs w-4 text-center shrink-0',
                  isActive ? 'text-white' : 'text-[#64748B] group-hover:text-[#0F172A]'
                )}
              />
              <div className="hidden lg:flex flex-1 items-center justify-between min-w-0">
                <span className="truncate">{item.label}</span>
                {item.badge && (
                  <span className={clsx('shrink-0 ml-1', item.badgeColor)}>
                    {item.badge}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </nav>

      {/* 4. Telemetry & User Footer */}
      <div className="p-3 border-t border-[#E2E8F0] bg-[#FAFAFA] shrink-0 space-y-2">
        {/* Activity Feed launcher */}
        <button
          type="button"
          onClick={toggleActivityDrawer}
          className="w-full flex items-center gap-2 px-2.5 py-2 rounded border border-[#E2E8F0] bg-white hover:bg-[#F8FAFC] text-[#1E293B] text-xs transition-colors"
          title="Buka Riwayat Aktivitas"
        >
          <i className="fa-solid fa-clock-rotate-left text-xs text-[#64748B]" />
          <span className="hidden lg:inline font-medium">Riwayat Aktivitas</span>
        </button>

        {/* User Card */}
        <div className="pt-1 flex items-center justify-between px-1">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded bg-[#1E1B4B] text-white flex items-center justify-center font-bold text-xs shrink-0">
              {user?.name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="hidden lg:block min-w-0">
              <div className="text-xs font-semibold text-slate-900 truncate leading-tight">
                {user?.name}
              </div>
              <div className="text-[10px] text-slate-500 font-sans truncate leading-none mt-0.5">
                {user?.systemRole === 'SUPER_ADMIN' ? 'Admin Utama' : 'Anggota'}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="p-1.5 text-slate-400 hover:text-[#BE123C] rounded hover:bg-rose-50 transition-colors"
            title="Keluar Akun"
          >
            <i className="fa-solid fa-arrow-right-from-bracket text-xs" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar (260px) & Tablet Icon Rail (64px) with Show/Hide Transition */}
      <aside
        className={clsx(
          'hidden md:block fixed inset-y-0 left-0 z-30 w-16 lg:w-[260px] transition-transform duration-200 ease-in-out',
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {sidebarContent}
      </aside>

      {/* Mobile Off-Canvas Drawer */}
      {isMobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-[#070235]/60" onClick={onCloseMobile} />
          <div className="relative w-72 max-w-[80vw] h-full z-10">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};
