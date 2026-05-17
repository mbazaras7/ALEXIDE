import { z } from 'zod';

export const registerSchema = z.object({
  body: z.object({
    email: z
      .string()
      .email('Invalid email format')
      .min(5, 'Email too short')
      .max(254, 'Email too long')
      .toLowerCase(),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        'Password must contain lowercase, uppercase, and number'
      ),
    name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
    role: z.enum(['STUDENT', 'TEACHER', 'ADMIN']),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email format').min(5, 'Email too short'),
    password: z.string().min(1, 'Password is required'),
  }),
});

export const updateProfileSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Valid name is required'),
  }),
});

export type RegisterData = z.infer<typeof registerSchema.shape.body>;
export type LoginData = z.infer<typeof loginSchema.shape.body>;
export type UpdateProfileData = z.infer<typeof updateProfileSchema>['body'];
