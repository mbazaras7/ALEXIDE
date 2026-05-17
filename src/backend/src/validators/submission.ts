import { z } from 'zod';

export const submitAssignmentSchema = z.object({
  params: z.object({
    assignmentId: z.string().uuid('Invalid assignment ID'),
  }),
  body: z
    .object({
      code: z.string().min(1).max(50000).optional(),
      storageKey: z.string().min(1).optional(),
    })
    .refine((data) => data.code || data.storageKey, {
      message: 'Either code or storageKey must be provided',
    }),
});

export const assignmentIdSchema = z.object({
  params: z.object({
    assignmentId: z.string().uuid('Invalid assignment ID'),
  }),
});

export const submissionIdSchema = z.object({
  params: z.object({
    submissionId: z.string().uuid('Invalid submission ID'),
  }),
});

export const classIdSchema = z.object({
  params: z.object({
    classId: z.string().uuid('Invalid class ID'),
  }),
});

export const classAndAssignmentSchema = z.object({
  params: z.object({
    classId: z.string().uuid('Invalid class ID'),
    assignmentId: z.string().uuid('Invalid assignment ID'),
  }),
});

export const reGradeSubmissionSchema = z.object({
  params: z.object({
    submissionId: z.string().uuid('Invalid submission ID'),
  }),
});

export const saveFeedbackSchema = z.object({
  params: z.object({
    submissionId: z.string().uuid('Invalid submission ID'),
  }),
  body: z.object({
    feedback: z
      .string()
      .min(1, 'Feedback cannot be empty')
      .max(2000, 'Feedback must be under 2000 characters'),
  }),
});

export const adoptAiFeedbackSchema = z.object({
  params: z.object({
    submissionId: z.string().uuid('Invalid submission ID'),
  }),
});
