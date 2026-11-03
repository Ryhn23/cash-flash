import { eq, and, inArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import { transactions, type Transaction } from '../db/schema.js';
import { normalizeDescription } from '../utils/security.js';

export interface AnomalyCheckResult {
  status: 'OK' | 'INCOMPLETE' | 'POTENTIAL_DUPLICATE' | 'VERIFIED_DUPLICATE_OK';
  duplicateCount: number;
}

/**
 * Check a transaction's completeness and duplicate status against other rows in the same group.
 */
export function evaluateTransactionDataStatus(
  tx: {
    id?: string;
    txDate: string;
    description: string;
    categoryId?: string | null;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    dataStatus?: string;
    verificationNote?: string | null;
  },
  existingGroupTransactions: Array<Pick<Transaction, 'id' | 'txDate' | 'description' | 'totalPrice' | 'dataStatus'>>
): AnomalyCheckResult {
  // 1. Check completeness (DATA_BELUM_LENGKAP)
  if (
    !tx.txDate ||
    !tx.description ||
    tx.description.trim() === '' ||
    !tx.categoryId ||
    tx.quantity === undefined ||
    tx.quantity === null ||
    tx.quantity <= 0 ||
    tx.unitPrice === undefined ||
    tx.unitPrice === null ||
    tx.unitPrice <= 0
  ) {
    return { status: 'INCOMPLETE', duplicateCount: 0 };
  }

  // If user previously confirmed verified duplicate and didn't clear it
  if (tx.dataStatus === 'VERIFIED_DUPLICATE_OK' && tx.verificationNote) {
    return { status: 'VERIFIED_DUPLICATE_OK', duplicateCount: 0 };
  }

  // 2. Check for duplicate (MUNGKIN_DOBEL):
  // Mirrors Excel COUNTIFS(Tanggal, A5, Normalized Uraian, B5, Total Harga, G5) > 1
  const normDesc = normalizeDescription(tx.description);
  const duplicates = existingGroupTransactions.filter((other) => {
    if (tx.id && other.id === tx.id) return false;
    return (
      other.txDate === tx.txDate &&
      other.totalPrice === tx.totalPrice &&
      normalizeDescription(other.description) === normDesc
    );
  });

  if (duplicates.length > 0) {
    return {
      status: 'POTENTIAL_DUPLICATE',
      duplicateCount: duplicates.length + 1,
    };
  }

  return { status: 'OK', duplicateCount: 0 };
}

/**
 * Re-evaluate and sync transaction statuses for a group in SQLite.
 * Supports targeted delta calculation if targetDates is provided (drastically reducing DB row scans).
 * If targetDates is omitted, re-evaluates all transactions in the group (used for bulk imports).
 */
export function recalculateGroupAnomalies(groupId: string, targetDates?: string[]): void {
  const conditions = [eq(transactions.groupId, groupId)];

  if (targetDates && targetDates.length > 0) {
    const uniqueDates = Array.from(new Set(targetDates.filter(Boolean)));
    if (uniqueDates.length > 0) {
      conditions.push(inArray(transactions.txDate, uniqueDates));
    }
  }

  const allTxs = db
    .select({
      id: transactions.id,
      txDate: transactions.txDate,
      description: transactions.description,
      categoryId: transactions.categoryId,
      quantity: transactions.quantity,
      unitPrice: transactions.unitPrice,
      totalPrice: transactions.totalPrice,
      dataStatus: transactions.dataStatus,
      verificationNote: transactions.verificationNote,
    })
    .from(transactions)
    .where(and(...conditions))
    .all();

  // Map to count occurrences of [txDate, normalizedDesc, totalPrice]
  const counts = new Map<string, number>();

  for (const t of allTxs) {
    const key = `${t.txDate}|${normalizeDescription(t.description)}|${t.totalPrice}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  // Update in a transaction
  db.transaction((tx) => {
    for (const t of allTxs) {
      // 1. Check incomplete
      if (
        !t.txDate ||
        !t.description ||
        t.description.trim() === '' ||
        !t.categoryId ||
        t.quantity <= 0 ||
        t.unitPrice <= 0
      ) {
        if (t.dataStatus !== 'INCOMPLETE') {
          tx.update(transactions)
            .set({ dataStatus: 'INCOMPLETE' })
            .where(and(eq(transactions.id, t.id), eq(transactions.groupId, groupId)))
            .run();
        }
        continue;
      }

      // 2. Check if verified duplicate
      if (t.dataStatus === 'VERIFIED_DUPLICATE_OK' && t.verificationNote) {
        continue;
      }

      // 3. Duplicate check
      const key = `${t.txDate}|${normalizeDescription(t.description)}|${t.totalPrice}`;
      const totalSame = counts.get(key) || 0;

      if (totalSame > 1) {
        if (t.dataStatus !== 'POTENTIAL_DUPLICATE') {
          tx.update(transactions)
            .set({ dataStatus: 'POTENTIAL_DUPLICATE' })
            .where(and(eq(transactions.id, t.id), eq(transactions.groupId, groupId)))
            .run();
        }
      } else {
        if (t.dataStatus !== 'OK') {
          tx.update(transactions)
            .set({ dataStatus: 'OK' })
            .where(and(eq(transactions.id, t.id), eq(transactions.groupId, groupId)))
            .run();
        }
      }
    }
  });
}
