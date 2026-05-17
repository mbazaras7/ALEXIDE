import db from '../db';
import { grades, users, classes } from '../db/schema';
import { eq, and, isNotNull } from 'drizzle-orm';
import type { GradeData, GradeWithStudent, GradeWithClass, SourceType } from '../types/grade';

//Types

type GradeRow = typeof grades.$inferSelect;

type GradeWithStudentRow = GradeRow & {
  studentName: string | null;
  studentEmail: string;
};

type GradeWithClassRow = GradeRow & {
  className: string;
};

export class GradeRepository {
  //Teacher queries

  async findById(gradeId: string): Promise<GradeData | null> {
    const [row] = await db.select().from(grades).where(eq(grades.id, gradeId));

    return row ? this.mapToGradeData(row) : null;
  }

  async findBySource(
    sourceId: string,
    sourceType: SourceType,
    classId: string
  ): Promise<GradeWithStudent[]> {
    const rows = await db
      .select(this.gradeWithStudentCols())
      .from(grades)
      .innerJoin(users, eq(users.id, grades.studentId))
      .where(
        and(
          eq(grades.sourceId, sourceId),
          eq(grades.sourceType, sourceType),
          eq(grades.classId, classId)
        )
      )
      .orderBy(users.name);
    return rows.map((row) => this.toGradeWithStudent(row));
  }

  async findByClass(classId: string): Promise<GradeWithStudent[]> {
    const rows = await db
      .select(this.gradeWithStudentCols())
      .from(grades)
      .innerJoin(users, eq(users.id, grades.studentId))
      .where(eq(grades.classId, classId))
      .orderBy(users.name, grades.sourceType, grades.sourceId);
    return rows.map((row) => this.toGradeWithStudent(row));
  }

  async findByClassAndStudent(classId: string, studentId: string): Promise<GradeWithStudent[]> {
    const rows = await db
      .select(this.gradeWithStudentCols())
      .from(grades)
      .innerJoin(users, eq(users.id, grades.studentId))
      .where(and(eq(grades.classId, classId), eq(grades.studentId, studentId)))
      .orderBy(grades.sourceType, grades.createdAt);
    return rows.map((row) => this.toGradeWithStudent(row));
  }

  async findByStudentAndSource(
    studentId: string,
    sourceId: string,
    sourceType: SourceType
  ): Promise<GradeData | null> {
    const [row] = await db
      .select()
      .from(grades)
      .where(
        and(
          eq(grades.studentId, studentId),
          eq(grades.sourceId, sourceId),
          eq(grades.sourceType, sourceType)
        )
      );

    return row ? this.mapToGradeData(row) : null;
  }

  //Teacher mutations

  async create(data: {
    studentId: string;
    classId: string;
    sourceType: SourceType;
    sourceId: string;
    score: number;
    maxScore: number;
  }): Promise<GradeData> {
    const [row] = await db
      .insert(grades)
      .values({
        studentId: data.studentId,
        classId: data.classId,
        sourceType: data.sourceType,
        sourceId: data.sourceId,
        score: data.score,
        maxScore: data.maxScore,
      })
      .returning();
    return this.mapToGradeData(row);
  }

  async update(
    gradeId: string,
    data: { score?: number; maxScore?: number }
  ): Promise<GradeData | null> {
    const [updated] = await db
      .update(grades)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(grades.id, gradeId))
      .returning();

