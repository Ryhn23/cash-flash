import React, { useState } from 'react';
import { Modal } from '../ui/Modal.js';
import { Button } from '../ui/Button.js';
import type { Transaction } from '../../types/index.js';
import { formatRupiah, formatDateIndo } from '../../utils/format.js';

export interface DuplicateResolutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (note: string) => Promise<void>;
  transaction: Transaction | null;
  matchingDuplicates?: Transaction[];
}

export const DuplicateResolutionModal: React.FC<DuplicateResolutionModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  transaction,
  matchingDuplicates = [],
}) => {
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!transaction) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!note.trim() || note.trim().length < 3) {
      setError('Catatan verifikasi wajib diisi (minimal 3 karakter)');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await onConfirm(note.trim());
      setNote('');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Gagal memverifikasi transaksi');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Konfirmasi Transaksi Bukan Duplikat"
      description="Verifikasi bahwa transaksi ini adalah pengeluaran sah yang terpisah, bukan kesalahan pencatatan dobel."
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs flex items-center gap-2">
            <i className="fa-solid fa-triangle-exclamation" />
            <span>{error}</span>
          </div>
        )}

        <div className="p-3.5 bg-[#FFFBEB] border border-[#FDE68A] rounded-lg text-xs text-[#92400E] space-y-2">
          <div className="font-bold flex items-center gap-1.5 text-amber-950 font-heading">
            <i className="fa-solid fa-triangle-exclamation text-amber-600" />
            <span>Peringatan Duplikasi Otomatis (Cek Data Formula Safir)</span>
          </div>
          <p className="leading-relaxed font-sans">
            Sistem mendeteksi transaksi ini memiliki kesamaan Tanggal (<strong>{formatDateIndo(transaction.txDate)}</strong>),
            Uraian (<strong>"{transaction.description}"</strong>), dan Total Harga (<strong>{formatRupiah(transaction.totalPrice)}</strong>)
            dengan baris transaksi lain di grup ini.
          </p>
        </div>

        {/* Transaction Summary Card */}
        <div className="p-3 bg-white border border-[#E2E8F0] rounded-lg text-xs space-y-1.5 font-mono">
          <div className="flex justify-between">
            <span className="text-slate-500 font-sans">Tanggal:</span>
            <span className="font-bold text-slate-800 tabular-nums">{transaction.txDate}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500 font-sans">Uraian:</span>
            <span className="font-bold text-slate-800">{transaction.description}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500 font-sans">Jumlah & Satuan:</span>
            <span className="font-bold text-slate-800 tabular-nums">{transaction.quantity} {transaction.unit}</span>
          </div>
          <div className="flex justify-between border-t border-[#F1F5F9] pt-1.5">
            <span className="text-slate-500 font-sans">Total Harga:</span>
            <span className="font-bold text-[#1E1B4B] text-sm tabular-nums">{formatRupiah(transaction.totalPrice)}</span>
          </div>
        </div>

        {/* Mandatory Verification Note */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Alasan / Catatan Verifikasi <span className="text-rose-600">*</span>
          </label>
          <textarea
            rows={3}
            className="w-full p-2.5 text-xs font-sans rounded border border-[#E2E8F0] bg-white text-slate-900 focus:outline-none focus:border-[#3730A3] focus:ring-2 focus:ring-[#3730A3]/10"
            placeholder="Contoh: Pembelian token kedua untuk meteran kamar staf nomor 4 (terpisah dari meteran utama)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            required
            autoFocus
          />
          <p className="text-[11px] text-slate-500 mt-1 font-sans">
            Catatan ini akan dicatat dalam audit trail bersama nama dan ID Anda sebagai penanggung jawab.
          </p>
        </div>

        <div className="pt-3 border-t border-[#E2E8F0] flex items-center justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Batal
          </Button>
          <Button type="submit" variant="primary" isLoading={isSubmitting} icon="fa-solid fa-shield-check">
            Konfirmasi Bukan Dobel
          </Button>
        </div>
      </form>
    </Modal>
  );
};
