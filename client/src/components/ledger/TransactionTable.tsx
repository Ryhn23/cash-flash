import React, { useState, useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
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
  const [sorting, setSorting] = useState<SortingState>([{ id: 'txDate', desc: true }]);

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
            {info.row.index + 1}
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
    [canManage, canEdit, onEditTransaction, onDeleteTransaction, onVerifyDuplicate, onManageReceipt]
  );

  const table = useReactTable({
    data: filteredData,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const anomalyCount = transactions.filter(
    (t) => t.dataStatus === 'POTENTIAL_DUPLICATE' || t.dataStatus === 'INCOMPLETE'
  ).length;

  return (
    <div className="space-y-4">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight font-heading">
            Buku Kas Belanja
          </h2>
          <span className="inline-flex items-center h-5 px-2 text-[10px] font-semibold rounded bg-slate-100 text-slate-700 font-mono border border-[#E2E8F0]">
            {filteredData.length} Baris
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
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

          <Button
            variant="secondary"
            size="sm"
            onClick={onExportExcel}
            icon="fa-solid fa-file-excel"
            className="text-emerald-800 hover:bg-emerald-50 border-emerald-200"
          >
            Export .xlsx (Safir)
          </Button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white border border-[#E2E8F0] rounded-lg p-3.5 space-y-3 no-gradient shadow-none">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
          {/* Keyword Search */}
          <div className="relative sm:col-span-2">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <i className="fa-solid fa-magnifying-glass text-xs" />
            </div>
            <input
              type="text"
              placeholder="Cari uraian, kategori, catatan..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-[38px] px-3 pl-9 rounded border border-[#E2E8F0] bg-white text-xs font-sans text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#3730A3] focus:ring-2 focus:ring-[#3730A3]/10"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
              >
                <i className="fa-solid fa-xmark text-xs" />
              </button>
            )}
          </div>

          {/* Filter Category */}
          <div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full h-[38px] px-2.5 rounded border border-[#E2E8F0] bg-white text-xs font-sans text-slate-800 focus:outline-none focus:border-[#3730A3] focus:ring-2 focus:ring-[#3730A3]/10"
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

          {/* Filter Status */}
          <div>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className={clsx(
                'w-full h-[38px] px-2.5 rounded border border-[#E2E8F0] bg-white text-xs font-sans text-slate-800 focus:outline-none focus:border-[#3730A3] focus:ring-2 focus:ring-[#3730A3]/10',
                selectedStatus === 'ANOMALIES' && 'bg-[#FFFBEB] text-[#92400E] border-[#FDE68A] font-bold'
              )}
            >
              <option value="ALL">Semua Status Cek</option>
              <option value="ANOMALIES">Perlu Cek ({anomalyCount})</option>
              <option value="POTENTIAL_DUPLICATE">Mungkin Dobel</option>
              <option value="INCOMPLETE">Belum Lengkap</option>
              <option value="VERIFIED_DUPLICATE_OK">Terverifikasi (Bukan Dobel)</option>
              <option value="OK">OK</option>
            </select>
          </div>

          {/* Filter Type */}
          <div>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full h-[38px] px-2.5 rounded border border-[#E2E8F0] bg-white text-xs font-sans text-slate-800 focus:outline-none focus:border-[#3730A3] focus:ring-2 focus:ring-[#3730A3]/10"
            >
              <option value="ALL">Semua Tipe</option>
              <option value="EXPENSE">Pengeluaran (Outflow)</option>
              <option value="INCOME">Pemasukan (Inflow)</option>
            </select>
          </div>
        </div>

        {/* Date Filter & Active Filters Reset */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pt-2 border-t border-[#F1F5F9] text-xs font-sans">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-slate-500 font-medium">Rentang Tanggal:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-[32px] px-2 rounded border border-[#E2E8F0] bg-white text-xs font-mono text-slate-800 focus:outline-none focus:border-[#3730A3]"
            />
            <span className="text-slate-400">s/d</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-[32px] px-2 rounded border border-[#E2E8F0] bg-white text-xs font-mono text-slate-800 focus:outline-none focus:border-[#3730A3]"
            />
          </div>

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
              className="text-[#3730A3] hover:underline font-semibold flex items-center gap-1 active:scale-[0.99]"
            >
              <i className="fa-solid fa-rotate-left text-[10px]" />
              <span>Reset Semua Filter</span>
            </button>
          )}
        </div>
      </div>

      {/* Spreadsheet Data Grid */}
      <div className="bg-white border border-[#E2E8F0] rounded-lg overflow-hidden shadow-none no-gradient">
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
    </div>
  );
};

