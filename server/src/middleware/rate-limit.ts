import type { MiddlewareHandler } from 'hono';

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const rateLimitStores = new Map<string, Map<string, RateLimitRecord>>();

export function rateLimit(options: {
  storeName: string;
  max: number;
  windowMs: number;
  keyGenerator?: (c: any) => Promise<string> | string;
  message?: string;
}): MiddlewareHandler {
  if (!rateLimitStores.has(options.storeName)) {
    rateLimitStores.set(options.storeName, new Map());
  }
  const store = rateLimitStores.get(options.storeName)!;

  // Periodically clean up expired entries
  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, record] of store.entries()) {
      if (record.resetAt <= now) {
        store.delete(key);
      }
    }
  }, 60000);
  cleanupTimer.unref();

  return async (c, next) => {
    const now = Date.now();
    let key = '';

    if (options.keyGenerator) {
      key = await options.keyGenerator(c);
    } else {
      const forwarded = c.req.header('x-forwarded-for');
      const ip = forwarded ? forwarded.split(',')[0].trim() : '127.0.0.1';
      key = ip;
    }

    const record = store.get(key);

    if (!record || record.resetAt <= now) {
      store.set(key, { count: 1, resetAt: now + options.windowMs });
    } else {
      record.count += 1;
      if (record.count > options.max) {
        const retryAfterSeconds = Math.ceil((record.resetAt - now) / 1000);
        c.header('Retry-After', retryAfterSeconds.toString());
        return c.json(
          {
            success: false,
            error: options.message || 'Terlalu banyak permintaan. Silakan coba beberapa saat lagi.',
            retryAfterSeconds,
          },
          429
        );
      }
    }

    await next();
  };
}

export function resetRateLimit(storeName: string, key: string) {
  const store = rateLimitStores.get(storeName);
  if (store) {
    store.delete(key);
  }
}
