import { describe, it, expect, beforeAll, afterEach, afterAll } from '@jest/globals';
import { submissionRepository } from '../submission';
import db from '../../db';
import { users, classes, assignments, submissions } from '../../db/schema';
import { eq } from 'drizzle-orm';

describe('SubmissionRepository', () => {
  let teacherId: string;
  let studentId: string;
  let classId: string;
  let assignmentId: string;

  beforeAll(async () => {
    const teacher = await db
      .insert(users)
      .values({
        email: 'repo-sub-teacher@gmail.com',
        password: 'hashed',
        role: 'TEACHER',
        name: 'Sub Teacher',
      })
      .returning();
    teacherId = teacher[0].id;

    const student = await db
      .insert(users)
      .values({
        email: 'repo-sub-student@gmail.com',
        password: 'hashed',
        role: 'STUDENT',
        name: 'Sub Student',
      })
      .returning();
    studentId = student[0].id;

    const cls = await db
      .insert(classes)
      .values({ name: 'Sub Repo Class', teacherId, joinCode: 'SUBREPOCLS' })
      .returning();
    classId = cls[0].id;

    const asgn = await db
      .insert(assignments)
      .values({
        classId,
        teacherId,
        title: 'Sub Repo Assignment',
        maxScore: 100,
        language: 'python',
        status: 'PUBLISHED',
      })
      .returning();
    assignmentId = asgn[0].id;
  });

  afterEach(async () => {
    await db.delete(submissions).where(eq(submissions.assignmentId, assignmentId));
  });

  afterAll(async () => {
    await db.delete(assignments).where(eq(assignments.id, assignmentId));
    await db.delete(classes).where(eq(classes.id, classId));
    await db.delete(users).where(eq(users.id, studentId));
    await db.delete(users).where(eq(users.id, teacherId));
  });

  // ─── upsert ───────────────────────────────────────────────────────────────

  describe('upsert', () => {
    it('should create a new submission', async () => {
      const result = await submissionRepository.upsert(assignmentId, studentId, 'print("hi")');
      expect(result.id).toBeDefined();
      expect(result.assignmentId).toBe(assignmentId);
      expect(result.studentId).toBe(studentId);
      expect(result.code).toBe('print("hi")');
      expect(result.status).toBe('PENDING');
    });

    it('should update code on conflict (same student + assignment)', async () => {
      await submissionRepository.upsert(assignmentId, studentId, 'print("v1")');
      const updated = await submissionRepository.upsert(assignmentId, studentId, 'print("v2")');
      expect(updated.code).toBe('print("v2")');
      expect(updated.status).toBe('PENDING');
    });

    it('should only have one submission per student+assignment after multiple upserts', async () => {
      await submissionRepository.upsert(assignmentId, studentId, 'print("v1")');
      await submissionRepository.upsert(assignmentId, studentId, 'print("v2")');
      const rows = await db
        .select()
        .from(submissions)
        .where(eq(submissions.assignmentId, assignmentId));
      expect(rows).toHaveLength(1);
    });
  });

  // ─── findByStudentAndAssignment ───────────────────────────────────────────

  describe('findByStudentAndAssignment', () => {
    it('should return a submission if it exists', async () => {
      await submissionRepository.upsert(assignmentId, studentId, 'print("hi")');
      const result = await submissionRepository.findByStudentAndAssignment(studentId, assignmentId);
      expect(result).not.toBeNull();
      expect(result!.assignmentId).toBe(assignmentId);
    });

    it('should return null if no submission exists', async () => {
      const result = await submissionRepository.findByStudentAndAssignment(
        studentId,
        '00000000-0000-0000-0000-000000000000'
      );
      expect(result).toBeNull();
    });

    it('should not return password or aiFeedback fields', async () => {
      await submissionRepository.upsert(assignmentId, studentId, 'print("hi")');
      const result = await submissionRepository.findByStudentAndAssignment(studentId, assignmentId);
      expect((result as any).aiFeedback).toBeUndefined();
    });
  });

  // ─── findById ─────────────────────────────────────────────────────────────

  describe('findById', () => {
    it('should find a submission by id and studentId', async () => {
      const created = await submissionRepository.upsert(assignmentId, studentId, 'print("hi")');
      const result = await submissionRepository.findById(created.id, studentId);
      expect(result).not.toBeNull();
      expect(result!.id).toBe(created.id);
    });

    it('should return null if submissionId does not belong to student', async () => {
      const created = await submissionRepository.upsert(assignmentId, studentId, 'print("hi")');
      const result = await submissionRepository.findById(
        created.id,
        '00000000-0000-0000-0000-000000000000'
      );
      expect(result).toBeNull();
    });

    it('should return null for a non-existent id', async () => {
      const result = await submissionRepository.findById(
        '00000000-0000-0000-0000-000000000000',
        studentId
      );
      expect(result).toBeNull();
    });
  });

  // ─── findByStudentAndAssignments ──────────────────────────────────────────

  describe('findByStudentAndAssignments', () => {
    it('should return matching submissions', async () => {
      await submissionRepository.upsert(assignmentId, studentId, 'print("hi")');
      const results = await submissionRepository.findByStudentAndAssignments(studentId, [
        assignmentId,
      ]);
      expect(results).toHaveLength(1);
    });

    it('should return empty array for empty assignmentIds', async () => {
      const results = await submissionRepository.findByStudentAndAssignments(studentId, []);
      expect(results).toHaveLength(0);
    });

    it('should not return submissions belonging to a different student', async () => {
      await submissionRepository.upsert(assignmentId, studentId, 'print("hi")');
      const results = await submissionRepository.findByStudentAndAssignments(
        '00000000-0000-0000-0000-000000000000',
        [assignmentId]
      );
      expect(results).toHaveLength(0);
    });
  });

  // ─── findByAssignment ─────────────────────────────────────────────────────

  describe('findByAssignment', () => {
    it('should return all submissions for an assignment with student info', async () => {
      await submissionRepository.upsert(assignmentId, studentId, 'print("hi")');
      const results = await submissionRepository.findByAssignment(assignmentId);
      expect(results).toHaveLength(1);
      expect((results[0] as any).student).toBeDefined();
      expect((results[0] as any).student.id).toBe(studentId);
    });

    it('should return empty array if no submissions', async () => {
      const results = await submissionRepository.findByAssignment(assignmentId);
      expect(results).toHaveLength(0);
    });
  });

  // ─── findByIdAsTeacher ────────────────────────────────────────────────────

  describe('findByIdAsTeacher', () => {
    it('should return submission if teacher owns the assignment', async () => {
      const created = await submissionRepository.upsert(assignmentId, studentId, 'print("hi")');
      const result = await submissionRepository.findByIdAsTeacher(created.id, teacherId);
      expect(result).not.toBeNull();
      expect(result!.id).toBe(created.id);
    });

    it('should return null if teacher does not own the assignment', async () => {
      const created = await submissionRepository.upsert(assignmentId, studentId, 'print("hi")');
      const result = await submissionRepository.findByIdAsTeacher(
        created.id,
        '00000000-0000-0000-0000-000000000000'
      );
      expect(result).toBeNull();
    });
  });

  // ─── saveFeedback ─────────────────────────────────────────────────────────

  describe('saveFeedback', () => {
    it('should save feedback and return updated submission', async () => {
      const created = await submissionRepository.upsert(assignmentId, studentId, 'print("hi")');
      const result = await submissionRepository.saveFeedback(created.id, 'Great work!');
      expect(result).not.toBeNull();
      expect(result!.feedback).toBe('Great work!');
      expect(result!.feedbackUpdatedAt).toBeInstanceOf(Date);
    });

    it('should return null for a non-existent submission id', async () => {
      const result = await submissionRepository.saveFeedback(
        '00000000-0000-0000-0000-000000000000',
        'feedback'
      );
      expect(result).toBeNull();
    });
  });

  // ─── saveAiFeedback ───────────────────────────────────────────────────────

  describe('saveAiFeedback', () => {
    it('should save AI feedback without throwing', async () => {
      const created = await submissionRepository.upsert(assignmentId, studentId, 'print("hi")');
      await expect(
        submissionRepository.saveAiFeedback(created.id, 'AI says: looks good')
      ).resolves.not.toThrow();
    });
  });

  // ─── adoptAiFeedback ──────────────────────────────────────────────────────

  describe('adoptAiFeedback', () => {
    it('should copy aiFeedback into feedback field', async () => {
      const created = await submissionRepository.upsert(assignmentId, studentId, 'print("hi")');
      await submissionRepository.saveAiFeedback(created.id, 'AI: nice code');
      const result = await submissionRepository.adoptAiFeedback(created.id);
      expect(result).not.toBeNull();
      expect(result!.feedback).toBe('AI: nice code');
    });

    it('should return null if no aiFeedback exists', async () => {
      const created = await submissionRepository.upsert(assignmentId, studentId, 'print("hi")');
      const result = await submissionRepository.adoptAiFeedback(created.id);
      expect(result).toBeNull();
    });
  });

  // ─── setStatus ────────────────────────────────────────────────────────────

  describe('setStatus', () => {
    it('should update submission status to RUNNING', async () => {
      const created = await submissionRepository.upsert(assignmentId, studentId, 'print("hi")');
      await submissionRepository.setStatus(created.id, 'RUNNING');
      const updated = await submissionRepository.findRawById(created.id);
      expect(updated!.status).toBe('RUNNING');
    });

    it('should update submission status to FAILED', async () => {
      const created = await submissionRepository.upsert(assignmentId, studentId, 'print("hi")');
      await submissionRepository.setStatus(created.id, 'FAILED');
      const updated = await submissionRepository.findRawById(created.id);
      expect(updated!.status).toBe('FAILED');
    });
  });

  // ─── findRawByAssignment ──────────────────────────────────────────────────

  describe('findRawByAssignment', () => {
    it('should return raw rows with all fields for stats calculation', async () => {
      await submissionRepository.upsert(assignmentId, studentId, 'print("hi")');
      const rows = await submissionRepository.findRawByAssignment(assignmentId);
      expect(rows).toHaveLength(1);
      expect(rows[0].status).toBe('PENDING');
    });

    it('should return empty array if no submissions', async () => {
      const rows = await submissionRepository.findRawByAssignment(assignmentId);
      expect(rows).toHaveLength(0);
    });
  });
});
