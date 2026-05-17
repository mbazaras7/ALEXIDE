import db from '../db';
import { assignments, testCases, classes } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import type {
  AssignmentData,
  AssignmentWithTestCases,
  TestCaseData,
  AssignmentStatus,
} from '../types/assignment';

//Types

type AssignmentRow = typeof assignments.$inferSelect;
type TestCaseRow = typeof testCases.$inferSelect;

export class AssignmentRepository {
  //Assignments

  async create(data: {
    classId: string;
    teacherId: string;
    title: string;
    description?: string;
    dueDate?: Date;
    maxScore?: number;
    language?: string;
    status?: AssignmentStatus;
  }): Promise<AssignmentData> {
    const [row] = await db
      .insert(assignments)
      .values({
        classId: data.classId,
        teacherId: data.teacherId,
        title: data.title,
        description: data.description ?? null,
        dueDate: data.dueDate ?? null,
        maxScore: data.maxScore ?? 100,
        language: data.language ?? 'python',
        status: data.status ?? 'DRAFT',
      })
      .returning();

    return this.mapToAssignmentData(row);
  }

  async findById(assignmentId: string): Promise<AssignmentData | null> {
    const [row] = await db.select().from(assignments).where(eq(assignments.id, assignmentId));

    return row ? this.mapToAssignmentData(row) : null;
  }

  async findByIdAndTeacher(
    assignmentId: string,
    teacherId: string
  ): Promise<AssignmentData | null> {
    const [row] = await db
      .select()
      .from(assignments)
      .where(and(eq(assignments.id, assignmentId), eq(assignments.teacherId, teacherId)));
    return row ? this.mapToAssignmentData(row) : null;
  }

  async findByIdAndClass(assignmentId: string, classId: string): Promise<AssignmentData | null> {
    const [row] = await db
      .select()
      .from(assignments)
      .where(and(eq(assignments.id, assignmentId), eq(assignments.classId, classId)));
    return row ? this.mapToAssignmentData(row) : null;
  }

  async findByIdWithTestCases(assignmentId: string): Promise<AssignmentWithTestCases | null> {
    const [assignment] = await db
      .select()
      .from(assignments)
      .where(eq(assignments.id, assignmentId));
    if (!assignment) return null;

    const cases = await this.fetchTestCases(assignmentId);
    return { ...this.mapToAssignmentData(assignment), testCases: cases };
  }

  async findByIdWithTestCasesAndTeacher(
    assignmentId: string,
    teacherId: string
  ): Promise<AssignmentWithTestCases | null> {
    const [assignment] = await db
      .select()
      .from(assignments)
      .where(and(eq(assignments.id, assignmentId), eq(assignments.teacherId, teacherId)));
    if (!assignment) return null;

    const cases = await this.fetchTestCases(assignmentId);
    return { ...this.mapToAssignmentData(assignment), testCases: cases };
  }

  async findAllByClass(classId: string): Promise<AssignmentData[]> {
    const rows = await db
      .select()
      .from(assignments)
      .where(eq(assignments.classId, classId))
      .orderBy(assignments.createdAt);
    return rows.map((r) => this.mapToAssignmentData(r));
  }

  async findAllByClassAndTeacher(classId: string, teacherId: string): Promise<AssignmentData[]> {
    const rows = await db
      .select()
      .from(assignments)
      .where(and(eq(assignments.classId, classId), eq(assignments.teacherId, teacherId)))
      .orderBy(assignments.createdAt);
    return rows.map((r) => this.mapToAssignmentData(r));
  }

  async findAllByClassWithClassName(
    classId: string
  ): Promise<(AssignmentData & { className: string })[]> {
    const rows = await db
      .select({
        id: assignments.id,
        classId: assignments.classId,
        teacherId: assignments.teacherId,
        title: assignments.title,
        description: assignments.description,
        dueDate: assignments.dueDate,
        maxScore: assignments.maxScore,
        language: assignments.language,
        status: assignments.status,
        createdAt: assignments.createdAt,
        updatedAt: assignments.updatedAt,
        className: classes.name,
      })
      .from(assignments)
      .innerJoin(classes, eq(classes.id, assignments.classId))
      .where(eq(assignments.classId, classId))
      .orderBy(assignments.createdAt);
    return rows.map((row) => ({ ...this.mapToAssignmentData(row), className: row.className }));
  }

