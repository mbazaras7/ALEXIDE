import { z } from 'zod';

export const executeCodeSchema = z.object({
  body: z.object({
    code: z
      .string()
      .min(1, 'Code is required')
      .max(50000, 'Code exceeds maximum length of 50,000 characters'),
    language: z.enum(['python']).default('python'),
  }),
});

export const executeFileSchema = z.object({
  body: z.object({
    storageKey: z.string().min(1, 'storageKey is required'),
    language: z.enum(['python']).default('python'),
  }),
});

export type ExecuteCodeInput = z.infer<typeof executeCodeSchema>['body'];
export type ExecuteFileInput = z.infer<typeof executeFileSchema>['body'];
