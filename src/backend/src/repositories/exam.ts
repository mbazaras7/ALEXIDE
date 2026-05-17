import db from '../db';
import { exams, examQuestions, examTestCases, examSessions } from '../db/schema';
import { eq, and, gt } from 'drizzle-orm';
import type {
  ExamData,
  ExamWithQuestions,
  ExamQuestionData,
  ExamQuestionWithTestCases,
  ExamTestCaseData,
  ExamSessionData,
  ExamStatus,
} from '../types/exam';

//Types

type ExamRow = typeof exams.$inferSelect;
type QuestionRow = typeof examQuestions.$inferSelect;
type TestCaseRow = typeof examTestCases.$inferSelect;
type SessionRow = typeof examSessions.$inferSelect;

export class ExamRepository {
  //Exams

  async create(data: {
    classId: string;
    teacherId: string;
    title: string;
    instructions?: string;
    language?: string;
    durationMinutes?: number;
    scheduledStart?: Date;
    scheduledEnd?: Date;
    maxScore?: number;
    status?: ExamStatus;
    isOpenBook?: boolean;
  }): Promise<ExamData> {
    const [row] = await db
      .insert(exams)
      .values({
        classId: data.classId,
        teacherId: data.teacherId,
        title: data.title,
        instructions: data.instructions ?? null,
        language: data.language ?? 'python',
        durationMinutes: data.durationMinutes ?? 60,
        scheduledStart: data.scheduledStart ?? null,
        scheduledEnd: data.scheduledEnd ?? null,
        maxScore: data.maxScore ?? 100,
        status: data.status ?? 'DRAFT',
        isOpenBook: data.isOpenBook ?? false,
      })
      .returning();
    return this.mapToExamData(row);
  }

  async findById(examId: string): Promise<ExamData | null> {
    const [row] = await db.select().from(exams).where(eq(exams.id, examId));
    return row ? this.mapToExamData(row) : null;
  }

  async findByIdAndTeacher(examId: string, teacherId: string): Promise<ExamData | null> {
    const [row] = await db
      .select()
      .from(exams)
      .where(and(eq(exams.id, examId), eq(exams.teacherId, teacherId)));
    return row ? this.mapToExamData(row) : null;
  }

  async findByIdWithQuestions(examId: string): Promise<ExamWithQuestions | null> {
    const [exam] = await db.select().from(exams).where(eq(exams.id, examId));
    if (!exam) return null;

    const questions = await db
      .select()
      .from(examQuestions)
      .where(eq(examQuestions.examId, examId))
      .orderBy(examQuestions.orderIndex, examQuestions.createdAt);

    const questionsWithCases: ExamQuestionWithTestCases[] = await Promise.all(
      questions.map(async (q) => {
        const cases = await db
          .select()
          .from(examTestCases)
          .where(eq(examTestCases.questionId, q.id))
          .orderBy(examTestCases.orderIndex, examTestCases.createdAt);
        return {
          ...this.mapToQuestionData(q),
          testCases: cases.map((c) => this.mapToTestCaseData(c)),
        };
      })
    );

    return { ...this.mapToExamData(exam), questions: questionsWithCases };
  }

  async findAllByClass(classId: string): Promise<ExamData[]> {
    const rows = await db
      .select()
      .from(exams)
      .where(eq(exams.classId, classId))
      .orderBy(exams.createdAt);
    return rows.map((r) => this.mapToExamData(r));
  }

  async findAllByClassAndTeacher(classId: string, teacherId: string): Promise<ExamData[]> {
    const rows = await db
      .select()
      .from(exams)
      .where(and(eq(exams.classId, classId), eq(exams.teacherId, teacherId)))
      .orderBy(exams.createdAt);
    return rows.map((r) => this.mapToExamData(r));
  }

