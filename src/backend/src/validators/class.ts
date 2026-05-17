import { z } from 'zod';

export const createClassSchema = z.object({
  body: z.object({
    name: z
      .string()
      .min(1, 'Class name cannot be empty')
      .max(100, 'Class name cannot exceed 100 characters'),
    description: z.string().max(500, 'Description cannot exceed 500 characters').optional(),
  }),
});

export const updateClassSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid class ID'),
  }),
  body: z
    .object({
      name: z
        .string()
        .min(1, 'Class name cannot be empty')
        .max(100, 'Class name cannot exceed 100 characters')
        .optional(),
      description: z.string().max(500, 'Description cannot exceed 500 characters').optional(),
    })
    .refine((data) => data.name !== undefined || data.description !== undefined, {
      message: 'At least one field (name or description) must be provided',
    }),
});

export const getClassSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid class ID'),
  }),
});

export const deleteClassSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid class ID'),
  }),
});

export const removeStudentSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid class ID'),
    studentId: z.string().uuid('Invalid student ID'),
  }),
});

export const joinClassSchema = z.object({
  body: z.object({
    joinCode: z.string().min(1, 'Join code cannot be empty').max(20, 'Invalid join code'),
  }),
});

export const leaveClassSchema = z.object({
  params: z.object({
    classId: z.string().uuid('Invalid class ID'),
  }),
});

export const getClassStudentsSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid class ID'),
  }),
});

export const getEnrolledClassStudentsSchema = z.object({
  params: z.object({
    classId: z.string().uuid('Invalid class ID'),
  }),
});
