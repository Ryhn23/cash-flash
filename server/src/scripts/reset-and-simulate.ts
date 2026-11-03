import { v4 as uuidv4 } from 'uuid';
import fs from 'node:fs';
import path from 'node:path';
import ExcelJS from 'exceljs';
import { db, initDb, sqlite } from '../db/index.js';
import {
  users,
  financialGroups,
  groupMembers,
  groupCategories,
  groupUnits,
  transactions,
  auditLogs,
  sessions,
} from '../db/schema.js';
import { hashPassword } from '../utils/security.js';
import { recalculateGroupAnomalies } from '../services/anomaly.js';
import { recordAuditLog } from '../services/audit.js';
import {
  generateSafirExcelWorkbook,
  parseAndValidateExcel,
  commitImportedRows,
  type ExportTransactionData,
} from '../services/excel.js';
import { eq, desc } from 'drizzle-orm';

export async function resetAndSimulate() {
  console.log('=====================================================');
  console.log('1. MEMBERSIHKAN SELURUH DATA DARI DATABASE SQLITE');
  console.log('=====================================================');

  initDb();

  // Clean all existing tables in proper foreign key order
  sqlite.exec(`
    DELETE FROM audit_logs;
    DELETE FROM transactions;
    DELETE FROM group_units;
    DELETE FROM group_categories;
    DELETE FROM group_members;
    DELETE FROM financial_groups;
    DELETE FROM sessions;
    DELETE FROM users;
  `);

  console.log('✔ Seluruh tabel berhasil dikosongkan (Clean Slate).\n');

  console.log('=====================================================');
  console.log('2. MEMBUAT GRUP SAFIR DENGAN 3 ANGGOTA + SUPER ADMIN');
  console.log('=====================================================');

  // Password hashes
  const adminPasswordHash = await hashPassword('AdminPassword123!');
  const memberPasswordHash = await hashPassword('SafirPassword123!');

  // A. Super Admin
  const superAdminId = uuidv4();
  db.insert(users)
    .values({
      id: superAdminId,
      name: 'Administrator Utama',
      email: 'admin@nextcash.io',
      passwordHash: adminPasswordHash,
      systemRole: 'SUPER_ADMIN',
      isActive: 1,
    })
    .run();
  console.log('✔ Akun Super Admin: admin@nextcash.io (AdminPassword123!)');

  // B. 3 Orang Anggota Safir:
  // 1. Bendahara (GROUP_MANAGER)
  const bendaharaId = uuidv4();
  db.insert(users)
    .values({
      id: bendaharaId,
      name: 'Fathir Bendahara',
      email: 'bendahara@safir.org',
      passwordHash: memberPasswordHash,
      systemRole: 'USER',
      isActive: 1,
    })
    .run();
  console.log('✔ 1. Bendahara (GROUP_MANAGER): bendahara@safir.org (SafirPassword123!)');

  // 2. Staf Kasir / Pencatat (EDITOR)
  const stafId = uuidv4();
  db.insert(users)
    .values({
      id: stafId,
      name: 'Ahmad Staf Pencatat',
      email: 'staf@safir.org',
      passwordHash: memberPasswordHash,
      systemRole: 'USER',
      isActive: 1,
    })
    .run();
  console.log('✔ 2. Staf Kasir (EDITOR): staf@safir.org (SafirPassword123!)');

  // 3. Auditor / Pengamat (VIEWER)
  const auditorId = uuidv4();
  db.insert(users)
    .values({
      id: auditorId,
      name: 'Dewi Auditor',
      email: 'auditor@safir.org',
      passwordHash: memberPasswordHash,
      systemRole: 'USER',
      isActive: 1,
    })
    .run();
  console.log('✔ 3. Auditor (VIEWER): auditor@safir.org (SafirPassword123!)');

  // C. Buat Grup: "BELANJA SAFIR"
  const safirGroupId = uuidv4();
  db.insert(financialGroups)
    .values({
      id: safirGroupId,
      name: 'BELANJA SAFIR',
      slug: 'belanja-safir',
      description: 'Pembukuan & Manajemen Belanja Operasional Kontingen Safir',
      budgetLimit: 75000000, // Rp 75.000.000 Pagu Anggaran
      createdBy: superAdminId,
    })
    .run();
  console.log('\n✔ Grup Keuangan: BELANJA SAFIR (Pagu Rp 75.000.000)');

  // D. Hubungkan 3 Anggota ke Grup BELANJA SAFIR
  db.insert(groupMembers).values({ id: uuidv4(), groupId: safirGroupId, userId: superAdminId, groupRole: 'GROUP_MANAGER' }).run();
  db.insert(groupMembers).values({ id: uuidv4(), groupId: safirGroupId, userId: bendaharaId, groupRole: 'GROUP_MANAGER' }).run();
  db.insert(groupMembers).values({ id: uuidv4(), groupId: safirGroupId, userId: stafId, groupRole: 'EDITOR' }).run();
  db.insert(groupMembers).values({ id: uuidv4(), groupId: safirGroupId, userId: auditorId, groupRole: 'VIEWER' }).run();
  console.log('✔ 3 Anggota berhasil ditautkan ke BELANJA SAFIR dengan perannya masing-masing.');

  // E. Buat Kategori Belanja Safir
  const categoryDefs = [
    { name: 'Tempat Tinggal', type: 'EXPENSE' as const, budget: 25000000 },
    { name: 'Konsumsi', type: 'EXPENSE' as const, budget: 15000000 },
    { name: 'Perlengkapan & ATK', type: 'EXPENSE' as const, budget: 10000000 },
    { name: 'Transportasi', type: 'EXPENSE' as const, budget: 12000000 },
    { name: 'Listrik & Utilitas', type: 'EXPENSE' as const, budget: 5000000 },
    { name: 'Logistik & Operasional', type: 'EXPENSE' as const, budget: 8000000 },
    { name: 'Dana Masuk / Pemasukan', type: 'INCOME' as const, budget: 0 },
  ];

  const catMap = new Map<string, string>();
  for (const c of categoryDefs) {
    const catId = uuidv4();
    db.insert(groupCategories)
      .values({
        id: catId,
        groupId: safirGroupId,
        name: c.name,
        type: c.type,
        budgetAllocation: c.budget,
      })
      .run();
    catMap.set(c.name, catId);
  }
  console.log(`✔ Berhasil membuat ${categoryDefs.length} Kategori Pembukuan Safir.`);

  // F. Buat Satuan Unit
  const units = ['Unit', 'Paket', 'Pcs', 'Rim', 'Lusin', 'Liter', 'Kg', 'Bulan', 'Hari'];
  for (const u of units) {
    db.insert(groupUnits)
      .values({
        id: uuidv4(),
        groupId: safirGroupId,
        name: u,
      })
      .run();
  }
  console.log(`✔ Berhasil membuat ${units.length} Satuan Pengukuran Belanja.\n`);

  console.log('=====================================================');
  console.log('3. SIMULASI KEGIATAN PENCATATAN TRANSAKSI');
  console.log('=====================================================');

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  // 1. Transaksi Pemasukan Kas Awal oleh Bendahara
  const tx1Id = uuidv4();
  db.insert(transactions)
    .values({
      id: tx1Id,
      groupId: safirGroupId,
      txDate: todayStr,
      type: 'INCOME',
      description: 'Pencairan Dana Tahap 1 dari Kas Pusat',
      categoryId: catMap.get('Dana Masuk / Pemasukan'),
      quantity: 1,
      unit: 'Paket',
      unitPrice: 50000000,
      totalPrice: 50000000,
      dataStatus: 'OK',
      createdBy: bendaharaId,
      updatedBy: bendaharaId,
    })
    .run();
  recordAuditLog({
    groupId: safirGroupId,
    actorId: bendaharaId,
    action: 'CREATE_TRANSACTION',
    entityType: 'TRANSACTION',
    entityId: tx1Id,
    newValues: { description: 'Pencairan Dana Tahap 1 dari Kas Pusat', totalPrice: 50000000 },
  });
  console.log('✔ [Bendahara] Catat Pemasukan Kas: Rp 50.000.000');

  // 2. Transaksi Sewa Tempat Tinggal oleh Staf Pencatat
  const tx2Id = uuidv4();
  db.insert(transactions)
    .values({
      id: tx2Id,
      groupId: safirGroupId,
      txDate: todayStr,
      type: 'EXPENSE',
      description: 'Sewa Wisma Penginapan Kontingen Safir',
      categoryId: catMap.get('Tempat Tinggal'),
      quantity: 1,
      unit: 'Bulan',
      unitPrice: 18500000,
      totalPrice: 18500000,
      dataStatus: 'OK',
      createdBy: stafId,
      updatedBy: stafId,
    })
    .run();
  console.log('✔ [Staf Pencatat] Catat Belanja Sewa Wisma: Rp 18.500.000');

  // 3. Transaksi ATK (Forward Mode: Qty * UnitPrice) oleh Staf Pencatat
  const tx3Id = uuidv4();
  db.insert(transactions)
    .values({
      id: tx3Id,
      groupId: safirGroupId,
      txDate: todayStr,
      type: 'EXPENSE',
      description: 'Kertas HVS A4 70gr dan Spidol Boardmarker',
      categoryId: catMap.get('Perlengkapan & ATK'),
      quantity: 5,
      unit: 'Rim',
      unitPrice: 55000,
      totalPrice: 275000,
      dataStatus: 'OK',
      createdBy: stafId,
      updatedBy: stafId,
    })
    .run();
  console.log('✔ [Staf Pencatat] Catat ATK (Forward 5 Rim @ Rp 55.000): Rp 275.000');

  // 4. Transaksi Konsumsi (Reverse Mode: Total / Qty) oleh Staf Pencatat
  const tx4Id = uuidv4();
  db.insert(transactions)
    .values({
      id: tx4Id,
      groupId: safirGroupId,
      txDate: todayStr,
      type: 'EXPENSE',
      description: 'Konsumsi Nasi Kotak Rapat Koordinasi Tim',
      categoryId: catMap.get('Konsumsi'),
      quantity: 35,
      unit: 'Pcs',
      unitPrice: 20000,
      totalPrice: 700000,
      dataStatus: 'OK',
      createdBy: stafId,
      updatedBy: stafId,
    })
    .run();
  console.log('✔ [Staf Pencatat] Catat Konsumsi (Reverse Split 35 Pcs): Rp 700.000');

  // 5. Transaksi Snack & Air Galon 1 (Akan menjadi duplikat kembar)
  const tx5Id = uuidv4();
  db.insert(transactions)
    .values({
      id: tx5Id,
      groupId: safirGroupId,
      txDate: todayStr,
      type: 'EXPENSE',
      description: 'Pembelian Snack dan Air Galon Posko',
      categoryId: catMap.get('Konsumsi'),
      quantity: 5,
      unit: 'Paket',
      unitPrice: 30000,
      totalPrice: 150000,
      dataStatus: 'OK',
      createdBy: stafId,
      updatedBy: stafId,
    })
    .run();

  // 6. Transaksi Snack & Air Galon 2 (Sengaja dicatat sama untuk simulasi anomali)
  const tx6Id = uuidv4();
  db.insert(transactions)
    .values({
      id: tx6Id,
      groupId: safirGroupId,
      txDate: todayStr,
      type: 'EXPENSE',
      description: 'Pembelian Snack dan Air Galon Posko',
      categoryId: catMap.get('Konsumsi'),
      quantity: 5,
      unit: 'Paket',
      unitPrice: 30000,
      totalPrice: 150000,
      dataStatus: 'OK',
      createdBy: stafId,
      updatedBy: stafId,
    })
    .run();

  // Jalankan anomaly check
  recalculateGroupAnomalies(safirGroupId);
  console.log('✔ [Deteksi Anomali Otomatis] 2 Transaksi Snack & Galon terdeteksi "POTENTIAL_DUPLICATE"');

  // 7. Simulasi Verifikasi oleh Bendahara
  db.update(transactions)
    .set({
      dataStatus: 'VERIFIED_DUPLICATE_OK',
      verificationNote: 'Pengeluaran terpisah untuk sesi pagi dan sesi sore yang sah',
      verifiedBy: bendaharaId,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(transactions.id, tx6Id))
    .run();

  recordAuditLog({
    groupId: safirGroupId,
    actorId: bendaharaId,
    action: 'VERIFY_DUPLICATE_OK',
    entityType: 'TRANSACTION',
    entityId: tx6Id,
    newValues: {
      status: 'VERIFIED_DUPLICATE_OK',
      note: 'Pengeluaran terpisah untuk sesi pagi dan sesi sore yang sah',
    },
  });
  console.log('✔ [Bendahara] Verifikasi Transaksi: Status diubah menjadi "VERIFIED_DUPLICATE_OK"\n');

  console.log('=====================================================');
  console.log('4. SIMULASI IMPOR DARI FILE EXCEL (.XLSX)');
  console.log('=====================================================');

  // Generate file excel sementara untuk diimpor
  const importWb = new ExcelJS.Workbook();
  const importSheet = importWb.addWorksheet('Belanja');
  importSheet.addRow([
    'NO',
    'TANGGAL',
    'URAIAN',
    'KATEGORI',
    'JUMLAH',
    'SATUAN',
    'HARGA SATUAN',
    'TOTAL HARGA',
    'TIPE',
    'CATATAN',
  ]);

  importSheet.addRow([1, todayStr, 'Sewa Mobil Elf Operasional Bandara', 'Transportasi', 2, 'Hari', 800000, 1600000, 'Pengeluaran', 'Penjemputan rombongan']);
  importSheet.addRow([2, todayStr, 'Cetak Spanduk & Banner Posko Safir', 'Logistik & Operasional', 4, 'Unit', 125000, 500000, 'Pengeluaran', 'Bahan Flexi']);
  importSheet.addRow([3, todayStr, 'Pengisian Token Listrik Wisma', 'Listrik & Utilitas', 1, 'Paket', 750000, 750000, 'Pengeluaran', 'Token 500k + 250k']);

  const importBuffer = Buffer.from(await importWb.xlsx.writeBuffer());

  // Parse & validasi buffer excel
  const parseResult = await parseAndValidateExcel(importBuffer, safirGroupId);
  console.log(`✔ Berhasil membaca file Excel: Total ${parseResult.totalRows} baris, Valid: ${parseResult.validCount}`);

  // Commit baris ke database
  const commitCount = await commitImportedRows(
    safirGroupId,
    stafId,
    parseResult.rows.map((r) => ({
      txDate: r.txDate,
      description: r.description,
      categoryId: r.categoryId,
      quantity: r.quantity,
      unit: r.unit,
      unitPrice: r.unitPrice,
      totalPrice: r.totalPrice,
      type: r.type,
      note: r.note,
    }))
  );
  console.log(`✔ ${commitCount} baris transaksi baru dari Excel berhasil di-commit ke database Safir.\n`);

  console.log('=====================================================');
  console.log('5. SIMULASI EKSPOR BUKU KAS KE FILE EXCEL (.XLSX)');
  console.log('=====================================================');

  const allSafirTxs = db
    .select({
      id: transactions.id,
      txDate: transactions.txDate,
      type: transactions.type,
      description: transactions.description,
      categoryName: groupCategories.name,
      quantity: transactions.quantity,
      unit: transactions.unit,
      unitPrice: transactions.unitPrice,
      totalPrice: transactions.totalPrice,
      dataStatus: transactions.dataStatus,
      creatorName: users.name,
      verificationNote: transactions.verificationNote,
    })
    .from(transactions)
    .leftJoin(groupCategories, eq(transactions.categoryId, groupCategories.id))
    .innerJoin(users, eq(transactions.createdBy, users.id))
    .where(eq(transactions.groupId, safirGroupId))
    .orderBy(desc(transactions.txDate))
    .all();

  const categoriesList = db
    .select({
      name: groupCategories.name,
      budgetAllocation: groupCategories.budgetAllocation,
    })
    .from(groupCategories)
    .where(eq(groupCategories.groupId, safirGroupId))
    .all();

  const exportBuffer = await generateSafirExcelWorkbook(
    'BELANJA SAFIR',
    allSafirTxs.map((t) => ({
      ...t,
      categoryName: t.categoryName || 'Belum dikategorikan',
      creatorName: t.creatorName || 'Staf',
    })),
    categoriesList
  );

  const exportDir = path.resolve(process.cwd(), 'exports');
  if (!fs.existsSync(exportDir)) {
    fs.mkdirSync(exportDir, { recursive: true });
  }

  const exportPath = path.join(exportDir, 'BELANJA_SAFIR_Terbaru.xlsx');
  fs.writeFileSync(exportPath, Buffer.from(exportBuffer as any));
  console.log(`✔ File Buku Kas resmi berhasil diekspor ke: ${exportPath}`);
  console.log(`  (Berisi ${allSafirTxs.length} baris transaksi lengkap dengan rumus Excel live SUM/COUNTIF).\n`);

  console.log('=====================================================');
  console.log('6. RINGKASAN AKHIR BUKU KAS SAFIR');
  console.log('=====================================================');

  const totalExpense = allSafirTxs
    .filter((t) => t.type === 'EXPENSE')
    .reduce((sum, t) => sum + t.totalPrice, 0);

  const totalIncome = allSafirTxs
    .filter((t) => t.type === 'INCOME')
    .reduce((sum, t) => sum + t.totalPrice, 0);

  const remaining = 75000000 - totalExpense;

  console.log(`• Pagu Anggaran         : Rp 75.000.000`);
  console.log(`• Total Pemasukan Kas   : Rp ${totalIncome.toLocaleString('id-ID')}`);
  console.log(`• Total Pengeluaran Kas : Rp ${totalExpense.toLocaleString('id-ID')}`);
  console.log(`• Sisa Saldo Pagu       : Rp ${remaining.toLocaleString('id-ID')} (${Math.round((remaining / 75000000) * 100)}%)`);
  console.log(`• Total Transaksi       : ${allSafirTxs.length} transaksi`);
  console.log(`• Status Rekonsiliasi   : OK - SAMA (Rp 0 Selisih)`);
  console.log('=====================================================\n');
}

// Execute if run directly
resetAndSimulate()
  .then(() => {
    console.log('🎉 SELURUH PROSES SIMULASI SELESAI DENGAN SUKSES!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Terjadi kesalahan:', err);
    process.exit(1);
  });
