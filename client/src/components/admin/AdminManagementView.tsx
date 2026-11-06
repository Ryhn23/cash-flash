import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client.js';
import { Button } from '../ui/Button.js';
import { Input } from '../ui/Input.js';
import { Select } from '../ui/Select.js';
import { Modal } from '../ui/Modal.js';
import { formatRupiah, formatDateIndo, parseRupiahInput } from '../../utils/format.js';
import type { User, FinancialGroup, AuditLogItem } from '../../types/index.js';
import { useAppStore } from '../../store/useAppStore.js';
import clsx from 'clsx';

export const AdminManagementView: React.FC = () => {
  const queryClient = useQueryClient();
  const { user: currentUser, activeGroup, setActiveGroup, setActiveTab } = useAppStore();
  const [activeAdminTab, setActiveAdminTab] = useState<'users' | 'groups' | 'audit'>('users');

  // Create User Modal State
  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false);
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userPassword, setUserPassword] = useState('');
  const [userSystemRole, setUserSystemRole] = useState<'SUPER_ADMIN' | 'USER'>('USER');
  const [userFormError, setUserFormError] = useState<string | null>(null);

  // Edit / Password Reset Modal State
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [editError, setEditError] = useState<string | null>(null);

  // Delete User Confirmation State
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);
  const [deleteUserError, setDeleteUserError] = useState<string | null>(null);

  // Create Financial Group Modal State
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupSlug, setGroupSlug] = useState('');
  const [groupDesc, setGroupDesc] = useState('');
  const [groupBudget, setGroupBudget] = useState(0);
  const [groupFormError, setGroupFormError] = useState<string | null>(null);

  // Edit Financial Group Modal State
  const [editingGroup, setEditingGroup] = useState<FinancialGroup | null>(null);
  const [editGroupName, setEditGroupName] = useState('');
  const [editGroupSlug, setEditGroupSlug] = useState('');
  const [editGroupDesc, setEditGroupDesc] = useState('');
  const [editGroupBudget, setEditGroupBudget] = useState(0);
  const [editGroupIsArchived, setEditGroupIsArchived] = useState(0);
  const [editGroupError, setEditGroupError] = useState<string | null>(null);
  const [isSavingEditGroup, setIsSavingEditGroup] = useState(false);

  // Delete Financial Group Modal State
  const [deletingGroup, setDeletingGroup] = useState<FinancialGroup | null>(null);
  const [isDeletingGroup, setIsDeletingGroup] = useState(false);
  const [deleteGroupError, setDeleteGroupError] = useState<string | null>(null);

  // Fetch Users
  const { data: usersData, isLoading: isLoadingUsers } = useQuery<{ success: boolean; users: User[] }>({
    queryKey: ['admin-users'],
    queryFn: () => api.get('/api/users'),
  });
  const users = usersData?.users || [];

  // Fetch Groups
  const { data: groupsData, isLoading: isLoadingGroups } = useQuery<{ success: boolean; groups: FinancialGroup[] }>({
    queryKey: ['admin-groups'],
    queryFn: () => api.get('/api/groups'),
  });
  const groups = groupsData?.groups || [];

  // Fetch System Audit Logs
  const { data: auditData, isLoading: isLoadingAudit } = useQuery<{ success: boolean; logs: AuditLogItem[] }>({
    queryKey: ['admin-audit'],
    queryFn: () => api.get('/api/audit'),
    enabled: activeAdminTab === 'audit',
  });
  const auditLogs = auditData?.logs || [];

  // Handle Create User
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserFormError(null);
    try {
      await api.post('/api/users', {
        name: userName.trim(),
        email: userEmail.trim(),
        password: userPassword,
        systemRole: userSystemRole,
      });
      setIsCreateUserOpen(false);
      setUserName('');
      setUserEmail('');
      setUserPassword('');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    } catch (err: any) {
      setUserFormError(err.message || 'Gagal membuat pengguna');
    }
  };

  // Handle Update User / Reset Password
  const handleSaveEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setEditError(null);
    try {
      const payload: Record<string, any> = {
        name: editingUser.name,
        email: editingUser.email,
        systemRole: editingUser.systemRole,
        isActive: editingUser.isActive,
      };
      if (resetPassword.trim()) {
        payload.password = resetPassword;
      }
      await api.patch(`/api/users/${editingUser.id}`, payload);
      setEditingUser(null);
      setResetPassword('');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    } catch (err: any) {
      setEditError(err.message || 'Gagal memperbarui pengguna');
    }
  };

  // Toggle User Active / Suspend
  const handleToggleUserActive = async (u: User) => {
    const nextState = u.isActive === 1 ? 0 : 1;
    const actionLabel = nextState === 1 ? 'mengaktifkan kembali' : 'menonaktifkan (suspend)';
    if (!confirm(`Apakah Anda yakin ingin ${actionLabel} akun ${u.name}?`)) return;
    try {
      await api.patch(`/api/users/${u.id}`, { isActive: nextState });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    } catch (err: any) {
      alert(err.message || 'Gagal mengubah status akun');
    }
  };

  // Handle Delete User
  const handleConfirmDeleteUser = async () => {
    if (!deletingUser) return;
    setIsDeletingUser(true);
    setDeleteUserError(null);
    try {
      await api.delete(`/api/users/${deletingUser.id}`);
      setDeletingUser(null);
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    } catch (err: any) {
      setDeleteUserError(err.message || 'Gagal menghapus pengguna');
    } finally {
      setIsDeletingUser(false);
    }
  };

  // Handle Create Group
  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setGroupFormError(null);
    try {
      await api.post('/api/groups', {
        name: groupName.trim(),
        slug: groupSlug.trim().toLowerCase(),
        description: groupDesc.trim(),
        budgetLimit: groupBudget,
      });
      setIsCreateGroupOpen(false);
      setGroupName('');
      setGroupSlug('');
      setGroupDesc('');
      setGroupBudget(0);
      queryClient.invalidateQueries({ queryKey: ['admin-groups'] });
      queryClient.invalidateQueries({ queryKey: ['groups'] });
    } catch (err: any) {
      setGroupFormError(err.message || 'Gagal membuat grup keuangan');
    }
  };

  // Auto-generate slug from name
  const handleGroupNameChange = (val: string) => {
    setGroupName(val);
    const slugified = val
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    setGroupSlug(slugified);
  };

  // Open Edit Group
  const handleOpenEditGroup = (g: FinancialGroup) => {
    setEditingGroup(g);
    setEditGroupName(g.name);
    setEditGroupSlug(g.slug);
    setEditGroupDesc(g.description || '');
    setEditGroupBudget(g.budgetLimit || 0);
    setEditGroupIsArchived(g.isArchived || 0);
    setEditGroupError(null);
  };

  // Save Edit Group
  const handleSaveEditGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGroup) return;
    setIsSavingEditGroup(true);
    setEditGroupError(null);
    try {
      await api.patch(`/api/groups/${editingGroup.id}`, {
        name: editGroupName.trim(),
        slug: editGroupSlug.trim().toLowerCase(),
        description: editGroupDesc.trim(),
        budgetLimit: editGroupBudget,
        isArchived: editGroupIsArchived,
      });

      if (activeGroup?.id === editingGroup.id) {
        setActiveGroup({
          ...activeGroup,
          name: editGroupName.trim(),
          slug: editGroupSlug.trim().toLowerCase(),
          description: editGroupDesc.trim(),
          budgetLimit: editGroupBudget,
          isArchived: editGroupIsArchived,
        });
      }

      setEditingGroup(null);
      queryClient.invalidateQueries({ queryKey: ['admin-groups'] });
      queryClient.invalidateQueries({ queryKey: ['groups'] });
    } catch (err: any) {
      setEditGroupError(err.message || 'Gagal memperbarui grup keuangan');
    } finally {
      setIsSavingEditGroup(false);
    }
  };

  // Confirm Delete Group
  const handleConfirmDeleteGroup = async () => {
    if (!deletingGroup) return;
    setIsDeletingGroup(true);
    setDeleteGroupError(null);
    try {
      await api.delete(`/api/groups/${deletingGroup.id}`);
      if (activeGroup?.id === deletingGroup.id) {
        setActiveGroup(null);
      }
      setDeletingGroup(null);
      queryClient.invalidateQueries({ queryKey: ['admin-groups'] });
      queryClient.invalidateQueries({ queryKey: ['groups'] });
    } catch (err: any) {
      setDeleteGroupError(err.message || 'Gagal menghapus grup keuangan');
    } finally {
      setIsDeletingGroup(false);
    }
  };

  // Open Group Workspace directly
  const handleOpenGroupWorkspace = (g: FinancialGroup) => {
    setActiveGroup(g);
    setActiveTab('ledger');
  };

  return (
    <div className="space-y-6">
      {/* Top Admin Bar */}
      <div className="bg-[#1E1B4B] text-white p-4 rounded-xl border border-indigo-950 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 no-gradient">
        <div className="flex items-center gap-2.5">
          <i className="fa-solid fa-shield-halved text-indigo-300 text-sm" />
          <h2 className="text-base font-bold font-heading">Konsol Administrasi</h2>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center bg-[#131037] p-1 rounded border border-[#2A265E] text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveAdminTab('users')}
            className={clsx(
              'px-3 py-1.5 rounded transition-colors active:scale-[0.99] font-sans',
              activeAdminTab === 'users' ? 'bg-white text-[#1E1B4B] shadow-none' : 'text-indigo-200 hover:text-white'
            )}
          >
            <i className="fa-solid fa-users mr-1.5" />
            Pengguna ({users.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveAdminTab('groups')}
            className={clsx(
              'px-3 py-1.5 rounded transition-colors active:scale-[0.99] font-sans',
              activeAdminTab === 'groups' ? 'bg-white text-[#1E1B4B] shadow-none' : 'text-indigo-200 hover:text-white'
            )}
          >
            <i className="fa-solid fa-building-columns mr-1.5" />
            Grup Keuangan ({groups.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveAdminTab('audit')}
            className={clsx(
              'px-3 py-1.5 rounded transition-colors active:scale-[0.99] font-sans',
              activeAdminTab === 'audit' ? 'bg-white text-[#1E1B4B] shadow-none' : 'text-indigo-200 hover:text-white'
            )}
          >
            <i className="fa-solid fa-shield-halved mr-1.5" />
            Audit Global
          </button>
        </div>
      </div>

      {/* 1. USERS TAB */}
      {activeAdminTab === 'users' && (
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] no-gradient">
          <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0] mb-4">
            <h3 className="text-sm sm:text-base font-bold text-slate-900 font-heading">Daftar Pengguna</h3>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsCreateUserOpen(true)}
              icon="fa-solid fa-user-plus"
            >
              Tambah Pengguna Baru
            </Button>
          </div>

          <div className="border border-[#E2E8F0] rounded-lg overflow-hidden bg-white shadow-none">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#FAFAFA] border-b border-[#E2E8F0] text-slate-500 font-semibold font-sans tracking-[0.04em] uppercase text-[11px]">
                <tr className="h-10">
                  <th className="py-2.5 px-3">Nama Pengguna</th>
                  <th className="py-2.5 px-3">Email</th>
                  <th className="py-2.5 px-3">Peran Sistem</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Grup Terdaftar</th>
                  <th className="py-2.5 px-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F5F9]">
                {users.map((u) => (
                  <tr key={u.id} className="h-11 hover:bg-[#F8FAFC] transition-colors">
                    <td className="px-3 font-semibold text-slate-900 flex items-center gap-2 h-11">
                      <div className="w-6 h-6 rounded bg-[#1E1B4B] text-white flex items-center justify-center text-[10px] font-bold">
                        {u.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-sans">{u.name}</span>
                    </td>
                    <td className="px-3 font-mono text-slate-600 tabular-nums">{u.email}</td>
                    <td className="px-3 font-mono text-xs text-slate-700">{u.systemRole}</td>
                    <td className="px-3">
                      <span className="inline-flex items-center gap-1.5 text-xs text-slate-700">
                        <span className={clsx('w-1.5 h-1.5 rounded-full shrink-0', u.isActive === 1 ? 'bg-emerald-500' : 'bg-slate-300')} />
                        <span>{u.isActive === 1 ? 'Aktif' : 'Nonaktif'}</span>
                      </span>
                    </td>
                    <td className="px-3">
                      <div className="flex flex-wrap gap-1">
                        {u.groups && u.groups.length > 0 ? (
                          u.groups.map((g) => (
                            <span key={g.groupId} className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-sans">
                              {g.groupName} ({g.groupRole})
                            </span>
                          ))
                        ) : (
                          <span className="text-[11px] text-slate-400 italic font-sans">Belum ada grup</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setEditingUser(u)}
                          className="px-2 py-1 text-xs text-[#3730A3] hover:bg-[#EEF2FF] rounded border border-[#C7D2FE] font-semibold active:scale-[0.99]"
                        >
                          Ubah / Reset
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleUserActive(u)}
                          className={clsx(
                            'px-2 py-1 text-xs rounded border font-semibold active:scale-[0.99]',
                            u.isActive === 1
                              ? 'text-amber-700 hover:bg-amber-50 border-amber-200'
                              : 'text-emerald-700 hover:bg-emerald-50 border-emerald-200'
                          )}
                        >
                          {u.isActive === 1 ? 'Suspend' : 'Aktifkan'}
                        </button>
                        {currentUser?.id !== u.id && (
                          <button
                            type="button"
                            onClick={() => {
                              setDeleteUserError(null);
                              setDeletingUser(u);
                            }}
                            className="px-2 py-1 text-xs text-rose-700 hover:bg-rose-50 rounded border border-rose-200 font-semibold active:scale-[0.99]"
                          >
                            Hapus
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2. FINANCIAL GROUPS TAB */}
      {activeAdminTab === 'groups' && (
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] no-gradient">
          <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0] mb-4">
            <h3 className="text-sm sm:text-base font-bold text-slate-900 font-heading">Grup Keuangan</h3>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsCreateGroupOpen(true)}
              icon="fa-solid fa-plus"
            >
              Buat Grup Baru
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {groups.map((g) => (
              <div key={g.id} className="p-4 border border-[#E2E8F0] rounded-xl bg-white shadow-[0_1px_3px_rgba(0,0,0,0.03)] hover:border-[#CBD5E1] transition-colors flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-slate-900 text-sm flex items-center gap-2 font-heading min-w-0">
                      <div className="w-6 h-6 rounded bg-[#1E1B4B] text-white flex items-center justify-center text-[10px] shrink-0 font-bold">
                        <i className="fa-solid fa-layer-group" />
                      </div>
                      <span className="truncate">{g.name}</span>
                      {g.isArchived === 1 && (
                        <span className="text-[10px] bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.5 rounded font-sans shrink-0 font-semibold">
                          Diarsipkan
                        </span>
                      )}
                    </div>
                    <span className="font-mono text-xs font-semibold text-slate-700 tabular-nums shrink-0 ml-2">
                      Pagu: {formatRupiah(g.budgetLimit)}
                    </span>
                  </div>

                  <p className="text-xs text-slate-500 mt-2 line-clamp-2 font-sans">
                    {g.description || 'Tidak ada deskripsi'}
                  </p>

                  <div className="flex items-center justify-between pt-3 mt-3 border-t border-[#F1F5F9] text-xs text-slate-500">
                    <div className="flex items-center gap-3 font-sans">
                      <span>
                        <i className="fa-solid fa-users text-[10px] mr-1" />
                        {g.memberCount || 0} Anggota
                      </span>
                      <span>
                        <i className="fa-solid fa-receipt text-[10px] mr-1" />
                        {g.transactionCount || 0} Transaksi
                      </span>
                    </div>
                    <span className="font-mono text-[11px] text-slate-400">slug: {g.slug}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-1.5 pt-3 mt-3 border-t border-[#E2E8F0]">
                  <button
                    type="button"
                    onClick={() => handleOpenGroupWorkspace(g)}
                    className="px-2.5 py-1 text-xs text-[#1E1B4B] bg-[#EEF2FF] hover:bg-[#E0E7FF] rounded border border-[#C7D2FE] font-semibold active:scale-[0.99] flex items-center gap-1.5"
                  >
                    <i className="fa-solid fa-arrow-up-right-from-square text-[10px]" />
                    Buka Buku Kas
                  </button>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleOpenEditGroup(g)}
                      className="px-2 py-1 text-xs text-slate-700 hover:bg-slate-100 rounded border border-[#CBD5E1] font-semibold active:scale-[0.99]"
                    >
                      Ubah
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDeleteGroupError(null);
                        setDeletingGroup(g);
                      }}
                      className="px-2 py-1 text-xs text-rose-700 hover:bg-rose-50 rounded border border-rose-200 font-semibold active:scale-[0.99]"
                    >
                      Hapus
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {groups.length === 0 && !isLoadingGroups && (
              <div className="col-span-full py-12 text-center text-slate-400">
                <i className="fa-solid fa-layer-group text-3xl mb-2 text-slate-300" />
                <p className="text-xs font-semibold text-slate-600 font-heading">Belum Ada Grup Keuangan</p>
                <p className="text-xs text-slate-400 mt-0.5 font-sans">Klik "Buat Grup Baru" untuk menambahkan buku kas pertama.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. AUDIT TAB */}
      {activeAdminTab === 'audit' && (
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] no-gradient">
          <div className="pb-3 border-b border-[#E2E8F0] mb-4">
            <h3 className="text-sm sm:text-base font-bold text-slate-900 font-heading">Audit Trail Global</h3>
          </div>

          <div className="border border-[#E2E8F0] rounded-lg overflow-hidden bg-white shadow-none">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#FAFAFA] border-b border-[#E2E8F0] text-slate-500 font-semibold font-sans tracking-[0.04em] uppercase text-[11px]">
                <tr className="h-10">
                  <th className="py-2.5 px-3">Waktu</th>
                  <th className="py-2.5 px-3">Aktor</th>
                  <th className="py-2.5 px-3">Tindakan</th>
                  <th className="py-2.5 px-3">Entitas</th>
                  <th className="py-2.5 px-3">IP Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F5F9]">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="h-11 hover:bg-[#F8FAFC] transition-colors">
                    <td className="px-3 font-mono text-slate-500 whitespace-nowrap tabular-nums">
                      {formatDateIndo(log.createdAt)} {new Date(log.createdAt).toLocaleTimeString('id-ID')}
                    </td>
                    <td className="px-3 font-medium text-slate-900 font-sans">
                      {log.actorName} <span className="text-slate-400">({log.actorEmail})</span>
                    </td>
                    <td className="px-3">
                      <span className="font-mono text-xs text-slate-800">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-3 text-slate-600 font-mono text-[11px]">
                      {log.entityType} ({log.entityId.slice(0, 8)}...)
                    </td>
                    <td className="px-3 text-slate-400 font-mono text-[11px] tabular-nums">
                      {log.ipAddress || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}


      {/* Create User Modal */}
      <Modal
        isOpen={isCreateUserOpen}
        onClose={() => setIsCreateUserOpen(false)}
        title="Tambah Akun Pengguna Baru"
        maxWidth="sm"
      >
        <form onSubmit={handleCreateUser} className="space-y-3">
          {userFormError && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 rounded text-xs flex items-center gap-2">
              <i className="fa-solid fa-triangle-exclamation" />
              <span>{userFormError}</span>
            </div>
          )}

          <Input
            label="Nama Lengkap"
            placeholder="Contoh: Rahmat Santoso"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            required
          />

          <Input
            label="Alamat Email"
            type="email"
            placeholder="nama@instansi.org"
            value={userEmail}
            onChange={(e) => setUserEmail(e.target.value)}
            required
          />

          <Input
            label="Kata Sandi Awal"
            type="password"
            placeholder="Minimal 8 karakter"
            value={userPassword}
            onChange={(e) => setUserPassword(e.target.value)}
            required
          />

          <Select
            label="Peran Sistem"
            value={userSystemRole}
            onChange={(e) => setUserSystemRole(e.target.value as any)}
            required
          >
            <option value="USER">USER</option>
            <option value="SUPER_ADMIN">SUPER_ADMIN</option>
          </Select>

          <div className="pt-2 border-t border-[#E2E8F0] flex justify-end gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => setIsCreateUserOpen(false)}>
              Batal
            </Button>
            <Button type="submit" variant="primary" size="sm">
              Buat Pengguna
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit User / Reset Password Modal */}
      <Modal
        isOpen={!!editingUser}
        onClose={() => setEditingUser(null)}
        title="Ubah Pengguna"
        maxWidth="sm"
      >
        {editingUser && (
          <form onSubmit={handleSaveEditUser} className="space-y-3">
            {editError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 rounded text-xs flex items-center gap-2">
                <i className="fa-solid fa-triangle-exclamation" />
                <span>{editError}</span>
              </div>
            )}

            <Input
              label="Nama Lengkap"
              value={editingUser.name}
              onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
              required
            />

            <Input
              label="Alamat Email"
              type="email"
              value={editingUser.email}
              onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
              required
            />

            <Select
              label="Peran Sistem"
              value={editingUser.systemRole}
              onChange={(e) => setEditingUser({ ...editingUser, systemRole: e.target.value as any })}
              required
            >
              <option value="USER">USER</option>
              <option value="SUPER_ADMIN">SUPER_ADMIN</option>
            </Select>

            <div>
              <Input
                label="Reset Kata Sandi (Opsional)"
                type="password"
                placeholder="Kosongkan jika tidak diubah"
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
              />
            </div>

            <div className="pt-2 border-t border-[#E2E8F0] flex justify-end gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => setEditingUser(null)}>
                Batal
              </Button>
              <Button type="submit" variant="primary" size="sm">
                Simpan Perubahan
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Create Financial Group Modal */}
      <Modal
        isOpen={isCreateGroupOpen}
        onClose={() => setIsCreateGroupOpen(false)}
        title="Buat Grup Keuangan"
        maxWidth="sm"
      >
        <form onSubmit={handleCreateGroup} className="space-y-3">
          {groupFormError && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 rounded text-xs flex items-center gap-2">
              <i className="fa-solid fa-triangle-exclamation" />
              <span>{groupFormError}</span>
            </div>
          )}

          <Input
            label="Nama Grup Keuangan"
            placeholder="Contoh: Operasional 2026, Divisi Logistik..."
            value={groupName}
            onChange={(e) => handleGroupNameChange(e.target.value)}
            required
          />

          <Input
            label="Slug Unik"
            placeholder="operasional-2026"
            value={groupSlug}
            onChange={(e) => setGroupSlug(e.target.value.toLowerCase())}
            required
          />

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1 font-sans">
              Deskripsi Singkat (Opsional)
            </label>
            <textarea
              rows={2}
              className="w-full p-2 text-xs font-sans rounded border border-[#CBD5E1] bg-white text-slate-900 focus:outline-none focus:border-[#3730A3]"
              placeholder="Keterangan alokasi anggaran..."
              value={groupDesc}
              onChange={(e) => setGroupDesc(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1 font-sans">
              Pagu Anggaran Awal (Rp)
            </label>
            <input
              type="text"
              className="w-full h-[38px] px-3 rounded border border-[#CBD5E1] bg-white text-xs font-mono font-bold text-slate-900 tabular-nums focus:outline-none focus:border-[#3730A3]"
              placeholder="Rp 0"
              value={groupBudget ? formatRupiah(groupBudget) : ''}
              onChange={(e) => setGroupBudget(parseRupiahInput(e.target.value))}
            />
          </div>

          <div className="pt-2 border-t border-[#E2E8F0] flex justify-end gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => setIsCreateGroupOpen(false)}>
              Batal
            </Button>
            <Button type="submit" variant="primary" size="sm">
              Buat Grup
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete User Confirmation Modal */}
      <Modal
        isOpen={!!deletingUser}
        onClose={() => !isDeletingUser && setDeletingUser(null)}
        title="Konfirmasi Hapus Pengguna"
        maxWidth="sm"
      >
        {deletingUser && (
          <div className="space-y-4">
            {deleteUserError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 rounded text-xs flex items-center gap-2">
                <i className="fa-solid fa-triangle-exclamation" />
                <span>{deleteUserError}</span>
              </div>
            )}

            <p className="text-xs text-slate-700 leading-relaxed font-sans">
              Apakah Anda yakin ingin menghapus akun pengguna{' '}
              <strong className="text-slate-900 font-semibold">{deletingUser.name}</strong> ({deletingUser.email})?
            </p>

            <div className="p-3 bg-rose-50/70 border border-rose-200 rounded text-[11px] text-rose-900 leading-normal font-sans">
              <i className="fa-solid fa-triangle-exclamation mr-1.5 text-rose-700" />
              Tindakan ini permanen. Seluruh sesi login dan keanggotaan grup pengguna ini akan dicabut secara langsung.
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E2E8F0]">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={isDeletingUser}
                onClick={() => setDeletingUser(null)}
              >
                Batal
              </Button>
              <Button
                type="button"
                variant="danger"
                size="sm"
                isLoading={isDeletingUser}
                onClick={handleConfirmDeleteUser}
                icon="fa-solid fa-trash-can"
              >
                Hapus Pengguna
              </Button>
            </div>
          </div>
        )}
      </Modal>
      {/* Edit Financial Group Modal */}
      <Modal
        isOpen={!!editingGroup}
        onClose={() => !isSavingEditGroup && setEditingGroup(null)}
        title="Ubah Grup Keuangan"
        maxWidth="sm"
      >
        {editingGroup && (
          <form onSubmit={handleSaveEditGroup} className="space-y-3">
            {editGroupError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 rounded text-xs flex items-center gap-2">
                <i className="fa-solid fa-triangle-exclamation" />
                <span>{editGroupError}</span>
              </div>
            )}

            <Input
              label="Nama Grup Keuangan"
              value={editGroupName}
              onChange={(e) => setEditGroupName(e.target.value)}
              required
            />

            <Input
              label="Slug Unik"
              value={editGroupSlug}
              onChange={(e) => setEditGroupSlug(e.target.value.toLowerCase())}
              required
            />

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 font-sans">
                Deskripsi Singkat
              </label>
              <textarea
                rows={2}
                className="w-full p-2 text-xs font-sans rounded border border-[#CBD5E1] bg-white text-slate-900 focus:outline-none focus:border-[#3730A3]"
                value={editGroupDesc}
                onChange={(e) => setEditGroupDesc(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 font-sans">
                Pagu Anggaran (Rp)
              </label>
              <input
                type="text"
                className="w-full h-[38px] px-3 rounded border border-[#CBD5E1] bg-white text-xs font-mono font-bold text-slate-900 tabular-nums focus:outline-none focus:border-[#3730A3]"
                value={editGroupBudget ? formatRupiah(editGroupBudget) : ''}
                onChange={(e) => setEditGroupBudget(parseRupiahInput(e.target.value))}
              />
            </div>

            <Select
              label="Status Arsip"
              value={String(editGroupIsArchived)}
              onChange={(e) => setEditGroupIsArchived(Number(e.target.value))}
            >
              <option value="0">Aktif (Operasional)</option>
              <option value="1">Diarsipkan (Tutup Buku)</option>
            </Select>

            <div className="pt-2 border-t border-[#E2E8F0] flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={isSavingEditGroup}
                onClick={() => setEditingGroup(null)}
              >
                Batal
              </Button>
              <Button type="submit" variant="primary" size="sm" isLoading={isSavingEditGroup}>
                Simpan Perubahan
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Delete Financial Group Confirmation Modal */}
      <Modal
        isOpen={!!deletingGroup}
        onClose={() => !isDeletingGroup && setDeletingGroup(null)}
        title="Konfirmasi Hapus Grup Keuangan"
        maxWidth="sm"
      >
        {deletingGroup && (
          <div className="space-y-4">
            {deleteGroupError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 rounded text-xs flex items-center gap-2">
                <i className="fa-solid fa-triangle-exclamation" />
                <span>{deleteGroupError}</span>
              </div>
            )}

            <p className="text-xs text-slate-700 leading-relaxed font-sans">
              Apakah Anda yakin ingin menghapus grup keuangan{' '}
              <strong className="text-slate-900 font-semibold">{deletingGroup.name}</strong> (slug: {deletingGroup.slug})?
            </p>

            <div className="p-3 bg-rose-50/70 border border-rose-200 rounded text-[11px] text-rose-900 leading-normal font-sans space-y-1.5">
              <div className="font-semibold flex items-center gap-1.5 text-rose-800">
                <i className="fa-solid fa-triangle-exclamation" />
                Peringatan: Tindakan ini permanen & tidak dapat dibatalkan!
              </div>
              <p>
                Menghapus grup ini akan menghapus seluruh <strong>{deletingGroup.transactionCount || 0} transaksi</strong> buku kas, seluruh kategori belanja, file bukti nota, serta keanggotaan pengguna di grup ini.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E2E8F0]">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={isDeletingGroup}
                onClick={() => setDeletingGroup(null)}
              >
                Batal
              </Button>
              <Button
                type="button"
                variant="danger"
                size="sm"
                isLoading={isDeletingGroup}
                onClick={handleConfirmDeleteGroup}
                icon="fa-solid fa-trash-can"
              >
                Hapus Grup Permanen
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
