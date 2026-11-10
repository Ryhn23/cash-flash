import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client.js';
import { Button } from '../ui/Button.js';
import { Input } from '../ui/Input.js';
import { Select } from '../ui/Select.js';
import { Modal } from '../ui/Modal.js';
import { PageHeader } from '../layout/PageHeader.js';
import { formatRupiah, parseRupiahInput } from '../../utils/format.js';
import type { FinancialGroup, GroupMember, GroupCategory, User } from '../../types/index.js';

export interface GroupSettingsViewProps {
  group: FinancialGroup;
  canManage: boolean;
}

export const GroupSettingsView: React.FC<GroupSettingsViewProps> = ({ group, canManage }) => {
  const queryClient = useQueryClient();

  // Group Details Form State
  const [name, setName] = useState(group.name);
  const [description, setDescription] = useState(group.description || '');
  const [budgetLimit, setBudgetLimit] = useState(group.budgetLimit);
  const [isSavingGroup, setIsSavingGroup] = useState(false);
  const [groupSaveMsg, setGroupSaveMsg] = useState<string | null>(null);

  // New Category State
  const [newCatName, setNewCatName] = useState('');
  const [newCatBudget, setNewCatBudget] = useState(0);
  const [isAddingCat, setIsAddingCat] = useState(false);

  // New Unit State
  const [newUnitName, setNewUnitName] = useState('');

  // Add Member Modal State
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedGroupRole, setSelectedGroupRole] = useState<'GROUP_MANAGER' | 'EDITOR' | 'VIEWER'>('EDITOR');
  const [memberError, setMemberError] = useState<string | null>(null);

  // Fetch group categories
  const { data: catData } = useQuery<{ success: boolean; categories: GroupCategory[] }>({
    queryKey: ['group-categories', group.id],
    queryFn: () => api.get(`/api/groups/${group.id}/categories`),
  });
  const categories = catData?.categories || [];

  // Fetch group units
  const { data: unitData } = useQuery<{ success: boolean; units: string[] }>({
    queryKey: ['group-units', group.id],
    queryFn: () => api.get(`/api/groups/${group.id}/units`),
  });
  const units = unitData?.units || [];

  // Fetch group members
  const { data: memberData } = useQuery<{ success: boolean; members: GroupMember[] }>({
    queryKey: ['group-members', group.id],
    queryFn: () => api.get(`/api/groups/${group.id}/members`),
  });
  const members = memberData?.members || [];

  // Fetch all users for adding member
  const { data: allUsersData } = useQuery<{ success: boolean; users: User[] }>({
    queryKey: ['users'],
    queryFn: () => api.get('/api/users'),
    enabled: isAddMemberOpen,
  });
  const allUsers = allUsersData?.users || [];
  const nonMembers = allUsers.filter((u) => !members.some((m) => m.userId === u.id));

  // Save Group Settings
  const handleSaveGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingGroup(true);
    setGroupSaveMsg(null);
    try {
      await api.patch(`/api/groups/${group.id}`, {
        name: name.trim(),
        description: description.trim(),
        budgetLimit,
      });
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      setGroupSaveMsg('Pengaturan grup berhasil disimpan!');
      setTimeout(() => setGroupSaveMsg(null), 3000);
    } catch (err: any) {
      alert(err.message || 'Gagal menyimpan pengaturan');
    } finally {
      setIsSavingGroup(false);
    }
  };

  // Add Category
  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    setIsAddingCat(true);
    try {
      await api.post(`/api/groups/${group.id}/categories`, {
        name: newCatName.trim(),
        type: 'EXPENSE',
        budgetAllocation: newCatBudget,
      });
      setNewCatName('');
      setNewCatBudget(0);
      queryClient.invalidateQueries({ queryKey: ['group-categories', group.id] });
      queryClient.invalidateQueries({ queryKey: ['analytics', group.id] });
    } catch (err: any) {
      alert(err.message || 'Gagal menambahkan kategori');
    } finally {
      setIsAddingCat(false);
    }
  };

  // Add Custom Unit
  const handleAddUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUnitName.trim()) return;
    try {
      await api.post(`/api/groups/${group.id}/units`, { name: newUnitName.trim() });
      setNewUnitName('');
      queryClient.invalidateQueries({ queryKey: ['group-units', group.id] });
    } catch (err: any) {
      alert(err.message || 'Gagal menambahkan satuan');
    }
  };

  // Add Member
  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) {
      setMemberError('Silakan pilih pengguna');
      return;
    }
    setMemberError(null);
    try {
      await api.post(`/api/groups/${group.id}/members`, {
        userId: selectedUserId,
        groupRole: selectedGroupRole,
      });
      setIsAddMemberOpen(false);
      setSelectedUserId('');
      queryClient.invalidateQueries({ queryKey: ['group-members', group.id] });
    } catch (err: any) {
      setMemberError(err.message || 'Gagal menambahkan anggota');
    }
  };

  // Update Member Role
  const handleUpdateRole = async (userId: string, newRole: 'GROUP_MANAGER' | 'EDITOR' | 'VIEWER') => {
    try {
      await api.patch(`/api/groups/${group.id}/members/${userId}`, { groupRole: newRole });
      queryClient.invalidateQueries({ queryKey: ['group-members', group.id] });
    } catch (err: any) {
      alert(err.message || 'Gagal mengubah peran anggota');
    }
  };

  // Remove Member
  const handleRemoveMember = async (userId: string, name: string) => {
    if (!confirm(`Apakah Anda yakin ingin mengeluarkan ${name} dari grup ini?`)) return;
    try {
      await api.delete(`/api/groups/${group.id}/members/${userId}`);
      queryClient.invalidateQueries({ queryKey: ['group-members', group.id] });
    } catch (err: any) {
      alert(err.message || 'Gagal mengeluarkan anggota');
    }
  };

  return (
    <div className="space-y-4">
      {/* Standardized Page Header */}
      <PageHeader
        title="Pengaturan Grup Keuangan"
        description="Konfigurasi nama grup, pagu batas anggaran belanja, kategori alokasi dana, satuan unit, dan akses anggota."
        icon="fa-solid fa-sliders"
        badge={
          <span className="px-2 py-0.5 text-[11px] font-medium bg-slate-100 text-slate-700 rounded border border-slate-200">
            {group.name}
          </span>
        }
      />

      {/* 1. Group General Settings */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] no-gradient">
        <div className="border-b border-[#E2E8F0] pb-2.5 mb-4">
          <h3 className="text-sm sm:text-base font-bold text-slate-900 font-heading">Pengaturan Grup & Pagu</h3>
        </div>

        {groupSaveMsg && (
          <div className="mb-4 p-3 bg-[#F0FDF4] border border-[#DCFCE7] text-[#15803D] rounded text-xs flex items-center gap-2">
            <i className="fa-solid fa-check" />
            <span>{groupSaveMsg}</span>
          </div>
        )}

        <form onSubmit={handleSaveGroup} className="space-y-4 max-w-2xl">
          <Input
            label="Nama Grup Keuangan"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={!canManage}
            required
          />

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 font-sans">
              Deskripsi / Keterangan Grup
            </label>
            <textarea
              rows={2}
              className="w-full p-2.5 text-xs font-sans rounded border border-[#E2E8F0] bg-white text-slate-900 focus:outline-none focus:border-[#3730A3] focus:ring-2 focus:ring-[#3730A3]/10"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={!canManage}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 font-sans">
              Pagu Anggaran Keseluruhan (Rp)
            </label>
            <input
              type="text"
              className="w-full h-[38px] px-3 rounded border border-[#E2E8F0] bg-white text-xs font-mono font-bold text-slate-900 tabular-nums focus:outline-none focus:border-[#3730A3] focus:ring-2 focus:ring-[#3730A3]/10"
              value={formatRupiah(budgetLimit)}
              onChange={(e) => setBudgetLimit(parseRupiahInput(e.target.value))}
              disabled={!canManage}
            />
          </div>

          {canManage && (
            <div className="flex justify-end pt-2">
              <Button type="submit" variant="primary" size="sm" isLoading={isSavingGroup}>
                Simpan Perubahan
              </Button>
            </div>
          )}
        </form>
      </div>

      {/* 2. Group Categories Management */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] no-gradient">
        <div className="border-b border-[#E2E8F0] pb-2.5 mb-4 flex items-center justify-between">
          <h3 className="text-sm sm:text-base font-bold text-slate-900 font-heading">Kategori Belanja</h3>
          <span className="text-xs text-slate-500 font-mono">
            {categories.length} kategori
          </span>
        </div>

        {canManage && (
          <form onSubmit={handleAddCategory} className="flex flex-col sm:flex-row items-end gap-3 mb-4 p-3 bg-[#F8FAFC] rounded border border-[#E2E8F0]">
            <div className="flex-1 w-full">
              <Input
                label="Nama Kategori Baru"
                placeholder="Contoh: Honorarium, Dokumentasi, Publikasi..."
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                required
              />
            </div>
            <div className="w-full sm:w-48">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 font-sans">
                Alokasi Pagu (Rp)
              </label>
              <input
                type="text"
                className="w-full h-[38px] px-3 rounded border border-[#E2E8F0] bg-white text-xs font-mono tabular-nums text-slate-900 focus:outline-none focus:border-[#3730A3]"
                placeholder="Rp 0"
                value={newCatBudget ? formatRupiah(newCatBudget) : ''}
                onChange={(e) => setNewCatBudget(parseRupiahInput(e.target.value))}
              />
            </div>
            <Button type="submit" variant="primary" size="sm" isLoading={isAddingCat} icon="fa-solid fa-plus">
              Tambah Kategori
            </Button>
          </form>
        )}

        <div className="divide-y divide-[#F1F5F9] border border-[#E2E8F0] rounded-lg overflow-hidden bg-white">
          {categories.map((c) => (
            <div key={c.id} className="p-3 flex items-center justify-between text-xs hover:bg-[#F8FAFC]">
              <div className="flex items-center gap-2">
                <i className="fa-solid fa-tag text-slate-400 text-xs" />
                <span className="font-semibold text-slate-800 font-sans">{c.name}</span>
              </div>
              <div className="flex items-center gap-3 font-mono text-slate-600 tabular-nums">
                <span>Alokasi: {formatRupiah(c.budgetAllocation)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Group Units Management */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] no-gradient">
        <div className="border-b border-[#E2E8F0] pb-2.5 mb-4">
          <h3 className="text-sm sm:text-base font-bold text-slate-900 font-heading">Satuan Item</h3>
        </div>

        {canManage && (
          <form onSubmit={handleAddUnit} className="flex items-end gap-2 max-w-sm mb-4">
            <Input
              label="Tambah Satuan Baru"
              placeholder="Contoh: Galon, Rim, Dus..."
              value={newUnitName}
              onChange={(e) => setNewUnitName(e.target.value)}
              required
            />
            <Button type="submit" variant="primary" size="sm" icon="fa-solid fa-plus">
              Tambah
            </Button>
          </form>
        )}

        <div className="flex flex-wrap gap-2">
          {units.map((u) => (
            <span key={u} className="px-2.5 py-0.5 bg-slate-100 text-slate-700 text-xs font-mono rounded">
              {u}
            </span>
          ))}
        </div>
      </div>

      {/* 4. Group Members Management */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] no-gradient">
        <div className="border-b border-[#E2E8F0] pb-2.5 mb-4 flex items-center justify-between">
          <h3 className="text-sm sm:text-base font-bold text-slate-900 font-heading">Anggota Tim & Peran</h3>
          {canManage && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsAddMemberOpen(true)}
              icon="fa-solid fa-user-plus"
            >
              Tambah Anggota
            </Button>
          )}
        </div>

        <div className="divide-y divide-[#F1F5F9] border border-[#E2E8F0] rounded-lg overflow-hidden bg-white">
          {members.map((m) => (
            <div key={m.id} className="p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:bg-[#F8FAFC]">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded bg-[#1E1B4B] text-white flex items-center justify-center font-bold text-xs no-gradient">
                  {m.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900 font-sans">{m.name}</div>
                  <div className="text-[11px] text-slate-500 font-mono">{m.email}</div>
                </div>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                {canManage ? (
                  <select
                    value={m.groupRole}
                    onChange={(e) => handleUpdateRole(m.userId, e.target.value as any)}
                    className="h-[32px] px-2 rounded border border-[#E2E8F0] bg-white text-xs font-sans text-slate-800 focus:outline-none focus:border-[#3730A3]"
                  >
                    <option value="GROUP_MANAGER">Ketua / Bendahara Utama</option>
                    <option value="EDITOR">Staf Pencatat / Panitia</option>
                    <option value="VIEWER">Auditor / Pengawas</option>
                  </select>
                ) : (
                  <span className="inline-flex items-center h-5 px-1.5 text-[11px] font-semibold text-slate-700 bg-slate-100 rounded-full">
                    {m.groupRole === 'GROUP_MANAGER' ? 'Ketua / Bendahara' : m.groupRole === 'EDITOR' ? 'Staf Pencatat' : 'Auditor'}
                  </span>
                )}

                {canManage && (
                  <button
                    type="button"
                    onClick={() => handleRemoveMember(m.userId, m.name)}
                    className="text-slate-400 hover:text-rose-600 p-1 rounded transition-colors active:scale-[0.99]"
                    title="Keluarkan dari grup"
                  >
                    <i className="fa-regular fa-trash-can text-xs" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Add Member Modal */}
      <Modal
        isOpen={isAddMemberOpen}
        onClose={() => setIsAddMemberOpen(false)}
        title="Tambah Anggota"
        maxWidth="sm"
      >
        <form onSubmit={handleAddMember} className="space-y-3">
          {memberError && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 rounded text-xs flex items-center gap-2">
              <i className="fa-solid fa-triangle-exclamation" />
              <span>{memberError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1 font-sans">
              Pengguna <span className="text-rose-600">*</span>
            </label>
            <select
              className="w-full h-[38px] px-2.5 rounded border border-[#CBD5E1] bg-white text-xs font-sans text-slate-800 focus:outline-none focus:border-[#3730A3]"
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              required
            >
              <option value="">-- Pilih Pengguna Terdaftar --</option>
              {nonMembers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.email})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1 font-sans">
              Peran Grup <span className="text-rose-600">*</span>
            </label>
            <select
              className="w-full h-[38px] px-2.5 rounded border border-[#CBD5E1] bg-white text-xs font-sans text-slate-800 focus:outline-none focus:border-[#3730A3]"
              value={selectedGroupRole}
              onChange={(e) => setSelectedGroupRole(e.target.value as any)}
              required
            >
              <option value="GROUP_MANAGER">Ketua / Bendahara (GROUP_MANAGER)</option>
              <option value="EDITOR">Staf Pencatat (EDITOR)</option>
              <option value="VIEWER">Auditor / Pengawas (VIEWER)</option>
            </select>
          </div>

          <div className="pt-2 border-t border-[#E2E8F0] flex justify-end gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => setIsAddMemberOpen(false)}>
              Batal
            </Button>
            <Button type="submit" variant="primary" size="sm">
              Tambahkan ke Grup
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

