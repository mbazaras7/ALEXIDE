import { describe, it, expect, beforeAll, afterEach, afterAll } from '@jest/globals';
import { db } from '../../db';
import { users, classes, classMembers, grades } from '../../db/schema';
import { gradeRepository } from '../grade';
import { eq } from 'drizzle-orm';

describe('GradeRepository', () => {
  let teacherId: string;
  let studentId: string;
  let classId: string;

  beforeAll(async () => {
    const [teacher] = await db
      .insert(users)
      .values({ email: 'repGrade-teacher@gmail.com', password: 'Password123', role: 'TEACHER' })
      .returning();
    teacherId = teacher.id;

    const [student] = await db
      .insert(users)
      .values({ email: 'repGrade-student@gmail.com', password: 'Password123', role: 'STUDENT' })
      .returning();
    studentId = student.id;

    const [cls] = await db
      .insert(classes)
      .values({ name: 'Grade Test Class', teacherId, joinCode: 'GRADETEST' })
      .returning();
    classId = cls.id;

    await db.insert(classMembers).values({ classId, studentId });
  });

  afterEach(async () => {
    await db.delete(grades).where(eq(grades.classId, classId));
  });

  afterAll(async () => {
    await db.delete(classMembers).where(eq(classMembers.classId, classId));
    await db.delete(classes).where(eq(classes.id, classId));
    await db.delete(users).where(eq(users.id, teacherId));
    await db.delete(users).where(eq(users.id, studentId));
  });

  describe('create', () => {
    it('should create a grade and compute percentage', async () => {
      const result = await gradeRepository.create({
        studentId,
        classId,
        sourceType: 'ASSIGNMENT',
        sourceId: 'assignment-1',
        score: 75,
        maxScore: 100,
      });

      expect(result.score).toBe(75);
      expect(result.maxScore).toBe(100);
      expect(result.percentage).toBe(75);
      expect(result.releasedAt).toBeNull();
      expect(result.id).toBeDefined();
    });

    it('should correctly compute percentage for partial scores', async () => {
      const result = await gradeRepository.create({
        studentId,
        classId,
        sourceType: 'ASSIGNMENT',
        sourceId: 'assignment-2',
        score: 3,
        maxScore: 4,
      });

      expect(result.percentage).toBe(75);
    });
  });

  describe('findById', () => {
    it('should find a grade by id', async () => {
      const created = await gradeRepository.create({
        studentId,
        classId,
        sourceType: 'ASSIGNMENT',
        sourceId: 'asgn-find',
        score: 80,
        maxScore: 100,
      });

      const found = await gradeRepository.findById(created.id);
      expect(found).not.toBeNull();
      expect(found!.id).toBe(created.id);
    });

    it('should return null for non-existent grade', async () => {
      const found = await gradeRepository.findById('00000000-0000-0000-0000-000000000000');
      expect(found).toBeNull();
    });
  });

  describe('findByStudentAndSource', () => {
    it('should find a grade by student and source', async () => {
      await gradeRepository.create({
        studentId,
        classId,
        sourceType: 'ASSIGNMENT',
        sourceId: 'asgn-src',
        score: 90,
        maxScore: 100,
      });

      const found = await gradeRepository.findByStudentAndSource(
        studentId,
        'asgn-src',
        'ASSIGNMENT'
      );
      expect(found).not.toBeNull();
      expect(found!.sourceId).toBe('asgn-src');
    });

    it('should return null if not found', async () => {
      const found = await gradeRepository.findByStudentAndSource(studentId, 'nonexistent', 'EXAM');
      expect(found).toBeNull();
    });
  });

  describe('update', () => {
    it('should update score and recompute percentage', async () => {
      const created = await gradeRepository.create({
        studentId,
        classId,
        sourceType: 'ASSIGNMENT',
        sourceId: 'asgn-upd',
        score: 50,
        maxScore: 100,
      });

      const updated = await gradeRepository.update(created.id, { score: 90 });
      expect(updated!.score).toBe(90);
      expect(updated!.percentage).toBe(90);
    });

    it('should return null for non-existent grade', async () => {
      const updated = await gradeRepository.update('00000000-0000-0000-0000-000000000000', {
        score: 50,
      });
      expect(updated).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete a grade and return true', async () => {
      const created = await gradeRepository.create({
        studentId,
        classId,
        sourceType: 'EXAM',
        sourceId: 'exam-del',
        score: 70,
        maxScore: 100,
      });

      const result = await gradeRepository.delete(created.id);
      expect(result).toBe(true);

      const found = await gradeRepository.findById(created.id);
      expect(found).toBeNull();
    });

    it('should return false for non-existent grade', async () => {
      const result = await gradeRepository.delete('00000000-0000-0000-0000-000000000000');
      expect(result).toBe(false);
    });
  });

  describe('findBySource', () => {
    it('should return all grades for a source with student info', async () => {
      await gradeRepository.create({
        studentId,
        classId,
        sourceType: 'ASSIGNMENT',
        sourceId: 'asgn-batch',
        score: 85,
        maxScore: 100,
      });

      const results = await gradeRepository.findBySource('asgn-batch', 'ASSIGNMENT', classId);
      expect(results).toHaveLength(1);
      expect(results[0].student).toBeDefined();
      expect(results[0].student.id).toBe(studentId);
    });

    it('should return empty array if no grades exist for source', async () => {
      const results = await gradeRepository.findBySource('nonexistent', 'ASSIGNMENT', classId);
      expect(results).toHaveLength(0);
    });
  });

  describe('releaseGrades', () => {
    it('should set releasedAt on all grades for a source', async () => {
      await gradeRepository.create({
        studentId,
        classId,
        sourceType: 'ASSIGNMENT',
        sourceId: 'asgn-release',
        score: 90,
        maxScore: 100,
      });

      const count = await gradeRepository.releaseGrades('asgn-release', 'ASSIGNMENT', classId);
      expect(count).toBe(1);

      const results = await gradeRepository.findBySource('asgn-release', 'ASSIGNMENT', classId);
      expect(results[0].releasedAt).not.toBeNull();
    });
  });

  describe('findReleasedByStudent', () => {
    it('should only return grades where releasedAt is set', async () => {
      await gradeRepository.create({
        studentId,
        classId,
        sourceType: 'ASSIGNMENT',
        sourceId: 'unreleased-1',
        score: 80,
        maxScore: 100,
      });

      await gradeRepository.create({
        studentId,
        classId,
        sourceType: 'ASSIGNMENT',
        sourceId: 'released-1',
        score: 90,
        maxScore: 100,
      });

      await gradeRepository.releaseGrades('released-1', 'ASSIGNMENT', classId);

      const results = await gradeRepository.findReleasedByStudent(studentId);
      const sourceIds = results.map((g) => g.sourceId);

      expect(sourceIds).toContain('released-1');
      expect(sourceIds).not.toContain('unreleased-1');
    });
  });

  describe('findByClassAndStudent', () => {
    it('should return all grades for a student in a class with student info', async () => {
      await gradeRepository.create({
        studentId,
        classId,
        sourceType: 'ASSIGNMENT',
        sourceId: 'asgn-cas-1',
        score: 75,
        maxScore: 100,
      });
      await gradeRepository.create({
        studentId,
        classId,
        sourceType: 'EXAM',
        sourceId: 'exam-cas-1',
        score: 20,
        maxScore: 20,
      });

      const results = await gradeRepository.findByClassAndStudent(classId, studentId);

      expect(results).toHaveLength(2);
      expect(results[0].student).toBeDefined();
      expect(results[0].student.id).toBe(studentId);
    });

    it('should return empty array if student has no grades in class', async () => {
      const results = await gradeRepository.findByClassAndStudent(
        classId,
        '00000000-0000-0000-0000-000000000000'
      );
      expect(results).toHaveLength(0);
    });

    it('should include both released and unreleased grades', async () => {
      await gradeRepository.create({
        studentId,
        classId,
        sourceType: 'ASSIGNMENT',
        sourceId: 'asgn-rel',
        score: 90,
        maxScore: 100,
      });
      await gradeRepository.create({
        studentId,
        classId,
        sourceType: 'ASSIGNMENT',
        sourceId: 'asgn-unrel',
        score: 60,
        maxScore: 100,
      });
      await gradeRepository.releaseGrades('asgn-rel', 'ASSIGNMENT', classId);

      const results = await gradeRepository.findByClassAndStudent(classId, studentId);
      const sourceIds = results.map((g) => g.sourceId);

      expect(sourceIds).toContain('asgn-rel');
      expect(sourceIds).toContain('asgn-unrel');
    });

    it('should correctly compute percentage per grade', async () => {
      await gradeRepository.create({
        studentId,
        classId,
        sourceType: 'ASSIGNMENT',
        sourceId: 'asgn-pct',
        score: 15,
        maxScore: 20,
      });

      const results = await gradeRepository.findByClassAndStudent(classId, studentId);
      const target = results.find((g) => g.sourceId === 'asgn-pct');

      expect(target!.percentage).toBe(75);
    });
  });
});
