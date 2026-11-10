import Tesseract from 'tesseract.js';
import { stripHtml } from '../utils/security.js';

export interface DetectedInvoiceData {
  txDate: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
  calcMode: 'FORWARD' | 'REVERSE';
  verificationNote?: string;
  confidence: number;
  rawText: string;
}

/**
 * Normalizes Indonesian currency string (e.g. "Rp 275.000,00" or "275.000" or "275,000") to integer
 */
export function parseNominal(str: string): number {
  if (!str) return 0;
  // Remove currency prefix and non-digits
  const cleaned = str
    .replace(/(?:[rR][pP]\.?|[iI][dD][rR]|\$)\s*/g, '')
    .trim();

  // If format is 275.000,00 (Indonesian with cents)
  if (/\.\d{3},\d{2}$/.test(cleaned)) {
    const withoutCents = cleaned.replace(/,\d{2}$/, '');
    const num = parseInt(withoutCents.replace(/\./g, ''), 10);
    return isNaN(num) ? 0 : num;
  }

  // If format is 275.000 (Indonesian thousands)
  if (/^\d{1,3}(?:\.\d{3})+$/.test(cleaned)) {
    const num = parseInt(cleaned.replace(/\./g, ''), 10);
    return isNaN(num) ? 0 : num;
  }

  // If format is 12,500.00 (US with cents)
  if (/,\d{3}\.\d{2}$/.test(cleaned)) {
    const withoutCents = cleaned.replace(/\.\d{2}$/, '');
    const num = parseInt(withoutCents.replace(/,/g, ''), 10);
    return isNaN(num) ? 0 : num;
  }

  // If format is 12,500 (US thousands)
  if (/^\d{1,3}(?:,\d{3})+$/.test(cleaned)) {
    const num = parseInt(cleaned.replace(/,/g, ''), 10);
    return isNaN(num) ? 0 : num;
  }

  // Standard plain integer
  if (/^\d+$/.test(cleaned)) {
    const num = parseInt(cleaned, 10);
    return isNaN(num) ? 0 : num;
  }

  // Fallback: strip any remaining non-digit characters
  const digitsOnly = cleaned.replace(/\D/g, '');
  const parsed = parseInt(digitsOnly, 10);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Deterministic Regex & Rule-Based Extractor for Standard Invoices / Receipts
 */
export function parseInvoiceText(rawText: string): DetectedInvoiceData {
  const text = rawText || '';
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  let detectedDate = '';
  let detectedTotal = 0;
  let detectedQty = 1;
  let detectedUnit = 'Unit';
  let detectedDesc = '';
  let invoiceNumber = '';
  let detectedFieldsCount = 0;

  // 1. EXTRACT TRANSACTION DATE
  // Case A: ISO YYYY-MM-DD
  const isoMatch = text.match(/\b(20\d{2})[-/.](0[1-9]|1[0-2])[-/.](0[1-9]|[12]\d|3[01])\b/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    detectedDate = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    detectedFieldsCount++;
  } else {
    // Case B: DD-MM-YYYY or DD/MM/YYYY
    const ddmmyyyyMatch = text.match(/\b(0[1-9]|[12]\d|3[01])[-/.](0[1-9]|1[0-2])[-/.](20\d{2})\b/);
    if (ddmmyyyyMatch) {
      const [, d, m, y] = ddmmyyyyMatch;
      detectedDate = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      detectedFieldsCount++;
    } else {
      // Case C: Indonesian named months (e.g. 10 November 2026 or 10 Nov 2026)
      const indoMonthMatch = text.match(
        /\b(0?[1-9]|[12]\d|3[01])\s+(Jan(?:uari)?|Feb(?:ruari)?|Mar(?:et)?|Apr(?:il)?|Mei|Jun(?:i)?|Jul(?:i)?|Agu(?:stus)?|Sep(?:tember)?|Okt(?:ober)?|Nov(?:ember)?|Des(?:ember)?)\s+(20\d{2})\b/i
      );
      if (indoMonthMatch) {
        const d = indoMonthMatch[1].padStart(2, '0');
        const monthName = indoMonthMatch[2].toLowerCase();
        const y = indoMonthMatch[3];
        const monthMap: Record<string, string> = {
          jan: '01',
          feb: '02',
          mar: '03',
          apr: '04',
          mei: '05',
          jun: '06',
          jul: '07',
          agu: '08',
          sep: '09',
          okt: '10',
          nov: '11',
          des: '12',
        };
        const mKey = monthName.slice(0, 3);
        const m = monthMap[mKey] || '01';
        detectedDate = `${y}-${m}-${d}`;
        detectedFieldsCount++;
      } else {
        // Fallback: Current Date
        detectedDate = new Date().toISOString().split('T')[0];
      }
    }
  }

  // 2. EXTRACT INVOICE NUMBER
  const invMatch = text.match(
    /(?:(?:^|[\r\n\s])(?:no(?:\.|mor)?\s*(?:faktur|nota|invoice)?|inv(?:oice)?|faktur)\s*[:#.]\s*)([A-Za-z0-9\-_/]{3,30})/i
  );
  if (invMatch) {
    invoiceNumber = invMatch[1].trim();
    detectedFieldsCount++;
  }

  // 3. EXTRACT TOTAL PRICE (Nominal Akhir)
  // Look for lines containing total keywords
  for (const line of lines) {
    if (/(?:total|total\s+bayar|grand\s+total|jumlah\s+total|tagihan|netto|subtotal)/i.test(line)) {
      const match = line.match(/(?:total|bayar|tagihan|jumlah|netto|subtotal)[^\d]*((?:[rR][pP]\.?|[iI][dD][rR]|\$)?\s*[\d.,]+)/i);
      if (match) {
        const parsed = parseNominal(match[1]);
        if (parsed > 0 && parsed > detectedTotal) {
          detectedTotal = parsed;
        }
      }
    }
  }

  // Fallback for total: scan for highest monetary number in the text
  if (detectedTotal === 0) {
    const allNumbers = text.match(/(?:Rp\.?|IDR)?\s*(\d{1,3}(?:[.,]\d{3})+)/gi) || [];
    for (const numStr of allNumbers) {
      const val = parseNominal(numStr);
      if (val > detectedTotal && val < 100_000_000_000_000) {
        detectedTotal = val;
      }
    }
  }
  if (detectedTotal > 0) detectedFieldsCount++;

  // 4. EXTRACT QUANTITY & UNIT
  // Look for pattern like "5 Rim", "10 Pcs", "2 Dus", "1.5 Kg"
  const qtyUnitMatch = text.match(
    /\b(\d+(?:[.,]\d+)?)\s*(rim|pcs|unit|paket|dus|box|kg|liter|lusin|lembar|meter|pack|buah|btl|botol|roll)\b/i
  );
  if (qtyUnitMatch) {
    const q = parseFloat(qtyUnitMatch[1].replace(',', '.'));
    if (!isNaN(q) && q > 0) {
      detectedQty = q;
    }
    const rawUnit = qtyUnitMatch[2].toLowerCase();
    const unitMap: Record<string, string> = {
      rim: 'Rim',
      pcs: 'Pcs',
      unit: 'Unit',
      paket: 'Paket',
      dus: 'Dus',
      box: 'Box',
      kg: 'Kg',
      liter: 'Liter',
      lusin: 'Lusin',
      lembar: 'Lembar',
      meter: 'Meter',
      pack: 'Pack',
      buah: 'Pcs',
      btl: 'Botol',
      botol: 'Botol',
      roll: 'Roll',
    };
    detectedUnit = unitMap[rawUnit] || 'Unit';
    detectedFieldsCount++;
  }

  // 5. EXTRACT DESCRIPTION (Uraian Belanja)
  // Look for label "Uraian: ...", "Nama Barang: ...", "Deskripsi: ..."
  const descLabelMatch = text.match(/(?:uraian|nama\s+barang|deskripsi|item|keterangan)\s*[:.]\s*([^\n\r]{3,80})/i);
  if (descLabelMatch) {
    detectedDesc = descLabelMatch[1].trim();
    detectedFieldsCount++;
  } else {
    // Look for lines that look like a product name (avoid headers and total lines)
    for (const line of lines) {
      if (
        !/(?:faktur|invoice|nota|kwitansi|receipt|tanggal|tgl|total|bayar|jumlah|subtotal|penerima|hormat|kembali|cash|tunai|admin|telp)/i.test(
          line
        ) &&
        line.length >= 4 &&
        line.length <= 80 &&
        !/^\d+$/.test(line) &&
        !/^[\d.,\s]+$/.test(line)
      ) {
        detectedDesc = line;
        detectedFieldsCount++;
        break;
      }
    }
  }

  if (!detectedDesc) {
    detectedDesc = 'Belanja Pembelian / Faktur';
  }

  // 6. CALCULATE UNIT PRICE
  const unitPrice = detectedQty > 0 && detectedTotal > 0 ? Math.round(detectedTotal / detectedQty) : 0;

  // 7. ASSEMBLE VERIFICATION NOTE
  const notes: string[] = [];
  if (invoiceNumber) {
    notes.push(`No Faktur: ${invoiceNumber}`);
  }

  // Calculate confidence percentage (out of 5 main targets)
  const confidence = Math.min(100, Math.round((detectedFieldsCount / 5) * 100));

  return {
    txDate: detectedDate,
    description: stripHtml(detectedDesc).slice(0, 200),
    quantity: detectedQty,
    unit: detectedUnit,
    unitPrice,
    totalPrice: detectedTotal,
    calcMode: 'FORWARD',
    verificationNote: notes.length > 0 ? notes.join(' • ') : undefined,
    confidence,
    rawText: text.trim(),
  };
}

/**
 * Scan invoice image buffer using local Tesseract OCR engine (No LLM required)
 */
export async function scanInvoiceImage(imageBuffer: Buffer): Promise<DetectedInvoiceData> {
  const worker = await Tesseract.createWorker('eng', undefined, {
    errorHandler: () => {},
  });
  try {
    const {
      data: { text },
    } = await worker.recognize(imageBuffer);
    return parseInvoiceText(text);
  } finally {
    await worker.terminate();
  }
}
