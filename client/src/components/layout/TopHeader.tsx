import React from 'react';
import { useAppStore } from '../../store/useAppStore.js';
import { Badge } from '../ui/Badge.js';
import clsx from 'clsx';

export interface TopHeaderProps {
  onOpenMobileSidebar: () => void;
  reconciliationStatus?: 'OK - Sama' | 'Selisih';
  remainingPercentage?: number;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  onOpenMobileSidebar,
}) => {
  const { activeGroup, activeTab, toggleActivityDrawer } = useAppStore();

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
      {/* Left: Mobile trigger & Active Title */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenMobileSidebar}
          className="md:hidden p-2 text-slate-600 hover:text-slate-900 rounded hover:bg-slate-100"
          aria-label="Buka Menu Navigasi"
        >
          <i className="fa-solid fa-bars text-sm" />
        </button>

        <div className="flex items-center gap-2.5">
          <h1 className="text-sm sm:text-base font-bold text-[#0F172A] tracking-tight font-heading">
            {getTabTitle()}
          </h1>
          {activeGroup && (
            <span className="inline-flex items-center h-5 px-2 text-[10px] font-semibold rounded bg-[#F1F5F9] text-slate-700 border border-[#E2E8F0]">
              {activeGroup.name}
            </span>
          )}
        </div>
      </div>

      {/* Right: Clean minimal action */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={toggleActivityDrawer}
          className="h-8 px-2.5 rounded border border-[#E2E8F0] bg-white hover:bg-[#F8FAFC] text-slate-600 hover:text-slate-900 text-xs font-medium flex items-center gap-1.5 transition-colors"
          title="Riwayat Aktivitas"
          aria-label="Riwayat Aktivitas"
        >
          <i className="fa-solid fa-clock-rotate-left text-xs text-slate-400" />
          <span className="hidden sm:inline">Aktivitas</span>
        </button>
      </div>
    </header>
  );
};
