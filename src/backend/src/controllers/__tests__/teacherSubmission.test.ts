import { describe, it, expect, beforeAll, afterAll, afterEach, beforeEach } from '@jest/globals';
import request from 'supertest';
import app from '../../app';
import { db } from '../../db';
import { users, classes, classMembers, assignments, submissions, grades } from '../../db/schema';
import { eq } from 'drizzle-orm';

describe('TeacherSubmissionController', () => {
  let teacherToken: string;
  let teacherId: string;
  let studentToken: string;
  let studentId: string;
  let classId: string;
  let assignmentId: string;
  let submissionId: string;
  const nonExistentId = '00000000-0000-0000-0000-000000000000';

  beforeAll(async () => {
    await db.delete(classes).where(eq(classes.joinCode, 'TSUBCTRL1'));
    await db.delete(users).where(eq(users.email, 'tsubctrl-teacher@gmail.com'));
    await db.delete(users).where(eq(users.email, 'tsubctrl-student@gmail.com'));

    await request(app).post('/api/backend/auth/register').send({
      email: 'tsubctrl-teacher@gmail.com',
      password: 'Password123',
      name: 'Teacher',
      role: 'TEACHER',
    });
    await request(app).post('/api/backend/auth/register').send({
      email: 'tsubctrl-student@gmail.com',
      password: 'Password123',
      name: 'Student',
      role: 'STUDENT',
    });

    const [teacher] = await db
      .select()
      .from(users)
      .where(eq(users.email, 'tsubctrl-teacher@gmail.com'));
    const [student] = await db
      .select()
      .from(users)
      .where(eq(users.email, 'tsubctrl-student@gmail.com'));
    teacherId = teacher.id;
    studentId = student.id;

    const teacherLogin = await request(app)
      .post('/api/backend/auth/login')
      .send({ email: 'tsubctrl-teacher@gmail.com', password: 'Password123' });
    teacherToken = teacherLogin.body.data.token;

    const studentLogin = await request(app)
      .post('/api/backend/auth/login')
      .send({ email: 'tsubctrl-student@gmail.com', password: 'Password123' });
    studentToken = studentLogin.body.data.token;

    const [cls] = await db
      .insert(classes)
      .values({ name: 'TSub Ctrl Class', teacherId, joinCode: 'TSUBCTRL1' })
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

    const [sub] = await db
      .insert(submissions)
      .values({
        assignmentId,
        studentId,
        code: 'print("hello")',
        status: 'COMPLETED',
        score: 100,
        maxScore: 100,
        testResults: JSON.stringify([
          { name: 'Test 1', passed: true, actualOutput: 'hello', expectedOutput: 'hello' },
        ]),
      })
      .returning();
    submissionId = sub.id;
  });

  afterEach(async () => {
    await db.delete(submissions).where(eq(submissions.assignmentId, assignmentId));
    await db.delete(grades).where(eq(grades.classId, classId));
    await db.delete(assignments).where(eq(assignments.classId, classId));
  });

  afterAll(async () => {
    await db.delete(classMembers).where(eq(classMembers.classId, classId));
    await db.delete(classes).where(eq(classes.id, classId));
    await db.delete(users).where(eq(users.id, studentId));
    await db.delete(users).where(eq(users.id, teacherId));
  });

  describe('GET /api/backend/teacher/submit/assignments/:assignmentId', () => {
    it('should return all submissions for an assignment', async () => {
      const response = await request(app)
        .get(`/api/backend/teacher/submit/assignments/${assignmentId}`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].studentId).toBe(studentId);
    });

    it('should return empty array if no submissions', async () => {
      await db.delete(submissions).where(eq(submissions.assignmentId, assignmentId));

      const response = await request(app)
        .get(`/api/backend/teacher/submit/assignments/${assignmentId}`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(0);
    });

    it('should return 404 if assignment not owned by teacher', async () => {
      const response = await request(app)
        .get(`/api/backend/teacher/submit/assignments/${nonExistentId}`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(404);
    });

    it('should return 403 if student tries to access', async () => {
      const response = await request(app)
        .get(`/api/backend/teacher/submit/assignments/${assignmentId}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(403);
    });

    it('should return 401 without token', async () => {
      const response = await request(app).get(
        `/api/backend/teacher/submit/assignments/${assignmentId}`
      );

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/backend/teacher/submit/:submissionId', () => {
    it('should return a specific submission', async () => {
      const response = await request(app)
        .get(`/api/backend/teacher/submit/${submissionId}`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.id).toBe(submissionId);
      expect(response.body.data.code).toBeDefined();
      expect(Array.isArray(response.body.data.testResults)).toBe(true);
    });

    it("should return 404 for submission not belonging to teacher's assignment", async () => {
      const response = await request(app)
        .get(`/api/backend/teacher/submit/${nonExistentId}`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(404);
    });

    it('should return 400 for invalid UUID', async () => {
      const response = await request(app)
        .get('/api/backend/teacher/submit/not-a-uuid')
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/backend/teacher/submit/classes/:classId', () => {
    it('should return all submissions across a class', async () => {
      const response = await request(app)
        .get(`/api/backend/teacher/submit/classes/${classId}`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data).toHaveLength(1);
    });

    it('should return 404 if class not owned by teacher', async () => {
      const response = await request(app)
        .get(`/api/backend/teacher/submit/classes/${nonExistentId}`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(404);
    });

    it('should return 403 if student tries to access', async () => {
      const response = await request(app)
        .get(`/api/backend/teacher/submit/classes/${classId}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/backend/teacher/submit/classes/:classId/assignments/:assignmentId', () => {
    it('should return all submissions for a class + assignment', async () => {
      const response = await request(app)
        .get(`/api/backend/teacher/submit/classes/${classId}/assignments/${assignmentId}`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].assignmentId).toBe(assignmentId);
    });

    it('should return 404 if class not owned by teacher', async () => {
      const response = await request(app)
        .get(`/api/backend/teacher/submit/classes/${nonExistentId}/assignments/${assignmentId}`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(404);
    });
  });
  describe('POST /api/backend/teacher/submit/:submissionId/regrade', () => {
    it('should return 200 and re-grade a COMPLETED submission', async () => {
      const response = await request(app)
        .post(`/api/backend/teacher/submit/${submissionId}/regrade`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should return 200 and re-grade a FAILED submission', async () => {
      await db
        .update(submissions)
        .set({ status: 'FAILED', score: null, maxScore: null, testResults: null })
        .where(eq(submissions.id, submissionId));

      const response = await request(app)
        .post(`/api/backend/teacher/submit/${submissionId}/regrade`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should update submission to COMPLETED with a score after re-grade', async () => {
      await db
        .update(submissions)
        .set({ status: 'FAILED', score: null, maxScore: null })
        .where(eq(submissions.id, submissionId));

      await request(app)
        .post(`/api/backend/teacher/submit/${submissionId}/regrade`)
        .set('Authorization', `Bearer ${teacherToken}`);

      const [updated] = await db.select().from(submissions).where(eq(submissions.id, submissionId));

      expect(updated.status).toBe('COMPLETED');
      expect(updated.score).not.toBeNull();
    });

    it('should upsert a grade record after re-grade', async () => {
      await db
        .update(submissions)
        .set({ status: 'FAILED' })
        .where(eq(submissions.id, submissionId));

      await request(app)
        .post(`/api/backend/teacher/submit/${submissionId}/regrade`)
        .set('Authorization', `Bearer ${teacherToken}`);

      const gradeRows = await db.select().from(grades).where(eq(grades.sourceId, assignmentId));

      expect(gradeRows).toHaveLength(1);
      expect(gradeRows[0].studentId).toBe(studentId);
    });

    it('should return 400 if submission is already RUNNING', async () => {
      await db
        .update(submissions)
        .set({ status: 'RUNNING' })
        .where(eq(submissions.id, submissionId));

      const response = await request(app)
        .post(`/api/backend/teacher/submit/${submissionId}/regrade`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Submission is already being graded');
    });

    it("should return 404 for a submission not belonging to teacher's assignment", async () => {
      const response = await request(app)
        .post(`/api/backend/teacher/submit/${nonExistentId}/regrade`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(404);
    });

    it("should return 404 for a submission on another teacher's assignment", async () => {
      const [otherClass] = await db
        .insert(classes)
        .values({ name: 'Other Class', teacherId: studentId, joinCode: `OTHTSUB-${Date.now()}` })
        .returning();

      const [otherAsgn] = await db
        .insert(assignments)
        .values({
          classId: otherClass.id,
          teacherId: studentId,
          title: 'Other',
          maxScore: 100,
          language: 'python',
          status: 'PUBLISHED',
        })
        .returning();

      const [otherSub] = await db
        .insert(submissions)
        .values({
          assignmentId: otherAsgn.id,
          studentId,
          code: 'print()',
          status: 'COMPLETED',
          score: 0,
          maxScore: 100,
        })
        .returning();

      const response = await request(app)
        .post(`/api/backend/teacher/submit/${otherSub.id}/regrade`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(404);

      await db.delete(submissions).where(eq(submissions.id, otherSub.id));
      await db.delete(assignments).where(eq(assignments.id, otherAsgn.id));
      await db.delete(classes).where(eq(classes.id, otherClass.id));
    });

    it('should return 403 if a student tries to re-grade', async () => {
      const response = await request(app)
        .post(`/api/backend/teacher/submit/${submissionId}/regrade`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/backend/teacher/submit/assignments/:assignmentId/stats', () => {
    it('should return stats for an assignment', async () => {
      const [otherStudent] = await db
        .insert(users)
        .values({
          email: `tsubctrl-other-student-${Date.now()}@gmail.com`,
          password: 'Password123',
          role: 'STUDENT',
          name: 'Other Student',
        })
        .returning();

      await db.insert(classMembers).values({ classId, studentId: otherStudent.id });

      await db.insert(submissions).values({
        assignmentId,
        studentId: otherStudent.id,
        code: 'print("fail")',
        status: 'FAILED',
        score: 40,
        maxScore: 100,
        testResults: JSON.stringify([
          { name: 'Test 1', passed: false, actualOutput: 'fail', expectedOutput: 'hello' },
        ]),
      });

      const response = await request(app)
        .get(`/api/backend/teacher/submit/assignments/${assignmentId}/stats`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(200);
      const stats = response.body.data;
      expect(stats.assignmentId).toBe(assignmentId);
      expect(stats.totalSubmissions).toBe(2);
      expect(stats.completedCount).toBe(1);
      expect(stats.failedCount).toBe(1);
      expect(stats.pendingCount).toBe(0);
      expect(stats.averageScore).toBeCloseTo(100, 1);
      expect(stats.averagePercentage).toBeCloseTo(100, 1);
      expect(stats.passRate).toBe(100);

      await db.delete(classMembers).where(eq(classMembers.studentId, otherStudent.id));
      await db.delete(users).where(eq(users.id, otherStudent.id));
    });

    it('should return zeros when there are no submissions', async () => {
      await db.delete(submissions).where(eq(submissions.assignmentId, assignmentId));

      const response = await request(app)
        .get(`/api/backend/teacher/submit/assignments/${assignmentId}/stats`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(200);
      const stats = response.body.data;
      expect(stats.totalSubmissions).toBe(0);
      expect(stats.passRate).toBe(0);
      expect(stats.averageScore).toBe(0);
      expect(stats.averagePercentage).toBe(0);
    });

    it('should return 404 if assignment not owned by teacher', async () => {
      const response = await request(app)
        .get(`/api/backend/teacher/submit/assignments/${nonExistentId}/stats`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(404);
    });

    it('should return 401 without token', async () => {
      const response = await request(app).get(
        `/api/backend/teacher/submit/assignments/${assignmentId}/stats`
      );

      expect(response.status).toBe(401);
    });
  });

  describe('PATCH /api/backend/teacher/submit/:submissionId/feedback', () => {
    it('should save feedback on a submission', async () => {
      const response = await request(app)
        .patch(`/api/backend/teacher/submit/${submissionId}/feedback`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ feedback: 'Good attempt, check your output formatting.' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      const [updated] = await db.select().from(submissions).where(eq(submissions.id, submissionId));
      expect(updated.feedback).toBe('Good attempt, check your output formatting.');
    });

    it('should overwrite existing feedback', async () => {
      await db
        .update(submissions)
        .set({ feedback: 'Old feedback' })
        .where(eq(submissions.id, submissionId));

      const response = await request(app)
        .patch(`/api/backend/teacher/submit/${submissionId}/feedback`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ feedback: 'New feedback' });

      expect(response.status).toBe(200);

      const [updated] = await db.select().from(submissions).where(eq(submissions.id, submissionId));
      expect(updated.feedback).toBe('New feedback');
    });

    it('should return 400 if feedback is an empty string', async () => {
      const response = await request(app)
        .patch(`/api/backend/teacher/submit/${submissionId}/feedback`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ feedback: '' });

      expect(response.status).toBe(400);
    });

    it("should return 404 for submission on another teacher's assignment", async () => {
      const [otherClass] = await db
        .insert(classes)
        .values({ name: 'Other Class', teacherId: studentId, joinCode: `OTHFB-${Date.now()}` })
        .returning();

      const [otherAsgn] = await db
        .insert(assignments)
        .values({
          classId: otherClass.id,
          teacherId: studentId,
          title: 'Other',
          maxScore: 100,
          language: 'python',
          status: 'PUBLISHED',
        })
        .returning();

      const [otherSub] = await db
        .insert(submissions)
        .values({
          assignmentId: otherAsgn.id,
          studentId,
          code: 'print()',
          status: 'COMPLETED',
          score: 0,
          maxScore: 100,
        })
        .returning();

      const response = await request(app)
        .patch(`/api/backend/teacher/submit/${otherSub.id}/feedback`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ feedback: 'Sneaky feedback.' });

      expect(response.status).toBe(404);

      await db.delete(submissions).where(eq(submissions.id, otherSub.id));
      await db.delete(assignments).where(eq(assignments.id, otherAsgn.id));
      await db.delete(classes).where(eq(classes.id, otherClass.id));
    });

    it('should return 403 if student tries to save feedback', async () => {
      const response = await request(app)
        .patch(`/api/backend/teacher/submit/${submissionId}/feedback`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ feedback: 'Good work.' });

      expect(response.status).toBe(403);
    });
  });

  describe('POST /api/backend/teacher/submit/:submissionId/feedback/adopt-ai', () => {
    it('should adopt AI feedback as the published feedback', async () => {
      await db
        .update(submissions)
        .set({ aiFeedback: 'AI generated feedback here.', aiFeedbackGeneratedAt: new Date() })
        .where(eq(submissions.id, submissionId));

      const response = await request(app)
        .post(`/api/backend/teacher/submit/${submissionId}/feedback/adopt-ai`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      const [updated] = await db.select().from(submissions).where(eq(submissions.id, submissionId));
      expect(updated.feedback).toBe('AI generated feedback here.');
    });

    it('should overwrite existing manual feedback when adopting AI feedback', async () => {
      await db
        .update(submissions)
        .set({
          feedback: 'Old manual feedback',
          aiFeedback: 'Better AI feedback.',
          aiFeedbackGeneratedAt: new Date(),
        })
        .where(eq(submissions.id, submissionId));

      await request(app)
        .post(`/api/backend/teacher/submit/${submissionId}/feedback/adopt-ai`)
        .set('Authorization', `Bearer ${teacherToken}`);

      const [updated] = await db.select().from(submissions).where(eq(submissions.id, submissionId));
      expect(updated.feedback).toBe('Better AI feedback.');
    });

    it('should return 400 when no AI feedback exists on the submission', async () => {
      const response = await request(app)
        .post(`/api/backend/teacher/submit/${submissionId}/feedback/adopt-ai`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('No AI feedback available for this submission');
    });

    it("should return 404 for submission on another teacher's assignment", async () => {
      const [otherClass] = await db
        .insert(classes)
        .values({ name: 'Other Class', teacherId: studentId, joinCode: `OTHAI-${Date.now()}` })
        .returning();

      const [otherAsgn] = await db
        .insert(assignments)
        .values({
          classId: otherClass.id,
          teacherId: studentId,
          title: 'Other',
          maxScore: 100,
          language: 'python',
          status: 'PUBLISHED',
        })
        .returning();

      const [otherSub] = await db
        .insert(submissions)
        .values({
          assignmentId: otherAsgn.id,
          studentId,
          code: 'print()',
          status: 'COMPLETED',
          score: 0,
          maxScore: 100,
          aiFeedback: 'AI feedback on other submission.',
          aiFeedbackGeneratedAt: new Date(),
        })
        .returning();

      const response = await request(app)
        .post(`/api/backend/teacher/submit/${otherSub.id}/feedback/adopt-ai`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(404);

      await db.delete(submissions).where(eq(submissions.id, otherSub.id));
      await db.delete(assignments).where(eq(assignments.id, otherAsgn.id));
      await db.delete(classes).where(eq(classes.id, otherClass.id));
    });

    it('should return 403 if student tries to adopt AI feedback', async () => {
      await db
        .update(submissions)
        .set({ aiFeedback: 'AI generated feedback here.', aiFeedbackGeneratedAt: new Date() })
        .where(eq(submissions.id, submissionId));

      const response = await request(app)
        .post(`/api/backend/teacher/submit/${submissionId}/feedback/adopt-ai`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(403);
    });
  });
});
