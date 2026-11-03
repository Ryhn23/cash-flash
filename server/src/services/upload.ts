import fs from 'node:fs';
import path from 'node:path';
import { v4 as uuidv4 } from 'uuid';

const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

/**
 * Validate MIME magic bytes to ensure safe image/PDF upload
 */
export function verifyMagicBytes(buffer: Buffer): { valid: boolean; ext: string; mime: string } {
  if (buffer.length < 8) {
    return { valid: false, ext: '', mime: '' };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { valid: true, ext: 'png', mime: 'image/png' };
  }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { valid: true, ext: 'jpg', mime: 'image/jpeg' };
  }

  // PDF: %PDF- (25 50 44 46 2D)
  if (
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46 &&
    buffer[4] === 0x2d
  ) {
    return { valid: true, ext: 'pdf', mime: 'application/pdf' };
  }

  // WebP: RIFF....WEBP
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return { valid: true, ext: 'webp', mime: 'image/webp' };
  }

  return { valid: false, ext: '', mime: '' };
}

/**
 * Strips EXIF metadata (APP1 marker 0xFFE1) from JPEG files to protect user privacy (GPS coordinates, camera IDs).
 */
export function stripExifFromJpeg(buffer: Buffer): Buffer {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
    return buffer;
  }

  const chunks: Buffer[] = [buffer.subarray(0, 2)]; // Keep SOI (0xFFD8)
  let offset = 2;

  while (offset < buffer.length - 1) {
    if (buffer[offset] !== 0xff) {
      chunks.push(buffer.subarray(offset));
      break;
    }

    const marker = buffer[offset + 1];
    // Standalone markers: SOS (0xDA), EOI (0xD9)
    if (marker === 0xd9 || marker === 0xda) {
      chunks.push(buffer.subarray(offset));
      break;
    }

    if (offset + 4 > buffer.length) {
      chunks.push(buffer.subarray(offset));
      break;
    }

    const segmentLength = (buffer[offset + 2] << 8) | buffer[offset + 3];
    const segmentEnd = offset + 2 + segmentLength;

    if (segmentEnd > buffer.length) {
      chunks.push(buffer.subarray(offset));
      break;
    }

    // 0xE1 is APP1 (EXIF / GPS metadata)
    if (marker === 0xe1) {
      // Omit EXIF segment
      offset = segmentEnd;
    } else {
      chunks.push(buffer.subarray(offset, segmentEnd));
      offset = segmentEnd;
    }
  }

  return Buffer.concat(chunks);
}

/**
 * Save uploaded file with randomized UUID filename and sanitized metadata
 */
export async function saveUploadedReceipt(buffer: Buffer): Promise<string> {
  const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
  if (buffer.length > MAX_SIZE) {
    throw new Error('Ukuran berkas melebihi batas maksimum 5MB.');
  }

  const { valid, ext } = verifyMagicBytes(buffer);
  if (!valid) {
    throw new Error('Tipe berkas tidak didukung. Harap unggah berkas PDF, PNG, JPG, atau WEBP asli.');
  }

  // Strip EXIF / GPS metadata from JPEG photos
  let finalBuffer = buffer;
  if (ext === 'jpg') {
    finalBuffer = stripExifFromJpeg(buffer);
  }

  const filename = `${uuidv4()}.${ext}`;
  const filePath = path.join(UPLOAD_DIR, filename);

  fs.writeFileSync(filePath, finalBuffer);
  return filename;
}

/**
 * Get absolute path to receipt file safely
 */
export function getReceiptAbsolutePath(filename: string): string | null {
  // Prevent directory traversal attacks
  const safeFilename = path.basename(filename);
  const fullPath = path.join(UPLOAD_DIR, safeFilename);
  if (fs.existsSync(fullPath)) {
    return fullPath;
  }
  return null;
}
