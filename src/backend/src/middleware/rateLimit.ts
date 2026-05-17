/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response, NextFunction } from 'express';
import { ResponseHandler } from '../utils/response';

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

const store: RateLimitStore = {};

export const createRateLimiter = (options: {
  windowMs: number;
  maxRequests: number;
  message?: string;
  keyBy?: 'ip' | 'userId';
}) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const identifier = options.keyBy === 'userId' ? ((req as any).user?.userId ?? req.ip) : req.ip;

    const key = `${identifier}-${req.path}`;
    const now = Date.now();

    if (store[key] && now > store[key].resetTime) {
      delete store[key];
    }

    if (!store[key]) {
      store[key] = {
        count: 1,
        resetTime: now + options.windowMs,
      };
      return next();
    }

    if (store[key].count >= options.maxRequests) {
      ResponseHandler.error(
        res,
        options.message || 'Too many requests, please try again later',
        429
      );
      return;
    }

    store[key].count++;
    next();
  };
};

export const autoSaveRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 20,
  message: 'Auto-save rate limit exceeded. Please wait before saving again.',
});

export const executeRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 10,
  message: 'Execution rate limit exceeded. Please wait before running code again.',
  keyBy: 'userId',
});
