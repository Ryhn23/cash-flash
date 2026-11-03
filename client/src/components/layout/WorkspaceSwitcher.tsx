import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client.js';
import { useAppStore } from '../../store/useAppStore.js';
import type { FinancialGroup } from '../../types/index.js';
import clsx from 'clsx';

export const WorkspaceSwitcher: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { activeGroup, setActiveGroup, user } = useAppStore();

  const { data: groupsData, isLoading } = useQuery<{ success: boolean; groups: FinancialGroup[] }>({
    queryKey: ['groups'],
    queryFn: () => api.get('/api/groups'),
  });

  const groups = groupsData?.groups || [];

  // Auto-select first group if none active
  React.useEffect(() => {
    if (groups.length > 0 && !activeGroup) {
      setActiveGroup(groups[0]);
    }
  }, [groups, activeGroup, setActiveGroup]);

  const handleSelect = (g: FinancialGroup) => {
    setActiveGroup(g);
    setIsOpen(false);
  };

  const getRoleLabel = (role?: string) => {
    switch (role) {
      case 'GROUP_MANAGER':
        return 'Ketua / Bendahara Utama';
      case 'EDITOR':
        return 'Staf Pencatat / Panitia';
      case 'VIEWER':
        return 'Auditor / Pengawas';
      default:
        return 'Anggota';
    }
  };

  return (
    <div className="relative w-full">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded border border-[#E2E8F0] bg-white hover:bg-[#F8FAFC] text-left transition-colors focus:outline-none focus:border-[#3730A3] focus:ring-2 focus:ring-[#3730A3]/10 active:scale-[0.99]"
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded bg-[#1E1B4B] text-white flex items-center justify-center text-xs font-bold shrink-0 no-gradient">
            <i className="fa-solid fa-layer-group text-[10px]" />
          </div>
          <div className="hidden lg:flex flex-col min-w-0">
            <span className="text-xs font-bold text-[#0F172A] leading-tight truncate font-heading">
              {activeGroup?.name || (isLoading ? 'Memuat...' : 'Pilih Grup')}
            </span>
            <span className="text-[10px] text-[#475569] leading-none truncate font-sans">
              {getRoleLabel(activeGroup?.userRole)}
            </span>
          </div>
        </div>
        <i className={clsx('hidden lg:block fa-solid fa-chevron-down text-[10px] text-slate-400 shrink-0 transition-transform', isOpen && 'rotate-180')} />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute left-0 top-full mt-1.5 w-64 bg-white border border-[#CBD5E1] rounded-lg z-50 py-1 overflow-hidden no-gradient shadow-[0_4px_12px_-2px_rgba(15,23,42,0.06),0_2px_4px_-1px_rgba(15,23,42,0.04)]">
            <div className="px-3 py-1.5 border-b border-[#E2E8F0] bg-[#FAFAFA]">
              <span className="text-[11px] font-semibold text-[#475569] uppercase tracking-[0.04em] font-sans">
                Workspace Keuangan
              </span>
            </div>
            <div className="max-h-60 overflow-y-auto">
              {groups.map((g) => {
                const isSelected = activeGroup?.id === g.id;
                return (
                  <button
                    key={g.id}
                    onClick={() => handleSelect(g)}
                    className={clsx(
                      'w-full text-left px-3 py-2 flex items-center justify-between text-xs hover:bg-[#F8FAFC] transition-colors',
                      isSelected && 'bg-[#EEF2FF] font-semibold text-[#1E1B4B]'
                    )}
                  >
                    <div className="min-w-0">
                      <div className="text-slate-900 font-medium truncate font-sans">{g.name}</div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        {g.transactionCount || 0} transaksi &bull; {getRoleLabel(g.userRole)}
                      </div>
                    </div>
                    {isSelected && <i className="fa-solid fa-check text-xs text-[#1E1B4B] shrink-0 ml-2" />}
                  </button>
                );
              })}
              {groups.length === 0 && !isLoading && (
                <div className="px-3 py-3 text-center text-xs text-slate-400 font-sans">
                  Tidak ada grup yang tersedia
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

