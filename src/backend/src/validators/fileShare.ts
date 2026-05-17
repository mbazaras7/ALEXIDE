import { z } from 'zod';

export const createShareSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid file ID'),
  }),
  body: z.object({
    expiresInHours: z.number().int().positive().optional(),
  }),
});

export const resolveShareSchema = z.object({
  params: z.object({
    code: z.string().min(1, 'Share code is required'),
  }),
});

export const revokeShareSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid file ID'),
  }),
});
