import { describe, it, expect, beforeAll, afterEach, afterAll } from '@jest/globals';
import { db } from '../../db';
import {
  users,
  classes,
  classMembers,
  exams,
  examQuestions,
  examSessions,
  examQuestionSubmissions,
} from '../../db/schema';
import { examSubmissionRepository } from '../examSubmission';
import { eq } from 'drizzle-orm';

describe('ExamSubmissionRepository', () => {
  let teacherId: string;
  let studentId: string;
  let classId: string;
  let examId: string;
  let questionId: string;
  let sessionId: string;
  const nonExistentId = '00000000-0000-0000-0000-000000000000';

  beforeAll(async () => {
    const [teacher] = await db
      .insert(users)
      .values({
        email: `sub-repo-teacher${Date.now()}@gmail.com`,
        password: 'Password123',
        role: 'TEACHER',
      })
      .returning();
    teacherId = teacher.id;

    const [student] = await db
      .insert(users)
      .values({
        email: `sub-repo-student${Date.now()}@gmail.com`,
        password: 'Password123',
        role: 'STUDENT',
      })
      .returning();
    studentId = student.id;

    const [cls] = await db
      .insert(classes)
      .values({
        name: 'Submission Repo Class',
        teacherId,
        joinCode: `SUBREPO-${Date.now()}`,
      })
      .returning();
    classId = cls.id;

    await db.insert(classMembers).values({ classId, studentId });

    const [exam] = await db
      .insert(exams)
      .values({
        classId,
        teacherId,
        title: 'Submission Test Exam',
        maxScore: 100,
        language: 'python',
        durationMinutes: 60,
        status: 'ACTIVE',
      })
      .returning();
    examId = exam.id;

    const [question] = await db
      .insert(examQuestions)
      .values({
        examId,
        title: 'Test Question',
        maxScore: 100,
        language: 'python',
        orderIndex: 0,
      })
      .returning();
    questionId = question.id;

    const [session] = await db
      .insert(examSessions)
      .values({
        examId,
        studentId,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      })
      .returning();
    sessionId = session.id;
  });

  afterEach(async () => {
    await db
      .delete(examQuestionSubmissions)
      .where(eq(examQuestionSubmissions.examSessionId, sessionId));
  });

  afterAll(async () => {
    await db.delete(examSessions).where(eq(examSessions.examId, examId));
    await db.delete(examQuestions).where(eq(examQuestions.examId, examId));
    await db.delete(exams).where(eq(exams.id, examId));
    await db.delete(classMembers).where(eq(classMembers.classId, classId));
    await db.delete(classes).where(eq(classes.id, classId));
    if (studentId) await db.delete(users).where(eq(users.id, studentId));
    if (teacherId) await db.delete(users).where(eq(users.id, teacherId));
  });

  describe('upsert', () => {
    it('should create a new submission with PENDING status', async () => {
      const result = await examSubmissionRepository.upsert({
        examSessionId: sessionId,
        examId,
        questionId,
        studentId,
        code: 'print("hello")',
      });

      expect(result.id).toBeDefined();
      expect(result.examSessionId).toBe(sessionId);
      expect(result.examId).toBe(examId);
      expect(result.questionId).toBe(questionId);
      expect(result.studentId).toBe(studentId);
      expect(result.code).toBe('print("hello")');
      expect(result.status).toBe('PENDING');
      expect(result.score).toBeNull();
      expect(result.maxScore).toBeNull();
      expect(result.testResults).toBeNull();
      expect(result.submittedAt).toBeDefined();
      expect(result.updatedAt).toBeDefined();
    });

    it('should update existing submission code on conflict (upsert)', async () => {
      await examSubmissionRepository.upsert({
        examSessionId: sessionId,
        examId,
        questionId,
        studentId,
        code: 'print("v1")',
      });

      const updated = await examSubmissionRepository.upsert({
        examSessionId: sessionId,
        examId,
        questionId,
        studentId,
        code: 'print("v2")',
      });

      expect(updated.code).toBe('print("v2")');
      expect(updated.status).toBe('PENDING');
      expect(updated.score).toBeNull();
      expect(updated.maxScore).toBeNull();
      expect(updated.testResults).toBeNull();
    });

    it('should reset score and testResults to null on upsert even if previously graded', async () => {
      const sub = await examSubmissionRepository.upsert({
        examSessionId: sessionId,
        examId,
        questionId,
        studentId,
        code: 'print("first")',
      });

      await examSubmissionRepository.updateResult(sub.id, {
        status: 'COMPLETED',
        score: 80,
        maxScore: 100,
        testResults: [
          { name: 'TC1', passed: true, actualOutput: '4', expectedOutput: '4', weight: 1 },
        ],
      });

      const resubmitted = await examSubmissionRepository.upsert({
        examSessionId: sessionId,
        examId,
        questionId,
        studentId,
        code: 'print("updated")',
      });

      expect(resubmitted.code).toBe('print("updated")');
      expect(resubmitted.status).toBe('PENDING');
      expect(resubmitted.score).toBeNull();
      expect(resubmitted.maxScore).toBeNull();
      expect(resubmitted.testResults).toBeNull();
    });
  });

  describe('findById', () => {
    it('should find a submission by id', async () => {
      const created = await examSubmissionRepository.upsert({
        examSessionId: sessionId,
        examId,
        questionId,
        studentId,
        code: 'print("find")',
      });

      const found = await examSubmissionRepository.findById(created.id);
      expect(found).not.toBeNull();
      expect(found!.id).toBe(created.id);
      expect(found!.code).toBe('print("find")');
    });

    it('should return null for non-existent id', async () => {
      const found = await examSubmissionRepository.findById(nonExistentId);
      expect(found).toBeNull();
    });
  });

  describe('findBySessionAndQuestion', () => {
    it('should find a submission by session and question', async () => {
      await examSubmissionRepository.upsert({
        examSessionId: sessionId,
        examId,
        questionId,
        studentId,
        code: 'print("session q")',
      });

      const found = await examSubmissionRepository.findBySessionAndQuestion(sessionId, questionId);
      expect(found).not.toBeNull();
      expect(found!.examSessionId).toBe(sessionId);
      expect(found!.questionId).toBe(questionId);
    });

    it('should return null when no submission exists for session+question', async () => {
      const found = await examSubmissionRepository.findBySessionAndQuestion(
        sessionId,
        nonExistentId
      );
      expect(found).toBeNull();
    });

    it('should return null for non-existent session', async () => {
      const found = await examSubmissionRepository.findBySessionAndQuestion(
        nonExistentId,
        questionId
      );
      expect(found).toBeNull();
    });
  });

  describe('findBySession', () => {
    it('should return all submissions for a session', async () => {
      const [q2] = await db
        .insert(examQuestions)
        .values({ examId, title: 'Q2', maxScore: 50, language: 'python', orderIndex: 1 })
        .returning();

      await examSubmissionRepository.upsert({
        examSessionId: sessionId,
        examId,
        questionId,
        studentId,
        code: 'print("q1")',
      });

      await examSubmissionRepository.upsert({
        examSessionId: sessionId,
        examId,
        questionId: q2.id,
        studentId,
        code: 'print("q2")',
      });

      const results = await examSubmissionRepository.findBySession(sessionId);
      expect(results.length).toBeGreaterThanOrEqual(2);
      expect(results.every((s) => s.examSessionId === sessionId)).toBe(true);

      await db.delete(examQuestions).where(eq(examQuestions.id, q2.id));
    });

    it('should return empty array for session with no submissions', async () => {
      const [tempExam] = await db
        .insert(exams)
        .values({
          classId,
          teacherId,
          title: 'Empty Session Exam',
          maxScore: 100,
          language: 'python',
          durationMinutes: 60,
          status: 'ACTIVE',
        })
        .returning();

      const [emptySession] = await db
        .insert(examSessions)
        .values({
          examId: tempExam.id,
          studentId,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        })
        .returning();

      const results = await examSubmissionRepository.findBySession(emptySession.id);
      expect(results).toHaveLength(0);

      await db.delete(examSessions).where(eq(examSessions.id, emptySession.id));
      await db.delete(exams).where(eq(exams.id, tempExam.id));
    });

    it('should return empty array for non-existent session', async () => {
      const results = await examSubmissionRepository.findBySession(nonExistentId);
      expect(results).toHaveLength(0);
    });
  });

  describe('updateResult', () => {
    it('should update submission to COMPLETED with score and testResults', async () => {
      const created = await examSubmissionRepository.upsert({
        examSessionId: sessionId,
        examId,
        questionId,
        studentId,
        code: 'print(4)',
      });

      const testResults = [
        { name: 'TC1', passed: true, actualOutput: '4', expectedOutput: '4', weight: 1 },
        { name: 'TC2', passed: true, actualOutput: '4', expectedOutput: '4', weight: 1 },
      ];

      const updated = await examSubmissionRepository.updateResult(created.id, {
        status: 'COMPLETED',
        score: 100,
        maxScore: 100,
        testResults,
      });

      expect(updated).not.toBeNull();
      expect(updated!.status).toBe('COMPLETED');
      expect(updated!.score).toBe(100);
      expect(updated!.maxScore).toBe(100);
      expect(updated!.testResults).toHaveLength(2);
      expect(updated!.testResults![0].passed).toBe(true);
      expect(updated!.testResults![0].name).toBe('TC1');
    });

    it('should update submission to FAILED with partial score', async () => {
      const created = await examSubmissionRepository.upsert({
        examSessionId: sessionId,
        examId,
        questionId,
        studentId,
        code: 'print("wrong")',
      });

      const testResults = [
        { name: 'TC1', passed: false, actualOutput: 'wrong', expectedOutput: '4', weight: 1 },
      ];

      const updated = await examSubmissionRepository.updateResult(created.id, {
        status: 'FAILED',
        score: 0,
        maxScore: 100,
        testResults,
      });

      expect(updated!.status).toBe('FAILED');
      expect(updated!.score).toBe(0);
      expect(updated!.testResults![0].passed).toBe(false);
      expect(updated!.testResults![0].actualOutput).toBe('wrong');
    });

    it('should handle mixed pass/fail test results and partial score', async () => {
      const created = await examSubmissionRepository.upsert({
        examSessionId: sessionId,
        examId,
        questionId,
        studentId,
        code: 'print("partial")',
      });

      const testResults = [
        { name: 'TC1', passed: true, actualOutput: '4', expectedOutput: '4', weight: 1 },
        { name: 'TC2', passed: false, actualOutput: 'wrong', expectedOutput: '5', weight: 1 },
      ];

      const updated = await examSubmissionRepository.updateResult(created.id, {
        status: 'FAILED',
        score: 50,
        maxScore: 100,
        testResults,
      });

      expect(updated!.score).toBe(50);
      expect(updated!.testResults).toHaveLength(2);
      expect(updated!.testResults![0].passed).toBe(true);
      expect(updated!.testResults![1].passed).toBe(false);
    });

    it('should parse testResults JSON correctly', async () => {
      const created = await examSubmissionRepository.upsert({
        examSessionId: sessionId,
        examId,
        questionId,
        studentId,
        code: 'print("json")',
      });

      const testResults = [
        {
          name: 'JSON Test',
          passed: true,
          actualOutput: 'hello world',
          expectedOutput: 'hello world',
          weight: 1,
        },
      ];

      const updated = await examSubmissionRepository.updateResult(created.id, {
        status: 'COMPLETED',
        score: 100,
        maxScore: 100,
        testResults,
      });

      expect(Array.isArray(updated!.testResults)).toBe(true);
      expect(updated!.testResults![0].actualOutput).toBe('hello world');
    });

    it('should return null for non-existent submission id', async () => {
      const updated = await examSubmissionRepository.updateResult(nonExistentId, {
        status: 'COMPLETED',
        score: 100,
        maxScore: 100,
        testResults: [],
      });

      expect(updated).toBeNull();
    });

    it('should update the updatedAt timestamp', async () => {
      const created = await examSubmissionRepository.upsert({
        examSessionId: sessionId,
        examId,
        questionId,
        studentId,
        code: 'print("time")',
      });

      const originalTime = created.updatedAt;
      await new Promise((resolve) => setTimeout(resolve, 10));

      const updated = await examSubmissionRepository.updateResult(created.id, {
        status: 'COMPLETED',
        score: 100,
        maxScore: 100,
        testResults: [],
      });

      expect(updated!.updatedAt.getTime()).toBeGreaterThanOrEqual(originalTime.getTime());
    });
  });
});
