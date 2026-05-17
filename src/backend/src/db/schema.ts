import {
  pgTable,
  text,
  timestamp,
  pgEnum,
  integer,
  boolean,
  foreignKey,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { randomUUID } from 'crypto';
import { relations, sql } from 'drizzle-orm';

export const userRoleEnum = pgEnum('user_role', ['STUDENT', 'TEACHER', 'ADMIN']);
export const sourceTypeEnum = pgEnum('source_type', ['ASSIGNMENT', 'EXAM']);
export const assignmentStatusEnum = pgEnum('assignment_status', ['DRAFT', 'PUBLISHED', 'CLOSED']);
export const submissionStatusEnum = pgEnum('submission_status', [
  'PENDING',
  'RUNNING',
  'COMPLETED',
  'FAILED',
]);
export const examStatusEnum = pgEnum('exam_status', [
  'DRAFT',
  'SCHEDULED',
  'ACTIVE',
  'COMPLETED',
  'CANCELLED',
]);

export const users = pgTable('users', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => randomUUID()),
  email: text('email').notNull().unique(),
  password: text('password').notNull(),
  role: userRoleEnum('role').default('STUDENT').notNull(),
  name: text('name'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const files = pgTable(
  'files',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    path: text('path').notNull(),
    // For hierarchical structure (null = root level)
    parentId: text('parent_id'),
    isDirectory: boolean('is_directory').default(false).notNull(),
    // File metadata
    mimeType: text('mime_type'),
    size: integer('size').default(0).notNull(), // in bytes
    // AWS S3 bucket key
    storageKey: text('storage_key'),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => {
    return {
      // Self-referencing foreign key constraint
      parentReference: foreignKey({
        columns: [table.parentId],
        foreignColumns: [table.id],
        name: 'files_parent_id_fkey',
      }).onDelete('cascade'),

      userIdIdx: index('files_user_id_idx').on(table.userId),
      parentIdIdx: index('files_parent_id_idx').on(table.parentId),
      pathIdx: index('files_path_idx').on(table.path),
      deletedAtIdx: index('files_deleted_at_idx').on(table.deletedAt),

      // Unique constraint (Commented out for now, but works and exists in database, just might be broken if uncommentend)
      uniqueUserPath: uniqueIndex('files_user_id_path_idx')
        .on(table.userId, table.path)
        .where(sql`${table.deletedAt} IS NULL`),
    };
  }
);

export const classes = pgTable(
  'classes',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    name: text('name').notNull(),
    description: text('description'),
    teacherId: text('teacher_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    joinCode: text('join_code').notNull().unique(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    teacherIdIdx: index('classes_teacher_id_idx').on(table.teacherId),
    joinCodeIdx: uniqueIndex('classes_join_code_idx').on(table.joinCode),
  })
);

export const classMembers = pgTable(
  'class_members',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    classId: text('class_id')
      .notNull()
      .references(() => classes.id, { onDelete: 'cascade' }),
    studentId: text('student_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    classIdIdx: index('class_members_class_id_idx').on(table.classId),
    studentIdIdx: index('class_members_student_id_idx').on(table.studentId),
    uniqueMembership: uniqueIndex('class_members_class_student_idx').on(
      table.classId,
      table.studentId
    ),
  })
);

export const grades = pgTable(
  'grades',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    studentId: text('student_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    classId: text('class_id')
      .notNull()
      .references(() => classes.id, { onDelete: 'cascade' }),
    //'ASSIGNMENT' or 'EXAM'
    sourceType: sourceTypeEnum('source_type').notNull(),
    sourceId: text('source_id').notNull(),
    score: integer('score').notNull(),
    maxScore: integer('max_score').notNull(),
    releasedAt: timestamp('released_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    studentIdIdx: index('grades_student_id_idx').on(table.studentId),
    classIdIdx: index('grades_class_id_idx').on(table.classId),
    sourceIdx: index('grades_source_idx').on(table.sourceType, table.sourceId),
    releasedAtIdx: index('grades_released_at_idx').on(table.releasedAt),
    //A student can only have one grade per assignment/exam
    uniqueGrade: uniqueIndex('grades_student_source_idx').on(
      table.studentId,
      table.sourceId,
      table.sourceType
    ),
  })
);

