import crypto from 'node:crypto';
import { hash, verify } from '@node-rs/argon2';

/**
 * Hash password using Argon2id
 */
export async function hashPassword(password: string): Promise<string> {
  return await hash(password, {
    memoryCost: 19456,
    timeCost: 2,
    outputLen: 32,
    parallelism: 1,
  });
}

/**
 * Verify password against Argon2id hash
 */
export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch (err) {
    return false;
  }
}

/**
 * Generate cryptographically secure random session token
 */
export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Generate CSRF token
 */
export function generateCsrfToken(): string {
  return crypto.randomBytes(24).toString('hex');
}

/**
 * Hash session token with SHA-256 before storing in SQLite
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Strip HTML tags from strings to prevent stored XSS
 */
export function stripHtml(input: unknown): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(/<[^>]*>?/gm, '')
    .trim();
}

/**
 * Sanitize text against Spreadsheet Formula Injection (CSV / Excel Injection)
 * Prefixes with an apostrophe (') if string starts with =, +, -, @, \t, or \r
 */
export function sanitizeFormula(text: string | null | undefined): string {
  if (!text) return '';
  const dangerousChars = ['=', '+', '-', '@', '\t', '\r'];
  if (dangerousChars.some(char => text.startsWith(char))) {
    return `'${text.trim()}`;
  }
  const trimmed = text.trim();
  if (dangerousChars.some(char => trimmed.startsWith(char))) {
    return `'${trimmed}`;
  }
  return trimmed;
}

/**
 * Clean cell content on import by stripping leading apostrophe if it was escaped
 */
export function unescapeFormula(text: string | null | undefined): string {
  if (!text) return '';
  const trimmed = text.trim();
  if (trimmed.startsWith("'") && trimmed.length > 1) {
    const nextChar = trimmed.charAt(1);
    if (['=', '+', '-', '@'].includes(nextChar)) {
      return trimmed.slice(1);
    }
  }
  return trimmed;
}

/**
 * Normalize description string for duplicate detection
 * Collapses whitespace, removes extra punctuation, lowercases
 */
export function normalizeDescription(desc: string | null | undefined): string {
  if (!desc) return '';
  return desc
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ') // replace non-alphanumeric with space
    .replace(/\s+/g, ' ')      // collapse spaces
    .trim();
}
