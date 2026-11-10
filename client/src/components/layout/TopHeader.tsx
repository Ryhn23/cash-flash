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
  const {
    activeGroup,
    activeTab,
    toggleActivityDrawer,
    isImmersiveMode,
    toggleImmersiveMode,
    isSidebarVisible,
    toggleSidebar,
  } = useAppStore();

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
    <header className="sticky top-0 z-20 h-14 bg-white border-b border-[#E2E8F0] px-4 sm:px-6 lg:px-8 flex items-center justify-between no-gradient">
      {/* Left: Sidebar toggle (Mobile & Desktop) & Active Title */}
      <div className="flex items-center gap-3">
        {/* Mobile sidebar button */}
        <button
          type="button"
          onClick={onOpenMobileSidebar}
          className="md:hidden p-2 text-slate-600 hover:text-slate-900 rounded hover:bg-slate-100 transition-colors"
          aria-label="Buka Menu Navigasi"
          title="Buka Navigasi"
        >
          <i className="fa-solid fa-bars text-sm" />
        </button>

        {/* Desktop sidebar toggle button */}
        <button
          type="button"
          onClick={toggleSidebar}
          className="hidden md:flex p-2 text-slate-600 hover:text-slate-900 rounded hover:bg-slate-100 transition-colors items-center justify-center"
          aria-label={isSidebarVisible ? 'Sembunyikan Sidebar' : 'Tampilkan Sidebar'}
          title={isSidebarVisible ? 'Sembunyikan Sidebar' : 'Tampilkan Sidebar'}
        >
          <i className={clsx('text-sm', isSidebarVisible ? 'fa-solid fa-bars-staggered' : 'fa-solid fa-bars')} />
        </button>

        <div className="flex items-center gap-2">
          <h1 className="text-sm sm:text-base font-semibold text-slate-900 tracking-tight font-heading">
            {getTabTitle()}
          </h1>
          {activeGroup && (
            <>
              <span className="text-slate-300 text-xs select-none">/</span>
              <span className="text-xs font-normal text-slate-500 truncate max-w-[140px] sm:max-w-none">
                {activeGroup.name}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Right: Immersive Mode & Activity Feed actions */}
      <div className="flex items-center gap-2">
        {/* Immersive / Full Screen Layout Toggle */}
        <Button
          variant={isImmersiveMode ? 'primary' : 'secondary'}
          size="sm"
          onClick={toggleImmersiveMode}
          title={isImmersiveMode ? 'Keluar dari Mode Imersif' : 'Mode Imersif (Perluas Tampilan)'}
          aria-label="Mode Imersif"
          icon={isImmersiveMode ? 'fa-solid fa-compress' : 'fa-solid fa-expand'}
        >
          <span className="hidden sm:inline">
            {isImmersiveMode ? 'Tampilan Normal' : 'Layar Penuh'}
          </span>
        </Button>

        {/* Activity Feed Button */}
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
