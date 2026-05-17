import { z } from 'zod';

const sourceTypeEnum = z.enum(['ASSIGNMENT', 'EXAM'] as const);

export const recordGradeSchema = z.object({
  params: z.object({
    classId: z.string().uuid('Invalid class ID'),
  }),
  body: z.object({
    studentId: z.string().uuid('Invalid student ID'),
    sourceType: sourceTypeEnum,
    sourceId: z.string().min(1, 'Source ID is required'),
    score: z.number().min(0, 'Score cannot be negative'),
    maxScore: z.number().min(1, 'Max score must be at least 1'),
  }),
});

export const updateGradeSchema = z.object({
  params: z.object({
    gradeId: z.string().uuid('Invalid grade ID'),
  }),
  body: z
    .object({
      score: z.number().min(0, 'Score cannot be negative').optional(),
      maxScore: z.number().min(1, 'Max score must be at least 1').optional(),
    })
    .refine((data) => data.score !== undefined || data.maxScore !== undefined, {
      message: 'At least one field (score or maxScore) must be provided',
    }),
});

export const deleteGradeSchema = z.object({
  params: z.object({
    gradeId: z.string().uuid('Invalid grade ID'),
  }),
});

export const getGradesByClassSchema = z.object({
  params: z.object({
    classId: z.string().uuid('Invalid class ID'),
  }),
});

export const getGradesBySourceSchema = z.object({
  params: z.object({
    classId: z.string().uuid('Invalid class ID'),
  }),
  query: z.object({
    sourceId: z.string().min(1, 'Source ID is required'),
    sourceType: sourceTypeEnum,
  }),
});

export const releaseGradesSchema = z.object({
  params: z.object({
    classId: z.string().uuid('Invalid class ID'),
  }),
  body: z.object({
    sourceType: sourceTypeEnum,
    sourceId: z.string().min(1, 'Source ID is required'),
  }),
});

export const getStudentClassGradesSchema = z.object({
  params: z.object({
    classId: z.string().uuid('Invalid class ID'),
  }),
});

export const getGradeByIdSchema = z.object({
  params: z.object({
    gradeId: z.string().uuid('Invalid grade ID'),
  }),
});

export const getStudentGradesByTypeSchema = z.object({
  params: z.object({
    classId: z.string().uuid('Invalid class ID'),
  }),
  query: z.object({
    sourceType: sourceTypeEnum,
  }),
});

export const getClassStatsSchema = z.object({
  params: z.object({
    classId: z.string().uuid('Invalid class ID'),
  }),
});

export const getStudentOverviewSchema = z.object({
  params: z.object({
    classId: z.string().uuid('Invalid class ID'),
    studentId: z.string().uuid('Invalid student ID'),
  }),
});