export const assignments = pgTable(
  'assignments',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    classId: text('class_id')
      .notNull()
      .references(() => classes.id, { onDelete: 'cascade' }),
    teacherId: text('teacher_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description'),
    dueDate: timestamp('due_date', { withTimezone: true }),
    maxScore: integer('max_score').notNull().default(100),
    language: text('language').notNull().default('python'),
    status: assignmentStatusEnum('status').notNull().default('DRAFT'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    classIdIdx: index('assignments_class_id_idx').on(table.classId),
    teacherIdIdx: index('assignments_teacher_id_idx').on(table.teacherId),
    statusIdx: index('assignments_status_idx').on(table.status),
    dueDateIdx: index('assignments_due_date_idx').on(table.dueDate),
  })
);

export const testCases = pgTable(
  'test_cases',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    assignmentId: text('assignment_id')
      .notNull()
      .references(() => assignments.id, { onDelete: 'cascade' }),
    name: text('name').notNull(), // e.g. "Test addition with positives"
    inputData: text('input_data'), // stdin input to pass to the student's code
    sysArgs: text('sys_args'),
    expectedOutput: text('expected_output').notNull(), // exact expected stdout
    weight: integer('weight').notNull().default(1), // for weighted scoring
    orderIndex: integer('order_index').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    assignmentIdIdx: index('test_cases_assignment_id_idx').on(table.assignmentId),
  })
);

export const submissions = pgTable(
  'submissions',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    assignmentId: text('assignment_id')
      .notNull()
      .references(() => assignments.id, { onDelete: 'cascade' }),
    studentId: text('student_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    code: text('code').notNull(),
    status: submissionStatusEnum('status').notNull().default('PENDING'),
    score: integer('score'),
    maxScore: integer('max_score'),
    testResults: text('test_results'),
    submittedAt: timestamp('submitted_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    aiFeedback: text('ai_feedback'),
    aiFeedbackGeneratedAt: timestamp('ai_feedback_generated_at', { withTimezone: true }),
    feedback: text('feedback'),
    feedbackUpdatedAt: timestamp('feedback_updated_at', { withTimezone: true }),
  },
  (table) => ({
    assignmentIdIdx: index('submissions_assignment_id_idx').on(table.assignmentId),
    studentIdIdx: index('submissions_student_id_idx').on(table.studentId),
    statusIdx: index('submissions_status_idx').on(table.status),
    uniqueSubmission: uniqueIndex('submissions_student_assignment_idx').on(
      table.studentId,
      table.assignmentId
    ),
  })
);

export const collaborationStates = pgTable('collaborationstates', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => randomUUID()),
  fileId: text('fileid')
    .notNull()
    .unique()
    .references(() => files.id, { onDelete: 'cascade' }),
  stateVector: text('statevector').notNull(),
  updatedAt: timestamp('updatedat', { withTimezone: true }).defaultNow().notNull(),
});

export const fileShares = pgTable(
  'fileshares',
  {
    id: text('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    fileId: text('fileid')
      .notNull()
      .references(() => files.id, { onDelete: 'cascade' }),
    ownerId: text('ownerid')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    shareCode: text('sharecode').notNull().unique(),
    expiresAt: timestamp('expiresat', { withTimezone: true }),
    createdAt: timestamp('createdat', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    fileIdIdx: index('filesharesfileidx').on(table.fileId),
    shareCodeIdx: uniqueIndex('filesharessharecode').on(table.shareCode),
  })
);

export const exams = pgTable(
  'exams',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    classId: text('class_id')
      .notNull()
      .references(() => classes.id, { onDelete: 'cascade' }),
    teacherId: text('teacher_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    instructions: text('instructions'),
    language: text('language').notNull().default('python'),
    durationMinutes: integer('duration_minutes').notNull().default(60),
    scheduledStart: timestamp('scheduled_start', { withTimezone: true }),
    scheduledEnd: timestamp('scheduled_end', { withTimezone: true }),
    status: examStatusEnum('status').notNull().default('DRAFT'),
    maxScore: integer('max_score').notNull().default(100),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    isOpenBook: boolean('is_open_book').notNull().default(false),
  },
  (table) => ({
    classIdIdx: index('exams_class_id_idx').on(table.classId),
    teacherIdIdx: index('exams_teacher_id_idx').on(table.teacherId),
    statusIdx: index('exams_status_idx').on(table.status),
    scheduledStartIdx: index('exams_scheduled_start_idx').on(table.scheduledStart),
  })
);

export const examQuestions = pgTable(
  'exam_questions',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    examId: text('exam_id')
      .notNull()
      .references(() => exams.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description'),
    maxScore: integer('max_score').notNull().default(100),
    language: text('language').notNull().default('python'),
    orderIndex: integer('order_index').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    examIdIdx: index('exam_questions_exam_id_idx').on(table.examId),
  })
);

