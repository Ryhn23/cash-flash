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
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 flex flex-col justify-between shadow-[0_1px_3px_rgba(0,0,0,0.03)] no-gradient">
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
          <span className="font-mono font-medium text-slate-700">
            {kpis.totalTransactions} transaksi
          </span>
        </div>
      </div>

      {/* 2. Pagu & Sisa Anggaran */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 flex flex-col justify-between shadow-[0_1px_3px_rgba(0,0,0,0.03)] no-gradient">
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
          'bg-white border rounded-xl p-4 flex flex-col justify-between shadow-[0_1px_3px_rgba(0,0,0,0.03)] no-gradient transition-all',
          hasAnomalies
            ? 'border-amber-300 hover:border-amber-400 cursor-pointer bg-amber-50/10'
            : 'border-[#E2E8F0]'
        )}
      >
        <div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase font-sans">
              REKONSILIASI KAS
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs text-slate-700 font-medium">
              <span className={clsx('w-1.5 h-1.5 rounded-full shrink-0', isReconciled ? 'bg-emerald-500' : 'bg-rose-500')} />
              <span>{kpis.reconciliationStatus}</span>
            </span>
          </div>
          <div className="text-xs font-normal text-slate-500 mt-2 font-sans">
            {isReconciled ? 'Buku kas dan rincian seimbang (Rp 0 selisih)' : 'Ada selisih pada pembukuan kas'}
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
          <span className="text-slate-500 font-sans">PERLU VERIFIKASI</span>
          {hasAnomalies ? (
            <span className="inline-flex items-center gap-1.5 font-medium text-amber-800">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
              <span>{kpis.needsReviewCount} Baris &bull; Tinjau</span>
            </span>
          ) : (
            <span className="text-slate-600 font-normal flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
              <span>Semua Bersih</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
