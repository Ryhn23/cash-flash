import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal.js';
import { Button } from '../ui/Button.js';
import { Input } from '../ui/Input.js';
import { Select } from '../ui/Select.js';
import type { Transaction, GroupCategory } from '../../types/index.js';
import { formatRupiah, parseRupiahInput } from '../../utils/format.js';
import clsx from 'clsx';

export interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  transaction?: Transaction | null;
  categories: GroupCategory[];
  units: string[];
}

export const TransactionModal: React.FC<TransactionModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  transaction,
  categories,
  units,
}) => {
  const isEditing = !!transaction;

  // Calculation mode: 'FORWARD' (Qty * UnitPrice = Total) vs 'REVERSE' (Total / Qty = UnitPrice)
  const [calcMode, setCalcMode] = useState<'FORWARD' | 'REVERSE'>('FORWARD');

  const [txDate, setTxDate] = useState('');
  const [type, setType] = useState<'EXPENSE' | 'INCOME'>('EXPENSE');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [unit, setUnit] = useState<string>('Unit');
  const [customUnit, setCustomUnit] = useState<string>('');
  const [isCustomUnit, setIsCustomUnit] = useState(false);
  const [unitPrice, setUnitPrice] = useState<number>(0);
  const [totalPrice, setTotalPrice] = useState<number>(0);
  const [verificationNote, setVerificationNote] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize form state
  useEffect(() => {
    if (transaction) {
      setTxDate(transaction.txDate);
      setType(transaction.type);
      setDescription(transaction.description);
      setCategoryId(transaction.categoryId || '');
      setQuantity(transaction.quantity);
      setUnitPrice(transaction.unitPrice);
      setTotalPrice(transaction.totalPrice);
      setVerificationNote(transaction.verificationNote || '');

      if (units.includes(transaction.unit)) {
        setUnit(transaction.unit);
        setIsCustomUnit(false);
      } else {
        setUnit('CUSTOM');
        setCustomUnit(transaction.unit);
        setIsCustomUnit(true);
      }
    } else {
      // Default new transaction
      setTxDate(new Date().toISOString().split('T')[0]);
      setType('EXPENSE');
      setDescription('');
      setCategoryId(categories[0]?.id || '');
      setQuantity(1);
      setUnit(units[0] || 'Unit');
      setCustomUnit('');
      setIsCustomUnit(false);
      setUnitPrice(0);
      setTotalPrice(0);
      setVerificationNote('');
      setCalcMode('FORWARD');
    }
    setError(null);
  }, [transaction, isOpen, categories, units]);

  // Dual-Direction Auto-Calculation
  const handleQuantityChange = (val: number) => {
    const qty = Math.max(0.001, val);
    setQuantity(qty);
    if (calcMode === 'FORWARD') {
      setTotalPrice(Math.round(qty * unitPrice));
    } else {
      if (totalPrice > 0) {
        setUnitPrice(totalPrice / qty);
      }
    }
  };

  const handleUnitPriceChange = (val: number) => {
    setUnitPrice(val);
    if (calcMode === 'FORWARD') {
      setTotalPrice(Math.round(quantity * val));
    }
  };

  const handleTotalPriceChange = (val: number) => {
    setTotalPrice(val);
    if (calcMode === 'REVERSE') {
      if (quantity > 0) {
        setUnitPrice(val / quantity);
      }
    }
  };

  const handleModeSwitch = (mode: 'FORWARD' | 'REVERSE') => {
    setCalcMode(mode);
    if (mode === 'FORWARD') {
      setTotalPrice(Math.round(quantity * unitPrice));
    } else {
      if (quantity > 0 && totalPrice > 0) {
        setUnitPrice(totalPrice / quantity);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!description.trim()) {
      setError('Uraian belanja wajib diisi');
      return;
    }

    if (quantity <= 0) {
      setError('Jumlah (Qty) harus lebih dari 0');
      return;
    }

    if (totalPrice <= 0) {
      setError('Total harga harus lebih dari Rp 0');
      return;
    }

    const finalUnit = isCustomUnit ? customUnit.trim() || 'Unit' : unit;

    setIsSubmitting(true);
    try {
      await onSubmit({
        txDate,
        type,
        description: description.trim(),
        categoryId: categoryId || null,
        quantity,
        unit: finalUnit,
        unitPrice,
        totalPrice,
        calcMode,
        verificationNote: verificationNote.trim() || undefined,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Gagal menyimpan transaksi');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Ubah Transaksi' : 'Tambah Transaksi'}
      maxWidth="xl"
    >
      <form onSubmit={handleSubmit} className="space-y-3">
        {error && (
          <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 rounded text-xs flex items-center gap-2">
            <i className="fa-solid fa-triangle-exclamation" />
            <span>{error}</span>
          </div>
        )}

        {/* Row 1: Tanggal & Tipe Transaksi */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Tanggal Transaksi"
            type="date"
            value={txDate}
            onChange={(e) => setTxDate(e.target.value)}
            required
          />

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Tipe Transaksi <span className="text-rose-600">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setType('EXPENSE')}
                className={clsx(
                  'h-[38px] px-3 text-xs font-semibold rounded border flex items-center justify-center gap-1.5 transition-colors active:scale-[0.99]',
                  type === 'EXPENSE'
                    ? 'bg-[#FFF1F2] border-[#FFE4E6] text-[#BE123C] font-bold'
                    : 'bg-white border-[#E2E8F0] text-slate-600 hover:bg-[#F8FAFC]'
                )}
              >
                <i className="fa-solid fa-arrow-down text-rose-600 text-xs" />
                <span>Pengeluaran</span>
              </button>
              <button
                type="button"
                onClick={() => setType('INCOME')}
                className={clsx(
                  'h-[38px] px-3 text-xs font-semibold rounded border flex items-center justify-center gap-1.5 transition-colors active:scale-[0.99]',
                  type === 'INCOME'
                    ? 'bg-[#F0FDF4] border-[#DCFCE7] text-[#15803D] font-bold'
                    : 'bg-white border-[#E2E8F0] text-slate-600 hover:bg-[#F8FAFC]'
                )}
              >
                <i className="fa-solid fa-arrow-up text-emerald-600 text-xs" />
                <span>Pemasukan</span>
              </button>
            </div>
          </div>
        </div>

        {/* Row 2: Uraian Deskripsi */}
        <Input
          label="Uraian / Deskripsi Belanja"
          placeholder="Contoh: Sewa Penginapan Safir, Kertas HVS A4..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
        />

        {/* Row 3: Kategori */}
        <div>
          <Select
            label="Kategori Pengeluaran"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            required
          >
            <option value="">-- Pilih Kategori --</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>

        {/* Dual-Direction Calculation Mode Selector */}
        <div className="flex items-center justify-between p-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg">
          <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5 font-heading">
            <i className="fa-solid fa-calculator text-[#1E1B4B]" />
            <span>Metode Perhitungan:</span>
          </span>
          <div className="flex items-center gap-1 bg-white p-0.5 border border-[#CBD5E1] rounded">
            <button
              type="button"
              onClick={() => handleModeSwitch('FORWARD')}
              className={clsx(
                'px-2 py-0.5 text-[11px] font-medium rounded transition-colors active:scale-[0.99]',
                calcMode === 'FORWARD'
                  ? 'bg-[#1E1B4B] text-white'
                  : 'text-slate-600 hover:text-slate-900'
              )}
            >
              Mode A: Qty &times; Satuan
            </button>
            <button
              type="button"
              onClick={() => handleModeSwitch('REVERSE')}
              className={clsx(
                'px-2 py-0.5 text-[11px] font-medium rounded transition-colors active:scale-[0.99]',
                calcMode === 'REVERSE'
                  ? 'bg-[#1E1B4B] text-white'
                  : 'text-slate-600 hover:text-slate-900'
              )}
            >
              Mode B: Split dari Total Nota
            </button>
          </div>
        </div>

        {/* Row 4: Jumlah, Satuan, Harga Satuan, Total Harga */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          {/* Jumlah */}
          <div>
            <Input
              label="Jumlah (Qty)"
              type="number"
              step="any"
              min="0.001"
              value={quantity}
              onChange={(e) => handleQuantityChange(parseFloat(e.target.value) || 0)}
              required
            />
          </div>

          {/* Satuan */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Satuan <span className="text-rose-600">*</span>
            </label>
            {!isCustomUnit ? (
              <select
                className="w-full input-base"
                value={unit}
                onChange={(e) => {
                  if (e.target.value === 'CUSTOM') {
                    setIsCustomUnit(true);
                  } else {
                    setUnit(e.target.value);
                  }
                }}
              >
                {units.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
                <option value="CUSTOM">+ Tulis Satuan Lain...</option>
              </select>
            ) : (
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  placeholder="Ketik satuan..."
                  className="w-full input-base"
                  value={customUnit}
                  onChange={(e) => setCustomUnit(e.target.value)}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setIsCustomUnit(false)}
                  className="px-2 py-1.5 text-xs text-slate-500 hover:text-slate-800"
                  title="Kembali ke daftar satuan"
                >
                  <i className="fa-solid fa-rotate-left" />
                </button>
              </div>
            )}
          </div>

          {/* Harga Satuan */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Harga Satuan (Rp)
              {calcMode === 'REVERSE' && <span className="text-indigo-600 font-normal"> (Auto)</span>}
            </label>
            <input
              type="text"
              className={clsx('w-full input-base font-mono', calcMode === 'REVERSE' && 'bg-slate-50 text-slate-700')}
              value={calcMode === 'REVERSE' ? unitPrice.toFixed(2) : unitPrice ? unitPrice.toString() : ''}
              onChange={(e) => {
                if (calcMode === 'FORWARD') {
                  handleUnitPriceChange(parseRupiahInput(e.target.value));
                }
              }}
              readOnly={calcMode === 'REVERSE'}
              placeholder="0"
            />
          </div>

          {/* Total Harga */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Total Harga (Rp) <span className="text-rose-600">*</span>
              {calcMode === 'FORWARD' && <span className="text-indigo-600 font-normal"> (Auto)</span>}
            </label>
            <input
              type="text"
              className={clsx(
                'w-full input-base font-mono font-bold',
                calcMode === 'FORWARD' ? 'bg-[#EEF2FF] text-[#1E1B4B]' : 'bg-white text-slate-900'
              )}
              value={totalPrice ? formatRupiah(totalPrice) : ''}
              onChange={(e) => {
                if (calcMode === 'REVERSE') {
                  handleTotalPriceChange(parseRupiahInput(e.target.value));
                }
              }}
              readOnly={calcMode === 'FORWARD'}
              placeholder="Rp 0"
              required
            />
          </div>
        </div>

        {/* Row 5: Catatan / Keterangan */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Catatan Tambahan
          </label>
          <textarea
            rows={2}
            className="w-full input-base"
            placeholder="Nomor nota, spesifikasi item, atau catatan tambahan..."
            value={verificationNote}
            onChange={(e) => setVerificationNote(e.target.value)}
          />
        </div>

        {/* Actions Footer */}
        <div className="pt-3 border-t border-[#E2E8F0] flex items-center justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Batal
          </Button>
          <Button type="submit" variant="primary" isLoading={isSubmitting}>
            {isEditing ? 'Perbarui Transaksi' : 'Simpan Transaksi'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

