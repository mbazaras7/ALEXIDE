import { z } from 'zod';

const assignmentStatusEnum = z.enum(['DRAFT', 'PUBLISHED', 'CLOSED'] as const);
const languageEnum = z.enum(['python'] as const);

export const createAssignmentSchema = z.object({
  params: z.object({
    classId: z.string().uuid('Invalid class ID'),
  }),
  body: z.object({
    title: z
      .string()
      .min(1, 'Title cannot be empty')
      .max(200, 'Title cannot exceed 200 characters'),
    description: z.string().max(2000).optional(),
    dueDate: z.string().datetime({ message: 'Invalid due date format, use ISO 8601' }).optional(),
    maxScore: z.number().int().min(1).max(1000).optional(),
    language: languageEnum.optional(),
    status: assignmentStatusEnum.optional(),
  }),
});

export const updateAssignmentSchema = z.object({
  params: z.object({
    assignmentId: z.string().uuid('Invalid assignment ID'),
  }),
  body: z
    .object({
      title: z.string().min(1).max(200).optional(),
      description: z.string().max(2000).optional(),
      dueDate: z
        .string()
        .datetime({ message: 'Invalid due date format, use ISO 8601' })
        .or(z.literal(''))
        .optional(),
      maxScore: z.number().int().min(1).max(1000).optional(),
      language: languageEnum.optional(),
      status: assignmentStatusEnum.optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: 'At least one field must be provided',
    }),
});

export const getAssignmentSchema = z.object({
  params: z.object({
    assignmentId: z.string().uuid('Invalid assignment ID'),
  }),
});

export const getClassAssignmentsSchema = z.object({
  params: z.object({
    classId: z.string().uuid('Invalid class ID'),
  }),
});

export const deleteAssignmentSchema = z.object({
  params: z.object({
    assignmentId: z.string().uuid('Invalid assignment ID'),
  }),
});

export const createTestCaseSchema = z.object({
  params: z.object({
    assignmentId: z.string().uuid('Invalid assignment ID'),
  }),
  body: z.object({
    name: z.string().min(1, 'Name cannot be empty').max(200, 'Name cannot exceed 200 characters'),
    inputData: z.string().optional(),
    expectedOutput: z.string().min(1, 'Expected output cannot be empty'),
    sysArgs: z.array(z.string()).optional(),
    weight: z.number().int().min(1).max(100).optional(),
    orderIndex: z.number().int().min(0).optional(),
  }),
});

export const updateTestCaseSchema = z.object({
  params: z.object({
    testCaseId: z.string().uuid('Invalid test case ID'),
  }),
  body: z
    .object({
      name: z.string().min(1).max(200).optional(),
      inputData: z.string().optional(),
      sysArgs: z.array(z.string()).nullable().optional(),
      expectedOutput: z.string().min(1).optional(),
      weight: z.number().int().min(1).max(100).optional(),
      orderIndex: z.number().int().min(0).optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: 'At least one field must be provided',
    }),
});

export const testCaseParamSchema = z.object({
  params: z.object({
    testCaseId: z.string().uuid('Invalid test case ID'),
  }),
});
