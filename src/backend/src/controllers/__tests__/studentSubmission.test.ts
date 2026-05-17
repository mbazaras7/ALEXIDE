import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  afterEach,
  beforeEach,
  jest,
} from '@jest/globals';
import request from 'supertest';
import app from '../../app';
import { db } from '../../db';
import {
  users,
  classes,
  classMembers,
  assignments,
  testCases,
  submissions,
  grades,
} from '../../db/schema';
import { eq } from 'drizzle-orm';
import { executionService } from '../../services/execution';

jest.mock('../../services/execution', () => ({
  executionService: {
    executeCode: jest.fn(),
  },
}));

const mockExecutionService = executionService as jest.Mocked<typeof executionService>;

describe('StudentSubmissionController', () => {
  let studentToken: string;
  let studentId: string;
  let teacherToken: string;
  let teacherId: string;
  let classId: string;
  let assignmentId: string;
  const nonExistentId = '00000000-0000-0000-0000-000000000000';

  beforeAll(async () => {
    await db.delete(classes).where(eq(classes.joinCode, 'SUBCTRL1'));
    await db.delete(users).where(eq(users.email, 'subctrl-teacher@gmail.com'));
    await db.delete(users).where(eq(users.email, 'subctrl-student@gmail.com'));

    await request(app).post('/api/backend/auth/register').send({
      email: 'subctrl-teacher@gmail.com',
      password: 'Password123',
      name: 'Teacher',
      role: 'TEACHER',
    });
    await request(app).post('/api/backend/auth/register').send({
      email: 'subctrl-student@gmail.com',
      password: 'Password123',
      name: 'Student',
      role: 'STUDENT',
    });

    const [teacher] = await db
      .select()
      .from(users)
      .where(eq(users.email, 'subctrl-teacher@gmail.com'));
    const [student] = await db
      .select()
      .from(users)
      .where(eq(users.email, 'subctrl-student@gmail.com'));
    teacherId = teacher.id;
    studentId = student.id;

    const teacherLogin = await request(app)
      .post('/api/backend/auth/login')
      .send({ email: 'subctrl-teacher@gmail.com', password: 'Password123' });
    teacherToken = teacherLogin.body.data.token;

    const studentLogin = await request(app)
      .post('/api/backend/auth/login')
      .send({ email: 'subctrl-student@gmail.com', password: 'Password123' });
    studentToken = studentLogin.body.data.token;

    const [cls] = await db
      .insert(classes)
      .values({ name: 'Sub Ctrl Class', teacherId, joinCode: 'SUBCTRL1' })
      .returning();
    classId = cls.id;

    await db.insert(classMembers).values({ classId, studentId });
  });

  beforeEach(async () => {
    const [asgn] = await db
      .insert(assignments)
      .values({
        classId,
        teacherId,
        title: 'Test Assignment',
        maxScore: 100,
        language: 'python',
        status: 'PUBLISHED',
      })
      .returning();
    assignmentId = asgn.id;

    await db.insert(testCases).values([
      {
        assignmentId,
        name: 'Print hello',
        inputData: null,
        expectedOutput: 'hello',
        weight: 1,
        orderIndex: 0,
      },
      {
        assignmentId,
        name: 'Add numbers',
        inputData: '2\n3',
        expectedOutput: '5',
        weight: 1,
        orderIndex: 1,
      },
    ]);

    // Default mock — both test cases pass
    mockExecutionService.executeCode
      .mockResolvedValueOnce({ output: 'hello', exitCode: 0 })
      .mockResolvedValueOnce({ output: '5', exitCode: 0 });
  });

  afterEach(async () => {
    mockExecutionService.executeCode.mockReset();
    await db.delete(submissions).where(eq(submissions.studentId, studentId));
    await db.delete(grades).where(eq(grades.classId, classId));
    await db.delete(assignments).where(eq(assignments.classId, classId));
  });

  afterAll(async () => {
    await db.delete(classMembers).where(eq(classMembers.classId, classId));
    await db.delete(classes).where(eq(classes.id, classId));
    await db.delete(users).where(eq(users.id, studentId));
    await db.delete(users).where(eq(users.id, teacherId));
  });

  describe('POST /api/backend/student/submit/assignments/:assignmentId', () => {
    it('should submit and return score with test results', async () => {
      const response = await request(app)
        .post(`/api/backend/student/submit/assignments/${assignmentId}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ code: 'print("hello")\na=int(input())\nb=int(input())\nprint(a+b)' });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('COMPLETED');
      expect(response.body.data.score).toBeDefined();
      expect(response.body.data.maxScore).toBe(100);
      expect(Array.isArray(response.body.data.testResults)).toBe(true);
      expect(response.body.data.testResults).toHaveLength(2);
    });

    it('should score 0 when all test cases fail', async () => {
      mockExecutionService.executeCode.mockReset();
      mockExecutionService.executeCode
        .mockResolvedValueOnce({ output: 'wrong', exitCode: 0 })
        .mockResolvedValueOnce({ output: 'wrong', exitCode: 0 });

      const response = await request(app)
        .post(`/api/backend/student/submit/assignments/${assignmentId}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ code: 'print("wrong")' });

      expect(response.status).toBe(201);
      expect(response.body.data.score).toBe(0);
      expect(response.body.data.testResults[0].passed).toBe(false);
      expect(response.body.data.testResults[1].passed).toBe(false);
    });

    it('should score 50 when half the test cases pass', async () => {
      mockExecutionService.executeCode.mockReset();
      mockExecutionService.executeCode
        .mockResolvedValueOnce({ output: 'hello', exitCode: 0 })
        .mockResolvedValueOnce({ output: 'wrong', exitCode: 0 });

      const response = await request(app)
        .post(`/api/backend/student/submit/assignments/${assignmentId}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ code: 'print("hello")' });

      expect(response.status).toBe(201);
      expect(response.body.data.score).toBe(50);
      expect(response.body.data.testResults[0].passed).toBe(true);
      expect(response.body.data.testResults[1].passed).toBe(false);
    });

    it('should overwrite previous submission on resubmit', async () => {
      mockExecutionService.executeCode.mockReset();
      mockExecutionService.executeCode
        .mockResolvedValueOnce({ output: 'wrong', exitCode: 0 })
        .mockResolvedValueOnce({ output: 'wrong', exitCode: 0 });

      await request(app)
        .post(`/api/backend/student/submit/assignments/${assignmentId}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ code: 'print("wrong")' });

      mockExecutionService.executeCode.mockReset();
      mockExecutionService.executeCode
        .mockResolvedValueOnce({ output: 'hello', exitCode: 0 })
        .mockResolvedValueOnce({ output: '5', exitCode: 0 });

      const response = await request(app)
        .post(`/api/backend/student/submit/assignments/${assignmentId}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ code: 'print("hello")\na=int(input())\nb=int(input())\nprint(a+b)' });

      expect(response.status).toBe(201);
      expect(response.body.data.score).toBe(100);

      const rows = await db.select().from(submissions).where(eq(submissions.studentId, studentId));
      expect(rows).toHaveLength(1);
    });

    it('should return 400 for DRAFT assignment', async () => {
      const [draft] = await db
        .insert(assignments)
        .values({
          classId,
          teacherId,
          title: 'Draft',
          maxScore: 100,
          language: 'python',
          status: 'DRAFT',
        })
        .returning();

      const response = await request(app)
        .post(`/api/backend/student/submit/assignments/${draft.id}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ code: 'print("hello")' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Assignment is not available for submission');
    });

    it('should return 400 for CLOSED assignment', async () => {
      const [closed] = await db
        .insert(assignments)
        .values({
          classId,
          teacherId,
          title: 'Closed',
          maxScore: 100,
          language: 'python',
          status: 'CLOSED',
        })
        .returning();

      const response = await request(app)
        .post(`/api/backend/student/submit/assignments/${closed.id}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ code: 'print("hello")' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Assignment is not available for submission');
    });

    it('should return 400 if code is missing', async () => {
      const response = await request(app)
        .post(`/api/backend/student/submit/assignments/${assignmentId}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({});

      expect(response.status).toBe(400);
    });

    it('should return 404 for non-existent assignment', async () => {
      const response = await request(app)
        .post(`/api/backend/student/submit/assignments/${nonExistentId}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ code: 'print("hello")' });

      expect(response.status).toBe(404);
    });

    it('should return 400 for invalid UUID', async () => {
      const response = await request(app)
        .post('/api/backend/student/submit/assignments/not-a-uuid')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ code: 'print("hello")' });

      expect(response.status).toBe(400);
    });

    it('should return 403 if teacher tries to submit', async () => {
      const response = await request(app)
        .post(`/api/backend/student/submit/assignments/${assignmentId}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ code: 'print("hello")' });

      expect(response.status).toBe(403);
    });

    it('should return 401 without token', async () => {
      const response = await request(app)
        .post(`/api/backend/student/submit/assignments/${assignmentId}`)
        .send({ code: 'print("hello")' });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/backend/student/submit/assignments/:assignmentId', () => {
    it('should return submission for an assignment', async () => {
      await db.insert(submissions).values({
        assignmentId,
        studentId,
        code: 'print("hello")',
        status: 'COMPLETED',
        score: 100,
        maxScore: 100,
        testResults: JSON.stringify([]),
      });

      const response = await request(app)
        .get(`/api/backend/student/submit/assignments/${assignmentId}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.assignmentId).toBe(assignmentId);
    });

    it('should return 404 if no submission exists', async () => {
      const response = await request(app)
        .get(`/api/backend/student/submit/assignments/${assignmentId}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(404);
    });

    it('should return 400 for invalid UUID', async () => {
      const response = await request(app)
        .get('/api/backend/student/submit/assignments/not-a-uuid')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(400);
    });

    it('should return 403 if teacher tries to access', async () => {
      const response = await request(app)
        .get(`/api/backend/student/submit/assignments/${assignmentId}`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(403);
    });

    it('should return 401 without token', async () => {
      const response = await request(app).get(
        `/api/backend/student/submit/assignments/${assignmentId}`
      );

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/backend/student/submit/:submissionId', () => {
    it('should return submission by ID', async () => {
      const [sub] = await db
        .insert(submissions)
        .values({
          assignmentId,
          studentId,
          code: 'print("hello")',
          status: 'COMPLETED',
          score: 100,
          maxScore: 100,
          testResults: JSON.stringify([]),
        })
        .returning();

      const response = await request(app)
        .get(`/api/backend/student/submit/${sub.id}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.id).toBe(sub.id);
    });

    it('should return 404 for submission belonging to another student', async () => {
      const [other] = await db
        .insert(users)
        .values({
          email: `other-${Date.now()}@gmail.com`,
          password: 'Password123',
          role: 'STUDENT',
        })
        .returning();

      const [sub] = await db
        .insert(submissions)
        .values({
          assignmentId,
          studentId: other.id,
          code: 'print("hello")',
          status: 'COMPLETED',
          score: 100,
          maxScore: 100,
          testResults: JSON.stringify([]),
        })
        .returning();

      const response = await request(app)
        .get(`/api/backend/student/submit/${sub.id}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(404);

      await db.delete(submissions).where(eq(submissions.id, sub.id));
      await db.delete(users).where(eq(users.id, other.id));
    });

    it('should return 404 for non-existent submission', async () => {
      const response = await request(app)
        .get(`/api/backend/student/submit/${nonExistentId}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(404);
    });

    it('should return 400 for invalid UUID', async () => {
      const response = await request(app)
        .get('/api/backend/student/submit/not-a-uuid')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(400);
    });

    it('should return 401 without token', async () => {
      const response = await request(app).get(`/api/backend/student/submit/${nonExistentId}`);

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/backend/student/submit/classes/:classId', () => {
    it('should return all submissions for a class', async () => {
      await db.insert(submissions).values({
        assignmentId,
        studentId,
        code: 'print("hello")',
        status: 'COMPLETED',
        score: 100,
        maxScore: 100,
        testResults: JSON.stringify([]),
      });

      const response = await request(app)
        .get(`/api/backend/student/submit/classes/${classId}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].assignmentId).toBe(assignmentId);
    });

    it('should return empty array if no submissions', async () => {
      const response = await request(app)
        .get(`/api/backend/student/submit/classes/${classId}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(0);
    });

    it('should return 400 if not enrolled in class', async () => {
      const response = await request(app)
        .get(`/api/backend/student/submit/classes/${nonExistentId}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(400);
    });

    it('should return 400 for invalid UUID', async () => {
      const response = await request(app)
        .get('/api/backend/student/submit/classes/not-a-uuid')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(400);
    });

    it('should return 403 if teacher tries to access', async () => {
      const response = await request(app)
        .get(`/api/backend/student/submit/classes/${classId}`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/backend/student/submit/classes/:classId/assignments/:assignmentId', () => {
    it('should return submission for specific class and assignment', async () => {
      await db.insert(submissions).values({
        assignmentId,
        studentId,
        code: 'print("hello")',
        status: 'COMPLETED',
        score: 100,
        maxScore: 100,
        testResults: JSON.stringify([]),
      });

      const response = await request(app)
        .get(`/api/backend/student/submit/classes/${classId}/assignments/${assignmentId}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.assignmentId).toBe(assignmentId);
    });

    it('should return 404 if no submission exists', async () => {
      const response = await request(app)
        .get(`/api/backend/student/submit/classes/${classId}/assignments/${assignmentId}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(404);
    });

    it('should return 400 if not enrolled', async () => {
      const response = await request(app)
        .get(`/api/backend/student/submit/classes/${nonExistentId}/assignments/${assignmentId}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(400);
    });

    it('should return 400 for invalid classId UUID', async () => {
      const response = await request(app)
        .get(`/api/backend/student/submit/classes/not-a-uuid/assignments/${assignmentId}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(400);
    });

    it('should return 400 for invalid assignmentId UUID', async () => {
      const response = await request(app)
        .get(`/api/backend/student/submit/classes/${classId}/assignments/not-a-uuid`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(400);
    });

    it('should return 403 if teacher tries to access', async () => {
      const response = await request(app)
        .get(`/api/backend/student/submit/classes/${classId}/assignments/${assignmentId}`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(403);
    });

    it('should return 401 without token', async () => {
      const response = await request(app).get(
        `/api/backend/student/submit/classes/${classId}/assignments/${assignmentId}`
      );

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/backend/student/submit/:submissionId/feedback', () => {
    it('should return feedback when it has been released', async () => {
      const [sub] = await db
        .insert(submissions)
        .values({
          assignmentId,
          studentId,
          code: 'print("hello")',
          status: 'COMPLETED',
          score: 100,
          maxScore: 100,
          testResults: JSON.stringify([]),
          feedback: 'Great work on this submission.',
          feedbackUpdatedAt: new Date(),
        })
        .returning();

      await db.insert(grades).values({
        classId,
        studentId,
        sourceId: assignmentId,
        sourceType: 'ASSIGNMENT',
        score: 100,
        maxScore: 100,
        releasedAt: new Date(),
      });

      const response = await request(app)
        .get(`/api/backend/student/submit/${sub.id}/feedback`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.feedback).toBe('Great work on this submission.');
      expect(response.body.data.aiFeedback).toBeUndefined();
    });

    it('should return submission with null feedback when none has been set', async () => {
      const [sub] = await db
        .insert(submissions)
        .values({
          assignmentId,
          studentId,
          code: 'print("hello")',
          status: 'COMPLETED',
          score: 100,
          maxScore: 100,
          testResults: JSON.stringify([]),
        })
        .returning();

      const response = await request(app)
        .get(`/api/backend/student/submit/${sub.id}/feedback`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.feedback).toBeNull();
      expect(response.body.data.aiFeedback).toBeUndefined();
    });

    it('should return 404 for submission belonging to another student', async () => {
      const [other] = await db
        .insert(users)
        .values({
          email: `other-feedback-${Date.now()}@gmail.com`,
          password: 'Password123',
          role: 'STUDENT',
        })
        .returning();

      const [sub] = await db
        .insert(submissions)
        .values({
          assignmentId,
          studentId: other.id,
          code: 'print("hello")',
          status: 'COMPLETED',
          score: 100,
          maxScore: 100,
          testResults: JSON.stringify([]),
          feedback: 'This belongs to another student.',
          feedbackUpdatedAt: new Date(),
        })
        .returning();

      const response = await request(app)
        .get(`/api/backend/student/submit/${sub.id}/feedback`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(404);

      await db.delete(submissions).where(eq(submissions.id, sub.id));
      await db.delete(users).where(eq(users.id, other.id));
    });
  });
});
