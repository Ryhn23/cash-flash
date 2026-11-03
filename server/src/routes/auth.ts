import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { eq, lt } from 'drizzle-orm';
import { setCookie, deleteCookie } from 'hono/cookie';
import { db } from '../db/index.js';
import { users, sessions } from '../db/schema.js';
import {
  verifyPassword,
  generateSessionToken,
  generateCsrfToken,
  hashToken,
  stripHtml,
} from '../utils/security.js';
import { authMiddleware } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rate-limit.js';
import type { AppEnv } from '../types/env.js';

export const authRouter = new Hono<AppEnv>();

// Periodic session cleanup: Purge expired sessions once per hour (unref timer)
export function purgeExpiredSessions(): number {
  try {
    const nowIso = new Date().toISOString();
    const res = db.delete(sessions).where(lt(sessions.expiresAt, nowIso)).run();
    return res.changes;
  } catch {
    return 0;
  }
}

const sessionCleanupInterval = setInterval(purgeExpiredSessions, 60 * 60 * 1000);
sessionCleanupInterval.unref();

// Strict login schema
const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .email('Format email tidak valid')
    .transform((val) => stripHtml(val).toLowerCase()),
  password: z.string().min(1, 'Kata sandi wajib diisi'),
});

// Rate limit login: max 5 attempts per 15 minutes per IP + email (relaxed during test suite execution)
const loginRateLimiter = rateLimit({
  storeName: 'login',
  max: process.env.NODE_ENV === 'test' ? 1000 : 5,
  windowMs: 15 * 60 * 1000,
  keyGenerator: async (c) => {
    const forwarded = c.req.header('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0].trim() : '127.0.0.1';
    try {
      const body = await c.req.raw.clone().json();
      return `${ip}:${body?.email || ''}`;
    } catch {
      return ip;
    }
  },
  message: 'Terlalu banyak percobaan masuk yang gagal. Silakan tunggu 15 menit.',
});

// POST /api/auth/login
authRouter.post('/login', loginRateLimiter, zValidator('json', loginSchema), async (c) => {
  const { email, password } = c.req.valid('json');

  const user = db.select().from(users).where(eq(users.email, email)).get();

  if (!user || user.isActive !== 1) {
    return c.json({ success: false, error: 'Email atau kata sandi tidak valid' }, 401);
  }

  const isValidPassword = await verifyPassword(password, user.passwordHash);
  if (!isValidPassword) {
    return c.json({ success: false, error: 'Email atau kata sandi tidak valid' }, 401);
  }

  // Create session and purge stale sessions
  purgeExpiredSessions();
  const rawToken = generateSessionToken();
  const tokenHash = hashToken(rawToken);
  const csrfToken = generateCsrfToken();
  const sessionId = crypto.randomUUID();

  // 7 days expiration
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const forwarded = c.req.header('x-forwarded-for');
  const ipAddress = forwarded ? forwarded.split(',')[0].trim() : '127.0.0.1';
  const userAgent = c.req.header('user-agent') || 'Unknown';

  db.insert(sessions)
    .values({
      id: sessionId,
      userId: user.id,
      tokenHash,
      csrfToken,
      ipAddress,
      userAgent,
      expiresAt,
    })
    .run();

  // Set HTTP-only session cookie
  setCookie(c, 'nextcash_session', rawToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60,
  });

  return c.json({
    success: true,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      systemRole: user.systemRole,
    },
    csrfToken,
  });
});

// POST /api/auth/logout
authRouter.post('/logout', authMiddleware, async (c) => {
  const session = c.get('session');
  if (session) {
    db.delete(sessions).where(eq(sessions.id, session.id)).run();
  }

  deleteCookie(c, 'nextcash_session', { path: '/' });
  return c.json({ success: true, message: 'Berhasil keluar' });
});

// GET /api/auth/me
authRouter.get('/me', authMiddleware, async (c) => {
  const user = c.get('user');
  const session = c.get('session');

  return c.json({
    success: true,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      systemRole: user.systemRole,
    },
    csrfToken: session?.csrfToken,
  });
});
