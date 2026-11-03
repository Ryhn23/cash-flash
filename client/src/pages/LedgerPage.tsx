import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client.js';
import { useAppStore } from '../store/useAppStore.js';
import type { Transaction, GroupCategory } from '../types/index.js';
import { TransactionTable } from '../components/ledger/TransactionTable.js';
import { TransactionModal } from '../components/ledger/TransactionModal.js';
import { DuplicateResolutionModal } from '../components/ledger/DuplicateResolutionModal.js';
import { ExcelImportModal } from '../components/ledger/ExcelImportModal.js';
import { ReceiptModal } from '../components/ledger/ReceiptModal.js';

export const LedgerPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { activeGroup, user } = useAppStore();

  // Modals state
  const [isAddEditOpen, setIsAddEditOpen] = useState(false);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

  const [isVerifyOpen, setIsVerifyOpen] = useState(false);
  const [verifyTx, setVerifyTx] = useState<Transaction | null>(null);

  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [receiptTx, setReceiptTx] = useState<Transaction | null>(null);

  // Fetch group transactions
  const { data: txData, isLoading: isLoadingTx } = useQuery<{ success: boolean; transactions: Transaction[] }>({
    queryKey: ['transactions', activeGroup?.id],
    queryFn: () => (activeGroup ? api.get(`/api/groups/${activeGroup.id}/transactions`) : Promise.resolve({ success: true, transactions: [] })),
    enabled: !!activeGroup,
  });
  const transactions = txData?.transactions || [];

  // Fetch categories
  const { data: catData } = useQuery<{ success: boolean; categories: GroupCategory[] }>({
    queryKey: ['group-categories', activeGroup?.id],
    queryFn: () => (activeGroup ? api.get(`/api/groups/${activeGroup.id}/categories`) : Promise.resolve({ success: true, categories: [] })),
    enabled: !!activeGroup,
  });
  const categories = catData?.categories || [];

  // Fetch units
  const { data: unitData } = useQuery<{ success: boolean; units: string[] }>({
    queryKey: ['group-units', activeGroup?.id],
    queryFn: () => (activeGroup ? api.get(`/api/groups/${activeGroup.id}/units`) : Promise.resolve({ success: true, units: [] })),
    enabled: !!activeGroup,
  });
  const units = unitData?.units || ['Unit', 'Paket', 'Pcs', 'Lusin', 'Liter', 'Kg'];

  if (!activeGroup) {
    return (
      <div className="py-16 text-center text-slate-500">
        <i className="fa-solid fa-layer-group text-4xl mb-3 text-slate-300" />
        <h3 className="text-base font-bold text-slate-800">Pilih Grup Keuangan Terlebih Dahulu</h3>
      </div>
    );
  }

  // Handle Create or Update Transaction
  const handleSubmitTransaction = async (data: any) => {
    if (selectedTx) {
      // Edit
      await api.patch(`/api/groups/${activeGroup.id}/transactions/${selectedTx.id}`, data);
    } else {
      // Create
      await api.post(`/api/groups/${activeGroup.id}/transactions`, data);
    }
    queryClient.invalidateQueries({ queryKey: ['transactions', activeGroup.id] });
    queryClient.invalidateQueries({ queryKey: ['analytics', activeGroup.id] });
  };

  // Handle Delete Transaction
  const handleDeleteTransaction = async (tx: Transaction) => {
    if (!confirm(`Hapus transaksi "${tx.description}" (${tx.txDate})?`)) return;
    try {
      await api.delete(`/api/groups/${activeGroup.id}/transactions/${tx.id}`);
      queryClient.invalidateQueries({ queryKey: ['transactions', activeGroup.id] });
      queryClient.invalidateQueries({ queryKey: ['analytics', activeGroup.id] });
    } catch (err: any) {
      alert(err.message || 'Gagal menghapus transaksi');
    }
  };

  // Handle Confirm Duplicate Resolution ("Bukan Dobel")
  const handleConfirmDuplicate = async (note: string) => {
    if (!verifyTx) return;
    await api.post(`/api/groups/${activeGroup.id}/transactions/${verifyTx.id}/verify-duplicate`, { note });
    queryClient.invalidateQueries({ queryKey: ['transactions', activeGroup.id] });
    queryClient.invalidateQueries({ queryKey: ['analytics', activeGroup.id] });
    queryClient.invalidateQueries({ queryKey: ['audit-logs', activeGroup.id] });
  };

  // Handle Direct Export Excel
  const handleExportExcel = () => {
    window.location.href = `/api/groups/${activeGroup.id}/export`;
  };

  return (
    <div className="space-y-6">
      {isLoadingTx ? (
        <div className="py-24 text-center text-slate-400">
          <i className="fa-solid fa-circle-notch fa-spin text-3xl mb-3 text-[#1E1B4B]" />
          <p className="text-xs font-medium">Memuat ledger transaksi...</p>
        </div>
      ) : (
        <TransactionTable
          transactions={transactions}
          categories={categories}
          userRole={activeGroup.userRole || 'VIEWER'}
          isSuperAdmin={user?.systemRole === 'SUPER_ADMIN'}
          onAddTransaction={() => {
            setSelectedTx(null);
            setIsAddEditOpen(true);
          }}
          onEditTransaction={(tx) => {
            setSelectedTx(tx);
            setIsAddEditOpen(true);
          }}
          onDeleteTransaction={handleDeleteTransaction}
          onVerifyDuplicate={(tx) => {
            setVerifyTx(tx);
            setIsVerifyOpen(true);
          }}
          onManageReceipt={(tx) => {
            setReceiptTx(tx);
            setIsReceiptOpen(true);
          }}
          onExportExcel={handleExportExcel}
          onImportExcel={() => setIsImportOpen(true)}
        />
      )}

      {/* Transaction Add / Edit Modal */}
      <TransactionModal
        isOpen={isAddEditOpen}
        onClose={() => setIsAddEditOpen(false)}
        onSubmit={handleSubmitTransaction}
        transaction={selectedTx}
        categories={categories}
        units={units}
      />

      {/* Duplicate Resolution Modal */}
      <DuplicateResolutionModal
        isOpen={isVerifyOpen}
        onClose={() => {
          setIsVerifyOpen(false);
          setVerifyTx(null);
        }}
        onConfirm={handleConfirmDuplicate}
        transaction={verifyTx}
      />

      {/* Excel Import Modal */}
      <ExcelImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        groupId={activeGroup.id}
        onImportSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['transactions', activeGroup.id] });
          queryClient.invalidateQueries({ queryKey: ['analytics', activeGroup.id] });
        }}
      />

      {/* Receipt Modal */}
      <ReceiptModal
        isOpen={isReceiptOpen}
        onClose={() => {
          setIsReceiptOpen(false);
          setReceiptTx(null);
        }}
        groupId={activeGroup.id}
        transaction={receiptTx}
        onUploadSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['transactions', activeGroup.id] });
        }}
      />
    </div>
  );
};
