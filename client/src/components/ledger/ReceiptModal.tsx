import React, { useState, useRef } from 'react';
import { Modal } from '../ui/Modal.js';
import { Button } from '../ui/Button.js';
import { api } from '../../api/client.js';
import type { Transaction } from '../../types/index.js';

export interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
  transaction: Transaction | null;
  onUploadSuccess: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  isOpen,
  onClose,
  groupId,
  transaction,
  onUploadSuccess,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!transaction) return null;

  const hasExistingReceipt = !!transaction.receiptPath;
  const receiptUrl = hasExistingReceipt ? `/uploads/${transaction.receiptPath}` : null;
  const isPdf = transaction.receiptPath?.toLowerCase().endsWith('.pdf');

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setIsUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      await api.post(`/api/groups/${groupId}/transactions/${transaction.id}/receipt`, formData);
      onUploadSuccess();
      setFile(null);
    } catch (err: any) {
      setError(err.message || 'Gagal mengunggah nota/lampiran');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Lampiran & Bukti Nota Pembayaran"
      description={`Transaksi: ${transaction.description} (${transaction.txDate})`}
      maxWidth="2xl"
    >
      <div className="space-y-4">
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs flex items-center gap-2">
            <i className="fa-solid fa-triangle-exclamation" />
            <span>{error}</span>
          </div>
        )}

        {/* Existing Receipt Preview */}
        {hasExistingReceipt && receiptUrl ? (
          <div className="border border-[#E2E8F0] rounded-lg overflow-hidden bg-[#F8FAFC] p-2 shadow-none">
            <div className="flex items-center justify-between pb-2 px-2 text-xs text-slate-500 font-sans">
              <span className="font-semibold text-slate-700">Berkas Terunggah:</span>
              <a
                href={receiptUrl}
                target="_blank"
                rel="noreferrer"
                className="text-[#3730A3] hover:underline font-bold flex items-center gap-1 active:scale-[0.99]"
              >
                <i className="fa-solid fa-arrow-up-right-from-square text-[10px]" />
                <span>Buka di Tab Baru</span>
              </a>
            </div>

            <div className="max-h-96 overflow-auto flex items-center justify-center bg-white rounded border border-[#E2E8F0]">
              {isPdf ? (
                <iframe src={receiptUrl} title="Nota PDF" className="w-full h-96 border-none" />
              ) : (
                <img
                  src={receiptUrl}
                  alt="Bukti Nota"
                  className="max-h-96 object-contain rounded"
                />
              )}
            </div>
          </div>
        ) : (
          <div className="p-8 border-2 border-dashed border-[#CBD5E1] rounded-lg text-center text-xs text-slate-400 bg-[#F8FAFC]">
            <i className="fa-solid fa-receipt text-3xl text-slate-300 mb-2" />
            <p className="font-sans">Belum ada bukti nota atau kuitansi yang dilampirkan pada transaksi ini.</p>
          </div>
        )}

        {/* Upload Form */}
        <form onSubmit={handleUpload} className="pt-2 border-t border-[#E2E8F0] space-y-3 font-sans">
          <label className="block text-xs font-semibold text-slate-700">
            {hasExistingReceipt ? 'Ganti Nota dengan Berkas Baru:' : 'Unggah Nota (JPG, PNG, PDF, atau WEBP):'}
          </label>

          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            accept="image/jpeg,image/png,image/webp,application/pdf"
            className="hidden"
          />

          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              icon="fa-solid fa-paperclip"
            >
              {file ? file.name : 'Pilih Berkas Lampiran...'}
            </Button>

            {file && (
              <Button type="submit" variant="primary" size="sm" isLoading={isUploading}>
                Unggah Sekarang
              </Button>
            )}
          </div>
          <p className="text-[11px] text-slate-400">
            Berkas diverifikasi byte-magic secara aman di server untuk mencegah serangan injeksi.
          </p>
        </form>

        <div className="pt-3 border-t border-[#E2E8F0] flex justify-end">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Tutup
          </Button>
        </div>
      </div>
    </Modal>
  );
};

