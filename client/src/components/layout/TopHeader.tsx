import React from 'react';
import { useAppStore } from '../../store/useAppStore.js';
import { Button } from '../ui/Button.js';
import clsx from 'clsx';

export interface TopHeaderProps {
  onOpenMobileSidebar: () => void;
  reconciliationStatus?: 'OK - Sama' | 'Selisih';
  remainingPercentage?: number;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  onOpenMobileSidebar,
}) => {
  const { activeGroup, activeTab, toggleActivityDrawer, isSidebarOpen, toggleSidebar, isImmersive, toggleImmersive } = useAppStore();

  const getTabTitle = () => {
    switch (activeTab) {
      case 'dashboard':
        return 'Ringkasan';
      case 'ledger':
        return 'Buku Kas Belanja';
      case 'settings':
        return 'Pengaturan Grup';
      case 'admin':
        return 'Konsol Admin';
      default:
        return 'Dashboard';
    }
  };

  return (
    <header className="sticky top-0 z-20 h-14 bg-white border-b border-[#E2E8F0] px-3 sm:px-6 flex items-center justify-between no-gradient">
      {/* Left: Sidebar toggle & Active Breadcrumb */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Mobile menu trigger */}
        <button
          type="button"
          onClick={onOpenMobileSidebar}
          className="md:hidden p-2 text-slate-600 hover:text-slate-900 rounded hover:bg-slate-100 transition-colors"
          title="Buka Menu Navigasi"
          aria-label="Buka Menu Navigasi"
        >
          <i className="fa-solid fa-bars text-sm" />
        </button>

        {/* Desktop sidebar toggle button */}
        <button
          type="button"
          onClick={toggleSidebar}
          className="hidden md:flex items-center justify-center w-8 h-8 text-slate-500 hover:text-slate-900 rounded hover:bg-slate-100 transition-colors"
          title={isSidebarOpen ? 'Sembunyikan Sidebar' : 'Tampilkan Sidebar'}
          aria-label={isSidebarOpen ? 'Sembunyikan Sidebar' : 'Tampilkan Sidebar'}
        >
          <i className={clsx('text-sm', isSidebarOpen ? 'fa-solid fa-bars-staggered' : 'fa-solid fa-bars')} />
        </button>

        <div className="flex items-center gap-2">
          <h1 className="text-sm sm:text-base font-semibold text-slate-900 tracking-tight font-heading">
            {getTabTitle()}
          </h1>
          {activeGroup && (
            <>
              <span className="text-slate-300 text-xs select-none">/</span>
              <span className="text-xs font-normal text-slate-500 truncate max-w-[140px] sm:max-w-[220px]">
                {activeGroup.name}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Right: Immersive & Clean minimal action */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Fullscreen / Immersive Toggle Button */}
        <Button
          variant={isImmersive ? 'primary' : 'secondary'}
          size="sm"
          onClick={toggleImmersive}
          title={isImmersive ? 'Keluar Mode Layar Luas' : 'Mode Layar Luas (Imersif)'}
          aria-label={isImmersive ? 'Keluar Mode Layar Luas' : 'Mode Layar Luas'}
          icon={isImmersive ? 'fa-solid fa-compress' : 'fa-solid fa-expand'}
        >
          <span className="hidden sm:inline">{isImmersive ? 'Normal' : 'Layar Luas'}</span>
        </Button>

        {/* Activity feed launcher */}
        <Button
          variant="secondary"
          size="sm"
          onClick={toggleActivityDrawer}
          title="Riwayat Aktivitas"
          aria-label="Riwayat Aktivitas"
          icon="fa-solid fa-clock-rotate-left"
        >
          <span className="hidden sm:inline">Aktivitas</span>
        </Button>
      </div>
    </header>
  );
};
