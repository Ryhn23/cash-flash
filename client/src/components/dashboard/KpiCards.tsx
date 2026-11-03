import React from 'react';
import type { AnalyticsKpis } from '../../types/index.js';
import { formatRupiah } from '../../utils/format.js';
import { useAppStore } from '../../store/useAppStore.js';
import clsx from 'clsx';

export interface KpiCardsProps {
  kpis: AnalyticsKpis;
  onFilterAnomalies?: () => void;
}

export const KpiCards: React.FC<KpiCardsProps> = ({ kpis, onFilterAnomalies }) => {
  const { setActiveTab } = useAppStore();

  const handleAnomalyClick = () => {
    setActiveTab('ledger');
    if (onFilterAnomalies) onFilterAnomalies();
  };

  const isReconciled = kpis.reconciliationStatus === 'OK - Sama';
  const hasAnomalies = kpis.needsReviewCount > 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
      {/* 1. Belanja & Transaksi */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 flex flex-col justify-between shadow-none no-gradient">
        <div>
          <span className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase font-sans">
            TOTAL PENGELUARAN
          </span>
          <div className="text-xl sm:text-2xl font-bold font-mono tracking-tight text-[#0F172A] mt-1">
            {formatRupiah(kpis.totalExpense)}
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
          <span className="text-slate-500 font-sans">JUMLAH TRANSAKSI</span>
          <span className="font-mono font-semibold text-slate-800 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
            {kpis.totalTransactions} transaksi
          </span>
        </div>
      </div>

      {/* 2. Pagu & Sisa Anggaran */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 flex flex-col justify-between shadow-none no-gradient">
        <div>
          <span className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase font-sans">
            PAGU ANGGARAN
          </span>
          <div className="text-xl sm:text-2xl font-bold font-mono tracking-tight text-[#1E1B4B] mt-1">
            {formatRupiah(kpis.budgetEffective)}
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
          <span className="text-slate-500 font-sans">SISA ANGGARAN</span>
          <div className="flex items-center gap-1.5 font-mono">
            <span className={clsx('font-bold', kpis.remainingBalance >= 0 ? 'text-[#15803D]' : 'text-[#BE123C]')}>
              {formatRupiah(kpis.remainingBalance)}
            </span>
            <span className="text-[10px] text-slate-400">({kpis.remainingPercentage}%)</span>
          </div>
        </div>
      </div>

      {/* 3. Kesehatan Kas & Anomali */}
      <div
        onClick={hasAnomalies ? handleAnomalyClick : undefined}
        className={clsx(
          'bg-white border rounded-xl p-4 flex flex-col justify-between shadow-none no-gradient transition-all',
          hasAnomalies
            ? 'border-amber-300 hover:border-amber-400 cursor-pointer bg-amber-50/20'
            : 'border-[#E2E8F0]'
        )}
      >
        <div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase font-sans">
              REKONSILIASI KAS
            </span>
            <span
              className={clsx(
                'inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded border',
                isReconciled
                  ? 'bg-[#F0FDF4] text-[#15803D] border-[#DCFCE7]'
                  : 'bg-[#FFF1F2] text-[#BE123C] border-[#FFE4E6]'
              )}
            >
              <i className={clsx('text-[9px]', isReconciled ? 'fa-solid fa-circle-check' : 'fa-solid fa-triangle-exclamation')} />
              <span>{kpis.reconciliationStatus}</span>
            </span>
          </div>
          <div className="text-sm font-medium text-slate-600 mt-2 font-sans">
            {isReconciled ? 'Ledger dan rincian seimbang (Rp 0 selisih)' : 'Ada selisih pada ledger kas'}
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
          <span className="text-slate-500 font-sans">PERLU VERIFIKASI</span>
          {hasAnomalies ? (
            <span className="inline-flex items-center gap-1 font-semibold text-amber-800 bg-amber-100/70 px-2 py-0.5 rounded border border-amber-300">
              <i className="fa-solid fa-magnifying-glass text-[10px]" />
              <span>{kpis.needsReviewCount} Baris &bull; Tinjau</span>
            </span>
          ) : (
            <span className="text-[#15803D] font-medium flex items-center gap-1">
              <i className="fa-solid fa-check text-[10px]" />
              <span>Semua Bersih</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
