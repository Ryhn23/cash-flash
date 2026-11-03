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
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-3">
        {error && (
          <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 rounded text-xs flex items-center gap-2">
            <i className="fa-solid fa-triangle-exclamation" />
            <span>{error}</span>
          </div>
        )}

        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs space-y-2">
          <div className="font-semibold flex items-center gap-1.5 text-amber-900 font-heading">
            <i className="fa-solid fa-triangle-exclamation text-amber-600" />
            <span>Terdeteksi Transaksi Serupa</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-slate-800 pt-1 border-t border-amber-200/60">
            <div>
              <span className="text-slate-500 font-sans block text-[10px]">Tanggal:</span>
              <span className="font-bold">{transaction.txDate}</span>
            </div>
            <div>
              <span className="text-slate-500 font-sans block text-[10px]">Total Nominal:</span>
              <span className="font-bold text-[#1E1B4B]">{formatRupiah(transaction.totalPrice)}</span>
            </div>
            <div className="col-span-2">
              <span className="text-slate-500 font-sans block text-[10px]">Uraian:</span>
              <span className="font-medium text-slate-900">{transaction.description}</span>
            </div>
          </div>
        </div>

        {/* Mandatory Verification Note */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Alasan Verifikasi <span className="text-rose-600">*</span>
          </label>
          <textarea
            rows={2}
            className="w-full p-2 text-xs font-sans rounded border border-[#CBD5E1] bg-white text-slate-900 focus:outline-none focus:border-[#3730A3] focus:ring-1 focus:ring-[#3730A3]"
            placeholder="Keterangan mengapa transaksi ini sah dan bukan dobel..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
            required
            autoFocus
          />
        </div>

        <div className="pt-2 border-t border-[#E2E8F0] flex items-center justify-end gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={onClose} disabled={isSubmitting}>
            Batal
          </Button>
          <Button type="submit" variant="primary" size="sm" isLoading={isSubmitting} icon="fa-solid fa-shield-check">
            Konfirmasi Bukan Dobel
          </Button>
        </div>
      </form>
    </Modal>
  );
};
