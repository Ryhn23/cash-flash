import type { MiddlewareHandler } from 'hono';
import { getCookie } from 'hono/cookie';
import { eq, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users, sessions, type User, type Session } from '../db/schema.js';
import { hashToken } from '../utils/security.js';
import type { AppEnv } from '../types/env.js';

export const authMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  const token = getCookie(c, 'nextcash_session');

  if (!token) {
    return c.json({ success: false, error: 'Akses ditolak: Tidak ada sesi aktif' }, 401);
  }

  const hashedToken = hashToken(token);

  const foundSession = db
    .select({
      session: sessions,
      user: users,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.tokenHash, hashedToken))
    .get();

  if (!foundSession) {
    return c.json({ success: false, error: 'Sesi tidak valid atau telah kedaluwarsa' }, 401);
  }

  const now = new Date().toISOString();
  if (foundSession.session.expiresAt <= now) {
    db.delete(sessions).where(eq(sessions.id, foundSession.session.id)).run();
    return c.json({ success: false, error: 'Sesi telah berakhir. Silakan masuk kembali.' }, 401);
  }

  if (foundSession.user.isActive !== 1) {
    return c.json({ success: false, error: 'Akun Anda dinonaktifkan oleh administrator' }, 403);
  }

  c.set('user', foundSession.user);
  c.set('session', foundSession.session);

  await next();
};
