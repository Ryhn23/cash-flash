import React from 'react';
import { motion } from 'framer-motion';
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

  const cards = [
    {
      id: 'expense',
      label: 'TOTAL PENGELUARAN',
      value: formatRupiah(kpis.totalExpense),
      subtext: `${kpis.totalTransactions} transaksi tercatat`,
      icon: 'fa-solid fa-arrow-trend-down',
      iconBg: 'bg-[#FFF1F2] text-[#BE123C] border-[#FFE4E6]',
      isNumeric: true,
    },
    {
      id: 'income',
      label: 'PAGU ANGGARAN',
      value: formatRupiah(kpis.budgetEffective),
      subtext: `Kas masuk ${formatRupiah(kpis.totalIncome)}`,
      icon: 'fa-solid fa-wallet',
      iconBg: 'bg-[#EEF2FF] text-[#1E1B4B] border-[#C7D2FE]',
      isNumeric: true,
    },
    {
      id: 'balance',
      label: 'SISA ANGGARAN',
      value: formatRupiah(kpis.remainingBalance),
      subtext: `Sisa ${kpis.remainingPercentage}% pagu`,
      icon: 'fa-solid fa-scale-balanced',
      iconBg: kpis.remainingBalance >= 0 ? 'bg-[#F0FDF4] text-[#15803D] border-[#DCFCE7]' : 'bg-[#FFF1F2] text-[#BE123C] border-[#FFE4E6]',
      isNumeric: true,
    },
    {
      id: 'transactions',
      label: 'JUMLAH TRANSAKSI',
      value: kpis.totalTransactions.toString(),
      subtext: 'Baris ledger aktif',
      icon: 'fa-solid fa-receipt',
      iconBg: 'bg-[#F8FAFC] text-[#475569] border-[#E2E8F0]',
      isNumeric: true,
    },
    {
      id: 'reconciliation',
      label: 'REKONSILIASI KAS',
      value: kpis.reconciliationStatus,
      subtext: kpis.reconciliationStatus === 'OK - Sama' ? 'Selisih Rp 0' : `Selisih ${formatRupiah(Math.abs(kpis.sumFromLedger - kpis.sumFromCategoryBreakdown))}`,
      icon: kpis.reconciliationStatus === 'OK - Sama' ? 'fa-solid fa-circle-check' : 'fa-solid fa-triangle-exclamation',
      iconBg: kpis.reconciliationStatus === 'OK - Sama' ? 'bg-[#F0FDF4] text-[#15803D] border-[#DCFCE7]' : 'bg-[#FFF1F2] text-[#BE123C] border-[#FFE4E6]',
      isBadge: true,
    },
    {
      id: 'anomalies',
      label: 'PERLU VERIFIKASI',
      value: `${kpis.needsReviewCount} Baris`,
      subtext: kpis.needsReviewCount > 0 ? 'Tinjau anomali' : 'Semua bersih',
      icon: 'fa-solid fa-magnifying-glass-chart',
      iconBg: kpis.needsReviewCount > 0 ? 'bg-[#FFFBEB] text-[#92400E] border-[#FDE68A]' : 'bg-[#F0FDF4] text-[#15803D] border-[#DCFCE7]',
      clickable: kpis.needsReviewCount > 0,
      onClick: handleAnomalyClick,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {cards.map((card, idx) => (
        <motion.div
          key={card.id}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.12, delay: idx * 0.02 }}
          onClick={card.onClick}
          className={clsx(
            'bg-white border border-[#E2E8F0] rounded-lg p-3.5 no-gradient transition-all',
            card.clickable ? 'cursor-pointer hover:border-amber-400 hover:bg-[#FFFBEB]/10 group' : 'hover:border-slate-300'
          )}
        >
          <div className="flex items-center justify-between">
            <span className="label-sm">
              {card.label}
            </span>
            <div
              className={clsx(
                'w-6 h-6 rounded flex items-center justify-center text-xs border no-gradient',
                card.iconBg
              )}
            >
              <i className={clsx(card.icon, 'text-[11px]')} />
            </div>
          </div>

          <div className="mt-2">
            <div
              className={clsx(
                'text-lg sm:text-xl font-bold tracking-tight text-[#0F172A]',
                card.isNumeric && 'tabular-data font-mono',
                card.id === 'reconciliation' && (kpis.reconciliationStatus === 'OK - Sama' ? 'text-[#15803D]' : 'text-[#BE123C]'),
                card.id === 'anomalies' && kpis.needsReviewCount > 0 && 'text-[#92400E]'
              )}
            >
              {card.value}
            </div>
            <div className="flex items-center justify-between text-xs text-[#64748B] mt-1 font-sans">
              <span>{card.subtext}</span>
              {card.clickable && (
                <i className="fa-solid fa-arrow-right text-[10px] text-amber-600 group-hover:translate-x-0.5 transition-transform" />
              )}
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
};
