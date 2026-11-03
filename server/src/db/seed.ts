import { v4 as uuidv4 } from 'uuid';
import { db, initDb } from './index.js';
import {
  users,
  financialGroups,
  groupMembers,
  groupCategories,
  groupUnits,
  transactions,
} from './schema.js';
import { hashPassword } from '../utils/security.js';
import { recalculateGroupAnomalies } from '../services/anomaly.js';
import { recordAuditLog } from '../services/audit.js';

export async function runSeed() {
  console.log('--- Initializing database schema ---');
  initDb();

  console.log('--- Seeding Users ---');

  // Check if admin already exists
  const existingAdmin = db.select().from(users).all();
  if (existingAdmin.length > 0) {
    console.log('Database already contains users. Checking if BELANJA SAFIR exists...');
    const existingGroup = db.select().from(financialGroups).all();
    if (existingGroup.length > 0) {
      console.log('BELANJA SAFIR already seeded.');
      return;
    }
  }

  // 1. SUPER_ADMIN
  const superAdminId = uuidv4();
  const superAdminHash = await hashPassword('AdminPassword123!');
  db.insert(users)
    .values({
      id: superAdminId,
      name: 'Administrator Utama',
      email: 'admin@nextcash.io',
      passwordHash: superAdminHash,
      systemRole: 'SUPER_ADMIN',
      isActive: 1,
    })
    .run();
  console.log('Seeded SUPER_ADMIN: admin@nextcash.io / AdminPassword123!');

  // 2. Sample User 1: Bendahara Utama (GROUP_MANAGER)
  const bendaharaId = uuidv4();
  const bendaharaHash = await hashPassword('SafirPassword123!');
  db.insert(users)
    .values({
      id: bendaharaId,
      name: 'Fathir Bendahara',
      email: 'bendahara@safir.org',
      passwordHash: bendaharaHash,
      systemRole: 'USER',
      isActive: 1,
    })
    .run();
  console.log('Seeded USER (GROUP_MANAGER): bendahara@safir.org / SafirPassword123!');

  // 3. Sample User 2: Staf Pencatat (EDITOR)
  const stafId = uuidv4();
  const stafHash = await hashPassword('SafirPassword123!');
  db.insert(users)
    .values({
      id: stafId,
      name: 'Ahmad Staf Pencatat',
      email: 'staf@safir.org',
      passwordHash: stafHash,
      systemRole: 'USER',
      isActive: 1,
    })
    .run();
  console.log('Seeded USER (EDITOR): staf@safir.org / SafirPassword123!');

  // 3b. Sample User 3: Auditor Pengamat (VIEWER)
  const auditorId = uuidv4();
  const auditorHash = await hashPassword('SafirPassword123!');
  db.insert(users)
    .values({
      id: auditorId,
      name: 'Dewi Auditor',
      email: 'auditor@safir.org',
      passwordHash: auditorHash,
      systemRole: 'USER',
      isActive: 1,
    })
    .run();
  console.log('Seeded USER (VIEWER): auditor@safir.org / SafirPassword123!');

  // 4. Financial Group: "BELANJA SAFIR"
  console.log('--- Seeding Financial Group: BELANJA SAFIR ---');
  const safirGroupId = uuidv4();
  db.insert(financialGroups)
    .values({
      id: safirGroupId,
      name: 'BELANJA SAFIR',
      slug: 'belanja-safir',
      description: 'Pembukuan & Manajemen Belanja Operasional Kontingen Safir',
      budgetLimit: 75000000, // Rp 75.000.000
      createdBy: superAdminId,
    })
    .run();

  // Assign Members to BELANJA SAFIR
  db.insert(groupMembers)
    .values({
      id: uuidv4(),
      groupId: safirGroupId,
      userId: superAdminId,
      groupRole: 'GROUP_MANAGER',
    })
    .run();

  db.insert(groupMembers)
    .values({
      id: uuidv4(),
      groupId: safirGroupId,
      userId: bendaharaId,
      groupRole: 'GROUP_MANAGER',
    })
    .run();

  db.insert(groupMembers)
    .values({
      id: uuidv4(),
      groupId: safirGroupId,
      userId: stafId,
      groupRole: 'EDITOR',
    })
    .run();

  db.insert(groupMembers)
    .values({
      id: uuidv4(),
      groupId: safirGroupId,
      userId: auditorId,
      groupRole: 'VIEWER',
    })
    .run();

  // Default Categories
  const categoryNames = [
    { name: 'Tempat Tinggal', budget: 25000000 },
    { name: 'Kantor', budget: 5000000 },
    { name: 'Perlengkapan', budget: 8000000 },
    { name: 'Elektronik', budget: 7000000 },
    { name: 'Listrik', budget: 3000000 },
    { name: 'Transportasi', budget: 12000000 },
    { name: 'Tiket', budget: 8000000 },
    { name: 'Coffee Break', budget: 3000000 },
    { name: 'Snack', budget: 2000000 },
    { name: 'Lainnya', budget: 2000000 },
  ];

  const catMap = new Map<string, string>();
  for (const c of categoryNames) {
    const catId = uuidv4();
    db.insert(groupCategories)
      .values({
        id: catId,
        groupId: safirGroupId,
        name: c.name,
        type: 'EXPENSE',
        budgetAllocation: c.budget,
      })
      .run();
    catMap.set(c.name, catId);
  }

  // Units
  const units = ['Unit', 'Paket', 'Pcs', 'Lusin', 'Liter', 'Kg', 'Rim', 'Kotak', 'Hari', 'Tiket'];
  for (const u of units) {
    db.insert(groupUnits)
      .values({
        id: uuidv4(),
        groupId: safirGroupId,
        name: u,
      })
      .run();
  }

  // Transactions (Including duplicate test cases: Token Listrik & Kipas Kamar)
  const initialTransactions = [
    {
      txDate: '2026-10-15',
      type: 'EXPENSE' as const,
      description: 'Sewa Penginapan Safir 5 Hari',
      category: 'Tempat Tinggal',
      quantity: 1,
      unit: 'Paket',
      unitPrice: 18500000,
      totalPrice: 18500000,
      creator: stafId,
      note: 'Kontrak sewa penginapan kontingen 5 kamar',
    },
    {
      txDate: '2026-10-16',
      type: 'EXPENSE' as const,
      description: 'ATK dan Kertas HVS Kantor',
      category: 'Kantor',
      quantity: 5,
      unit: 'Rim',
      unitPrice: 65000,
      totalPrice: 325000,
      creator: stafId,
      note: 'HVS PaperOne A4 80gr',
    },
    // DUPLICATE PAIR 1: Token Listrik
    {
      txDate: '2026-10-18',
      type: 'EXPENSE' as const,
      description: 'Token Listrik Mess Utama',
      category: 'Listrik',
      quantity: 1,
      unit: 'Unit',
      unitPrice: 500000,
      totalPrice: 500000,
      creator: stafId,
      note: 'Token PLN No. Meter 1425890012',
    },
    {
      txDate: '2026-10-18',
      type: 'EXPENSE' as const,
      description: 'Token Listrik Mess Utama',
      category: 'Listrik',
      quantity: 1,
      unit: 'Unit',
      unitPrice: 500000,
      totalPrice: 500000,
      creator: bendaharaId,
      note: 'Token PLN No. Meter 1425890012 (Baris duplikat terdeteksi otomatis)',
    },
    // DUPLICATE PAIR 2: Kipas Kamar
    {
      txDate: '2026-10-20',
      type: 'EXPENSE' as const,
      description: 'Kipas Kamar Stand Fan Miyako',
      category: 'Elektronik',
      quantity: 2,
      unit: 'Unit',
      unitPrice: 275000,
      totalPrice: 550000,
      creator: stafId,
      note: 'Kipas angin berdiri untuk ruang medis',
    },
    {
      txDate: '2026-10-20',
      type: 'EXPENSE' as const,
      description: 'Kipas Kamar Stand Fan Miyako',
      category: 'Elektronik',
      quantity: 2,
      unit: 'Unit',
      unitPrice: 275000,
      totalPrice: 550000,
      creator: stafId,
      note: 'Pembelian kedua untuk ruang istirahat',
    },
    {
      txDate: '2026-10-21',
      type: 'EXPENSE' as const,
      description: 'Konsumsi Snack Rapat Koordinasi',
      category: 'Snack',
      quantity: 45,
      unit: 'Kotak',
      unitPrice: 15000,
      totalPrice: 675000,
      creator: stafId,
      note: 'Kue basah + air mineral botol',
    },
    {
      txDate: '2026-10-22',
      type: 'EXPENSE' as const,
      description: 'Sewa Minibus Elf Antar Jemput',
      category: 'Transportasi',
      quantity: 3,
      unit: 'Hari',
      unitPrice: 1200000,
      totalPrice: 3600000,
      creator: stafId,
      note: 'Armada transportasi lokal supir + bbm',
    },
    {
      txDate: '2026-10-23',
      type: 'EXPENSE' as const,
      description: 'Coffee Break Peserta Evaluasi',
      category: 'Coffee Break',
      quantity: 50,
      unit: 'Paket',
      unitPrice: 25000,
      totalPrice: 1250000,
      creator: stafId,
      note: 'Kopi, teh, snack box sore',
    },
    {
      txDate: '2026-10-24',
      type: 'EXPENSE' as const,
      description: 'Tiket Kereta Eksekutif Tim Advance',
      category: 'Tiket',
      quantity: 4,
      unit: 'Tiket',
      unitPrice: 450000,
      totalPrice: 1800000,
      creator: stafId,
      note: 'KA Argo Parahyangan Jakarta-Bandung PP',
    },
    // Uncategorized row demonstration
    {
      txDate: '2026-10-25',
      type: 'EXPENSE' as const,
      description: 'Pengeluaran Darurat Medis & Obat Lapangan',
      category: null,
      quantity: 1,
      unit: 'Paket',
      unitPrice: 485000,
      totalPrice: 485000,
      creator: stafId,
      note: 'Belum dikategorikan oleh staf penginput',
    },
    // Income row
    {
      txDate: '2026-10-14',
      type: 'INCOME' as const,
      description: 'Penerimaan Alokasi Dana Termin I Safir',
      category: 'Lainnya',
      quantity: 1,
      unit: 'Paket',
      unitPrice: 75000000,
      totalPrice: 75000000,
      creator: bendaharaId,
      note: 'Transfer rekening kas operasional panitia',
    },
  ];

  for (const t of initialTransactions) {
    db.insert(transactions)
      .values({
        id: uuidv4(),
        groupId: safirGroupId,
        txDate: t.txDate,
        type: t.type,
        description: t.description,
        categoryId: t.category ? catMap.get(t.category) || null : null,
        quantity: t.quantity,
        unit: t.unit,
        unitPrice: t.unitPrice,
        totalPrice: t.totalPrice,
        dataStatus: 'OK',
        verificationNote: t.note,
        createdBy: t.creator,
        updatedBy: t.creator,
      })
      .run();
  }

  // Recalculate group anomalies
  recalculateGroupAnomalies(safirGroupId);

  // Initial audit log
  recordAuditLog({
    groupId: safirGroupId,
    actorId: superAdminId,
    action: 'SEED_INITIAL_DATA',
    entityType: 'GROUP',
    entityId: safirGroupId,
    newValues: { message: 'Inisialisasi grup BELANJA SAFIR dan transaksi awal' },
  });

  console.log('--- Seeding completed successfully! ---');
}

// Execute if run directly
if (process.argv[1]?.endsWith('seed.ts') || process.argv[1]?.endsWith('seed.js')) {
  runSeed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Seed error:', err);
      process.exit(1);
    });
}
