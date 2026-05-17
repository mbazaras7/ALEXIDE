import { describe, it, expect, beforeAll, afterEach, afterAll } from '@jest/globals';
import { db } from '../../db';
import { users, classes, classMembers } from '../../db/schema';
import { classRepository } from '../class';
import { and, eq } from 'drizzle-orm';

describe('ClassRepository', () => {
  let teacherId: string;

  beforeAll(async () => {
    const [teacher] = await db
      .insert(users)
      .values({
        email: 'classGrade-teacher@gmail.com',
        password: 'password',
        role: 'TEACHER',
        name: 'Teacher',
      })
      .returning();
    teacherId = teacher.id;
  });

  afterEach(async () => {
    await db
      .delete(classMembers)
      .where(
        eq(
          classMembers.classId,
          db.select({ id: classes.id }).from(classes).where(eq(classes.teacherId, teacherId)) as any
        )
      )
      .catch(() => {});
    await db.delete(classes).where(eq(classes.teacherId, teacherId));
  });

  afterAll(async () => {
    await db.delete(users).where(eq(users.id, teacherId));
  });

  describe('create', () => {
    it('should create a class', async () => {
      const result = await classRepository.create({
        name: 'Python',
        description: 'Intro',
        teacherId,
        joinCode: 'ABCD1234',
      });

      expect(result).toMatchObject({
        name: 'Python',
        description: 'Intro',
        teacherId,
        joinCode: 'ABCD1234',
      });
      expect(result.id).toBeDefined();
      expect(result.createdAt).toBeInstanceOf(Date);
    });

    it('should create a class without description', async () => {
      const result = await classRepository.create({
        name: 'No Desc',
        teacherId,
        joinCode: 'NODESC01',
      });

      expect(result.description).toBeNull();
    });
  });

  describe('findById', () => {
    it('should find class by id', async () => {
      const created = await classRepository.create({
        name: 'Class',
        teacherId,
        joinCode: 'CLASS012',
      });

      const found = await classRepository.findById(created.id);
      expect(found).toMatchObject({ id: created.id, name: 'Class' });
    });

    it('should return null for non-existent class', async () => {
      const found = await classRepository.findById('00000000-0000-0000-0000-000000000000');
      expect(found).toBeNull();
    });
  });

  describe('findByIdAndTeacher', () => {
    it('should find class owned by teacher', async () => {
      const created = await classRepository.create({
        name: 'My Class',
        teacherId,
        joinCode: 'MYCLASS1',
      });

      const found = await classRepository.findByIdAndTeacher(created.id, teacherId);
      expect(found).not.toBeNull();
      expect(found!.id).toBe(created.id);
    });
  });

  describe('findByJoinCode', () => {
    it('should find class by join code', async () => {
      await classRepository.create({
        name: 'Join Me',
        teacherId,
        joinCode: 'JOINME01',
      });

      const found = await classRepository.findByJoinCode('JOINME01');
      expect(found).not.toBeNull();
      expect(found!.joinCode).toBe('JOINME01');
    });

    it('should return null for non-existent join code', async () => {
      const found = await classRepository.findByJoinCode('XXXXXXXX');
      expect(found).toBeNull();
    });
  });

  describe('findAllByTeacher', () => {
    it('should return all classes for teacher with memberCount', async () => {
      await classRepository.create({ name: 'Class A', teacherId, joinCode: 'CLASSA01' });
      await classRepository.create({ name: 'Class B', teacherId, joinCode: 'CLASSB01' });

      const result = await classRepository.findAllByTeacher(teacherId);

      expect(result.length).toBeGreaterThanOrEqual(2);
      result.forEach((c) => expect(typeof c.memberCount).toBe('number'));
    });

    it('should not return classes from other teachers', async () => {
      const [otherTeacher] = await db
        .insert(users)
        .values({ email: 'other-teacher@gmail.com', password: 'x', role: 'TEACHER' })
        .returning();

      await classRepository.create({
        name: 'Other Class',
        teacherId: otherTeacher.id,
        joinCode: 'OTHER001',
      });

      const result = await classRepository.findAllByTeacher(teacherId);
      const names = result.map((c) => c.name);
      expect(names).not.toContain('Other Class');

      await db.delete(classes).where(eq(classes.teacherId, otherTeacher.id));
      await db.delete(users).where(eq(users.id, otherTeacher.id));
    });

    it('should reflect correct memberCount after adding a student', async () => {
      const created = await classRepository.create({
        name: 'Counted Class',
        teacherId,
        joinCode: 'COUNT001',
      });

      const [student] = await db
        .insert(users)
        .values({ email: 'count-student@gmail.com', password: 'x', role: 'STUDENT' })
        .returning();

      await db.insert(classMembers).values({ classId: created.id, studentId: student.id });

      const result = await classRepository.findAllByTeacher(teacherId);
      const found = result.find((c) => c.id === created.id);
      expect(found!.memberCount).toBe(1);

      await db.delete(classMembers).where(eq(classMembers.classId, created.id));
      await db.delete(users).where(eq(users.id, student.id));
    });
  });

  describe('update', () => {
    it('should update class name', async () => {
      const created = await classRepository.create({
        name: 'Old Name',
        teacherId,
        joinCode: 'UPDAT001',
      });

      const updated = await classRepository.update(created.id, teacherId, { name: 'New Name' });
      expect(updated!.name).toBe('New Name');
    });

    it('should return null if teacher does not own the class', async () => {
      const created = await classRepository.create({
        name: 'Protected',
        teacherId,
        joinCode: 'UPDAT003',
      });

      const updated = await classRepository.update(
        created.id,
        '00000000-0000-0000-0000-000000000000',
        { name: 'Stolen' }
      );
      expect(updated).toBeNull();
    });
  });

  describe('updateJoinCode', () => {
    it('should update the join code', async () => {
      const created = await classRepository.create({
        name: 'Code Class',
        teacherId,
        joinCode: 'OLDCODE1',
      });

      const updated = await classRepository.updateJoinCode(created.id, teacherId, 'NEWCODE1');
      expect(updated!.joinCode).toBe('NEWCODE1');
    });
  });

  describe('delete', () => {
    it('should delete a class and return true', async () => {
      const created = await classRepository.create({
        name: 'Delete Me',
        teacherId,
        joinCode: 'DELET001',
      });

      const deleted = await classRepository.delete(created.id, teacherId);
      expect(deleted).toBe(true);

      const found = await classRepository.findById(created.id);
      expect(found).toBeNull();
    });

    it('should return false if class not found', async () => {
      const deleted = await classRepository.delete(
        '00000000-0000-0000-0000-000000000000',
        teacherId
      );
      expect(deleted).toBe(false);
    });
  });

  describe('removeMember', () => {
    it('should remove a student from a class', async () => {
      const created = await classRepository.create({
        name: 'Remove Student',
        teacherId,
        joinCode: 'REMOV001',
      });

      const [student] = await db
        .insert(users)
        .values({ email: 'remove-student@gmail.com', password: 'x', role: 'STUDENT' })
        .returning();

      await db.insert(classMembers).values({ classId: created.id, studentId: student.id });

      const result = await classRepository.removeMember(created.id, student.id, teacherId);
      expect(result).toBe(true);

      const members = await db
        .select()
        .from(classMembers)
        .where(eq(classMembers.classId, created.id));
      expect(members).toHaveLength(0);

      await db.delete(users).where(eq(users.id, student.id));
    });
  });

  describe('findMembership', () => {
    it('should return true if student is a member', async () => {
      const created = await classRepository.create({
        name: 'Membership Class',
        teacherId,
        joinCode: `MEMB-${Date.now()}`,
      });

      const [student] = await db
        .insert(users)
        .values({ email: `memb-student-${Date.now()}@gmail.com`, password: 'x', role: 'STUDENT' })
        .returning();

      await db.insert(classMembers).values({ classId: created.id, studentId: student.id });

      const result = await classRepository.findMembership(created.id, student.id);
      expect(result).toBe(true);

      await db.delete(classMembers).where(eq(classMembers.classId, created.id));
      await db.delete(users).where(eq(users.id, student.id));
    });

    it('should return false if student is not a member', async () => {
      const created = await classRepository.create({
        name: 'Non-Member Class',
        teacherId,
        joinCode: `NONMEMB-${Date.now()}`,
      });

      const result = await classRepository.findMembership(
        created.id,
        '00000000-0000-0000-0000-000000000000'
      );
      expect(result).toBe(false);
    });

    it('should return false after student has left', async () => {
      const created = await classRepository.create({
        name: 'Left Class',
        teacherId,
        joinCode: `LEFT-${Date.now()}`,
      });

      const [student] = await db
        .insert(users)
        .values({ email: `left-student-${Date.now()}@gmail.com`, password: 'x', role: 'STUDENT' })
        .returning();

      await db.insert(classMembers).values({ classId: created.id, studentId: student.id });

      const before = await classRepository.findMembership(created.id, student.id);
      expect(before).toBe(true);

      await db
        .delete(classMembers)
        .where(and(eq(classMembers.classId, created.id), eq(classMembers.studentId, student.id)));

      const after = await classRepository.findMembership(created.id, student.id);
      expect(after).toBe(false);

      await db.delete(users).where(eq(users.id, student.id));
    });
  });

  describe('joinClass', () => {
    it('should insert a class member record', async () => {
      const created = await classRepository.create({
        name: 'Join Class',
        teacherId,
        joinCode: `JOIN-${Date.now()}`,
      });

      const [student] = await db
        .insert(users)
        .values({ email: `join-student-${Date.now()}@gmail.com`, password: 'x', role: 'STUDENT' })
        .returning();

      const result = await classRepository.joinClass(created.id, student.id);

      expect(result.classId).toBe(created.id);
      expect(result.studentId).toBe(student.id);
      expect(result.joinedAt).toBeInstanceOf(Date);
      expect(result.id).toBeDefined();

      await db.delete(classMembers).where(eq(classMembers.classId, created.id));
      await db.delete(users).where(eq(users.id, student.id));
    });

    it('should throw on duplicate membership due to unique constraint', async () => {
      const created = await classRepository.create({
        name: 'Duplicate Join Class',
        teacherId,
        joinCode: `DUPJOIN-${Date.now()}`,
      });

      const [student] = await db
        .insert(users)
        .values({ email: `dup-student-${Date.now()}@gmail.com`, password: 'x', role: 'STUDENT' })
        .returning();

      await classRepository.joinClass(created.id, student.id);

      await expect(classRepository.joinClass(created.id, student.id)).rejects.toThrow();

      await db.delete(classMembers).where(eq(classMembers.classId, created.id));
      await db.delete(users).where(eq(users.id, student.id));
    });
  });

  describe('leaveClass', () => {
    it('should remove the membership record and return true', async () => {
      const created = await classRepository.create({
        name: 'Leave Class',
        teacherId,
        joinCode: `LEAVE-${Date.now()}`,
      });

      const [student] = await db
        .insert(users)
        .values({ email: `leave-student-${Date.now()}@gmail.com`, password: 'x', role: 'STUDENT' })
        .returning();

      await db.insert(classMembers).values({ classId: created.id, studentId: student.id });

      const result = await classRepository.leaveClass(created.id, student.id);
      expect(result).toBe(true);

      const stillMember = await classRepository.findMembership(created.id, student.id);
      expect(stillMember).toBe(false);

      await db.delete(users).where(eq(users.id, student.id));
    });

    it('should return false if membership does not exist', async () => {
      const created = await classRepository.create({
        name: 'Leave Nonexistent',
        teacherId,
        joinCode: `LEAVENX-${Date.now()}`,
      });

      const result = await classRepository.leaveClass(
        created.id,
        '00000000-0000-0000-0000-000000000000'
      );
      expect(result).toBe(false);
    });
  });

  describe('findEnrolledClasses', () => {
    it('should return all classes a student is enrolled in', async () => {
      const class1 = await classRepository.create({
        name: 'Enrolled Class A',
        teacherId,
        joinCode: `ENRA-${Date.now()}`,
      });

      const class2 = await classRepository.create({
        name: 'Enrolled Class B',
        teacherId,
        joinCode: `ENRB-${Date.now()}`,
      });

      const [student] = await db
        .insert(users)
        .values({ email: `enr-student-${Date.now()}@gmail.com`, password: 'x', role: 'STUDENT' })
        .returning();

      await db.insert(classMembers).values([
        { classId: class1.id, studentId: student.id },
        { classId: class2.id, studentId: student.id },
      ]);

      const result = await classRepository.findEnrolledClasses(student.id);

      expect(result).toHaveLength(2);
      const classNames = result.map((e) => e.class.name);
      expect(classNames).toContain('Enrolled Class A');
      expect(classNames).toContain('Enrolled Class B');

      result.forEach((enrollment) => {
        expect(enrollment.class.id).toBeDefined();
        expect(enrollment.class.name).toBeDefined();
        expect(enrollment.class.teacherId).toBe(teacherId);
        expect(enrollment.joinedAt).toBeInstanceOf(Date);
      });

      await db.delete(classMembers).where(eq(classMembers.studentId, student.id));
      await db.delete(users).where(eq(users.id, student.id));
    });

    it('should return empty array if student is not enrolled anywhere', async () => {
      const [student] = await db
        .insert(users)
        .values({ email: `noenr-student-${Date.now()}@gmail.com`, password: 'x', role: 'STUDENT' })
        .returning();

      const result = await classRepository.findEnrolledClasses(student.id);
      expect(result).toEqual([]);

      await db.delete(users).where(eq(users.id, student.id));
    });

    it('should not return classes the student has left', async () => {
      const created = await classRepository.create({
        name: 'Left Behind Class',
        teacherId,
        joinCode: `LEFTB-${Date.now()}`,
      });

      const [student] = await db
        .insert(users)
        .values({ email: `leftb-student-${Date.now()}@gmail.com`, password: 'x', role: 'STUDENT' })
        .returning();

      await db.insert(classMembers).values({ classId: created.id, studentId: student.id });

      const before = await classRepository.findEnrolledClasses(student.id);
      expect(before).toHaveLength(1);

      await classRepository.leaveClass(created.id, student.id);

      const after = await classRepository.findEnrolledClasses(student.id);
      expect(after).toHaveLength(0);

      await db.delete(users).where(eq(users.id, student.id));
    });

    it('should only return classes for the specific student', async () => {
      const created = await classRepository.create({
        name: 'Shared Class',
        teacherId,
        joinCode: `SHARED-${Date.now()}`,
      });

      const [student1] = await db
        .insert(users)
        .values({ email: `shared1-${Date.now()}@gmail.com`, password: 'x', role: 'STUDENT' })
        .returning();

      const [student2] = await db
        .insert(users)
        .values({ email: `shared2-${Date.now()}@gmail.com`, password: 'x', role: 'STUDENT' })
        .returning();

      await db.insert(classMembers).values([
        { classId: created.id, studentId: student1.id },
        { classId: created.id, studentId: student2.id },
      ]);

      const result = await classRepository.findEnrolledClasses(student1.id);

      expect(result).toHaveLength(1);
      expect(result[0].studentId).toBe(student1.id);

      await db.delete(classMembers).where(eq(classMembers.classId, created.id));
      await db.delete(users).where(eq(users.id, student1.id));
      await db.delete(users).where(eq(users.id, student2.id));
    });
  });
  describe('findStudentsByClass', () => {
    it('should return empty student list when no members', async () => {
      const created = await classRepository.create({
        name: 'Empty Students Class',
        teacherId,
        joinCode: `EMPSTU-${Date.now()}`,
      });

      const result = await classRepository.findStudentsByClass(created.id);

      expect(result.classId).toBe(created.id);
      expect(result.studentCount).toBe(0);
      expect(result.students).toHaveLength(0);
    });

    it('should return correct studentCount and student fields', async () => {
      const created = await classRepository.create({
        name: 'One Student Class',
        teacherId,
        joinCode: `ONESTU-${Date.now()}`,
      });

      const [student] = await db
        .insert(users)
        .values({
          email: `findstu-${Date.now()}@gmail.com`,
          password: 'x',
          role: 'STUDENT',
          name: 'Find Student',
        })
        .returning();

      await db.insert(classMembers).values({ classId: created.id, studentId: student.id });

      const result = await classRepository.findStudentsByClass(created.id);

      expect(result.studentCount).toBe(1);
      expect(result.students[0].id).toBe(student.id);
      expect(result.students[0].name).toBe('Find Student');
      expect(result.students[0].email).toBe(student.email);
      expect(result.students[0].joinedAt).toBeInstanceOf(Date);

      await db.delete(classMembers).where(eq(classMembers.classId, created.id));
      await db.delete(users).where(eq(users.id, student.id));
    });

    it('should return correct count with multiple students', async () => {
      const created = await classRepository.create({
        name: 'Multi Student Class',
        teacherId,
        joinCode: `MULTI-${Date.now()}`,
      });

      const [student1] = await db
        .insert(users)
        .values({
          email: `multi1-${Date.now()}@gmail.com`,
          password: 'x',
          role: 'STUDENT',
          name: 'Student One',
        })
        .returning();

      const [student2] = await db
        .insert(users)
        .values({
          email: `multi2-${Date.now()}@gmail.com`,
          password: 'x',
          role: 'STUDENT',
          name: 'Student Two',
        })
        .returning();

      await db.insert(classMembers).values([
        { classId: created.id, studentId: student1.id },
        { classId: created.id, studentId: student2.id },
      ]);

      const result = await classRepository.findStudentsByClass(created.id);

      expect(result.studentCount).toBe(2);
      const ids = result.students.map((s) => s.id);
      expect(ids).toContain(student1.id);
      expect(ids).toContain(student2.id);

      await db.delete(classMembers).where(eq(classMembers.classId, created.id));
      await db.delete(users).where(eq(users.id, student1.id));
      await db.delete(users).where(eq(users.id, student2.id));
    });

    it('should not include students from other classes', async () => {
      const class1 = await classRepository.create({
        name: 'Class One',
        teacherId,
        joinCode: `CLSONE-${Date.now()}`,
      });

      const class2 = await classRepository.create({
        name: 'Class Two',
        teacherId,
        joinCode: `CLSTWO-${Date.now()}`,
      });

      const [student1] = await db
        .insert(users)
        .values({ email: `clsone-stu-${Date.now()}@gmail.com`, password: 'x', role: 'STUDENT' })
        .returning();

      const [student2] = await db
        .insert(users)
        .values({ email: `clstwo-stu-${Date.now()}@gmail.com`, password: 'x', role: 'STUDENT' })
        .returning();

      await db.insert(classMembers).values({ classId: class1.id, studentId: student1.id });
      await db.insert(classMembers).values({ classId: class2.id, studentId: student2.id });

      const result = await classRepository.findStudentsByClass(class1.id);

      expect(result.studentCount).toBe(1);
      expect(result.students[0].id).toBe(student1.id);
      const ids = result.students.map((s) => s.id);
      expect(ids).not.toContain(student2.id);

      await db.delete(classMembers).where(eq(classMembers.classId, class1.id));
      await db.delete(classMembers).where(eq(classMembers.classId, class2.id));
      await db.delete(users).where(eq(users.id, student1.id));
      await db.delete(users).where(eq(users.id, student2.id));
    });

    it('should return students ordered by joinedAt', async () => {
      const created = await classRepository.create({
        name: 'Ordered Class',
        teacherId,
        joinCode: `ORDER-${Date.now()}`,
      });

      const [studentA] = await db
        .insert(users)
        .values({ email: `ordera-${Date.now()}@gmail.com`, password: 'x', role: 'STUDENT' })
        .returning();

      await db.insert(classMembers).values({ classId: created.id, studentId: studentA.id });

      // Small delay to ensure different joinedAt timestamps
      await new Promise((r) => setTimeout(r, 10));

      const [studentB] = await db
        .insert(users)
        .values({ email: `orderb-${Date.now()}@gmail.com`, password: 'x', role: 'STUDENT' })
        .returning();

      await db.insert(classMembers).values({ classId: created.id, studentId: studentB.id });

      const result = await classRepository.findStudentsByClass(created.id);

      expect(result.students[0].id).toBe(studentA.id);
      expect(result.students[1].id).toBe(studentB.id);

      await db.delete(classMembers).where(eq(classMembers.classId, created.id));
      await db.delete(users).where(eq(users.id, studentA.id));
      await db.delete(users).where(eq(users.id, studentB.id));
    });

    it('should reflect updated count after a student leaves', async () => {
      const created = await classRepository.create({
        name: 'Leave Count Class',
        teacherId,
        joinCode: `LVCNT-${Date.now()}`,
      });

      const [student] = await db
        .insert(users)
        .values({ email: `lvcnt-stu-${Date.now()}@gmail.com`, password: 'x', role: 'STUDENT' })
        .returning();

      await db.insert(classMembers).values({ classId: created.id, studentId: student.id });

      const before = await classRepository.findStudentsByClass(created.id);
      expect(before.studentCount).toBe(1);

      await classRepository.leaveClass(created.id, student.id);

      const after = await classRepository.findStudentsByClass(created.id);
      expect(after.studentCount).toBe(0);
      expect(after.students).toHaveLength(0);

      await db.delete(users).where(eq(users.id, student.id));
    });
  });
});
