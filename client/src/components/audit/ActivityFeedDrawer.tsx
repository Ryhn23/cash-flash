import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '../../store/useAppStore.js';
import { api } from '../../api/client.js';
import type { AuditLogItem } from '../../types/index.js';
import { formatDateIndo } from '../../utils/format.js';
import clsx from 'clsx';

export const ActivityFeedDrawer: React.FC = () => {
  const { isActivityDrawerOpen, setActivityDrawerOpen, activeGroup } = useAppStore();
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery<{ success: boolean; logs: AuditLogItem[] }>({
    queryKey: ['audit-logs', activeGroup?.id],
    queryFn: () => (activeGroup ? api.get(`/api/groups/${activeGroup.id}/audit`) : Promise.resolve({ success: true, logs: [] })),
    enabled: isActivityDrawerOpen && !!activeGroup,
    refetchInterval: 15000, // Poll every 15s when drawer is open
  });

  const logs = data?.logs || [];

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'CREATE_TRANSACTION':
        return { label: 'Tambah Transaksi', dot: 'bg-emerald-500' };
      case 'UPDATE_TRANSACTION':
        return { label: 'Perubahan Data', dot: 'bg-indigo-600' };
      case 'DELETE_TRANSACTION':
        return { label: 'Hapus Transaksi', dot: 'bg-rose-500' };
      case 'VERIFY_DUPLICATE_OK':
        return { label: 'Verifikasi Sah', dot: 'bg-amber-500' };
      case 'IMPORT_EXCEL_TRANSACTIONS':
        return { label: 'Impor Excel', dot: 'bg-cyan-600' };
      case 'UPLOAD_RECEIPT':
        return { label: 'Unggah Nota', dot: 'bg-teal-500' };
      default:
        return { label: action.replace(/_/g, ' '), dot: 'bg-slate-400' };
    }
  };

  return (
    <AnimatePresence>
      {isActivityDrawerOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setActivityDrawerOpen(false)}
            className="absolute inset-0 bg-[#070235]/60"
            aria-hidden="true"
          />

          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="w-screen max-w-md bg-white border-l border-[#CBD5E1] shadow-[0_4px_12px_-2px_rgba(15,23,42,0.06),0_2px_4px_-1px_rgba(15,23,42,0.04)] flex flex-col no-gradient"
            >
              {/* Header */}
              <div className="p-4 border-b border-[#E2E8F0] flex items-center justify-between bg-[#FAFAFA]">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded bg-[#1E1B4B] text-white flex items-center justify-center text-xs">
                    <i className="fa-solid fa-clock-rotate-left" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 font-heading">Riwayat Aktivitas &amp; Log</h3>
                    <p className="text-[11px] text-slate-500 font-sans">
                      Grup: {activeGroup?.name || '-'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => refetch()}
                    className="p-1.5 rounded hover:bg-slate-200 text-slate-500 transition-colors active:scale-[0.99]"
                    title="Segarkan Log"
                  >
                    <i className="fa-solid fa-arrows-rotate text-xs" />
                  </button>
                  <button
                    onClick={() => setActivityDrawerOpen(false)}
                    className="p-1.5 rounded hover:bg-slate-200 text-slate-500 transition-colors active:scale-[0.99]"
                  >
                    <i className="fa-solid fa-xmark text-sm" />
                  </button>
                </div>
              </div>

              {/* Feed Content */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {isLoading ? (
                  <div className="py-12 text-center text-xs text-slate-400 font-sans">
                    <i className="fa-solid fa-circle-notch fa-spin text-lg mb-2 text-[#1E1B4B]" />
                    <div>Memuat riwayat aktivitas...</div>
                  </div>
                ) : logs.length === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-400 font-sans">
                    <i className="fa-solid fa-inbox text-2xl text-slate-300 mb-2" />
                    <div>Belum ada riwayat aktivitas pada grup ini.</div>
                  </div>
                ) : (
                  logs.map((log) => {
                    const badge = getActionBadge(log.action);
                    const isExpanded = expandedLogId === log.id;

                    return (
                      <div
                        key={log.id}
                        className="p-3 bg-white border border-[#E2E8F0] rounded-lg shadow-none hover:border-slate-300 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="inline-flex items-center gap-1.5 text-xs text-slate-700 font-medium">
                            <span className={clsx('w-1.5 h-1.5 rounded-full shrink-0', badge.dot)} />
                            <span>{badge.label}</span>
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono tabular-nums">
                            {formatDateIndo(log.createdAt)} {new Date(log.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>

                        <div className="text-xs text-slate-800 font-medium mt-1 font-sans">
                          <span className="font-bold text-[#1E1B4B]">{log.actorName}</span>{' '}
                          <span className="text-slate-500">({log.actorEmail})</span>
                        </div>

                        {/* Diff details toggle if json data exists */}
                        {(log.oldValues || log.newValues) && (
                          <div className="mt-2 pt-2 border-t border-[#F1F5F9]">
                            <button
                              type="button"
                              onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                              className="text-[11px] text-[#3730A3] hover:underline flex items-center gap-1 font-medium font-sans active:scale-[0.99]"
                            >
                              <i className={clsx('fa-solid', isExpanded ? 'fa-chevron-up' : 'fa-chevron-down', 'text-[9px]')} />
                              <span>{isExpanded ? 'Sembunyikan Rincian Diff' : 'Lihat Rincian Perubahan'}</span>
                            </button>

                            {isExpanded && (
                              <div className="mt-2 p-2 bg-[#F8FAFC] rounded border border-[#E2E8F0] text-[10px] font-mono overflow-x-auto space-y-1.5">
                                {log.oldValues && (
                                  <div>
                                    <div className="text-rose-700 font-bold mb-0.5">- Nilai Sebelumnya:</div>
                                    <pre className="text-slate-600 bg-white p-1 rounded border border-[#E2E8F0]">
                                      {JSON.stringify(JSON.parse(log.oldValues), null, 2)}
                                    </pre>
                                  </div>
                                )}
                                {log.newValues && (
                                  <div>
                                    <div className="text-emerald-700 font-bold mb-0.5">+ Nilai Baru:</div>
                                    <pre className="text-slate-600 bg-white p-1 rounded border border-[#E2E8F0]">
                                      {JSON.stringify(JSON.parse(log.newValues), null, 2)}
                                    </pre>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
};