  async findIdsByClass(classId: string): Promise<string[]> {
    const rows = await db
      .select({ id: assignments.id })
      .from(assignments)
      .where(eq(assignments.classId, classId));
    return rows.map((r) => r.id);
  }

  async update(
    assignmentId: string,
    teacherId: string,
    data: {
      title?: string;
      description?: string;
      dueDate?: Date | null;
      maxScore?: number;
      language?: string;
      status?: AssignmentStatus;
    }
  ): Promise<AssignmentData | null> {
    const [updated] = await db
      .update(assignments)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(assignments.id, assignmentId), eq(assignments.teacherId, teacherId)))
      .returning();
    return updated ? this.mapToAssignmentData(updated) : null;
  }

  async delete(assignmentId: string, teacherId: string): Promise<boolean> {
    const result = await db
      .delete(assignments)
      .where(and(eq(assignments.id, assignmentId), eq(assignments.teacherId, teacherId)))
      .returning();
    return result.length > 0;
  }

  //Test Cases

  async addTestCase(data: {
    assignmentId: string;
    name: string;
    inputData?: string;
    expectedOutput: string;
    sysArgs?: string[];
    weight?: number;
    orderIndex?: number;
  }): Promise<TestCaseData> {
    const [row] = await db
      .insert(testCases)
      .values({
        assignmentId: data.assignmentId,
        name: data.name,
        inputData: data.inputData ?? null,
        expectedOutput: data.expectedOutput,
        sysArgs: data.sysArgs ? JSON.stringify(data.sysArgs) : null,
        weight: data.weight ?? 1,
        orderIndex: data.orderIndex ?? 0,
      })
      .returning();

    return this.mapToTestCaseData(row);
  }

  async findTestCaseById(testCaseId: string): Promise<TestCaseData | null> {
    const [row] = await db.select().from(testCases).where(eq(testCases.id, testCaseId));

    return row ? this.mapToTestCaseData(row) : null;
  }

  async findTestCasesByAssignment(assignmentId: string): Promise<TestCaseData[]> {
    return this.fetchTestCases(assignmentId);
  }

  async updateTestCase(
    testCaseId: string,
    data: {
      name?: string;
      inputData?: string | null;
      expectedOutput?: string;
      sysArgs?: string[] | null;
      weight?: number;
      orderIndex?: number;
    }
  ): Promise<TestCaseData | null> {
    const { sysArgs, ...rest } = data;
    const [updated] = await db
      .update(testCases)
      .set({
        ...rest,
        ...(sysArgs !== undefined && { sysArgs: sysArgs ? JSON.stringify(sysArgs) : null }),
        updatedAt: new Date(),
      })
      .where(eq(testCases.id, testCaseId))
      .returning();

    return updated ? this.mapToTestCaseData(updated) : null;
  }

  async deleteTestCase(testCaseId: string): Promise<boolean> {
    const result = await db.delete(testCases).where(eq(testCases.id, testCaseId)).returning();

    return result.length > 0;
  }

  async deleteAllTestCases(assignmentId: string): Promise<number> {
    const result = await db
      .delete(testCases)
      .where(eq(testCases.assignmentId, assignmentId))
      .returning();
    return result.length;
  }

  //Private helpers

  private async fetchTestCases(assignmentId: string): Promise<TestCaseData[]> {
    const rows = await db
      .select()
      .from(testCases)
      .where(eq(testCases.assignmentId, assignmentId))
      .orderBy(testCases.orderIndex, testCases.createdAt);
    return rows.map((r) => this.mapToTestCaseData(r));
  }

  private mapToAssignmentData(row: AssignmentRow & { className?: string }): AssignmentData {
    return {
      id: row.id,
      classId: row.classId,
      teacherId: row.teacherId,
      title: row.title,
      description: row.description,
      dueDate: row.dueDate,
      maxScore: row.maxScore,
      language: row.language,
      status: row.status,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private mapToTestCaseData(row: TestCaseRow): TestCaseData {
    return {
      id: row.id,
      assignmentId: row.assignmentId,
      name: row.name,
      inputData: row.inputData,
      expectedOutput: row.expectedOutput,
      sysArgs: row.sysArgs ? (JSON.parse(row.sysArgs as string) as string[]) : null,
      weight: row.weight,
      orderIndex: row.orderIndex,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}

export const assignmentRepository = new AssignmentRepository();
