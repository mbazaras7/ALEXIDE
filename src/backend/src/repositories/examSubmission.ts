import db from '../db';
import { examQuestionSubmissions } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import type { ExamQuestionSubmissionData } from '../types/examSubmission';
import type { TestResult } from '../types/submission';

//Types

type SubmissionRow = typeof examQuestionSubmissions.$inferSelect;

export class ExamSubmissionRepository {
  //Queries

  async findById(id: string): Promise<ExamQuestionSubmissionData | null> {
    const [row] = await db
      .select()
      .from(examQuestionSubmissions)
      .where(eq(examQuestionSubmissions.id, id));
    return row ? this.parse(row) : null;
  }

  async findBySessionAndQuestion(
    examSessionId: string,
    questionId: string
  ): Promise<ExamQuestionSubmissionData | null> {
    const [row] = await db
      .select()
      .from(examQuestionSubmissions)
      .where(
        and(
          eq(examQuestionSubmissions.examSessionId, examSessionId),
          eq(examQuestionSubmissions.questionId, questionId)
        )
      );
    return row ? this.parse(row) : null;
  }

  async findBySession(examSessionId: string): Promise<ExamQuestionSubmissionData[]> {
    const rows = await db
      .select()
      .from(examQuestionSubmissions)
      .where(eq(examQuestionSubmissions.examSessionId, examSessionId));
    return rows.map((r) => this.parse(r));
  }

  //Mutations

  async upsert(data: {
    examSessionId: string;
    examId: string;
    questionId: string;
    studentId: string;
    code: string;
  }): Promise<ExamQuestionSubmissionData> {
    const [row] = await db
      .insert(examQuestionSubmissions)
      .values({
        examSessionId: data.examSessionId,
        examId: data.examId,
        questionId: data.questionId,
        studentId: data.studentId,
        code: data.code,
        status: 'PENDING',
      })
      .onConflictDoUpdate({
        target: [examQuestionSubmissions.examSessionId, examQuestionSubmissions.questionId],
        set: {
          code: data.code,
          status: 'PENDING',
          score: null,
          maxScore: null,
          testResults: null,
          updatedAt: new Date(),
        },
      })
      .returning();
    return this.parse(row);
  }

  async updateResult(
    id: string,
    data: {
      status: 'COMPLETED' | 'FAILED';
      score: number;
      maxScore: number;
      testResults: TestResult[];
    }
  ): Promise<ExamQuestionSubmissionData | null> {
    const [updated] = await db
      .update(examQuestionSubmissions)
      .set({
        status: data.status,
        score: data.score,
        maxScore: data.maxScore,
        testResults: JSON.stringify(data.testResults),
        updatedAt: new Date(),
      })
      .where(eq(examQuestionSubmissions.id, id))
      .returning();
    return updated ? this.parse(updated) : null;
  }

  //Private helpers

  private parse(row: SubmissionRow): ExamQuestionSubmissionData {
    return {
      id: row.id,
      examSessionId: row.examSessionId,
      examId: row.examId,
      questionId: row.questionId,
      studentId: row.studentId,
      code: row.code,
      status: row.status,
      score: row.score,
      maxScore: row.maxScore,
      testResults: row.testResults ? (JSON.parse(row.testResults as string) as TestResult[]) : null,
      submittedAt: row.submittedAt,
      updatedAt: row.updatedAt,
    };
  }
}

export const examSubmissionRepository = new ExamSubmissionRepository();
