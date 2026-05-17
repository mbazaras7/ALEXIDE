import db from '../db';
import { submissions, assignments, grades } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import type {
  SubmissionForGrading,
  AssignmentForGrading,
  SubmissionWithAssignment,
  UpsertGradeData,
  UpdateSubmissionResultData,
} from '../types/grading';

export class GradingRepository {
  //Queries

  async findSubmissionById(submissionId: string): Promise<SubmissionForGrading | null> {
    const [row] = await db.select().from(submissions).where(eq(submissions.id, submissionId));
    return row ?? null;
  }

  async findSubmissionWithAssignment(
    submissionId: string
  ): Promise<SubmissionWithAssignment | null> {
    const [row] = await db
      .select({
        id: submissions.id,
        assignmentId: submissions.assignmentId,
        status: submissions.status,
      })
      .from(submissions)
      .innerJoin(assignments, eq(assignments.id, submissions.assignmentId))
      .where(eq(submissions.id, submissionId));
    return row ?? null;
  }

  async findAssignmentById(assignmentId: string): Promise<AssignmentForGrading | null> {
    const [row] = await db.select().from(assignments).where(eq(assignments.id, assignmentId));
    return row ?? null;
  }

  async findAssignmentByIdAndTeacher(
    assignmentId: string,
    teacherId: string
  ): Promise<AssignmentForGrading | null> {
    const [row] = await db
      .select()
      .from(assignments)
      .where(and(eq(assignments.id, assignmentId), eq(assignments.teacherId, teacherId)));
    return row ?? null;
  }

  //Mutations

  async setSubmissionRunning(submissionId: string): Promise<void> {
    await db
      .update(submissions)
      .set({ status: 'RUNNING', updatedAt: new Date() })
      .where(eq(submissions.id, submissionId));
  }

  async updateSubmissionResult(
    submissionId: string,
    data: UpdateSubmissionResultData
  ): Promise<void> {
    await db
      .update(submissions)
      .set({
        status: data.status,
        score: data.score,
        maxScore: data.maxScore,
        testResults: data.testResults,
        updatedAt: new Date(),
      })
      .where(eq(submissions.id, submissionId));
  }

  async setSubmissionFailed(submissionId: string): Promise<void> {
    await db
      .update(submissions)
      .set({ status: 'FAILED', updatedAt: new Date() })
      .where(eq(submissions.id, submissionId));
  }

  async upsertGrade(data: UpsertGradeData): Promise<void> {
    await db
      .insert(grades)
      .values({
        studentId: data.studentId,
        classId: data.classId,
        sourceType: 'ASSIGNMENT',
        sourceId: data.sourceId,
        score: data.score,
        maxScore: data.maxScore,
      })
      .onConflictDoUpdate({
        target: [grades.studentId, grades.sourceId, grades.sourceType],
        set: {
          score: data.score,
          maxScore: data.maxScore,
          updatedAt: new Date(),
        },
      });
  }
}

export const gradingRepository = new GradingRepository();
