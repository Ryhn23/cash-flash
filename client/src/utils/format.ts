/**
 * Format number as Indonesian Rupiah (e.g. Rp 18.500.000)
 */
export function formatRupiah(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return 'Rp 0';
  }
  const formatted = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);

  return formatted;
}

/**
 * Format quantity with decimal support
 */
export function formatQuantity(qty: number | null | undefined): string {
  if (qty === null || qty === undefined || isNaN(qty)) return '0';
  return new Intl.NumberFormat('id-ID', {
    maximumFractionDigits: 2,
  }).format(qty);
}

/**
 * Format date to Indonesian human-readable format (e.g. 18 Okt 2026)
 */
export function formatDateIndo(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(d);
  } catch {
    return dateStr;
  }
}

/**
 * Parse raw string to positive integer Rupiah
 */
export function parseRupiahInput(value: string): number {
  const cleanStr = value.replace(/[^0-9]/g, '');
  return parseInt(cleanStr, 10) || 0;
}
