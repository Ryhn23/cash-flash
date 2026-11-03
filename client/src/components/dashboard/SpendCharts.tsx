import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  Legend,
} from 'recharts';
import type { CategoryBreakdownItem, TimelineItem, TopExpenseItem } from '../../types/index.js';
import { formatRupiah, formatDateIndo } from '../../utils/format.js';
import { Badge } from '../ui/Badge.js';

export interface SpendChartsProps {
  categories: CategoryBreakdownItem[];
  timeline: TimelineItem[];
  topExpenses: TopExpenseItem[];
}

export const SpendCharts: React.FC<SpendChartsProps> = ({
  categories,
  timeline,
  topExpenses,
}) => {
  const sortedCategories = [...categories]
    .filter((c) => c.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 6);

  // Floating precision tooltip per DESIGN.md
  const CustomBarTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="floating-overlay p-2.5 rounded text-xs no-gradient">
          <div className="font-semibold text-slate-900 font-heading">{data.name}</div>
          <div className="text-[#1E1B4B] font-bold font-mono tabular-data mt-0.5">
            {formatRupiah(data.total)}
          </div>
          <div className="text-[#64748B] text-[11px] mt-0.5 font-sans">
            {data.count} Transaksi ({data.percentage}%)
          </div>
        </div>
      );
    }
    return null;
  };

  const CustomLineTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="floating-overlay p-2.5 rounded text-xs no-gradient">
          <div className="font-semibold text-slate-900 mb-1 font-heading">{formatDateIndo(label)}</div>
          {payload.map((p: any, i: number) => (
            <div key={i} className="flex items-center gap-2 text-slate-700">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
              <span className="font-sans text-xs">{p.name}:</span>
              <span className="font-bold font-mono tabular-data">{formatRupiah(p.value)}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* 1. Category Spend Horizontal Bar Chart */}
      <div className="bg-white border border-[#E2E8F0] rounded-lg p-4 no-gradient">
        <div className="flex items-center justify-between mb-3 border-b border-[#E2E8F0] pb-2.5">
          <h4 className="text-sm font-semibold text-slate-900 font-heading">Alokasi Belanja</h4>
          <span className="label-sm px-2 py-0.5 bg-[#F1F5F9] rounded text-slate-600 font-mono">
            6 Pos Teratas
          </span>
        </div>

        <div className="h-64 w-full">
          {sortedCategories.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={sortedCategories}
                layout="vertical"
                margin={{ top: 5, right: 20, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F1F5F9" />
                <XAxis
                  type="number"
                  tickFormatter={(val) => `Rp ${(val / 1000000).toFixed(0)}Jt`}
                  tick={{ fontSize: 10, fill: '#64748B', fontFamily: 'Geist Mono' }}
                  axisLine={{ stroke: '#E2E8F0' }}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 11, fill: '#0F172A', fontWeight: 500, fontFamily: 'Inter' }}
                  axisLine={{ stroke: '#E2E8F0' }}
                  width={90}
                />
                <Tooltip content={<CustomBarTooltip />} />
                <Bar dataKey="total" fill="#1E1B4B" radius={[0, 2, 2, 0]} barSize={14} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-slate-400">
              Belum ada data pengeluaran
            </div>
          )}
        </div>
      </div>

      {/* 2. Daily Spend vs Income Trend Line Chart */}
      <div className="bg-white border border-[#E2E8F0] rounded-lg p-4 no-gradient">
        <div className="flex items-center justify-between mb-3 border-b border-[#E2E8F0] pb-2.5">
          <h4 className="text-sm font-semibold text-slate-900 font-heading">Tren Arus Kas</h4>
          <span className="label-sm px-2 py-0.5 bg-[#F1F5F9] rounded text-slate-600 font-mono">
            Harian
          </span>
        </div>

        <div className="h-64 w-full">
          {timeline.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={timeline}
                margin={{ top: 5, right: 20, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatDateIndo}
                  tick={{ fontSize: 10, fill: '#64748B', fontFamily: 'Geist Mono' }}
                  axisLine={{ stroke: '#E2E8F0' }}
                />
                <YAxis
                  tickFormatter={(val) => `${(val / 1000000).toFixed(0)}M`}
                  tick={{ fontSize: 10, fill: '#64748B', fontFamily: 'Geist Mono' }}
                  axisLine={{ stroke: '#E2E8F0' }}
                />
                <Tooltip content={<CustomLineTooltip />} />
                <Legend
                  wrapperStyle={{ fontSize: 11, paddingTop: 10 }}
                  iconType="circle"
                />
                <Line
                  type="monotone"
                  dataKey="expense"
                  name="Pengeluaran (Rp)"
                  stroke="#1E1B4B"
                  strokeWidth={2}
                  dot={{ fill: '#1E1B4B', r: 3, strokeWidth: 0 }}
                  activeDot={{ r: 4, fill: '#3730A3' }}
                />
                <Line
                  type="monotone"
                  dataKey="income"
                  name="Pemasukan (Rp)"
                  stroke="#0D9488"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  dot={{ fill: '#0D9488', r: 3, strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-slate-400">
              Belum ada riwayat transaksi
            </div>
          )}
        </div>
      </div>

      {/* 3. Top Expense Items List */}
      <div className="lg:col-span-2 bg-white border border-[#E2E8F0] rounded-lg p-4 no-gradient">
        <div className="flex items-center justify-between mb-3 border-b border-[#E2E8F0] pb-2.5">
          <h4 className="text-sm font-semibold text-slate-900 font-heading">Top 5 Pengeluaran</h4>
          <span className="label-sm px-2 py-0.5 bg-[#F1F5F9] rounded text-slate-600 font-mono">
            Nominal Tertinggi
          </span>
        </div>

        <div className="divide-y divide-[#E2E8F0] border border-[#E2E8F0] rounded overflow-hidden">
          {topExpenses.map((tx, idx) => (
            <div
              key={tx.id}
              className="h-11 px-4 flex items-center justify-between hover:bg-[#F8FAFC] transition-colors gap-4"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="font-mono text-xs text-slate-400 w-4 text-center">
                  {idx + 1}
                </span>
                <div className="truncate">
                  <span className="text-xs font-medium text-slate-900 truncate">
                    {tx.description}
                  </span>
                  <span className="text-[11px] text-slate-400 ml-2 font-mono">
                    {formatDateIndo(tx.txDate)} &bull; {tx.categoryName}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-4 shrink-0">
                <div className="text-right font-mono tabular-data text-xs font-bold text-[#0F172A]">
                  {formatRupiah(tx.totalPrice)}
                </div>
                <Badge status={tx.dataStatus} size="sm" />
              </div>
            </div>
          ))}

          {topExpenses.length === 0 && (
            <div className="p-8 text-center text-xs text-slate-400">
              Belum ada data pengeluaran dicatat.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
