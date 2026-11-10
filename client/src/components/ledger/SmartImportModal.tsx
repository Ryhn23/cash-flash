import React, { useState, useRef } from 'react';
import { Modal } from '../ui/Modal.js';
import { Button } from '../ui/Button.js';
import { Input } from '../ui/Input.js';
import { Select } from '../ui/Select.js';
import { api } from '../../api/client.js';
import type { GroupCategory } from '../../types/index.js';
import { formatRupiah, parseRupiahInput } from '../../utils/format.js';
import clsx from 'clsx';

export interface SmartImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
  categories: GroupCategory[];
  units: string[];
  onSubmit: (data: any) => Promise<void>;
}

export const SmartImportModal: React.FC<SmartImportModalProps> = ({
  isOpen,
  onClose,
  groupId,
  categories,
  units,
  onSubmit,
}) => {
  const [step, setStep] = useState<'UPLOAD' | 'REVIEW'>('UPLOAD');
  const [file, setFile] = useState<File | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Scanned / Extracted Data
  const [receiptPath, setReceiptPath] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Form Fields
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

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const resetState = () => {
    setStep('UPLOAD');
    setFile(null);
    setIsScanning(false);
    setScanError(null);
    setReceiptPath(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
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
    setSaveError(null);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleFileSelect = (selectedFile: File) => {
    setScanError(null);
    if (!['image/png', 'image/jpeg', 'image/jpg', 'image/webp'].includes(selectedFile.type)) {
      setScanError('Format file tidak didukung. Harap unggah gambar JPG, PNG, atau WEBP.');
      return;
    }
    if (selectedFile.size > 15 * 1024 * 1024) {
      setScanError('Ukuran file terlalu besar. Maksimal 15 MB.');
      return;
    }
    setFile(selectedFile);
    const localUrl = URL.createObjectURL(selectedFile);
    setPreviewUrl(localUrl);
  };

  const handleStartScan = async () => {
    if (!file) return;
    setIsScanning(true);
    setScanError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await api.post<{
        success: boolean;
        data: {
          receiptPath: string;
          scanned: {
            txDate: string | null;
            description: string | null;
            quantity: number | null;
            unit: string | null;
            unitPrice: number | null;
            totalPrice: number | null;
            invoiceNumber: string | null;
            rawText?: string;
          };
        };
      }>(`/api/groups/${groupId}/smart-import/scan`, formData);

      const scanned = res.data.scanned;
      setReceiptPath(res.data.receiptPath);

      // Populate extracted values with safe fallbacks
      setTxDate(scanned.txDate || new Date().toISOString().split('T')[0]);
      setDescription(scanned.description || '');

      const scannedQty = scanned.quantity && scanned.quantity > 0 ? scanned.quantity : 1;
      setQuantity(scannedQty);

      if (scanned.unit && units.includes(scanned.unit)) {
        setUnit(scanned.unit);
        setIsCustomUnit(false);
      } else if (scanned.unit) {
        setUnit('CUSTOM');
        setCustomUnit(scanned.unit);
        setIsCustomUnit(true);
      } else {
        setUnit(units[0] || 'Unit');
        setIsCustomUnit(false);
      }

      const scannedTotal = scanned.totalPrice || 0;
      let scannedUnitPrice = scanned.unitPrice || 0;

      if (scannedTotal > 0 && scannedUnitPrice === 0 && scannedQty > 0) {
        scannedUnitPrice = Math.round(scannedTotal / scannedQty);
      } else if (scannedTotal === 0 && scannedUnitPrice > 0 && scannedQty > 0) {
        setTotalPrice(Math.round(scannedUnitPrice * scannedQty));
      }

      setUnitPrice(scannedUnitPrice);
      setTotalPrice(scannedTotal || Math.round(scannedUnitPrice * scannedQty));

      if (scanned.invoiceNumber) {
        setVerificationNote(`Pindai Faktur No: ${scanned.invoiceNumber}`);
      }

      setStep('REVIEW');
    } catch (err: any) {
      setScanError(err.message || 'Gagal memindai gambar faktur');
    } finally {
      setIsScanning(false);
    }
  };

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

  const handleSaveTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);

    if (!description.trim()) {
      setSaveError('Uraian belanja wajib diisi');
      return;
    }
    if (quantity <= 0) {
      setSaveError('Jumlah kuantitas harus lebih dari 0');
      return;
    }
    if (totalPrice <= 0) {
      setSaveError('Total harga harus lebih dari Rp 0');
      return;
    }

    const finalUnit = isCustomUnit ? customUnit.trim() || 'Unit' : unit;

    setIsSaving(true);
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
        receiptPath,
      });
      handleClose();
    } catch (err: any) {
      setSaveError(err.message || 'Gagal menyimpan transaksi');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Pindai Faktur &amp; Nota Otomatis"
      maxWidth={step === 'REVIEW' ? '2xl' : 'lg'}
    >
      {step === 'UPLOAD' ? (
        <div className="space-y-4">
          <div className="bg-[#EEF2FF] border border-[#C7D2FE] p-3 rounded text-xs text-[#1E1B4B]">
            <p className="font-semibold mb-1 flex items-center gap-1.5">
              <i className="fa-solid fa-receipt text-[#3730A3]" />
              Ekstraksi Cepat Tanpa AI Cloud
            </p>
            <p className="text-slate-600">
              Unggah foto nota, kuitansi, atau faktur pembelian. Sistem membaca teks secara lokal (OCR) dan mendeteksi tanggal, uraian barang, kuantitas, serta nominal harga secara terstruktur.
            </p>
          </div>

          {scanError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded text-xs flex items-center gap-2">
              <i className="fa-solid fa-triangle-exclamation" />
              <span>{scanError}</span>
            </div>
          )}

          {/* Upload Dropzone */}
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer.files?.[0]) {
                handleFileSelect(e.dataTransfer.files[0]);
              }
            }}
            className={clsx(
              'border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors',
              file ? 'border-[#3730A3] bg-indigo-50/30' : 'border-[#CBD5E1] hover:border-[#3730A3] bg-[#F8FAFC]'
            )}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => {
                if (e.target.files?.[0]) {
                  handleFileSelect(e.target.files[0]);
                }
              }}
              accept="image/png,image/jpeg,image/jpg,image/webp"
              className="hidden"
            />
            {file ? (
              <div className="space-y-2">
                <i className="fa-solid fa-file-image text-3xl text-[#3730A3]" />
                <p className="text-sm font-semibold text-slate-800">{file.name}</p>
                <p className="text-xs text-slate-500">{(file.size / 1024).toFixed(1)} KB • Klik untuk ganti file</p>
              </div>
            ) : (
              <div className="space-y-2">
                <i className="fa-solid fa-cloud-arrow-up text-3xl text-slate-400" />
                <p className="text-sm font-semibold text-slate-700">Pilih atau seret gambar faktur ke sini</p>
                <p className="text-xs text-slate-500">Format yang didukung: JPG, PNG, atau WEBP (Maksimal 15 MB)</p>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={handleClose} disabled={isScanning}>
              Batal
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={handleStartScan}
              disabled={!file || isScanning}
              isLoading={isScanning}
              icon="fa-solid fa-wand-magic-sparkles"
            >
              {isScanning ? 'Memindai Teks...' : 'Mulai Pindai Faktur'}
            </Button>
          </div>
        </div>
      ) : (
        /* Review Step */
        <form onSubmit={handleSaveTransaction} className="space-y-4">
          <div className="bg-emerald-50 border border-emerald-200 p-2.5 rounded text-xs text-emerald-900 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <i className="fa-solid fa-circle-check text-emerald-600 text-sm" />
              <span>
                <strong>Berhasil Dipindai!</strong> Silakan periksa atau sesuaikan data di bawah sebelum disimpan.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setStep('UPLOAD')}
              className="text-xs font-semibold text-emerald-800 underline hover:text-emerald-950"
            >
              Ganti Gambar
            </button>
          </div>

          {saveError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded text-xs flex items-center gap-2">
              <i className="fa-solid fa-triangle-exclamation" />
              <span>{saveError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left: Receipt Preview */}
            <div className="border border-[#E2E8F0] rounded p-2 bg-[#F8FAFC] flex flex-col items-center justify-center min-h-[300px] max-h-[460px] overflow-hidden">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2 self-start">
                Pratinjau Nota
              </span>
              {previewUrl ? (
                <div className="relative w-full h-full flex items-center justify-center overflow-auto max-h-[400px]">
                  <img
                    src={previewUrl}
                    alt="Lampiran Faktur"
                    className="max-h-[380px] max-w-full object-contain rounded border border-slate-200"
                  />
                </div>
              ) : (
                <p className="text-xs text-slate-400">Tidak ada gambar pratinjau</p>
              )}
            </div>

            {/* Right: Editable Transaction Details */}
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <Input
                  label="Tanggal Transaksi"
                  type="date"
                  value={txDate}
                  onChange={(e) => setTxDate(e.target.value)}
                  required
                />
                <Select
                  label="Jenis Transaksi"
                  value={type}
                  onChange={(e) => setType(e.target.value as 'EXPENSE' | 'INCOME')}
                >
                  <option value="EXPENSE">Pengeluaran (Kas Keluar)</option>
                  <option value="INCOME">Pemasukan (Kas Masuk)</option>
                </Select>
              </div>

              <div>
                <Select
                  label="Kategori Anggaran"
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                >
                  <option value="">-- Tanpa Kategori --</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </div>

              <Input
                label="Uraian / Nama Barang"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Contoh: Kertas HVS A4 70gr"
                required
              />

              <div className="grid grid-cols-2 gap-2">
                <Input
                  label="Jumlah (Kuantitas)"
                  type="number"
                  step="any"
                  min="0.01"
                  value={quantity}
                  onChange={(e) => handleQuantityChange(parseFloat(e.target.value) || 0)}
                  required
                />

                <Select
                  label="Satuan"
                  value={unit}
                  onChange={(e) => {
                    const val = e.target.value;
                    setUnit(val);
                    setIsCustomUnit(val === 'CUSTOM');
                  }}
                >
                  {units.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                  <option value="CUSTOM">+ Satuan Lainnya</option>
                </Select>
              </div>

              {isCustomUnit && (
                <Input
                  label="Tulis Satuan Kustom"
                  value={customUnit}
                  onChange={(e) => setCustomUnit(e.target.value)}
                  placeholder="Misal: Rim, Galon, Lembar"
                  required
                />
              )}

              {/* Mode switch & Pricing */}
              <div className="bg-slate-50 p-2.5 rounded border border-slate-200 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700">Perhitungan Harga:</span>
                  <div className="flex gap-1 text-[11px]">
                    <button
                      type="button"
                      onClick={() => handleModeSwitch('FORWARD')}
                      className={clsx(
                        'px-2 py-0.5 rounded font-medium transition-colors',
                        calcMode === 'FORWARD'
                          ? 'bg-[#1E1B4B] text-white'
                          : 'bg-white text-slate-600 border border-slate-300'
                      )}
                    >
                      Kuantitas &times; Satuan
                    </button>
                    <button
                      type="button"
                      onClick={() => handleModeSwitch('REVERSE')}
                      className={clsx(
                        'px-2 py-0.5 rounded font-medium transition-colors',
                        calcMode === 'REVERSE'
                          ? 'bg-[#1E1B4B] text-white'
                          : 'bg-white text-slate-600 border border-slate-300'
                      )}
                    >
                      Bagi dari Total
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Harga Satuan (Rp)
                    </label>
                    <input
                      type="text"
                      readOnly={calcMode === 'REVERSE'}
                      value={formatRupiah(unitPrice)}
                      onChange={(e) => handleUnitPriceChange(parseRupiahInput(e.target.value))}
                      className={clsx(
                        'w-full input-base font-mono text-xs',
                        calcMode === 'REVERSE' && 'bg-slate-100 text-slate-600 cursor-not-allowed'
                      )}
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Total Harga (Rp) *
                    </label>
                    <input
                      type="text"
                      readOnly={calcMode === 'FORWARD'}
                      value={formatRupiah(totalPrice)}
                      onChange={(e) => handleTotalPriceChange(parseRupiahInput(e.target.value))}
                      className={clsx(
                        'w-full input-base font-mono text-xs font-bold text-[#1E1B4B]',
                        calcMode === 'FORWARD' && 'bg-slate-100 cursor-not-allowed'
                      )}
                    />
                  </div>
                </div>
              </div>

              <Input
                label="Catatan Verifikasi / No Faktur"
                value={verificationNote}
                onChange={(e) => setVerificationNote(e.target.value)}
                placeholder="Nomor faktur atau catatan toko"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[#E2E8F0]">
            <Button type="button" variant="secondary" onClick={handleClose} disabled={isSaving}>
              Batal
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={isSaving}
              icon="fa-solid fa-check"
            >
              Simpan Transaksi &amp; Lampiran
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
};

