import db from '../db';
import { classes, classMembers, users } from '../db/schema';
import { eq, and, count } from 'drizzle-orm';
import type {
  ClassData,
  ClassWithMemberCount,
  ClassWithMembers,
  ClassMemberData,
  StudentClassData,
  ClassStudentList,
} from '../types/class';

//Types

type ClassRow = typeof classes.$inferSelect;

type MemberRow = {
  id: string;
  classId: string;
  studentId: string;
  joinedAt: Date;
  studentName: string | null;
  studentEmail: string;
};

export class ClassRepository {
  //Teacher methods

  async create(data: {
    name: string;
    description?: string;
    teacherId: string;
    joinCode: string;
  }): Promise<ClassData> {
    const [row] = await db
      .insert(classes)
      .values({
        name: data.name,
        description: data.description ?? null,
        teacherId: data.teacherId,
        joinCode: data.joinCode,
      })
      .returning();

    return this.mapToClassData(row);
  }

  async findById(classId: string): Promise<ClassData | null> {
    const [row] = await db.select().from(classes).where(eq(classes.id, classId));

    return row ? this.mapToClassData(row) : null;
  }

  async findByIdAndTeacher(classId: string, teacherId: string): Promise<ClassData | null> {
    const [row] = await db
      .select()
      .from(classes)
      .where(and(eq(classes.id, classId), eq(classes.teacherId, teacherId)));

    return row ? this.mapToClassData(row) : null;
  }

  async findByJoinCode(joinCode: string): Promise<ClassData | null> {
    const [row] = await db.select().from(classes).where(eq(classes.joinCode, joinCode));

    return row ? this.mapToClassData(row) : null;
  }

  //Returns all classes for a teacher with student counts
  async findAllByTeacher(teacherId: string): Promise<ClassWithMemberCount[]> {
    const rows = await db
      .select({
        id: classes.id,
        name: classes.name,
        description: classes.description,
        teacherId: classes.teacherId,
        joinCode: classes.joinCode,
        createdAt: classes.createdAt,
        updatedAt: classes.updatedAt,
        memberCount: count(classMembers.id),
      })
      .from(classes)
      .leftJoin(classMembers, eq(classMembers.classId, classes.id))
      .where(eq(classes.teacherId, teacherId))
      .groupBy(classes.id);

    return rows.map((row) => ({
      ...this.mapToClassData(row),
      memberCount: Number(row.memberCount),
    }));
  }

  //Returns full class details with student roster
  async findByIdWithMembers(classId: string, teacherId: string): Promise<ClassWithMembers | null> {
    const classRow = await this.findByIdAndTeacher(classId, teacherId);
    if (!classRow) return null;

    const memberRows = await db
      .select({
        id: classMembers.id,
        classId: classMembers.classId,
        studentId: classMembers.studentId,
        joinedAt: classMembers.joinedAt,
        studentName: users.name,
        studentEmail: users.email,
      })
      .from(classMembers)
      .innerJoin(users, eq(users.id, classMembers.studentId))
      .where(eq(classMembers.classId, classId));

    return {
      ...classRow,
      members: memberRows.map((r) => this.mapToMemberData(r)),
    };
  }

  async update(
    classId: string,
    teacherId: string,
    data: { name?: string; description?: string }
  ): Promise<ClassData | null> {
    const [updated] = await db
      .update(classes)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(classes.id, classId), eq(classes.teacherId, teacherId)))
      .returning();

    return updated ? this.mapToClassData(updated) : null;
  }

  async updateJoinCode(
    classId: string,
    teacherId: string,
    joinCode: string
  ): Promise<ClassData | null> {
    const [updated] = await db
      .update(classes)
      .set({ joinCode, updatedAt: new Date() })
      .where(and(eq(classes.id, classId), eq(classes.teacherId, teacherId)))
      .returning();

    return updated ? this.mapToClassData(updated) : null;
  }

  async delete(classId: string, teacherId: string): Promise<boolean> {
    const result = await db
      .delete(classes)
      .where(and(eq(classes.id, classId), eq(classes.teacherId, teacherId)))
      .returning();

    return result.length > 0;
  }

  async removeMember(classId: string, studentId: string, teacherId: string): Promise<boolean> {
    const ownsClass = await this.findByIdAndTeacher(classId, teacherId);
    if (!ownsClass) return false;

    const result = await db
      .delete(classMembers)
      .where(and(eq(classMembers.classId, classId), eq(classMembers.studentId, studentId)))
      .returning();

    return result.length > 0;
  }

  //Student methods

  async findMembership(classId: string, studentId: string): Promise<boolean> {
    const [row] = await db
      .select({ id: classMembers.id })
      .from(classMembers)
      .where(and(eq(classMembers.classId, classId), eq(classMembers.studentId, studentId)));

    return !!row;
  }

  async joinClass(classId: string, studentId: string): Promise<ClassMemberData> {
    const [row] = await db.insert(classMembers).values({ classId, studentId }).returning();

    return {
      id: row.id,
      classId: row.classId,
      studentId: row.studentId,
      joinedAt: row.joinedAt,
      student: { id: studentId, name: null, email: '' },
    };
  }

  async leaveClass(classId: string, studentId: string): Promise<boolean> {
    const result = await db
      .delete(classMembers)
      .where(and(eq(classMembers.classId, classId), eq(classMembers.studentId, studentId)))
      .returning();

    return result.length > 0;
  }

  async findEnrolledClasses(studentId: string): Promise<StudentClassData[]> {
    const rows = await db
      .select({
        id: classMembers.id,
        classId: classMembers.classId,
        studentId: classMembers.studentId,
        joinedAt: classMembers.joinedAt,
        className: classes.name,
        classDescription: classes.description,
        classTeacherId: classes.teacherId,
        classJoinCode: classes.joinCode,
        classCreatedAt: classes.createdAt,
        classUpdatedAt: classes.updatedAt,
      })
      .from(classMembers)
      .innerJoin(classes, eq(classes.id, classMembers.classId))
      .where(eq(classMembers.studentId, studentId))
      .orderBy(classMembers.joinedAt);

    return rows.map((row) => ({
      id: row.id,
      classId: row.classId,
      studentId: row.studentId,
      joinedAt: row.joinedAt,
      class: {
        id: row.classId,
        name: row.className,
        description: row.classDescription,
        teacherId: row.classTeacherId,
        joinCode: row.classJoinCode,
        createdAt: row.classCreatedAt,
        updatedAt: row.classUpdatedAt,
      },
    }));
  }

  async findStudentsByClass(classId: string): Promise<ClassStudentList> {
    const rows = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        joinedAt: classMembers.joinedAt,
      })
      .from(classMembers)
      .innerJoin(users, eq(users.id, classMembers.studentId))
      .where(eq(classMembers.classId, classId))
      .orderBy(classMembers.joinedAt);

    return {
      classId,
      studentCount: rows.length,
      students: rows.map((row) => ({
        id: row.id,
        name: row.name,
        email: row.email,
        joinedAt: row.joinedAt,
      })),
    };
  }

  //Private helpers

  private mapToClassData(row: ClassRow & { memberCount?: number }): ClassData {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      teacherId: row.teacherId,
      joinCode: row.joinCode,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private mapToMemberData(row: MemberRow): ClassMemberData {
    return {
      id: row.id,
      classId: row.classId,
      studentId: row.studentId,
      joinedAt: row.joinedAt,
      student: {
        id: row.studentId,
        name: row.studentName,
        email: row.studentEmail,
      },
    };
  }
}

export const classRepository = new ClassRepository();