  async update(
    examId: string,
    teacherId: string,
    data: {
      title?: string;
      instructions?: string | null;
      language?: string;
      durationMinutes?: number;
      scheduledStart?: Date | null;
      scheduledEnd?: Date | null;
      maxScore?: number;
      status?: ExamStatus;
    }
  ): Promise<ExamData | null> {
    const [updated] = await db
      .update(exams)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(exams.id, examId), eq(exams.teacherId, teacherId)))
      .returning();
    return updated ? this.mapToExamData(updated) : null;
  }

  async delete(examId: string, teacherId: string): Promise<boolean> {
    const result = await db
      .delete(exams)
      .where(and(eq(exams.id, examId), eq(exams.teacherId, teacherId)))
      .returning();
    return result.length > 0;
  }

  //Questions

  async addQuestion(data: {
    examId: string;
    title: string;
    description?: string;
    maxScore?: number;
    language?: string;
    orderIndex?: number;
  }): Promise<ExamQuestionData> {
    const [row] = await db
      .insert(examQuestions)
      .values({
        examId: data.examId,
        title: data.title,
        description: data.description ?? null,
        maxScore: data.maxScore ?? 100,
        language: data.language ?? 'python',
        orderIndex: data.orderIndex ?? 0,
      })
      .returning();
    return this.mapToQuestionData(row);
  }

  async findQuestionById(questionId: string): Promise<ExamQuestionData | null> {
    const [row] = await db.select().from(examQuestions).where(eq(examQuestions.id, questionId));
    return row ? this.mapToQuestionData(row) : null;
  }

  async updateQuestion(
    questionId: string,
    data: {
      title?: string;
      description?: string | null;
      maxScore?: number;
      language?: string;
      orderIndex?: number;
    }
  ): Promise<ExamQuestionData | null> {
    const [updated] = await db
      .update(examQuestions)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(examQuestions.id, questionId))
      .returning();
    return updated ? this.mapToQuestionData(updated) : null;
  }

  async deleteQuestion(questionId: string): Promise<boolean> {
    const result = await db
      .delete(examQuestions)
      .where(eq(examQuestions.id, questionId))
      .returning();
    return result.length > 0;
  }

  //Test Cases

  async addTestCase(data: {
    questionId: string;
    name: string;
    inputData?: string;
    sysArgs?: string[];
    expectedOutput: string;
    weight?: number;
    orderIndex?: number;
  }): Promise<ExamTestCaseData> {
    const [row] = await db
      .insert(examTestCases)
      .values({
        questionId: data.questionId,
        name: data.name,
        inputData: data.inputData ?? null,
        sysArgs: data.sysArgs ? JSON.stringify(data.sysArgs) : null,
        expectedOutput: data.expectedOutput,
        weight: data.weight ?? 1,
        orderIndex: data.orderIndex ?? 0,
      })
      .returning();
    return this.mapToTestCaseData(row);
  }

  async updateTestCase(
    testCaseId: string,
    data: {
      name?: string;
      inputData?: string | null;
      sysArgs?: string[] | null;
      expectedOutput?: string;
      weight?: number;
      orderIndex?: number;
    }
  ): Promise<ExamTestCaseData | null> {
    const payload: Record<string, unknown> = { ...data, updatedAt: new Date() };
    if ('sysArgs' in data) {
      payload.sysArgs = data.sysArgs ? JSON.stringify(data.sysArgs) : null;
    }
    const [updated] = await db
      .update(examTestCases)
      .set(payload)
      .where(eq(examTestCases.id, testCaseId))
      .returning();
    return updated ? this.mapToTestCaseData(updated) : null;
  }

  async deleteTestCase(testCaseId: string): Promise<boolean> {
    const result = await db
      .delete(examTestCases)
      .where(eq(examTestCases.id, testCaseId))
      .returning();
    return result.length > 0;
  }

  //Sessions

  async createSession(data: {
    examId: string;
    studentId: string;
    expiresAt: Date;
  }): Promise<ExamSessionData> {
    const [row] = await db
      .insert(examSessions)
      .values({
        examId: data.examId,
        studentId: data.studentId,
        expiresAt: data.expiresAt,
      })
      .returning();
    return this.mapToSessionData(row);
  }

  async findSessionByExamAndStudent(
    examId: string,
    studentId: string
  ): Promise<ExamSessionData | null> {
    const [row] = await db
      .select()
      .from(examSessions)
      .where(and(eq(examSessions.examId, examId), eq(examSessions.studentId, studentId)));
    return row ? this.mapToSessionData(row) : null;
  }

  async findActiveSessionsByExam(examId: string): Promise<ExamSessionData[]> {
    const rows = await db
      .select()
      .from(examSessions)
      .where(
        and(
          eq(examSessions.examId, examId),
          eq(examSessions.isSubmitted, false),
          gt(examSessions.expiresAt, new Date())
        )
      );
    return rows.map((r) => this.mapToSessionData(r));
  }

  async findAllSessionsByExam(examId: string): Promise<ExamSessionData[]> {
    const rows = await db.select().from(examSessions).where(eq(examSessions.examId, examId));
    return rows.map((r) => this.mapToSessionData(r));
  }

  async findActiveSessionsByStudent(studentId: string): Promise<ExamSessionData[]> {
    const rows = await db
      .select()
      .from(examSessions)
      .where(and(eq(examSessions.studentId, studentId), eq(examSessions.isSubmitted, false)));
    return rows.map((r) => this.mapToSessionData(r));
  }

  async updateSession(
    examId: string,
    studentId: string,
    data: {
      isSubmitted?: boolean;
      submittedAt?: Date;
      tabSwitchCount?: number;
    }
  ): Promise<ExamSessionData | null> {
    const [updated] = await db
      .update(examSessions)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(examSessions.examId, examId), eq(examSessions.studentId, studentId)))
      .returning();
    return updated ? this.mapToSessionData(updated) : null;
  }

  //Private mappers

  private mapToExamData(row: ExamRow): ExamData {
    return {
      id: row.id,
      classId: row.classId,
      teacherId: row.teacherId,
      title: row.title,
      instructions: row.instructions,
      language: row.language,
      durationMinutes: row.durationMinutes,
      scheduledStart: row.scheduledStart,
      scheduledEnd: row.scheduledEnd,
      status: row.status,
      maxScore: row.maxScore,
      isOpenBook: row.isOpenBook,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private mapToQuestionData(row: QuestionRow): ExamQuestionData {
    return {
      id: row.id,
      examId: row.examId,
      title: row.title,
      description: row.description,
      maxScore: row.maxScore,
      language: row.language,
      orderIndex: row.orderIndex,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private mapToTestCaseData(row: TestCaseRow): ExamTestCaseData {
    return {
      id: row.id,
      questionId: row.questionId,
      name: row.name,
      inputData: row.inputData,
      sysArgs: row.sysArgs ? (JSON.parse(row.sysArgs as string) as string[]) : null,
      expectedOutput: row.expectedOutput,
      weight: row.weight,
      orderIndex: row.orderIndex,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private mapToSessionData(row: SessionRow): ExamSessionData {
    return {
      id: row.id,
      examId: row.examId,
      studentId: row.studentId,
      startedAt: row.startedAt,
      submittedAt: row.submittedAt,
      expiresAt: row.expiresAt,
      tabSwitchCount: row.tabSwitchCount,
      isSubmitted: row.isSubmitted,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}

export const examRepository = new ExamRepository();
