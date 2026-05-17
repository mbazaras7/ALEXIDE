import db from '../db';
import { submissions, grades, assignments, users } from '../db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import type { SubmissionData, StudentSubmissionData } from '../types/submission';

// ─── Types ────────────────────────────────────────────────────────────────────

type SubmissionRow = typeof submissions.$inferSelect;

type SubmissionWithStudentRow = Omit<SubmissionRow, never> & {
  student: { id: string; name: string | null; email: string };
};

type SubmissionWithGradeRow = Pick<
  SubmissionRow,
  | 'id'
  | 'assignmentId'
  | 'studentId'
  | 'code'
  | 'status'
  | 'score'
  | 'maxScore'
  | 'testResults'
  | 'submittedAt'
  | 'updatedAt'
  | 'feedback'
  | 'feedbackUpdatedAt'
  | 'aiFeedback'
  | 'aiFeedbackGeneratedAt'
> & { gradeReleasedAt: Date | null };

const submissionCols = {
  id: submissions.id,
  assignmentId: submissions.assignmentId,
  studentId: submissions.studentId,
  code: submissions.code,
  status: submissions.status,
  score: submissions.score,
  maxScore: submissions.maxScore,
  testResults: submissions.testResults,
  submittedAt: submissions.submittedAt,
  updatedAt: submissions.updatedAt,
  feedback: submissions.feedback,
  feedbackUpdatedAt: submissions.feedbackUpdatedAt,
  aiFeedback: submissions.aiFeedback,
  aiFeedbackGeneratedAt: submissions.aiFeedbackGeneratedAt,
};

export class SubmissionRepository {
  //Student queries

  async findByStudentAndAssignment(
    studentId: string,
    assignmentId: string
  ): Promise<StudentSubmissionData | null> {
    const [row] = await db
      .select()
      .from(submissions)
      .where(and(eq(submissions.studentId, studentId), eq(submissions.assignmentId, assignmentId)));
    return row ? this.toStudentView(row) : null;
  }

  async findById(submissionId: string, studentId: string): Promise<StudentSubmissionData | null> {
    const [row] = await db
      .select()
      .from(submissions)
      .where(and(eq(submissions.id, submissionId), eq(submissions.studentId, studentId)));
    return row ? this.toStudentView(row) : null;
  }

  async findByStudentAndAssignments(
    studentId: string,
    assignmentIds: string[]
  ): Promise<StudentSubmissionData[]> {
    if (assignmentIds.length === 0) return [];
    const rows = await db
      .select()
      .from(submissions)
      .where(
        and(inArray(submissions.assignmentId, assignmentIds), eq(submissions.studentId, studentId))
      )
      .orderBy(submissions.submittedAt);
    return rows.map((r) => this.toStudentView(r));
  }

  async findWithReleasedFeedback(
    submissionId: string,
    studentId: string
  ): Promise<StudentSubmissionData | null> {
    const [row] = await db
      .select({
        id: submissions.id,
        assignmentId: submissions.assignmentId,
        studentId: submissions.studentId,
        code: submissions.code,
        status: submissions.status,
        score: submissions.score,
        maxScore: submissions.maxScore,
        testResults: submissions.testResults,
        submittedAt: submissions.submittedAt,
        updatedAt: submissions.updatedAt,
        feedback: submissions.feedback,
        feedbackUpdatedAt: submissions.feedbackUpdatedAt,
        gradeReleasedAt: grades.releasedAt,
      })
      .from(submissions)
      .leftJoin(
        grades,
        and(
          eq(grades.sourceId, submissions.assignmentId),
          eq(grades.studentId, submissions.studentId),
          eq(grades.sourceType, 'ASSIGNMENT')
        )
      )
      .where(and(eq(submissions.id, submissionId), eq(submissions.studentId, studentId)));

    if (!row) return null;

    const gradeReleased = row.gradeReleasedAt !== null;
    return {
      id: row.id,
      assignmentId: row.assignmentId,
      code: row.code,
      status: row.status,
      score: row.score,
      maxScore: row.maxScore,
      testResults: row.testResults
        ? (JSON.parse(row.testResults as string) as ReturnType<typeof JSON.parse>)
        : null,
      submittedAt: row.submittedAt,
      updatedAt: row.updatedAt,
      feedback: gradeReleased ? row.feedback : null,
      feedbackUpdatedAt: gradeReleased ? row.feedbackUpdatedAt : null,
    };
  }

  //Teacher queries

  async findByAssignment(assignmentId: string): Promise<SubmissionData[]> {
    const rows = await db
      .select({
        ...submissionCols,
        student: { id: users.id, name: users.name, email: users.email },
      })
      .from(submissions)
      .innerJoin(users, eq(users.id, submissions.studentId))
      .where(eq(submissions.assignmentId, assignmentId))
      .orderBy(submissions.submittedAt);
    return rows.map((r) => this.parse(r));
  }

