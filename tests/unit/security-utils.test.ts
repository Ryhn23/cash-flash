import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hashPassword,
  verifyPassword,
  generateSessionToken,
  generateCsrfToken,
  hashToken,
  stripHtml,
  sanitizeFormula,
  unescapeFormula,
  normalizeDescription,
} from '../../server/src/utils/security.js';
import { verifyMagicBytes } from '../../server/src/services/upload.js';

test('Tahap 1: Security Utilities & Data Sanitization', async (t) => {
  await t.test('Password Hashing & Verification with Argon2id', async () => {
    const rawPassword = 'SecurePassword123!@#';
    const passwordHash = await hashPassword(rawPassword);

    assert.ok(passwordHash.startsWith('$argon2id$'), 'Hash must be generated with argon2id');
    const isValid = await verifyPassword(rawPassword, passwordHash);
    assert.strictEqual(isValid, true, 'Correct password must verify to true');

    const isInvalid = await verifyPassword('WrongPassword', passwordHash);
    assert.strictEqual(isInvalid, false, 'Wrong password must verify to false');
  });

  await t.test('Session and CSRF Token Generation and Hashing', () => {
    const sessionToken1 = generateSessionToken();
    const sessionToken2 = generateSessionToken();
    assert.strictEqual(sessionToken1.length, 64, '32 bytes hex session token should have 64 chars');
    assert.notStrictEqual(sessionToken1, sessionToken2, 'Session tokens must be distinct and random');

    const csrfToken = generateCsrfToken();
    assert.strictEqual(csrfToken.length, 48, '24 bytes hex CSRF token should have 48 chars');

    const hashedToken = hashToken(sessionToken1);
    assert.strictEqual(hashedToken.length, 64, 'SHA-256 hash output should be 64 chars hex');
    assert.strictEqual(hashToken(sessionToken1), hashedToken, 'Hash must be deterministic');
  });

  await t.test('XSS Sanitization: stripHtml', () => {
    const maliciousInput = '<script>alert("pwned")</script><b>Beli Kertas A4</b>';
    const cleaned = stripHtml(maliciousInput);
    assert.strictEqual(cleaned, 'alert("pwned")Beli Kertas A4', 'HTML tags must be stripped');

    assert.strictEqual(stripHtml(null), '');
    assert.strictEqual(stripHtml(undefined), '');
    assert.strictEqual(stripHtml('   Text Biasa   '), 'Text Biasa');
  });

  await t.test('Excel Formula Injection Defense: sanitizeFormula & unescapeFormula', () => {
    // Dangerous formula prefixes: =, +, -, @, \t, \r
    const dangerousFormulas = [
      '=SUM(A1:A10)',
      '+1+2',
      '-5*10',
      '@SUM(B1)',
      '\tcmd.exe',
      '\rcalc.exe',
    ];

    for (const formula of dangerousFormulas) {
      const sanitized = sanitizeFormula(formula);
      assert.ok(sanitized.startsWith("'"), `Formula ${formula} must be prefixed with an apostrophe`);
    }

    // Normal safe strings should remain untouched
    assert.strictEqual(sanitizeFormula('Beli Meja Rapat'), 'Beli Meja Rapat');
    assert.strictEqual(sanitizeFormula(''), '');
    assert.strictEqual(sanitizeFormula(null), '');

    // Unescaping on import
    assert.strictEqual(unescapeFormula("'=SUM(A1:A10)"), '=SUM(A1:A10)');
    assert.strictEqual(unescapeFormula("'+1+2"), '+1+2');
    assert.strictEqual(unescapeFormula("'-5*10"), '-5*10');
    assert.strictEqual(unescapeFormula("'@SUM"), '@SUM');
    assert.strictEqual(unescapeFormula("Normal Text"), 'Normal Text');
    assert.strictEqual(unescapeFormula("'O'Reilly"), "'O'Reilly", 'Do not strip apostrophe if next char is not a formula symbol');
  });

  await t.test('Description Normalization for Duplicate Detection', () => {
    const desc1 = '   Beli   Kertas   HVS   A4 70gr (1 rim)  ! ';
    const desc2 = 'beli kertas hvs a4 70gr 1 rim';
    assert.strictEqual(
      normalizeDescription(desc1),
      normalizeDescription(desc2),
      'Descriptions with different casing, whitespace, or punctuation should normalize identically'
    );

    assert.strictEqual(normalizeDescription(null), '');
    assert.strictEqual(normalizeDescription(''), '');
  });

  await t.test('Binary Magic Bytes File Validation', () => {
    // Valid PNG Header: 89 50 4E 47 0D 0A 1A 0A
    const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01]);
    const pngResult = verifyMagicBytes(pngBuffer);
    assert.strictEqual(pngResult.valid, true);
    assert.strictEqual(pngResult.ext, 'png');
    assert.strictEqual(pngResult.mime, 'image/png');

    // Valid JPEG Header: FF D8 FF
    const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
    const jpegResult = verifyMagicBytes(jpegBuffer);
    assert.strictEqual(jpegResult.valid, true);
    assert.strictEqual(jpegResult.ext, 'jpg');
    assert.strictEqual(jpegResult.mime, 'image/jpeg');

    // Valid PDF Header: %PDF- (25 50 44 46 2D)
    const pdfBuffer = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]);
    const pdfResult = verifyMagicBytes(pdfBuffer);
    assert.strictEqual(pdfResult.valid, true);
    assert.strictEqual(pdfResult.ext, 'pdf');
    assert.strictEqual(pdfResult.mime, 'application/pdf');

    // Valid WebP Header: RIFF....WEBP (52 49 46 46 .. .. .. .. 57 45 42 50)
    const webpBuffer = Buffer.from([
      0x52, 0x49, 0x46, 0x46, 0x20, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
    ]);
    const webpResult = verifyMagicBytes(webpBuffer);
    assert.strictEqual(webpResult.valid, true);
    assert.strictEqual(webpResult.ext, 'webp');
    assert.strictEqual(webpResult.mime, 'image/webp');

    // Fake / Malicious Binary Header (e.g. executable disguised as image)
    const fakeBuffer = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]); // MZ DOS header
    const fakeResult = verifyMagicBytes(fakeBuffer);
    assert.strictEqual(fakeResult.valid, false);

    // Too short buffer
    const shortBuffer = Buffer.from([0x01, 0x02]);
    assert.strictEqual(verifyMagicBytes(shortBuffer).valid, false);
  });
});

