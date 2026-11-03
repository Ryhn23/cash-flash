import React, { useState, useRef } from 'react';
import { Modal } from '../ui/Modal.js';
import { Button } from '../ui/Button.js';
import { Badge } from '../ui/Badge.js';
import { api } from '../../api/client.js';
import { formatRupiah } from '../../utils/format.js';
import clsx from 'clsx';

export interface ExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
  onImportSuccess: () => void;
}

export const ExcelImportModal: React.FC<ExcelImportModalProps> = ({
  isOpen,
  onClose,
  groupId,
  onImportSuccess,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<any | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      selectFile(e.dataTransfer.files[0]);
    }
  };

  const selectFile = (selected: File) => {
    setError(null);
    setReport(null);
    const ext = selected.name.toLowerCase();
    if (!ext.endsWith('.xlsx') && !ext.endsWith('.xls') && !ext.endsWith('.csv')) {
      setError('Hanya mendukung format file spreadsheet (.xlsx, .xls, atau .csv)');
      return;
    }
    setFile(selected);
  };

  const handlePreview = async () => {
    if (!file) return;
    setIsPreviewing(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await api.post<{ success: boolean; report: any }>(
        `/api/groups/${groupId}/import/preview`,
        formData
      );
      setReport(res.report);
    } catch (err: any) {
      setError(err.message || 'Gagal memproses berkas Excel');
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleCommit = async () => {
    if (!report || report.validCount === 0) return;
    setIsCommitting(true);
    setError(null);

    // Filter valid rows to commit
    const validRows = report.rows
      .filter((r: any) => r.status === 'OK' || r.status === 'POTENTIAL_DUPLICATE')
      .map((r: any) => ({
        txDate: r.txDate,
        description: r.description,
        categoryId: r.categoryId,
        quantity: r.quantity,
        unit: r.unit,
        unitPrice: r.unitPrice,
        totalPrice: r.totalPrice,
        type: r.type,
        note: r.note,
      }));

    try {
      await api.post(`/api/groups/${groupId}/import/commit`, { rows: validRows });
      onImportSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Gagal menyimpan data import');
    } finally {
      setIsCommitting(false);
    }
  };

  const reset = () => {
    setFile(null);
    setReport(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Impor Buku Kas dari Excel (.xlsx / .csv)"
      description="Unggah file spreadsheet belanja Safir. Sistem akan melakukan dry-run validasi otomatis sebelum memasukkan data ke database."
      maxWidth="4xl"
    >
      <div className="space-y-4">
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs flex items-center gap-2">
            <i className="fa-solid fa-triangle-exclamation" />
            <span>{error}</span>
          </div>
        )}

        {/* Step 1: Upload or Drop Zone */}
        {!report ? (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleFileDrop}
            className={clsx(
              'border-2 border-dashed rounded-lg p-8 text-center transition-colors no-gradient shadow-none',
              file ? 'border-[#3730A3] bg-[#EEF2FF]/30' : 'border-[#CBD5E1] hover:border-[#3730A3] bg-[#F8FAFC]'
            )}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => e.target.files?.[0] && selectFile(e.target.files[0])}
              accept=".xlsx,.xls,.csv"
              className="hidden"
            />

            <div className="w-12 h-12 rounded bg-[#1E1B4B] text-white flex items-center justify-center mx-auto mb-3 shadow-none no-gradient">
              <i className="fa-solid fa-file-excel text-xl" />
            </div>

            {file ? (
              <div className="space-y-2">
                <div className="text-sm font-bold text-slate-900 font-heading">{file.name}</div>
                <div className="text-xs text-slate-500 font-mono">
                  Ukuran: {(file.size / 1024).toFixed(1)} KB &bull; Siap dianalisis
                </div>
                <div className="flex items-center justify-center gap-2 pt-2">
                  <Button variant="secondary" size="sm" onClick={reset}>
                    Pilih Berkas Lain
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handlePreview}
                    isLoading={isPreviewing}
                    icon="fa-solid fa-magnifying-glass"
                  >
                    Mulai Uji Validasi (Dry-Run)
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="text-sm font-bold text-slate-900 font-heading">
                  Tarik dan lepas berkas Excel ke sini
                </div>
                <p className="text-xs text-slate-500 font-sans">
                  Format .xlsx, .xls, atau .csv (Maksimum 5MB)
                </p>
                <div className="pt-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Jelajahi Berkas
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Step 2: Dry-run Validation Report */
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-white border border-[#E2E8F0] rounded-lg text-center shadow-none">
                <div className="text-[11px] text-slate-500 font-semibold tracking-wider uppercase font-sans">Total Baris</div>
                <div className="text-xl font-bold font-mono text-slate-900 mt-1 tabular-nums">
                  {report.totalRows}
                </div>
              </div>
              <div className="p-3 bg-[#F0FDF4] border border-[#DCFCE7] rounded-lg text-center shadow-none">
                <div className="text-[11px] text-[#15803D] font-semibold tracking-wider uppercase font-sans">Valid Siap Impor</div>
                <div className="text-xl font-bold font-mono text-[#15803D] mt-1 tabular-nums">
                  {report.validCount}
                </div>
              </div>
              <div className="p-3 bg-[#FFFBEB] border border-[#FDE68A] rounded-lg text-center shadow-none">
                <div className="text-[11px] text-[#92400E] font-semibold tracking-wider uppercase font-sans">Mungkin Dobel</div>
                <div className="text-xl font-bold font-mono text-[#92400E] mt-1 tabular-nums">
                  {report.duplicateCount}
                </div>
              </div>
              <div className="p-3 bg-[#FFF1F2] border border-[#FFE4E6] rounded-lg text-center shadow-none">
                <div className="text-[11px] text-[#BE123C] font-semibold tracking-wider uppercase font-sans">Data Tidak Lengkap</div>
                <div className="text-xl font-bold font-mono text-[#BE123C] mt-1 tabular-nums">
                  {report.incompleteCount}
                </div>
              </div>
            </div>

            {/* Dry-Run Row Table Preview */}
            <div className="border border-[#E2E8F0] rounded-lg overflow-hidden max-h-72 overflow-y-auto bg-white shadow-none">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-[#FAFAFA] border-b border-[#E2E8F0] text-slate-500 font-semibold font-sans tracking-[0.04em] uppercase text-[11px]">
                  <tr className="h-10">
                    <th className="py-2 px-3 w-10 text-center">#</th>
                    <th className="py-2 px-3">Tanggal</th>
                    <th className="py-2 px-3">Uraian</th>
                    <th className="py-2 px-3">Kategori</th>
                    <th className="py-2 px-3 text-right">Total (Rp)</th>
                    <th className="py-2 px-3 text-center">Status Cek Data</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F5F9]">
                  {report.rows.map((row: any) => (
                    <tr
                      key={row.rowNum}
                      className={clsx(
                        'hover:bg-[#F8FAFC] transition-colors',
                        row.status === 'POTENTIAL_DUPLICATE' && 'bg-[#FFFBEB]/40',
                        row.status === 'INCOMPLETE' && 'bg-[#FFF1F2]/40'
                      )}
                    >
                      <td className="py-2 px-3 text-center font-mono text-slate-400 tabular-nums">
                        {row.rowNum}
                      </td>
                      <td className="py-2 px-3 font-mono tabular-nums">{row.txDate || '-'}</td>
                      <td className="py-2 px-3 font-medium text-slate-900 truncate max-w-xs">{row.description}</td>
                      <td className="py-2 px-3 text-slate-600">
                        {row.categoryName || <span className="italic text-slate-400">Belum ada</span>}
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-semibold tabular-nums text-[#1E1B4B]">
                        {formatRupiah(row.totalPrice)}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <Badge status={row.status} size="sm" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-[#E2E8F0]">
              <Button variant="secondary" size="sm" onClick={reset}>
                Unggah Ulang File Lain
              </Button>
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" onClick={onClose}>
                  Tutup
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleCommit}
                  isLoading={isCommitting}
                  disabled={report.validCount + report.duplicateCount === 0}
                  icon="fa-solid fa-cloud-arrow-up"
                >
                  Konfirmasi & Komit ({report.validCount + report.duplicateCount} Baris)
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
