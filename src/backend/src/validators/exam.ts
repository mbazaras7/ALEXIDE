import { z } from 'zod';

const examStatusEnum = z.enum(['DRAFT', 'SCHEDULED', 'ACTIVE', 'COMPLETED', 'CANCELLED'] as const);
const languageEnum = z.enum(['python'] as const);

export const createExamSchema = z.object({
  params: z.object({
    classId: z.string().uuid('Invalid class ID'),
  }),
  body: z.object({
    title: z
      .string()
      .min(1, 'Title cannot be empty')
      .max(200, 'Title cannot exceed 200 characters'),
    instructions: z.string().max(5000).optional(),
    language: languageEnum.optional(),
    durationMinutes: z.number().int().min(1).max(480).optional(),
    scheduledStart: z
      .string()
      .datetime({ message: 'Invalid scheduledStart format, use ISO 8601' })
      .optional(),
    scheduledEnd: z
      .string()
      .datetime({ message: 'Invalid scheduledEnd format, use ISO 8601' })
      .optional(),
    maxScore: z.number().int().min(1).max(1000).optional(),
    status: examStatusEnum.optional(),
  }),
});

export const updateExamSchema = z.object({
  params: z.object({
    examId: z.string().uuid('Invalid exam ID'),
  }),
  body: z
    .object({
      title: z.string().min(1).max(200).optional(),
      instructions: z.string().max(5000).nullable().optional(),
      language: languageEnum.optional(),
      durationMinutes: z.number().int().min(1).max(480).optional(),
      scheduledStart: z
        .string()
        .datetime({ message: 'Invalid scheduledStart format, use ISO 8601' })
        .or(z.literal(''))
        .nullable()
        .optional(),
      scheduledEnd: z
        .string()
        .datetime({ message: 'Invalid scheduledEnd format, use ISO 8601' })
        .or(z.literal(''))
        .nullable()
        .optional(),
      maxScore: z.number().int().min(1).max(1000).optional(),
      status: examStatusEnum.optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: 'At least one field must be provided',
    }),
});

export const getExamSchema = z.object({
  params: z.object({
    examId: z.string().uuid('Invalid exam ID'),
  }),
});

export const getClassExamsSchema = z.object({
  params: z.object({
    classId: z.string().uuid('Invalid class ID'),
  }),
});

export const deleteExamSchema = z.object({
  params: z.object({
    examId: z.string().uuid('Invalid exam ID'),
  }),
});

export const publishExamSchema = z.object({
  params: z.object({
    examId: z.string().uuid('Invalid exam ID'),
  }),
});

export const addQuestionSchema = z.object({
  params: z.object({
    examId: z.string().uuid('Invalid exam ID'),
  }),
  body: z.object({
    title: z
      .string()
      .min(1, 'Title cannot be empty')
      .max(200, 'Title cannot exceed 200 characters'),
    description: z.string().max(5000).optional(),
    maxScore: z.number().int().min(1).max(1000).optional(),
    language: languageEnum.optional(),
    orderIndex: z.number().int().min(0).optional(),
  }),
});

export const updateQuestionSchema = z.object({
  params: z.object({
    examId: z.string().uuid('Invalid exam ID'),
    questionId: z.string().uuid('Invalid question ID'),
  }),
  body: z
    .object({
      title: z.string().min(1).max(200).optional(),
      description: z.string().max(5000).nullable().optional(),
      maxScore: z.number().int().min(1).max(1000).optional(),
      language: languageEnum.optional(),
      orderIndex: z.number().int().min(0).optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: 'At least one field must be provided',
    }),
});

export const deleteQuestionSchema = z.object({
  params: z.object({
    examId: z.string().uuid('Invalid exam ID'),
    questionId: z.string().uuid('Invalid question ID'),
  }),
});

export const addExamTestCaseSchema = z.object({
  params: z.object({
    examId: z.string().uuid('Invalid exam ID'),
    questionId: z.string().uuid('Invalid question ID'),
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

export const updateExamTestCaseSchema = z.object({
  params: z.object({
    examId: z.string().uuid('Invalid exam ID'),
    questionId: z.string().uuid('Invalid question ID'),
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

export const deleteExamTestCaseSchema = z.object({
  params: z.object({
    examId: z.string().uuid('Invalid exam ID'),
    questionId: z.string().uuid('Invalid question ID'),
    testCaseId: z.string().uuid('Invalid test case ID'),
  }),
});

export const startExamSchema = z.object({
  params: z.object({
    examId: z.string().uuid('Invalid exam ID'),
  }),
});

export const submitExamSchema = z.object({
  params: z.object({
    examId: z.string().uuid('Invalid exam ID'),
  }),
});

export const tabSwitchSchema = z.object({
  params: z.object({
    examId: z.string().uuid('Invalid exam ID'),
  }),
});

export const addExamAnswerSchema = z.object({
  params: z.object({
    examId: z.string().uuid('Invalid exam ID'),
    questionId: z.string().uuid('Invalid question ID'),
  }),
  body: z.object({
    code: z.string().min(1, 'Code cannot be empty'),
  }),
});

export const getExamAnswersSchema = z.object({
  params: z.object({
    examId: z.string().uuid('Invalid exam ID'),
  }),
});

export const getExamMonitorStateSchema = z.object({
  params: z.object({
    examId: z.string().uuid('Invalid exam ID'),
  }),
});

export const getStudentSnapshotSchema = z.object({
  params: z.object({
    examId: z.string().uuid('Invalid exam ID'),
    studentId: z.string().uuid('Invalid student ID'),
  }),
});
