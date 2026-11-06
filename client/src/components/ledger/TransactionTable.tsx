import React, { useState, useMemo, useEffect } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
  type PaginationState,
} from '@tanstack/react-table';
import type { Transaction, GroupCategory, GroupRole } from '../../types/index.js';
import { formatRupiah, formatQuantity } from '../../utils/format.js';
import { Badge } from '../ui/Badge.js';
import { Button } from '../ui/Button.js';
import clsx from 'clsx';

export interface TransactionTableProps {
  transactions: Transaction[];
  categories: GroupCategory[];
  userRole: GroupRole;
  isSuperAdmin: boolean;
  onAddTransaction: () => void;
  onEditTransaction: (tx: Transaction) => void;
  onDeleteTransaction: (tx: Transaction) => void;
  onVerifyDuplicate: (tx: Transaction) => void;
  onManageReceipt: (tx: Transaction) => void;
  onExportExcel: () => void;
  onImportExcel: () => void;
  initialFilterStatus?: string;
}

export const TransactionTable: React.FC<TransactionTableProps> = ({
  transactions,
  categories,
  userRole,
  isSuperAdmin,
  onAddTransaction,
  onEditTransaction,
  onDeleteTransaction,
  onVerifyDuplicate,
  onManageReceipt,
  onExportExcel,
  onImportExcel,
  initialFilterStatus,
}) => {
  const canManage = userRole === 'GROUP_MANAGER' || isSuperAdmin;
  const canEdit = userRole === 'GROUP_MANAGER' || userRole === 'EDITOR' || isSuperAdmin;

  // Filter states
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>(initialFilterStatus || 'ALL');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showAdvancedFilter, setShowAdvancedFilter] = useState(false);
  const [sorting, setSorting] = useState<SortingState>([{ id: 'txDate', desc: true }]);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 25,
  });

  // Reset to first page when search or filters change
  useEffect(() => {
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  }, [search, selectedCategory, selectedStatus, selectedType, startDate, endDate]);

  // Apply filtering
  const filteredData = useMemo(() => {
    return transactions.filter((tx) => {
      // Keyword search
      if (search.trim()) {
        const kw = search.toLowerCase();
        const descMatch = tx.description.toLowerCase().includes(kw);
        const catMatch = tx.categoryName?.toLowerCase().includes(kw) || false;
        const noteMatch = tx.verificationNote?.toLowerCase().includes(kw) || false;
        const creatorMatch = tx.creatorName?.toLowerCase().includes(kw) || false;
        if (!descMatch && !catMatch && !noteMatch && !creatorMatch) return false;
      }

      // Category filter
      if (selectedCategory !== 'ALL') {
        if (selectedCategory === 'UNCATEGORIZED') {
          if (tx.categoryId) return false;
        } else {
          if (tx.categoryId !== selectedCategory) return false;
        }
      }

      // Status filter
      if (selectedStatus !== 'ALL') {
        if (selectedStatus === 'ANOMALIES') {
          if (tx.dataStatus !== 'POTENTIAL_DUPLICATE' && tx.dataStatus !== 'INCOMPLETE') return false;
        } else if (tx.dataStatus !== selectedStatus) {
          return false;
        }
      }

      // Type filter
      if (selectedType !== 'ALL' && tx.type !== selectedType) {
        return false;
      }

      // Date range filter
      if (startDate && tx.txDate < startDate) return false;
      if (endDate && tx.txDate > endDate) return false;

      return true;
    });
  }, [transactions, search, selectedCategory, selectedStatus, selectedType, startDate, endDate]);

  const columnHelper = createColumnHelper<Transaction>();

  const columns = useMemo(
    () => [
      columnHelper.display({
        id: 'rowNumber',
        header: () => <span className="w-8 text-center block">NO</span>,
        cell: (info) => (
          <span className="text-slate-400 font-mono text-xs tabular-nums text-center block w-8">
            {pagination.pageIndex * pagination.pageSize + info.row.index + 1}
          </span>
        ),
      }),
      columnHelper.accessor('txDate', {
        header: 'TANGGAL',
        cell: (info) => (
          <div className="font-mono text-xs text-slate-800 whitespace-nowrap tabular-nums">
            {info.getValue()}
          </div>
        ),
      }),
      columnHelper.accessor('type', {
        header: 'TIPE',
        cell: (info) => {
          const type = info.getValue();
          return type === 'INCOME' ? (
            <span className="inline-flex items-center h-5 px-1.5 text-[11px] font-semibold rounded-full bg-[#F0FDF4] text-[#15803D] border border-[#DCFCE7] whitespace-nowrap">
              Inflow
            </span>
          ) : (
            <span className="inline-flex items-center h-5 px-1.5 text-[11px] font-semibold rounded-full bg-[#F1F5F9] text-[#475569] whitespace-nowrap">
              Outflow
            </span>
          );
        },
      }),
      columnHelper.accessor('description', {
        header: 'URAIAN / DESKRIPSI',
        cell: (info) => {
          const tx = info.row.original;
          return (
            <div className="max-w-xs md:max-w-sm truncate py-0.5">
              <div className="text-xs font-semibold text-slate-900 truncate" title={info.getValue()}>
                {info.getValue()}
              </div>
              {tx.verificationNote && (
                <div className="text-[11px] text-slate-500 flex items-center gap-1 font-sans truncate" title={tx.verificationNote}>
                  <i className="fa-regular fa-note-sticky text-[10px] text-slate-400" />
                  <span className="truncate">{tx.verificationNote}</span>
                </div>
              )}
            </div>
          );
        },
      }),
      columnHelper.accessor('categoryName', {
        header: 'KATEGORI',
        cell: (info) => {
          const val = info.getValue();
          return val ? (
            <span className="text-xs text-slate-800 font-medium whitespace-nowrap">{val}</span>
          ) : (
            <span className="text-[11px] italic text-amber-800 bg-[#FFFBEB] px-1.5 py-0.5 rounded border border-[#FDE68A] whitespace-nowrap">
              Unassigned
            </span>
          );
        },
      }),
      columnHelper.accessor('quantity', {
        header: () => <span className="text-right block">JUMLAH</span>,
        cell: (info) => (
          <div className="text-right font-mono text-xs text-slate-700 tabular-nums">
            {formatQuantity(info.getValue())}
          </div>
        ),
      }),
      columnHelper.accessor('unit', {
        header: 'SATUAN',
        cell: (info) => (
          <span className="text-xs text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded font-mono whitespace-nowrap">
            {info.getValue()}
          </span>
        ),
      }),
      columnHelper.accessor('unitPrice', {
        header: () => <span className="text-right block">HARGA SATUAN</span>,
        cell: (info) => (
          <div className="text-right font-mono text-xs text-slate-600 tabular-nums">
            {formatRupiah(info.getValue())}
          </div>
        ),
      }),
      columnHelper.accessor('totalPrice', {
        header: () => <span className="text-right block">TOTAL HARGA</span>,
        cell: (info) => (
          <div className="text-right font-mono text-xs font-bold text-[#1E1B4B] tabular-nums">
            {formatRupiah(info.getValue())}
          </div>
        ),
      }),
      columnHelper.accessor('dataStatus', {
        header: 'CEK DATA',
        cell: (info) => <Badge status={info.getValue()} size="sm" />,
      }),
      columnHelper.accessor('creatorName', {
        header: 'INPUT OLEH',
        cell: (info) => (
          <span className="text-xs text-slate-500 whitespace-nowrap">
            {info.getValue() || '-'}
          </span>
        ),
      }),
      columnHelper.display({
        id: 'receipt',
        header: 'NOTA',
        cell: (info) => {
          const tx = info.row.original;
          const hasReceipt = !!tx.receiptPath;
          return (
            <button
              type="button"
              onClick={() => onManageReceipt(tx)}
              className={clsx(
                'w-7 h-7 rounded flex items-center justify-center transition-colors text-xs',
                hasReceipt
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100'
                  : 'bg-slate-50 text-slate-400 border border-slate-200 hover:text-slate-700 hover:bg-slate-100'
              )}
              title={hasReceipt ? 'Lihat Nota Terlampir' : 'Unggah Nota'}
            >
              <i className={hasReceipt ? 'fa-solid fa-paperclip' : 'fa-regular fa-file'} />
            </button>
          );
        },
      }),
      columnHelper.display({
        id: 'actions',
        header: () => <span className="text-right block">AKSI</span>,
        cell: (info) => {
          const tx = info.row.original;
          return (
            <div className="flex items-center justify-end gap-1">
              {tx.dataStatus === 'POTENTIAL_DUPLICATE' && canManage && (
                <button
                  type="button"
                  onClick={() => onVerifyDuplicate(tx)}
                  className="px-2 py-0.5 text-[11px] font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded transition-colors flex items-center gap-1 active:scale-[0.99]"
                  title="Konfirmasi Bukan Dobel"
                >
                  <i className="fa-solid fa-shield-check text-[10px]" />
                  <span className="hidden xl:inline">Bukan Dobel</span>
                </button>
              )}

              {canEdit && (
                <button
                  type="button"
                  onClick={() => onEditTransaction(tx)}
                  className="w-7 h-7 rounded text-slate-500 hover:text-[#1E1B4B] hover:bg-slate-100 transition-colors flex items-center justify-center active:scale-[0.99]"
                  title="Ubah Transaksi"
                >
                  <i className="fa-solid fa-pen text-xs" />
                </button>
              )}

              {canEdit && (
                <button
                  type="button"
                  onClick={() => onDeleteTransaction(tx)}
                  className="w-7 h-7 rounded text-slate-400 hover:text-rose-700 hover:bg-rose-50 transition-colors flex items-center justify-center active:scale-[0.99]"
                  title="Hapus Transaksi"
                >
                  <i className="fa-regular fa-trash-can text-xs" />
                </button>
              )}
            </div>
          );
        },
      }),
    ],
    [
      canManage,
      canEdit,
      pagination.pageIndex,
      pagination.pageSize,
      onEditTransaction,
      onDeleteTransaction,
      onVerifyDuplicate,
      onManageReceipt,
    ]
  );

  const table = useReactTable({
    data: filteredData,
    columns,
    state: { sorting, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const anomalyCount = transactions.filter(
    (t) => t.dataStatus === 'POTENTIAL_DUPLICATE' || t.dataStatus === 'INCOMPLETE'
  ).length;

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-1">
        <div className="flex items-center gap-2.5">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight font-heading">
            Buku Kas Belanja
          </h2>
          <span className="inline-flex items-center h-5 px-2 text-[10px] font-semibold rounded bg-slate-100 text-slate-700 font-mono border border-[#E2E8F0]">
            {filteredData.length} Baris
          </span>
        </div>
      </div>

      {/* Unified Compact Action Bar */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-3 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shadow-none no-gradient">
        {/* Left: Search input & Quick Segment Tabs */}
        <div className="flex-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          {/* Keyword Search */}
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <i className="fa-solid fa-magnifying-glass text-xs" />
            </div>
            <input
              type="text"
              placeholder="Cari uraian, kategori, catatan..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-9 px-3 pl-8.5 rounded-lg border border-[#E2E8F0] bg-slate-50/50 text-xs font-sans text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#1E1B4B] focus:bg-white transition-colors"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600"
              >
                <i className="fa-solid fa-xmark text-xs" />
              </button>
            )}
          </div>

          {/* Quick Segment Tabs */}
          <div className="inline-flex items-center p-0.5 rounded-lg bg-slate-100/80 border border-slate-200/60 text-xs shrink-0">
            <button
              type="button"
              onClick={() => {
                setSelectedType('ALL');
                setSelectedStatus('ALL');
              }}
              className={clsx(
                'px-2.5 py-1 rounded-md font-medium text-xs transition-all',
                selectedType === 'ALL' && selectedStatus === 'ALL'
                  ? 'bg-white text-slate-900 shadow-sm font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              )}
            >
              Semua
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedType('EXPENSE');
                setSelectedStatus('ALL');
              }}
              className={clsx(
                'px-2.5 py-1 rounded-md font-medium text-xs transition-all',
                selectedType === 'EXPENSE'
                  ? 'bg-white text-slate-900 shadow-sm font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              )}
            >
              Pengeluaran
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedType('INCOME');
                setSelectedStatus('ALL');
              }}
              className={clsx(
                'px-2.5 py-1 rounded-md font-medium text-xs transition-all',
                selectedType === 'INCOME'
                  ? 'bg-white text-slate-900 shadow-sm font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              )}
            >
              Pemasukan
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedStatus(selectedStatus === 'ANOMALIES' ? 'ALL' : 'ANOMALIES');
              }}
              className={clsx(
                'px-2.5 py-1 rounded-md font-medium text-xs flex items-center gap-1.5 transition-all',
                selectedStatus === 'ANOMALIES'
                  ? 'bg-amber-100 text-amber-900 font-bold border border-amber-300'
                  : 'text-slate-600 hover:text-slate-900'
              )}
            >
              <span>Perlu Cek</span>
              {anomalyCount > 0 && (
                <span className="font-mono text-[11px] text-amber-700 font-semibold">
                  ({anomalyCount})
                </span>
              )}
            </button>
          </div>

          {/* Toggle Filter Lanjutan */}
          <button
            type="button"
            onClick={() => setShowAdvancedFilter(!showAdvancedFilter)}
            className={clsx(
              'h-9 px-2.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-colors shrink-0',
              showAdvancedFilter || selectedCategory !== 'ALL' || startDate || endDate
                ? 'bg-indigo-50 border-indigo-200 text-indigo-900 font-semibold'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            )}
            title="Filter Tanggal dan Kategori"
          >
            <i className="fa-solid fa-filter text-[11px]" />
            <span className="hidden sm:inline">Filter</span>
            {(selectedCategory !== 'ALL' || startDate || endDate) && (
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-600" />
            )}
          </button>
        </div>

        {/* Right: Standardized Functional Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="secondary"
            size="sm"
            onClick={onExportExcel}
            icon="fa-solid fa-file-excel"
          >
            Export .xlsx
          </Button>

          {canEdit && (
            <Button
              variant="secondary"
              size="sm"
              onClick={onImportExcel}
              icon="fa-solid fa-file-import"
            >
              Import Excel
            </Button>
          )}

          {canEdit && (
            <Button
              variant="primary"
              size="sm"
              onClick={onAddTransaction}
              icon="fa-solid fa-plus"
            >
              Tambah Transaksi
            </Button>
          )}
        </div>
      </div>

      {/* Collapsible Advanced Filters (Only displayed on demand) */}
      {showAdvancedFilter && (
        <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            {/* Category Dropdown */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 font-medium">Kategori:</span>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="h-8 px-2.5 rounded-md border border-slate-200 bg-white text-xs font-sans text-slate-800 focus:outline-none focus:border-[#1E1B4B]"
              >
                <option value="ALL">Semua Kategori</option>
                <option value="UNCATEGORIZED">-- Belum dikategorikan --</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Date Range Picker */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 font-medium">Periode:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-8 px-2 rounded-md border border-slate-200 bg-white text-xs font-mono text-slate-800 focus:outline-none focus:border-[#1E1B4B]"
              />
              <span className="text-slate-400">s/d</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-8 px-2 rounded-md border border-slate-200 bg-white text-xs font-mono text-slate-800 focus:outline-none focus:border-[#1E1B4B]"
              />
            </div>
          </div>

          {/* Reset Action */}
          {(search || selectedCategory !== 'ALL' || selectedStatus !== 'ALL' || selectedType !== 'ALL' || startDate || endDate) && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setSelectedCategory('ALL');
                setSelectedStatus('ALL');
                setSelectedType('ALL');
                setStartDate('');
                setEndDate('');
              }}
              className="text-indigo-700 hover:underline font-semibold flex items-center gap-1"
            >
              <i className="fa-solid fa-rotate-left text-[10px]" />
              <span>Reset Filter</span>
            </button>
          )}
        </div>
      )}

      {/* Spreadsheet Data Grid */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.03)] no-gradient">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr
                  key={headerGroup.id}
                  className="h-11 bg-[#FAFAFA] border-b border-[#E2E8F0]"
                >
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="px-3 text-[11px] font-semibold text-slate-500 tracking-[0.04em] uppercase cursor-pointer select-none whitespace-nowrap font-sans"
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      <div className="flex items-center gap-1.5">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {{
                          asc: <i className="fa-solid fa-arrow-up text-[10px] text-[#1E1B4B]" />,
                          desc: <i className="fa-solid fa-arrow-down text-[10px] text-[#1E1B4B]" />,
                        }[header.column.getIsSorted() as string] ?? null}
                      </div>
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-[#F1F5F9]">
              {table.getRowModel().rows.length > 0 ? (
                table.getRowModel().rows.map((row) => {
                  const tx = row.original;
                  const isDuplicate = tx.dataStatus === 'POTENTIAL_DUPLICATE';
                  const isIncomplete = tx.dataStatus === 'INCOMPLETE';

                  return (
                    <tr
                      key={row.id}
                      className={clsx(
                        'h-11 hover:bg-[#F8FAFC] transition-colors',
                        isDuplicate && 'bg-[#FFFBEB]/40 border-l-4 border-l-amber-500',
                        isIncomplete && 'bg-[#FFF1F2]/40 border-l-4 border-l-rose-500'
                      )}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="px-3 py-1.5 whitespace-nowrap">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={columns.length} className="py-12 text-center text-slate-400">
                    <i className="fa-solid fa-file-circle-question text-3xl mb-2 text-slate-300" />
                    <div>Tidak ada transaksi yang cocok dengan filter.</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-3.5 py-2.5 bg-white border border-[#E2E8F0] rounded-lg text-xs text-slate-600 shadow-none no-gradient">
        <div className="flex items-center gap-2 flex-wrap">
          <span>Tampilkan:</span>
          <select
            value={table.getState().pagination.pageSize}
            onChange={(e) => {
              table.setPageSize(Number(e.target.value));
            }}
            className="h-7 px-2 bg-slate-50 border border-[#CBD5E1] rounded text-slate-800 font-medium focus:outline-none focus:border-[#1E1B4B]"
          >
            {[25, 50, 100].map((size) => (
              <option key={size} value={size}>
                {size} baris
              </option>
            ))}
            <option value={Math.max(filteredData.length, 1000)}>Semua</option>
          </select>
          <span className="text-slate-300">|</span>
          <span className="font-mono text-slate-700">
            {filteredData.length === 0
              ? '0 transaksi'
              : `${table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1} - ${Math.min(
                  (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
                  filteredData.length
                )} dari ${filteredData.length} transaksi`}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
            className="h-7 w-7 rounded border border-[#E2E8F0] flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 transition-colors"
            title="Halaman Pertama"
            aria-label="Halaman Pertama"
          >
            <i className="fa-solid fa-angles-left text-[10px]" />
          </button>
          <button
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="h-7 w-7 rounded border border-[#E2E8F0] flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 transition-colors"
            title="Sebelumnya"
            aria-label="Sebelumnya"
          >
            <i className="fa-solid fa-angle-left text-[10px]" />
          </button>

          <span className="px-2 font-mono text-slate-700">
            Hal <strong>{table.getPageCount() === 0 ? 0 : table.getState().pagination.pageIndex + 1}</strong> dari{' '}
            <strong>{table.getPageCount()}</strong>
          </span>

          <button
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="h-7 w-7 rounded border border-[#E2E8F0] flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 transition-colors"
            title="Selanjutnya"
            aria-label="Selanjutnya"
          >
            <i className="fa-solid fa-angle-right text-[10px]" />
          </button>
          <button
            onClick={() => table.setPageIndex(table.getPageCount() - 1)}
            disabled={!table.getCanNextPage()}
            className="h-7 w-7 rounded border border-[#E2E8F0] flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 transition-colors"
            title="Halaman Terakhir"
            aria-label="Halaman Terakhir"
          >
            <i className="fa-solid fa-angles-right text-[10px]" />
          </button>
        </div>
      </div>
    </div>
  );
};

