import { describe, it, expect, beforeAll, afterEach, afterAll } from '@jest/globals';
import db from '../../db';
import { users, classes, classMembers, assignments, submissions, grades } from '../../db/schema';
import { gradingRepository } from '../grading';
import { eq } from 'drizzle-orm';

describe('GradingRepository', () => {
  let teacherId: string;
  let studentId: string;
  let classId: string;
  let assignmentId: string;

  beforeAll(async () => {
    const [teacher] = await db
      .insert(users)
      .values({
        email: `grading-repo-teacher-${Date.now()}@gmail.com`,
        password: 'Password123',
        role: 'TEACHER',
      })
      .returning();
    teacherId = teacher.id;

    const [student] = await db
      .insert(users)
      .values({
        email: `grading-repo-student-${Date.now()}@gmail.com`,
        password: 'Password123',
        role: 'STUDENT',
      })
      .returning();
    studentId = student.id;

    const [cls] = await db
      .insert(classes)
      .values({ name: 'Grading Repo Class', teacherId, joinCode: `GRADREPO-${Date.now()}` })
      .returning();
    classId = cls.id;

    await db.insert(classMembers).values({ classId, studentId });

    const [asgn] = await db
      .insert(assignments)
      .values({
        classId,
        teacherId,
        title: 'Grading Test Assignment',
        maxScore: 100,
        language: 'python',
        status: 'PUBLISHED',
      })
      .returning();
    assignmentId = asgn.id;
  });

  afterEach(async () => {
    await db.delete(submissions).where(eq(submissions.assignmentId, assignmentId));
    await db.delete(grades).where(eq(grades.classId, classId));
  });

  afterAll(async () => {
    await db.delete(assignments).where(eq(assignments.id, assignmentId));
    await db.delete(classMembers).where(eq(classMembers.classId, classId));
    await db.delete(classes).where(eq(classes.id, classId));
    await db.delete(users).where(eq(users.id, teacherId));
    await db.delete(users).where(eq(users.id, studentId));
  });

  // ─── Helper ───────────────────────────────────────────────────────────────

  async function createSubmission(
    status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' = 'PENDING'
  ) {
    const [row] = await db
      .insert(submissions)
      .values({ assignmentId, studentId, code: 'print("hello")', status })
      .returning();
    return row;
  }

  // ─── findSubmissionById ───────────────────────────────────────────────────

  describe('findSubmissionById', () => {
    it('should return a submission by id', async () => {
      const created = await createSubmission();
      const found = await gradingRepository.findSubmissionById(created.id);
      expect(found).not.toBeNull();
      expect(found!.id).toBe(created.id);
      expect(found!.code).toBe('print("hello")');
      expect(found!.status).toBe('PENDING');
    });

    it('should return null for non-existent submission', async () => {
      const found = await gradingRepository.findSubmissionById(
        '00000000-0000-0000-0000-000000000000'
      );
      expect(found).toBeNull();
    });
  });

  // ─── findSubmissionWithAssignment ─────────────────────────────────────────

  describe('findSubmissionWithAssignment', () => {
    it('should return submission with assignmentId and status', async () => {
      const created = await createSubmission();
      const found = await gradingRepository.findSubmissionWithAssignment(created.id);
      expect(found).not.toBeNull();
      expect(found!.id).toBe(created.id);
      expect(found!.assignmentId).toBe(assignmentId);
      expect(found!.status).toBe('PENDING');
    });

    it('should return null for non-existent submission', async () => {
      const found = await gradingRepository.findSubmissionWithAssignment(
        '00000000-0000-0000-0000-000000000000'
      );
      expect(found).toBeNull();
    });
  });

  // ─── findAssignmentById ───────────────────────────────────────────────────

  describe('findAssignmentById', () => {
    it('should return an assignment by id', async () => {
      const found = await gradingRepository.findAssignmentById(assignmentId);
      expect(found).not.toBeNull();
      expect(found!.id).toBe(assignmentId);
      expect(found!.classId).toBe(classId);
      expect(found!.teacherId).toBe(teacherId);
      expect(found!.maxScore).toBe(100);
    });

    it('should return null for non-existent assignment', async () => {
      const found = await gradingRepository.findAssignmentById(
        '00000000-0000-0000-0000-000000000000'
      );
      expect(found).toBeNull();
    });
  });

  // ─── findAssignmentByIdAndTeacher ─────────────────────────────────────────

  describe('findAssignmentByIdAndTeacher', () => {
    it('should return assignment when teacher owns it', async () => {
      const found = await gradingRepository.findAssignmentByIdAndTeacher(assignmentId, teacherId);
      expect(found).not.toBeNull();
      expect(found!.id).toBe(assignmentId);
    });

    it('should return null when teacher does not own the assignment', async () => {
      const found = await gradingRepository.findAssignmentByIdAndTeacher(
        assignmentId,
        '00000000-0000-0000-0000-000000000000'
      );
      expect(found).toBeNull();
    });

    it('should return null for non-existent assignment', async () => {
      const found = await gradingRepository.findAssignmentByIdAndTeacher(
        '00000000-0000-0000-0000-000000000000',
        teacherId
      );
      expect(found).toBeNull();
    });
  });

  // ─── setSubmissionRunning ─────────────────────────────────────────────────

  describe('setSubmissionRunning', () => {
    it('should update submission status to RUNNING', async () => {
      const created = await createSubmission('PENDING');
      await gradingRepository.setSubmissionRunning(created.id);
      const updated = await gradingRepository.findSubmissionById(created.id);
      expect(updated!.status).toBe('RUNNING');
    });

    it('should update updatedAt timestamp', async () => {
      const created = await createSubmission('PENDING');
      const originalUpdatedAt = created.updatedAt;
      await new Promise((r) => setTimeout(r, 10));
      await gradingRepository.setSubmissionRunning(created.id);
      const updated = await gradingRepository.findSubmissionById(created.id);
      expect(updated!.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
    });
  });

  // ─── updateSubmissionResult ───────────────────────────────────────────────

  describe('updateSubmissionResult', () => {
    it('should update status, score, maxScore, and testResults', async () => {
      const created = await createSubmission('RUNNING');
      const testResults = JSON.stringify([
        { name: 'Test 1', passed: true, weight: 1, actualOutput: 'hello', expectedOutput: 'hello' },
      ]);

      await gradingRepository.updateSubmissionResult(created.id, {
        status: 'COMPLETED',
        score: 100,
        maxScore: 100,
        testResults,
      });

      const updated = await gradingRepository.findSubmissionById(created.id);
      expect(updated!.status).toBe('COMPLETED');
      expect(updated!.score).toBe(100);
      expect(updated!.maxScore).toBe(100);
    });

    it('should store FAILED status when tests do not fully pass', async () => {
      const created = await createSubmission('RUNNING');
      const testResults = JSON.stringify([
        {
          name: 'Test 1',
          passed: false,
          weight: 1,
          actualOutput: 'wrong',
          expectedOutput: 'hello',
        },
      ]);

      await gradingRepository.updateSubmissionResult(created.id, {
        status: 'FAILED',
        score: 0,
        maxScore: 100,
        testResults,
      });

      const updated = await gradingRepository.findSubmissionById(created.id);
      expect(updated!.status).toBe('FAILED');
      expect(updated!.score).toBe(0);
    });
  });

  // ─── setSubmissionFailed ──────────────────────────────────────────────────

  describe('setSubmissionFailed', () => {
    it('should set submission status to FAILED', async () => {
      const created = await createSubmission('RUNNING');
      await gradingRepository.setSubmissionFailed(created.id);
      const updated = await gradingRepository.findSubmissionById(created.id);
      expect(updated!.status).toBe('FAILED');
    });

    it('should update updatedAt timestamp', async () => {
      const created = await createSubmission('RUNNING');
      const originalUpdatedAt = created.updatedAt;
      await new Promise((r) => setTimeout(r, 10));
      await gradingRepository.setSubmissionFailed(created.id);
      const updated = await gradingRepository.findSubmissionById(created.id);
      expect(updated!.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
    });
  });

  // ─── upsertGrade ─────────────────────────────────────────────────────────

  describe('upsertGrade', () => {
    it('should insert a new grade record', async () => {
      await gradingRepository.upsertGrade({
        studentId,
        classId,
        sourceId: assignmentId,
        score: 80,
        maxScore: 100,
      });

      const rows = await db.select().from(grades).where(eq(grades.sourceId, assignmentId));
      expect(rows).toHaveLength(1);
      expect(rows[0].score).toBe(80);
      expect(rows[0].maxScore).toBe(100);
      expect(rows[0].sourceType).toBe('ASSIGNMENT');
    });

    it('should update existing grade on conflict (same student + source)', async () => {
      await gradingRepository.upsertGrade({
        studentId,
        classId,
        sourceId: assignmentId,
        score: 60,
        maxScore: 100,
      });

      await gradingRepository.upsertGrade({
        studentId,
        classId,
        sourceId: assignmentId,
        score: 90,
        maxScore: 100,
      });

      const rows = await db.select().from(grades).where(eq(grades.sourceId, assignmentId));
      expect(rows).toHaveLength(1);
      expect(rows[0].score).toBe(90);
    });

    it('should correctly store classId, studentId and sourceType ASSIGNMENT', async () => {
      await gradingRepository.upsertGrade({
        studentId,
        classId,
        sourceId: assignmentId,
        score: 75,
        maxScore: 100,
      });

      const rows = await db.select().from(grades).where(eq(grades.sourceId, assignmentId));
      expect(rows[0].classId).toBe(classId);
      expect(rows[0].studentId).toBe(studentId);
      expect(rows[0].sourceType).toBe('ASSIGNMENT');
    });
  });
});
