import ExcelJS from 'exceljs';
import { sanitizeFormula, unescapeFormula, normalizeDescription } from '../utils/security.js';
import { db } from '../db/index.js';
import { transactions, groupCategories, users } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { recalculateGroupAnomalies } from './anomaly.js';
import { v4 as uuidv4 } from 'uuid';

export interface ExportTransactionData {
  id: string;
  txDate: string;
  type: string;
  description: string;
  categoryName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
  dataStatus: string;
  creatorName: string;
  verificationNote?: string | null;
}

/**
 * Generate multi-sheet .xlsx file identical in structure to BELANJA_SAFIR_diperbaiki.xlsx
 */
export async function generateSafirExcelWorkbook(
  groupName: string,
  txList: ExportTransactionData[],
  categoriesList: Array<{ name: string; budgetAllocation?: number }>
): Promise<ExcelJS.Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Next-Cash Financial System';
  workbook.lastModifiedBy = 'Next-Cash Financial System';
  workbook.created = new Date();
  workbook.modified = new Date();

  // ----------------------------------------------------
  // SHEET 1: Belanja
  // ----------------------------------------------------
  const belanjaSheet = workbook.addWorksheet('Belanja', {
    views: [{ state: 'frozen', ySplit: 4 }],
  });

  // Title block
  belanjaSheet.mergeCells('A1:J1');
  const titleCell = belanjaSheet.getCell('A1');
  titleCell.value = `BUKU KAS / LEDGER TRANSAKSI - ${groupName.toUpperCase()}`;
  titleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FF1E1B4B' } };
  titleCell.alignment = { horizontal: 'left', vertical: 'middle' };
  belanjaSheet.getRow(1).height = 28;

  belanjaSheet.mergeCells('A2:J2');
  const subtitleCell = belanjaSheet.getCell('A2');
  subtitleCell.value = `Digenerate otomatis pada: ${new Date().toLocaleString('id-ID')} | Status: Multi-Tenant Collaborative Ledger`;
  subtitleCell.font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF475569' } };
  belanjaSheet.getRow(2).height = 18;

  // Header row at row 4
  const headers = [
    'No',
    'Tanggal (YYYY-MM-DD)',
    'Uraian / Deskripsi',
    'Jumlah',
    'Satuan',
    'Harga Satuan (Rp)',
    'Total Harga (Rp)',
    'Kategori',
    'Tipe',
    'Status Cek Data',
    'Diinput Oleh',
    'Catatan / Verifikasi',
  ];

  const headerRow = belanjaSheet.getRow(4);
  headerRow.values = headers;
  headerRow.height = 26;
  headerRow.eachCell((cell) => {
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E1B4B' }, // Midnight Indigo 950
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    };
  });

  // Populate data rows
  txList.forEach((tx, idx) => {
    const rowNumber = idx + 5; // starting at row 5
    const row = belanjaSheet.getRow(rowNumber);

    // Live Excel formula for Total Harga: ROUND(D{row} * F{row}, 0)
    // Live Excel formula for duplicate check: COUNTIFS($B:$B, B{row}, $C:$C, C{row}, $G:$G, G{row}) > 1
    const totalFormula = `ROUND(D${rowNumber}*F${rowNumber},0)`;

    row.values = [
      idx + 1,
      tx.txDate,
      sanitizeFormula(tx.description),
      tx.quantity,
      sanitizeFormula(tx.unit),
      tx.unitPrice,
      { formula: totalFormula, result: tx.totalPrice },
      sanitizeFormula(tx.categoryName || 'Belum dikategorikan'),
      tx.type === 'INCOME' ? 'Pemasukan' : 'Pengeluaran',
      tx.dataStatus === 'VERIFIED_DUPLICATE_OK'
        ? 'VERIFIED_OK'
        : tx.dataStatus === 'POTENTIAL_DUPLICATE'
        ? 'MUNGKIN_DOBEL'
        : tx.dataStatus === 'INCOMPLETE'
        ? 'DATA_BELUM_LENGKAP'
        : 'OK',
      sanitizeFormula(tx.creatorName),
      sanitizeFormula(tx.verificationNote || ''),
    ];

    row.height = 22;
    row.eachCell((cell, colNumber) => {
      cell.font = { name: 'Arial', size: 9 };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };

      // Number formatting
      if (colNumber === 1) cell.alignment = { horizontal: 'center' };
      if (colNumber === 2) cell.alignment = { horizontal: 'center' };
      if (colNumber === 4) {
        cell.numFmt = '#,##0.##';
        cell.alignment = { horizontal: 'right' };
      }
      if (colNumber === 5) cell.alignment = { horizontal: 'center' };
      if (colNumber === 6 || colNumber === 7) {
        cell.numFmt = '#,##0';
        cell.alignment = { horizontal: 'right' };
      }
      if (colNumber === 9) cell.alignment = { horizontal: 'center' };
      if (colNumber === 10) {
        cell.alignment = { horizontal: 'center' };
        if (tx.dataStatus === 'POTENTIAL_DUPLICATE') {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFBEB' } };
          cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF92400E' } };
        } else if (tx.dataStatus === 'INCOMPLETE') {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF1F2' } };
          cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF9F1239' } };
        } else if (tx.dataStatus === 'VERIFIED_DUPLICATE_OK' || tx.dataStatus === 'OK') {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFECFDF5' } };
          cell.font = { name: 'Arial', size: 9, color: { argb: 'FF065F46' } };
        }
      }
    });
  });

  // Total summary row at bottom of Belanja
  const lastDataRow = Math.max(txList.length + 4, 5);
  const sumRowNumber = lastDataRow + 1;
  const sumRow = belanjaSheet.getRow(sumRowNumber);
  sumRow.getCell(3).value = 'TOTAL KESELURUHAN';
  sumRow.getCell(3).font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF0F172A' } };
  sumRow.getCell(7).value = { formula: `SUM(G5:G${lastDataRow})` };
  sumRow.getCell(7).font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF1E1B4B' } };
  sumRow.getCell(7).numFmt = '#,##0';
  sumRow.height = 24;

  belanjaSheet.columns = [
    { width: 6 },  // No
    { width: 14 }, // Tanggal
    { width: 34 }, // Uraian
    { width: 10 }, // Qty
    { width: 10 }, // Satuan
    { width: 16 }, // Harga Satuan
    { width: 18 }, // Total Harga
    { width: 20 }, // Kategori
    { width: 14 }, // Tipe
    { width: 22 }, // Status Cek Data
    { width: 18 }, // Diinput Oleh
    { width: 28 }, // Catatan
  ];

  // ----------------------------------------------------
  // SHEET 2: Ringkasan (Executive Summary with SUMIFS / COUNTIFS)
  // ----------------------------------------------------
  const ringkasanSheet = workbook.addWorksheet('Ringkasan');

  ringkasanSheet.mergeCells('A1:F1');
  const rTitleCell = ringkasanSheet.getCell('A1');
  rTitleCell.value = `RINGKASAN EKSEKUTIF BELANJA - ${groupName.toUpperCase()}`;
  rTitleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FF1E1B4B' } };
  ringkasanSheet.getRow(1).height = 28;

  const rHeaders = ['No', 'Kategori Pengeluaran', 'Jumlah Transaksi', 'Total Belanja (Rp)', '% dari Total', 'Alokasi Pagu (Rp)'];
  const rHeaderRow = ringkasanSheet.getRow(3);
  rHeaderRow.values = rHeaders;
  rHeaderRow.height = 24;
  rHeaderRow.eachCell((cell) => {
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E1B4B' },
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  // Categories + "Belum dikategorikan"
  const catNames = [...categoriesList.map((c) => c.name), 'Belum dikategorikan'];
  catNames.forEach((catName, idx) => {
    const rowNum = idx + 4;
    const row = ringkasanSheet.getRow(rowNum);

    // Live Excel SUMIFS and COUNTIFS linked directly to Belanja sheet
    // Belanja!$H$5:$H${lastDataRow} has Category
    // Belanja!$G$5:$G${lastDataRow} has Total Price
    const countFormula = `COUNTIFS(Belanja!$H$5:$H$${lastDataRow}, B${rowNum})`;
    const sumFormula = `SUMIFS(Belanja!$G$5:$G$${lastDataRow}, Belanja!$H$5:$H$${lastDataRow}, B${rowNum})`;
    const percentFormula = `IF(D$${catNames.length + 4}>0, D${rowNum}/D$${catNames.length + 4}, 0)`;

    const allocation = categoriesList.find((c) => c.name === catName)?.budgetAllocation || 0;

    row.values = [
      idx + 1,
      catName,
      { formula: countFormula },
      { formula: sumFormula },
      { formula: percentFormula },
      allocation,
    ];

    row.height = 20;
    row.eachCell((cell, colNumber) => {
      cell.font = { name: 'Arial', size: 9 };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };
      if (colNumber === 1) cell.alignment = { horizontal: 'center' };
      if (colNumber === 3) {
        cell.alignment = { horizontal: 'right' };
        cell.numFmt = '#,##0';
      }
      if (colNumber === 4 || colNumber === 6) {
        cell.alignment = { horizontal: 'right' };
        cell.numFmt = '#,##0';
      }
      if (colNumber === 5) {
        cell.alignment = { horizontal: 'right' };
        cell.numFmt = '0.0%';
      }
    });
  });

  // Summary Row on Ringkasan
  const summaryRowIndex = catNames.length + 4;
  const totalSummaryRow = ringkasanSheet.getRow(summaryRowIndex);
  totalSummaryRow.values = [
    '',
    'TOTAL KESELURUHAN PENGELUARAN',
    { formula: `SUM(C4:C${summaryRowIndex - 1})` },
    { formula: `SUM(D4:D${summaryRowIndex - 1})` },
    { formula: `SUM(E4:E${summaryRowIndex - 1})` },
    { formula: `SUM(F4:F${summaryRowIndex - 1})` },
  ];
  totalSummaryRow.height = 24;
  totalSummaryRow.eachCell((cell, colNumber) => {
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF1E1B4B' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
    if (colNumber === 3 || colNumber === 4 || colNumber === 6) cell.numFmt = '#,##0';
    if (colNumber === 5) cell.numFmt = '0.0%';
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF1E1B4B' } },
      bottom: { style: 'medium', color: { argb: 'FF1E1B4B' } },
    };
  });

  // Reconciliation Check Card
  const reconRowIndex = summaryRowIndex + 3;
  ringkasanSheet.mergeCells(`A${reconRowIndex}:D${reconRowIndex}`);
  const reconHeader = ringkasanSheet.getCell(`A${reconRowIndex}`);
  reconHeader.value = 'STATUS REKONSILIASI AKUNTANSI';
  reconHeader.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
  reconHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E1B4B' } };

  const reconCheckRow = ringkasanSheet.getRow(reconRowIndex + 1);
  reconCheckRow.getCell(1).value = 'Selisih (Ledger Belanja vs Tabel Ringkasan):';
  reconCheckRow.getCell(3).value = {
    formula: `Belanja!G${sumRowNumber} - D${summaryRowIndex}`,
  };
  reconCheckRow.getCell(3).numFmt = '#,##0';
  reconCheckRow.getCell(3).font = { name: 'Arial', size: 10, bold: true };

  reconCheckRow.getCell(4).value = {
    formula: `IF(Belanja!G${sumRowNumber}=D${summaryRowIndex}, "OK - Sama (Rekonsiliasi Sempurna)", "PERINGATAN: Terjadi Selisih!")`,
  };
  reconCheckRow.getCell(4).font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF065F46' } };

  ringkasanSheet.columns = [
    { width: 6 },  // No
    { width: 28 }, // Kategori
    { width: 18 }, // Jumlah Transaksi
    { width: 22 }, // Total Belanja
    { width: 16 }, // % dari Total
    { width: 22 }, // Alokasi Pagu
  ];

  return await workbook.xlsx.writeBuffer();
}