export const examTestCases = pgTable(
  'exam_test_cases',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    questionId: text('question_id')
      .notNull()
      .references(() => examQuestions.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    inputData: text('input_data'),
    sysArgs: text('sys_args'),
    expectedOutput: text('expected_output').notNull(),
    weight: integer('weight').notNull().default(1),
    orderIndex: integer('order_index').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    questionIdIdx: index('exam_test_cases_question_id_idx').on(table.questionId),
  })
);

export const examSessions = pgTable(
  'exam_sessions',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    examId: text('exam_id')
      .notNull()
      .references(() => exams.id, { onDelete: 'cascade' }),
    studentId: text('student_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    tabSwitchCount: integer('tab_switch_count').notNull().default(0),
    isSubmitted: boolean('is_submitted').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    examIdIdx: index('exam_sessions_exam_id_idx').on(table.examId),
    studentIdIdx: index('exam_sessions_student_id_idx').on(table.studentId),
    uniqueSession: uniqueIndex('exam_sessions_exam_student_idx').on(table.examId, table.studentId),
  })
);

export const examQuestionSubmissions = pgTable(
  'exam_question_submissions',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    examSessionId: text('exam_session_id')
      .notNull()
      .references(() => examSessions.id, { onDelete: 'cascade' }),
    examId: text('exam_id')
      .notNull()
      .references(() => exams.id, { onDelete: 'cascade' }),
    questionId: text('question_id')
      .notNull()
      .references(() => examQuestions.id, { onDelete: 'cascade' }),
    studentId: text('student_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    code: text('code').notNull(),
    status: submissionStatusEnum('status').notNull().default('PENDING'),
    score: integer('score'),
    maxScore: integer('max_score'),
    testResults: text('test_results'),
    submittedAt: timestamp('submitted_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    sessionIdx: index('eq_sub_session_idx').on(table.examSessionId),
    questionIdx: index('eq_sub_question_idx').on(table.questionId),
    studentIdx: index('eq_sub_student_idx').on(table.studentId),
    uniqueSubmission: uniqueIndex('eq_sub_unique_idx').on(table.examSessionId, table.questionId),
  })
);

// Defines relationships
export const usersRelations = relations(users, ({ many }) => ({
  files: many(files),
  taughtClasses: many(classes),
  classMembers: many(classMembers),
  grades: many(grades),
  assignments: many(assignments),
  submissions: many(submissions),
}));

export const filesRelations = relations(files, ({ one, many }) => ({
  user: one(users, {
    fields: [files.userId],
    references: [users.id],
  }),
  parent: one(files, {
    fields: [files.parentId],
    references: [files.id],
    relationName: 'fileHierarchy',
  }),
  children: many(files, {
    relationName: 'fileHierarchy',
  }),
  collaborationState: one(collaborationStates, {
    fields: [files.id],
    references: [collaborationStates.fileId],
  }),
}));

export const classesRelations = relations(classes, ({ one, many }) => ({
  teacher: one(users, {
    fields: [classes.teacherId],
    references: [users.id],
  }),
  members: many(classMembers),
  grades: many(grades),
  assignments: many(assignments),
}));

export const classMembersRelations = relations(classMembers, ({ one }) => ({
  class: one(classes, {
    fields: [classMembers.classId],
    references: [classes.id],
  }),
  student: one(users, {
    fields: [classMembers.studentId],
    references: [users.id],
  }),
}));

export const gradesRelations = relations(grades, ({ one }) => ({
  student: one(users, {
    fields: [grades.studentId],
    references: [users.id],
  }),
  class: one(classes, {
    fields: [grades.classId],
    references: [classes.id],
  }),
}));