    return updated ? this.mapToGradeData(updated) : null;
  }

  async delete(gradeId: string): Promise<boolean> {
    const result = await db.delete(grades).where(eq(grades.id, gradeId)).returning();

    return result.length > 0;
  }

  async releaseGrades(sourceId: string, sourceType: SourceType, classId: string): Promise<number> {
    const result = await db
      .update(grades)
      .set({ releasedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(grades.sourceId, sourceId),
          eq(grades.sourceType, sourceType),
          eq(grades.classId, classId)
        )
      )
      .returning();

    return result.length;
  }

  //Student queries

  async findReleasedByStudent(studentId: string): Promise<GradeWithClass[]> {
    const rows = await db
      .select(this.gradeWithClassCols())
      .from(grades)
      .innerJoin(classes, eq(classes.id, grades.classId))
      .where(and(eq(grades.studentId, studentId), isNotNull(grades.releasedAt)))
      .orderBy(grades.releasedAt);
    return rows.map((row) => ({
      ...this.mapToGradeData(row),
      class: { id: row.classId, name: row.className },
    }));
  }

  //All grades for a student in a specific class
  async findReleasedByStudentAndClass(studentId: string, classId: string): Promise<GradeData[]> {
    const rows = await db
      .select()
      .from(grades)
      .where(
        and(
          eq(grades.studentId, studentId),
          eq(grades.classId, classId),
          isNotNull(grades.releasedAt)
        )
      )
      .orderBy(grades.sourceType, grades.sourceId);
    return rows.map((r) => this.mapToGradeData(r));
  }

  async findReleasedByIdAndStudent(
    gradeId: string,
    studentId: string
  ): Promise<GradeWithClass | null> {
    const [row] = await db
      .select(this.gradeWithClassCols())
      .from(grades)
      .innerJoin(classes, eq(classes.id, grades.classId))
      .where(
        and(eq(grades.id, gradeId), eq(grades.studentId, studentId), isNotNull(grades.releasedAt))
      );
    if (!row) return null;
    return {
      ...this.mapToGradeData(row),
      class: { id: row.classId, name: row.className },
    };
  }

  //Released grades filtered by sourceType for a student in a class
  async findReleasedByStudentClassAndType(
    studentId: string,
    classId: string,
    sourceType: SourceType
  ): Promise<GradeData[]> {
    const rows = await db
      .select()
      .from(grades)
      .where(
        and(
          eq(grades.studentId, studentId),
          eq(grades.classId, classId),
          eq(grades.sourceType, sourceType),
          isNotNull(grades.releasedAt)
        )
      )
      .orderBy(grades.sourceId);
    return rows.map((r) => this.mapToGradeData(r));
  }

  //All released grades for a student to compute stats
  async findAllReleasedByStudentAndClass(studentId: string, classId: string): Promise<GradeData[]> {
    const rows = await db
      .select()
      .from(grades)
      .where(
        and(
          eq(grades.studentId, studentId),
          eq(grades.classId, classId),
          isNotNull(grades.releasedAt)
        )
      );
    return rows.map((r) => this.mapToGradeData(r));
  }

  //All released grades grouped by class for summary
  async findReleasedByStudentGroupedByClass(
    studentId: string
  ): Promise<(GradeData & { className: string })[]> {
    const rows = await db
      .select(this.gradeWithClassCols())
      .from(grades)
      .innerJoin(classes, eq(classes.id, grades.classId))
      .where(and(eq(grades.studentId, studentId), isNotNull(grades.releasedAt)))
      .orderBy(classes.name);
    return rows.map((row) => ({
      ...this.mapToGradeData(row),
      className: row.className,
    }));
  }

  //Private helpers

  private gradeWithStudentCols() {
    return {
      id: grades.id,
      studentId: grades.studentId,
      classId: grades.classId,
      sourceType: grades.sourceType,
      sourceId: grades.sourceId,
      score: grades.score,
      maxScore: grades.maxScore,
      releasedAt: grades.releasedAt,
      createdAt: grades.createdAt,
      updatedAt: grades.updatedAt,
      studentName: users.name,
      studentEmail: users.email,
    };
  }

  private gradeWithClassCols() {
    return {
      id: grades.id,
      studentId: grades.studentId,
      classId: grades.classId,
      sourceType: grades.sourceType,
      sourceId: grades.sourceId,
      score: grades.score,
      maxScore: grades.maxScore,
      releasedAt: grades.releasedAt,
      createdAt: grades.createdAt,
      updatedAt: grades.updatedAt,
      className: classes.name,
    };
  }

  private mapToGradeData(row: GradeRow | GradeWithStudentRow | GradeWithClassRow): GradeData {
    return {
      id: row.id,
      studentId: row.studentId,
      classId: row.classId,
      sourceType: row.sourceType,
      sourceId: row.sourceId,
      score: row.score,
      maxScore: row.maxScore,
      percentage: Math.round((row.score / row.maxScore) * 100 * 100) / 100,
      releasedAt: row.releasedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private toGradeWithStudent(row: GradeWithStudentRow): GradeWithStudent {
    return {
      ...this.mapToGradeData(row),
      student: { id: row.studentId, name: row.studentName, email: row.studentEmail },
    };
  }
}

export const gradeRepository = new GradeRepository();
