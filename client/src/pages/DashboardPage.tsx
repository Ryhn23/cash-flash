import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client.js';
import { useAppStore } from '../store/useAppStore.js';
import type { AnalyticsReport } from '../types/index.js';
import { KpiCards } from '../components/dashboard/KpiCards.js';
import { CategoryBreakdownTable } from '../components/dashboard/CategoryBreakdownTable.js';
import { SpendCharts } from '../components/dashboard/SpendCharts.js';
import { Button } from '../components/ui/Button.js';
import { formatRupiah } from '../utils/format.js';

export const DashboardPage: React.FC = () => {
  const { activeGroup, setActiveTab } = useAppStore();

  const { data, isLoading, refetch } = useQuery<{ success: boolean } & AnalyticsReport>({
    queryKey: ['analytics', activeGroup?.id],
    queryFn: () => (activeGroup ? api.get(`/api/groups/${activeGroup.id}/analytics`) : Promise.reject('No group')),
    enabled: !!activeGroup,
  });

  if (!activeGroup) {
    return (
      <div className="py-16 text-center text-slate-500">
        <i className="fa-solid fa-layer-group text-4xl mb-3 text-slate-300" />
        <h3 className="text-base font-bold text-slate-800 font-heading">Pilih Grup Keuangan Terlebih Dahulu</h3>
        <p className="text-xs text-slate-500 mt-1 font-sans">Gunakan dropdown pemilih grup di bilah navigasi samping.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="py-24 text-center text-slate-400">
        <i className="fa-solid fa-circle-notch fa-spin text-3xl mb-3 text-[#1E1B4B]" />
        <p className="text-xs font-medium font-mono">Memuat telemetri keuangan {activeGroup.name}...</p>
      </div>
    );
  }

  const kpis = data?.kpis;
  const categories = data?.categoryBreakdown || [];
  const timeline = data?.timeline || [];
  const topExpenses = data?.topExpenses || [];

  return (
    <div className="space-y-5">
      {/* Sleek Minimal Header Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-1">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-[#0F172A] tracking-tight font-heading">
            Ringkasan Keuangan
          </h2>
          <span className="text-xs text-slate-500 font-mono">
            {activeGroup.name} &bull; Ledger Real-Time
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => refetch()}
            icon="fa-solid fa-arrows-rotate"
          >
            Segarkan
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => setActiveTab('ledger')}
            icon="fa-solid fa-table-list"
          >
            Buka Buku Kas Belanja
          </Button>
        </div>
      </div>

      {/* Discrepancy Alert only if Selisih exists */}
      {kpis && kpis.reconciliationStatus !== 'OK - Sama' && (
        <div className="p-3.5 rounded-lg border bg-[#FFF1F2] border-[#FFE4E6] text-[#BE123C] flex items-center justify-between gap-3 text-xs shadow-none">
          <div className="flex items-center gap-2.5">
            <i className="fa-solid fa-triangle-exclamation text-sm shrink-0" />
            <div>
              <span className="font-bold">Selisih Rekonsiliasi Terdeteksi: </span>
              <span className="font-mono tabular-nums">
                Ledger ({formatRupiah(kpis.sumFromLedger)}) &ne; Kategori ({formatRupiah(kpis.sumFromCategoryBreakdown)})
              </span>
            </div>
          </div>
          <span className="font-mono font-bold px-2 py-0.5 rounded bg-white border border-[#FFE4E6]">
            Selisih {formatRupiah(Math.abs(kpis.sumFromLedger - kpis.sumFromCategoryBreakdown))}
          </span>
        </div>
      )}

      {/* 1. Executive Summary: KPI Cards */}
      {kpis && <KpiCards kpis={kpis} onFilterAnomalies={() => setActiveTab('ledger')} />}

      {/* 2. Breakdown Pengeluaran per Kategori */}
      {kpis && <CategoryBreakdownTable categories={categories} totalExpense={kpis.totalExpense} />}

      {/* 3. Grafik Tren & Top Pengeluaran Terbesar */}
      <SpendCharts categories={categories} timeline={timeline} topExpenses={topExpenses} />
    </div>
  );
};