export const assignmentsRelations = relations(assignments, ({ one, many }) => ({
  class: one(classes, {
    fields: [assignments.classId],
    references: [classes.id],
  }),
  teacher: one(users, {
    fields: [assignments.teacherId],
    references: [users.id],
  }),
  testCases: many(testCases),
  submissions: many(submissions),
}));

export const testCasesRelations = relations(testCases, ({ one }) => ({
  assignment: one(assignments, {
    fields: [testCases.assignmentId],
    references: [assignments.id],
  }),
}));

export const submissionsRelations = relations(submissions, ({ one }) => ({
  assignment: one(assignments, {
    fields: [submissions.assignmentId],
    references: [assignments.id],
  }),
  student: one(users, {
    fields: [submissions.studentId],
    references: [users.id],
  }),
}));

export const collaborationStatesRelations = relations(collaborationStates, ({ one }) => ({
  file: one(files, {
    fields: [collaborationStates.fileId],
    references: [files.id],
  }),
}));

export const fileSharesRelations = relations(fileShares, ({ one }) => ({
  file: one(files, { fields: [fileShares.fileId], references: [files.id] }),
  owner: one(users, { fields: [fileShares.ownerId], references: [users.id] }),
}));

export const examsRelations = relations(exams, ({ one, many }) => ({
  class: one(classes, {
    fields: [exams.classId],
    references: [classes.id],
  }),
  teacher: one(users, {
    fields: [exams.teacherId],
    references: [users.id],
  }),
  questions: many(examQuestions),
  sessions: many(examSessions),
}));

export const examQuestionsRelations = relations(examQuestions, ({ one, many }) => ({
  exam: one(exams, {
    fields: [examQuestions.examId],
    references: [exams.id],
  }),
  testCases: many(examTestCases),
}));

export const examTestCasesRelations = relations(examTestCases, ({ one }) => ({
  question: one(examQuestions, {
    fields: [examTestCases.questionId],
    references: [examQuestions.id],
  }),
}));

export const examSessionsRelations = relations(examSessions, ({ one }) => ({
  exam: one(exams, {
    fields: [examSessions.examId],
    references: [exams.id],
  }),
  student: one(users, {
    fields: [examSessions.studentId],
    references: [users.id],
  }),
}));

export const examQuestionSubmissionsRelations = relations(examQuestionSubmissions, ({ one }) => ({
  session: one(examSessions, {
    fields: [examQuestionSubmissions.examSessionId],
    references: [examSessions.id],
  }),
  question: one(examQuestions, {
    fields: [examQuestionSubmissions.questionId],
    references: [examQuestions.id],
  }),
  student: one(users, {
    fields: [examQuestionSubmissions.studentId],
    references: [users.id],
  }),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type File = typeof files.$inferSelect;
export type NewFile = typeof files.$inferInsert;
export type Class = typeof classes.$inferSelect;
export type NewClass = typeof classes.$inferInsert;
export type ClassMember = typeof classMembers.$inferSelect;
export type NewClassMember = typeof classMembers.$inferInsert;
export type Grade = typeof grades.$inferSelect;
export type NewGrade = typeof grades.$inferInsert;
export type Assignment = typeof assignments.$inferSelect;
export type NewAssignment = typeof assignments.$inferInsert;
export type TestCase = typeof testCases.$inferSelect;
export type NewTestCase = typeof testCases.$inferInsert;
export type Submission = typeof submissions.$inferSelect;
export type NewSubmission = typeof submissions.$inferInsert;
export type CollaborationState = typeof collaborationStates.$inferSelect;
export type NewCollaborationState = typeof collaborationStates.$inferInsert;
export type FileShare = typeof fileShares.$inferSelect;
export type NewFileShare = typeof fileShares.$inferInsert;
export type Exam = typeof exams.$inferSelect;
export type NewExam = typeof exams.$inferInsert;
export type ExamQuestion = typeof examQuestions.$inferSelect;
export type NewExamQuestion = typeof examQuestions.$inferInsert;
export type ExamTestCase = typeof examTestCases.$inferSelect;
export type NewExamTestCase = typeof examTestCases.$inferInsert;
export type ExamSession = typeof examSessions.$inferSelect;
export type NewExamSession = typeof examSessions.$inferInsert;
export type ExamQuestionSubmission = typeof examQuestionSubmissions.$inferSelect;
export type NewExamQuestionSubmission = typeof examQuestionSubmissions.$inferInsert;
