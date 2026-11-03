import React from 'react';
import type { CategoryBreakdownItem } from '../../types/index.js';
import { formatRupiah } from '../../utils/format.js';
import clsx from 'clsx';

export interface CategoryBreakdownTableProps {
  categories: CategoryBreakdownItem[];
  totalExpense: number;
}

export const CategoryBreakdownTable: React.FC<CategoryBreakdownTableProps> = ({
  categories,
  totalExpense,
}) => {
  const totalCount = categories.reduce((sum, c) => sum + c.count, 0);

  return (
    <div className="bg-white border border-[#E2E8F0] rounded-lg overflow-hidden no-gradient">
      <div className="px-4 py-3 border-b border-[#E2E8F0] flex items-center justify-between bg-white">
        <h3 className="text-sm font-semibold text-[#0F172A] tracking-tight font-heading">
          Pengeluaran per Kategori
        </h3>
        <span className="text-[10px] font-semibold text-slate-600 bg-[#F1F5F9] px-2 py-0.5 rounded border border-[#E2E8F0] font-mono">
          {categories.length} Kategori
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-[#FAFAFA] border-b border-[#E2E8F0] text-slate-500 h-9">
              <th className="px-4 w-12 text-center label-sm">No</th>
              <th className="px-4 label-sm">Kategori</th>
              <th className="px-4 text-center label-sm">Transaksi</th>
              <th className="px-4 text-right label-sm">Total Belanja</th>
              <th className="px-4 text-right label-sm">Porsi</th>
              <th className="px-4 w-40 label-sm">Visualisasi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E2E8F0]">
            {categories.map((cat, idx) => {
              const isUncategorized = cat.id === null;
              return (
                <tr
                  key={cat.id || 'uncategorized'}
                  className={clsx(
                    'h-11 hover:bg-[#F8FAFC] transition-colors',
                    isUncategorized && cat.count > 0 && 'bg-[#FFFBEB]/30'
                  )}
                >
                  <td className="px-4 text-center text-slate-400 font-mono text-xs">
                    {idx + 1}
                  </td>
                  <td className="px-4 font-medium text-slate-900">
                    <div className="flex items-center gap-2">
                      <div
                        className={clsx(
                          'w-2 h-2 rounded-full shrink-0',
                          isUncategorized ? 'bg-[#92400E]' : 'bg-[#1E1B4B]'
                        )}
                      />
                      <span className={clsx(isUncategorized && 'italic text-[#92400E] font-semibold')}>
                        {cat.name}
                      </span>
                      {isUncategorized && cat.count > 0 && (
                        <span className="h-4 px-1.5 text-[9px] font-bold rounded-full bg-[#FFFBEB] text-[#92400E] border border-[#FDE68A] inline-flex items-center">
                          Perlu Cek
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 text-center font-mono tabular-data text-slate-700">
                    {cat.count}
                  </td>
                  <td className="px-4 text-right font-mono tabular-data font-semibold text-[#0F172A]">
                    {formatRupiah(cat.total)}
                  </td>
                  <td className="px-4 text-right font-mono tabular-data font-bold text-[#1E1B4B]">
                    {cat.percentage}%
                  </td>
                  <td className="px-4">
                    <div className="w-full bg-[#F1F5F9] h-1.5 rounded-full overflow-hidden">
                      <div
                        className={clsx(
                          'h-full rounded-full transition-all duration-300',
                          isUncategorized ? 'bg-[#92400E]' : 'bg-[#1E1B4B]'
                        )}
                        style={{ width: `${Math.min(cat.percentage, 100)}%` }}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-[#FAFAFA] border-t-2 border-[#1E1B4B] font-bold text-slate-900 h-11">
              <td colSpan={2} className="px-4 uppercase tracking-wider text-[11px] font-heading">
                Total Keseluruhan
              </td>
              <td className="px-4 text-center font-mono tabular-data text-xs">{totalCount}</td>
              <td className="px-4 text-right font-mono tabular-data text-sm text-[#1E1B4B]">
                {formatRupiah(totalExpense)}
              </td>
              <td className="px-4 text-right font-mono tabular-data text-xs">100.0%</td>
              <td className="px-4">
                <div className="w-full bg-[#1E1B4B] h-1.5 rounded-full" />
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};