  async findByIdAsTeacher(submissionId: string, teacherId: string): Promise<SubmissionData | null> {
    const [row] = await db
      .select(submissionCols)
      .from(submissions)
      .innerJoin(assignments, eq(assignments.id, submissions.assignmentId))
      .where(and(eq(submissions.id, submissionId), eq(assignments.teacherId, teacherId)));
    return row ? this.parse(row) : null;
  }

  async findByAssignmentIds(assignmentIds: string[]): Promise<SubmissionData[]> {
    if (assignmentIds.length === 0) return [];
    const rows = await db
      .select({
        ...submissionCols,
        student: { id: users.id, name: users.name, email: users.email },
      })
      .from(submissions)
      .innerJoin(users, eq(users.id, submissions.studentId))
      .where(inArray(submissions.assignmentId, assignmentIds))
      .orderBy(submissions.submittedAt);
    return rows.map((r) => this.parse(r));
  }

  async findRawById(submissionId: string): Promise<SubmissionData | null> {
    const [row] = await db.select().from(submissions).where(eq(submissions.id, submissionId));
    return row ? this.parse(row) : null;
  }

  async findRawByAssignment(assignmentId: string): Promise<SubmissionData[]> {
    const rows = await db
      .select()
      .from(submissions)
      .where(eq(submissions.assignmentId, assignmentId));
    return rows.map((r) => this.parse(r));
  }

  //Mutations

  async upsert(assignmentId: string, studentId: string, code: string): Promise<SubmissionData> {
    const [row] = await db
      .insert(submissions)
      .values({ assignmentId, studentId, code, status: 'PENDING' })
      .onConflictDoUpdate({
        target: [submissions.studentId, submissions.assignmentId],
        set: { code, status: 'PENDING', updatedAt: new Date() },
      })
      .returning();
    return this.parse(row);
  }

  async updateResult(
    submissionId: string,
    data: {
      status: 'COMPLETED' | 'FAILED';
      score: number;
      maxScore: number;
      testResults: unknown;
    }
  ): Promise<void> {
    await db
      .update(submissions)
      .set({
        status: data.status,
        score: data.score,
        maxScore: data.maxScore,
        testResults: JSON.stringify(data.testResults),
        updatedAt: new Date(),
      })
      .where(eq(submissions.id, submissionId));
  }

  async setStatus(submissionId: string, status: 'RUNNING' | 'FAILED' | 'PENDING'): Promise<void> {
    await db
      .update(submissions)
      .set({ status, updatedAt: new Date() })
      .where(eq(submissions.id, submissionId));
  }

  async saveFeedback(submissionId: string, feedback: string): Promise<SubmissionData | null> {
    const [updated] = await db
      .update(submissions)
      .set({ feedback, feedbackUpdatedAt: new Date(), updatedAt: new Date() })
      .where(eq(submissions.id, submissionId))
      .returning();
    return updated ? this.parse(updated) : null;
  }

  async saveAiFeedback(submissionId: string, aiFeedback: string): Promise<void> {
    await db
      .update(submissions)
      .set({ aiFeedback, aiFeedbackGeneratedAt: new Date(), updatedAt: new Date() })
      .where(eq(submissions.id, submissionId));
  }

  async adoptAiFeedback(submissionId: string): Promise<SubmissionData | null> {
    const [submission] = await db
      .select()
      .from(submissions)
      .where(eq(submissions.id, submissionId));
    if (!submission?.aiFeedback) return null;

    const [updated] = await db
      .update(submissions)
      .set({
        feedback: submission.aiFeedback,
        feedbackUpdatedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(submissions.id, submissionId))
      .returning();
    return updated ? this.parse(updated) : null;
  }

  //Private helpers

  private parse(
    row: SubmissionRow | SubmissionWithStudentRow | SubmissionWithGradeRow
  ): SubmissionData {
    return {
      ...row,
      testResults: row.testResults
        ? (JSON.parse(row.testResults as string) as ReturnType<typeof JSON.parse>)
        : null,
    };
  }

  private toStudentView(row: SubmissionRow): StudentSubmissionData {
    const parsed = this.parse(row);
    return {
      id: parsed.id,
      assignmentId: parsed.assignmentId,
      code: parsed.code,
      status: parsed.status,
      score: parsed.score,
      maxScore: parsed.maxScore,
      testResults: parsed.testResults,
      submittedAt: parsed.submittedAt,
      updatedAt: parsed.updatedAt,
      feedback: parsed.feedback ?? null,
      feedbackUpdatedAt: parsed.feedbackUpdatedAt ?? null,
    };
  }
}

export const submissionRepository = new SubmissionRepository();
