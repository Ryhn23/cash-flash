import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.js';
import { requireGroupAccess } from '../middleware/rbac.js';
import { verifyMagicBytes, saveUploadedReceipt } from '../services/upload.js';
import { scanInvoiceImage, parseInvoiceText } from '../services/smart-import.js';
import type { AppEnv } from '../types/env.js';

export const smartImportRouter = new Hono<AppEnv>();

smartImportRouter.use('*', authMiddleware);

// POST /api/groups/:groupId/smart-import/scan
smartImportRouter.post('/:groupId/smart-import/scan', requireGroupAccess('EDITOR'), async (c) => {
  const body = await c.req.parseBody();
  const file = body['file'];

  if (!file || !(file instanceof File)) {
    return c.json({ success: false, error: 'Berkas gambar faktur/nota wajib diunggah' }, 400);
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Validate Magic Bytes (Must be authentic PNG, JPG, or WEBP image)
  const { valid, ext } = verifyMagicBytes(buffer);
  if (!valid || (ext !== 'png' && ext !== 'jpg' && ext !== 'webp')) {
    return c.json(
      {
        success: false,
        error: 'Format berkas tidak didukung. Harap unggah foto/scan nota dalam format JPG, PNG, atau WEBP.',
      },
      400
    );
  }

  // 1. Save uploaded receipt image securely to storage
  const receiptPath = await saveUploadedReceipt(buffer);

  // 2. Perform OCR and deterministic heuristic parsing
  let detected;
  try {
    detected = await scanInvoiceImage(buffer);
  } catch {
    // Graceful fallback if OCR fails to process image
    detected = parseInvoiceText('');
  }

  return c.json({
    success: true,
    detected,
    receiptPath,
  });
});