/**
 * Dry-run parse and validate uploaded Excel file
 */
export async function parseAndValidateExcel(
  buffer: Buffer,
  groupId: string,
  categories: Array<{ id: string; name: string }>
) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as any);

  const worksheet = workbook.getWorksheet('Belanja') || workbook.worksheets[0];
  if (!worksheet) {
    throw new Error('Format file tidak valid: Lembar kerja tidak ditemukan');
  }

  // Find header row (search first 10 rows for "Tanggal" or "Uraian")
  let headerRowIndex = -1;
  const colMap: Record<string, number> = {};

  for (let r = 1; r <= 10; r++) {
    const row = worksheet.getRow(r);
    const rowValues = row.values as Array<unknown>;
    if (Array.isArray(rowValues)) {
      rowValues.forEach((val, colIdx) => {
        if (typeof val === 'string') {
          const str = val.trim().toLowerCase();
          if (str.includes('tanggal')) colMap.date = colIdx;
          if (str.includes('uraian') || str.includes('deskripsi')) colMap.description = colIdx;
          if (str.includes('jumlah') || str.includes('qty')) colMap.quantity = colIdx;
          if (str.includes('satuan')) colMap.unit = colIdx;
          if (str.includes('harga satuan') || str.includes('unit price')) colMap.unitPrice = colIdx;
          if (str.includes('total')) colMap.totalPrice = colIdx;
          if (str.includes('kategori')) colMap.category = colIdx;
          if (str.includes('tipe')) colMap.type = colIdx;
          if (str.includes('catatan') || str.includes('keterangan')) colMap.note = colIdx;
        }
      });
      if (colMap.description !== undefined && (colMap.date !== undefined || colMap.totalPrice !== undefined)) {
        headerRowIndex = r;
        break;
      }
    }
  }

  if (headerRowIndex === -1) {
    throw new Error('Kolom tidak terdeteksi. Pastikan file memiliki baris judul dengan "Tanggal", "Uraian", "Jumlah", dsb.');
  }

  const categoryByName = new Map(categories.map((c) => [c.name.toLowerCase().trim(), c.id]));

  const parsedRows: Array<{
    rowNum: number;
    txDate: string;
    description: string;
    categoryId: string | null;
    categoryName: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    totalPrice: number;
    type: 'EXPENSE' | 'INCOME';
    note: string;
    status: 'OK' | 'INCOMPLETE' | 'POTENTIAL_DUPLICATE';
    errors: string[];
  }> = [];

  const existingTxs = db
    .select({
      id: transactions.id,
      txDate: transactions.txDate,
      description: transactions.description,
      totalPrice: transactions.totalPrice,
    })
    .from(transactions)
    .where(eq(transactions.groupId, groupId))
    .all();

  const internalSeen = new Map<string, number>();

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber <= headerRowIndex) return;

    const getVal = (col?: number) => {
      if (!col) return '';
      const cell = row.getCell(col);
      if (cell.value && typeof cell.value === 'object' && 'result' in cell.value) {
        return (cell.value as any).result;
      }
      return cell.value;
    };

    const rawDate = getVal(colMap.date);
    const rawDesc = getVal(colMap.description);
    const rawQty = getVal(colMap.quantity);
    const rawUnit = getVal(colMap.unit);
    const rawPrice = getVal(colMap.unitPrice);
    const rawTotal = getVal(colMap.totalPrice);
    const rawCat = getVal(colMap.category);
    const rawType = getVal(colMap.type);
    const rawNote = getVal(colMap.note);

    // Skip empty rows
    if (!rawDesc && !rawTotal && !rawDate) return;

    // Date parsing
    let txDate = '';
    if (rawDate instanceof Date) {
      txDate = rawDate.toISOString().split('T')[0];
    } else if (typeof rawDate === 'string') {
      const match = rawDate.trim().match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
      if (match) {
        txDate = `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
      } else {
        txDate = rawDate.trim();
      }
    } else if (typeof rawDate === 'number') {
      // Excel serial date conversion
      const date = new Date(Math.round((rawDate - 25569) * 86400 * 1000));
      txDate = date.toISOString().split('T')[0];
    }

    const description = unescapeFormula(String(rawDesc || '').trim());
    const quantity = Math.max(0, Number(rawQty) || 1);
    const unit = String(rawUnit || 'Unit').trim();
    let unitPrice = Math.max(0, Number(rawPrice) || 0);
    let totalPrice = Math.round(Number(rawTotal) || 0);

    // Auto-calculate if one is missing
    if (totalPrice === 0 && unitPrice > 0) {
      totalPrice = Math.round(quantity * unitPrice);
    } else if (unitPrice === 0 && totalPrice > 0 && quantity > 0) {
      unitPrice = totalPrice / quantity;
    }

    const categoryName = String(rawCat || '').trim();
    const categoryId = categoryByName.get(categoryName.toLowerCase()) || null;

    const typeStr = String(rawType || '').toLowerCase();
    const type: 'EXPENSE' | 'INCOME' = typeStr.includes('pemasukan') || typeStr.includes('income') ? 'INCOME' : 'EXPENSE';
    const note = unescapeFormula(String(rawNote || '').trim());

    const errors: string[] = [];
    if (!txDate) errors.push('Tanggal tidak valid');
    if (!description) errors.push('Uraian tidak boleh kosong');
    if (quantity <= 0) errors.push('Jumlah harus lebih dari 0');
    if (totalPrice <= 0) errors.push('Total harga harus lebih dari 0');

    let status: 'OK' | 'INCOMPLETE' | 'POTENTIAL_DUPLICATE' = errors.length > 0 ? 'INCOMPLETE' : 'OK';

    // Duplicate check
    const normDesc = normalizeDescription(description);
    const dupKey = `${txDate}|${normDesc}|${totalPrice}`;

    const alreadyInDb = existingTxs.some(
      (et) => et.txDate === txDate && et.totalPrice === totalPrice && normalizeDescription(et.description) === normDesc
    );
    const alreadyInBatch = (internalSeen.get(dupKey) || 0) > 0;
    internalSeen.set(dupKey, (internalSeen.get(dupKey) || 0) + 1);

    if (status === 'OK' && (alreadyInDb || alreadyInBatch)) {
      status = 'POTENTIAL_DUPLICATE';
    }

    parsedRows.push({
      rowNum: rowNumber,
      txDate,
      description,
      categoryId,
      categoryName,
      quantity,
      unit,
      unitPrice,
      totalPrice,
      type,
      note,
      status,
      errors,
    });
  });

  const validCount = parsedRows.filter((r) => r.status === 'OK').length;
  const duplicateCount = parsedRows.filter((r) => r.status === 'POTENTIAL_DUPLICATE').length;
  const incompleteCount = parsedRows.filter((r) => r.status === 'INCOMPLETE').length;

  return {
    totalRows: parsedRows.length,
    validCount,
    duplicateCount,
    incompleteCount,
    rows: parsedRows,
  };
}

/**
 * Commit parsed rows to SQLite inside a single transaction
 */
export async function commitImportedRows(
  groupId: string,
  userId: string,
  rows: Array<{
    txDate: string;
    description: string;
    categoryId: string | null;
    quantity: number;
    unit: string;
    unitPrice: number;
    totalPrice: number;
    type: 'EXPENSE' | 'INCOME';
    note?: string;
  }>
) {
  const insertedIds: string[] = [];

  db.transaction((tx) => {
    for (const r of rows) {
      const id = uuidv4();
      insertedIds.push(id);
      tx.insert(transactions)
        .values({
          id,
          groupId,
          txDate: r.txDate,
          type: r.type,
          description: r.description,
          categoryId: r.categoryId,
          quantity: r.quantity,
          unit: r.unit || 'Unit',
          unitPrice: r.unitPrice,
          totalPrice: r.totalPrice,
          dataStatus: 'OK', // will be evaluated by recalculateGroupAnomalies
          verificationNote: r.note || null,
          createdBy: userId,
          updatedBy: userId,
        })
        .run();
    }
  });

  // Re-run anomaly checks
  recalculateGroupAnomalies(groupId);

  return insertedIds.length;
}
