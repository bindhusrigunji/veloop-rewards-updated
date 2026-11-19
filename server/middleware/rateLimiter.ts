import { Request, Response, NextFunction } from 'express';

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

const ipRequestMap = new Map<string, RateLimitRecord>();
let limiterSequence = 0;

function pruneExpired(now: number): void {
  if (ipRequestMap.size <= 1000) return;
  for (const [key, record] of ipRequestMap.entries()) {
    if (now > record.resetTime) {
      ipRequestMap.delete(key);
    }
  }
}

export function rateLimiter(options: {
  windowMs: number;
  maxRequests: number;
  message?: string;
  namespace?: string;
}) {
  limiterSequence += 1;
  const namespace = options.namespace || `limiter-${limiterSequence}`;
  const { windowMs, maxRequests, message = 'Too many requests, please slow down' } = options;

  return (req: Request, res: Response, next: NextFunction): void => {
    const clientIp = (req.ip || req.headers['x-forwarded-for'] || 'unknown') as string;
    const key = `${namespace}:${clientIp}`;
    const now = Date.now();

    pruneExpired(now);

    const record = ipRequestMap.get(key);

    if (!record || now > record.resetTime) {
      ipRequestMap.set(key, {
        count: 1,
        resetTime: now + windowMs
      });
      return next();
    }

    if (record.count >= maxRequests) {
      res.status(429).json({
        success: false,
        message,
        retryAfterMs: Math.max(0, record.resetTime - now)
      });
      return;
    }

    record.count++;
    next();
  };
}
