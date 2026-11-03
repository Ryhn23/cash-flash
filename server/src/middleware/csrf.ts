import type { MiddlewareHandler } from 'hono';
import type { Session } from '../db/schema.js';
import type { AppEnv } from '../types/env.js';

export const csrfProtection: MiddlewareHandler<AppEnv> = async (c, next) => {
  const method = c.req.method.toUpperCase();

  // Safe HTTP methods do not mutate state
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    return await next();
  }

  // Exempt public auth routes from session-bound CSRF (they create the session)
  const path = c.req.path;
  if (path === '/api/auth/login' || path === '/api/auth/csrf') {
    return await next();
  }

  // 1. Origin / Referer verification
  const origin = c.req.header('origin');
  const referer = c.req.header('referer');
  const host = c.req.header('host');

  if (origin && host) {
    try {
      const originHost = new URL(origin).host;
      if (originHost !== host && !originHost.includes('localhost') && !originHost.includes('127.0.0.1')) {
        return c.json({ success: false, error: 'CSRF Defense: Invalid request Origin' }, 403);
      }
    } catch {
      return c.json({ success: false, error: 'CSRF Defense: Malformed Origin header' }, 403);
    }
  } else if (referer && host) {
    try {
      const refererHost = new URL(referer).host;
      if (refererHost !== host && !refererHost.includes('localhost') && !refererHost.includes('127.0.0.1')) {
        return c.json({ success: false, error: 'CSRF Defense: Invalid request Referer' }, 403);
      }
    } catch {
      return c.json({ success: false, error: 'CSRF Defense: Malformed Referer header' }, 403);
    }
  }

  // 2. Double-Submit / Session-bound X-CSRF-Token header verification
  const session = c.get('session') as Session | undefined;
  if (session) {
    const clientCsrfToken = c.req.header('x-csrf-token');
    if (!clientCsrfToken || clientCsrfToken !== session.csrfToken) {
      return c.json(
        {
          success: false,
          error: 'CSRF Defense: Token CSRF tidak valid atau hilang. Muat ulang halaman.',
        },
        403
      );
    }
  }

  await next();
};
