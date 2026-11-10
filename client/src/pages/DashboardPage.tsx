import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client.js';
import { useAppStore } from '../store/useAppStore.js';
import type { AnalyticsReport } from '../types/index.js';
import { KpiCards } from '../components/dashboard/KpiCards.js';
import { CategoryBreakdownTable } from '../components/dashboard/CategoryBreakdownTable.js';
import { Button } from '../components/ui/Button.js';
import { formatRupiah } from '../utils/format.js';

export const DashboardPage: React.FC = () => {
  const { user, activeGroup, setActiveTab } = useAppStore();

  const { data, isLoading, refetch } = useQuery<{ success: boolean } & AnalyticsReport>({
    queryKey: ['analytics', activeGroup?.id],
    queryFn: () => (activeGroup ? api.get(`/api/groups/${activeGroup.id}/analytics`) : Promise.reject('No group')),
    enabled: !!activeGroup,
  });

  if (!activeGroup) {
    return (
      <div className="py-20 text-center max-w-md mx-auto px-4">
        <div className="w-12 h-12 rounded bg-slate-100 text-slate-400 mx-auto flex items-center justify-center text-xl mb-3">
          <i className="fa-solid fa-layer-group" />
        </div>
        <h3 className="text-base font-bold text-slate-800 font-heading">Belum Ada Grup Keuangan Aktif</h3>
        <p className="text-xs text-slate-500 mt-1.5 font-sans leading-relaxed">
          {user?.systemRole === 'SUPER_ADMIN'
            ? 'Database siap dan bersih. Buat grup keuangan atau buku kas pertama Anda melalui Konsol Admin.'
            : 'Akun Anda belum terdaftar di grup pembukuan mana pun. Silakan hubungi Administrator untuk mendapatkan akses ke grup.'}
        </p>
        {user?.systemRole === 'SUPER_ADMIN' && (
          <Button
            variant="primary"
            size="sm"
            className="mt-4"
            onClick={() => setActiveTab('admin')}
            icon="fa-solid fa-shield-halved"
          >
            Buka Konsol Admin & Buat Grup
          </Button>
        )}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="py-24 text-center text-slate-400">
        <i className="fa-solid fa-circle-notch fa-spin text-3xl mb-3 text-[#1E1B4B]" />
        <p className="text-xs font-medium font-sans">Memuat data keuangan {activeGroup.name}...</p>
      </div>
    );
  }

  const kpis = data?.kpis;
  const categories = data?.categoryBreakdown || [];

  return (
    <div className="space-y-4">
      {/* Header Toolbar */}
      <div className="flex items-center justify-between pb-1">
        <div>
          <h2 className="text-sm sm:text-base font-semibold text-[#0F172A] tracking-tight font-heading">
            Ringkasan Keuangan
          </h2>
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
                Total Kas ({formatRupiah(kpis.sumFromLedger)}) &ne; Total Rincian ({formatRupiah(kpis.sumFromCategoryBreakdown)})
              </span>
            </div>
          </div>
          <span className="font-mono font-bold px-2 py-0.5 rounded bg-white border border-[#FFE4E6]">
            Selisih {formatRupiah(Math.abs(kpis.sumFromLedger - kpis.sumFromCategoryBreakdown))}
          </span>
        </div>
      )}

      {/* 1. Executive Summary: Minimalist KPI Cards */}
      {kpis && <KpiCards kpis={kpis} onFilterAnomalies={() => setActiveTab('ledger')} />}

      {/* 2. Breakdown Pengeluaran per Kategori */}
      {kpis && <CategoryBreakdownTable categories={categories} totalExpense={kpis.totalExpense} />}
    </div>
  );
};
