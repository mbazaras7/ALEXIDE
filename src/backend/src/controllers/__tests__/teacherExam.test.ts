import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import request from 'supertest';
import app from '../../app';
import { db } from '../../db';
import {
  users,
  classes,
  exams,
  examQuestions,
  examTestCases,
  examSessions,
  examQuestionSubmissions,
} from '../../db/schema';
import { eq } from 'drizzle-orm';

describe('TeacherExamController', () => {
  let teacherToken: string;
  let teacherId: string;
  let studentToken: string;
  let studentId: string;
  let classId: string;
  const nonExistentId = '00000000-0000-0000-0000-000000000000';

  beforeAll(async () => {
    await db.delete(classes).where(eq(classes.joinCode, 'EXAMCTRL1'));
    await db.delete(users).where(eq(users.email, 'exam-ctrl-teacher@gmail.com'));
    await db.delete(users).where(eq(users.email, 'exam-ctrl-student@gmail.com'));

    await request(app).post('/api/backend/auth/register').send({
      email: 'exam-ctrl-teacher@gmail.com',
      password: 'Password123',
      name: 'Exam Teacher',
      role: 'TEACHER',
    });
    await request(app).post('/api/backend/auth/register').send({
      email: 'exam-ctrl-student@gmail.com',
      password: 'Password123',
      name: 'Exam Student',
      role: 'STUDENT',
    });

    const [teacher] = await db
      .select()
      .from(users)
      .where(eq(users.email, 'exam-ctrl-teacher@gmail.com'));
    const [student] = await db
      .select()
      .from(users)
      .where(eq(users.email, 'exam-ctrl-student@gmail.com'));
    teacherId = teacher.id;
    studentId = student.id;

    const teacherLogin = await request(app)
      .post('/api/backend/auth/login')
      .send({ email: 'exam-ctrl-teacher@gmail.com', password: 'Password123' });
    teacherToken = teacherLogin.body.data.token;

    const studentLogin = await request(app)
      .post('/api/backend/auth/login')
      .send({ email: 'exam-ctrl-student@gmail.com', password: 'Password123' });
    studentToken = studentLogin.body.data.token;

    const [cls] = await db
      .insert(classes)
      .values({ name: 'Exam Ctrl Class', teacherId, joinCode: 'EXAMCTRL1' })
      .returning();
    classId = cls.id;
  });

  afterEach(async () => {
    if (classId) {
      await db.delete(exams).where(eq(exams.classId, classId));
    }
  });

  afterAll(async () => {
    if (classId) await db.delete(classes).where(eq(classes.id, classId));
    if (studentId) await db.delete(users).where(eq(users.id, studentId));
    if (teacherId) await db.delete(users).where(eq(users.id, teacherId));
  });

  describe('POST /api/backend/teacher/exams/:classId', () => {
    it('should create a DRAFT exam and return 201', async () => {
      const response = await request(app)
        .post(`/api/backend/teacher/exams/${classId}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ title: 'Python Exam' });

      expect(response.status).toBe(201);
      expect(response.body.data.title).toBe('Python Exam');
      expect(response.body.data.status).toBe('DRAFT');
      expect(response.body.data.maxScore).toBe(100);
      expect(response.body.data.durationMinutes).toBe(60);
      expect(response.body.data.language).toBe('python');
      expect(response.body.data.classId).toBe(classId);
    });

    it('should create with custom durationMinutes and maxScore', async () => {
      const response = await request(app)
        .post(`/api/backend/teacher/exams/${classId}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ title: 'Custom Exam', durationMinutes: 90, maxScore: 50 });

      expect(response.status).toBe(201);
      expect(response.body.data.durationMinutes).toBe(90);
      expect(response.body.data.maxScore).toBe(50);
    });

    it('should create with scheduled dates', async () => {
      const start = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      const end = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

      const response = await request(app)
        .post(`/api/backend/teacher/exams/${classId}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ title: 'Scheduled Exam', scheduledStart: start, scheduledEnd: end });

      expect(response.status).toBe(201);
      expect(response.body.data.scheduledStart).not.toBeNull();
      expect(response.body.data.scheduledEnd).not.toBeNull();
    });

    it('should return 400 if scheduledEnd is before scheduledStart', async () => {
      const start = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
      const end = new Date(Date.now() + 60 * 60 * 1000).toISOString();

      const response = await request(app)
        .post(`/api/backend/teacher/exams/${classId}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ title: 'Bad Dates', scheduledStart: start, scheduledEnd: end });

      expect(response.status).toBe(400);
    });

    it('should return 400 if title is missing', async () => {
      const response = await request(app)
        .post(`/api/backend/teacher/exams/${classId}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ durationMinutes: 60 });

      expect(response.status).toBe(400);
    });

    it('should return 400 if title is empty', async () => {
      const response = await request(app)
        .post(`/api/backend/teacher/exams/${classId}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ title: '' });

      expect(response.status).toBe(400);
    });

    it('should return 404 for non-existent class', async () => {
      const response = await request(app)
        .post(`/api/backend/teacher/exams/${nonExistentId}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ title: 'Orphan Exam' });

      expect(response.status).toBe(404);
    });

    it('should return 401 without token', async () => {
      const response = await request(app)
        .post(`/api/backend/teacher/exams/${classId}`)
        .send({ title: 'Unauth' });

      expect(response.status).toBe(401);
    });

    it('should return 403 if user is a student', async () => {
      const response = await request(app)
        .post(`/api/backend/teacher/exams/${classId}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ title: 'Sneaky' });

      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/backend/teacher/exams/class/:classId', () => {
    it('should return all exams for a class', async () => {
      await db.insert(exams).values([
        {
          classId,
          teacherId,
          title: 'Exam 1',
          maxScore: 100,
          language: 'python',
          durationMinutes: 60,
          status: 'DRAFT',
        },
        {
          classId,
          teacherId,
          title: 'Exam 2',
          maxScore: 100,
          language: 'python',
          durationMinutes: 60,
          status: 'DRAFT',
        },
      ]);

      const response = await request(app)
        .get(`/api/backend/teacher/exams/class/${classId}`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThanOrEqual(2);
    });

    it('should return empty array when no exams', async () => {
      const response = await request(app)
        .get(`/api/backend/teacher/exams/class/${classId}`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(0);
    });

    it('should return 401 without token', async () => {
      const response = await request(app).get(`/api/backend/teacher/exams/class/${classId}`);

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/backend/teacher/exams/:examId', () => {
    it('should return exam with questions array', async () => {
      const [created] = await db
        .insert(exams)
        .values({
          classId,
          teacherId,
          title: 'Full Exam',
          maxScore: 100,
          language: 'python',
          durationMinutes: 60,
          status: 'DRAFT',
        })
        .returning();

      const response = await request(app)
        .get(`/api/backend/teacher/exams/${created.id}`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.id).toBe(created.id);
      expect(Array.isArray(response.body.data.questions)).toBe(true);
    });

    it('should return exam with questions and test cases populated', async () => {
      const [created] = await db
        .insert(exams)
        .values({
          classId,
          teacherId,
          title: 'Populated Exam',
          maxScore: 100,
          language: 'python',
          durationMinutes: 60,
          status: 'DRAFT',
        })
        .returning();

      const [question] = await db
        .insert(examQuestions)
        .values({
          examId: created.id,
          title: 'Q1',
          maxScore: 50,
          language: 'python',
          orderIndex: 0,
        })
        .returning();

      await db.insert(examTestCases).values({
        questionId: question.id,
        name: 'TC1',
        expectedOutput: 'hello',
        weight: 1,
        orderIndex: 0,
      });

      const response = await request(app)
        .get(`/api/backend/teacher/exams/${created.id}`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.questions).toHaveLength(1);
      expect(response.body.data.questions[0].testCases).toHaveLength(1);
      expect(response.body.data.questions[0].testCases[0].expectedOutput).toBe('hello');
    });

    it('should return 404 for non-existent exam', async () => {
      const response = await request(app)
        .get(`/api/backend/teacher/exams/${nonExistentId}`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('PATCH /api/backend/teacher/exams/:examId', () => {
    it('should update title', async () => {
      const [created] = await db
        .insert(exams)
        .values({
          classId,
          teacherId,
          title: 'Old Title',
          maxScore: 100,
          language: 'python',
          durationMinutes: 60,
          status: 'DRAFT',
        })
        .returning();

      const response = await request(app)
        .patch(`/api/backend/teacher/exams/${created.id}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ title: 'New Title' });

      expect(response.status).toBe(200);
      expect(response.body.data.title).toBe('New Title');
    });

    it('should update status to SCHEDULED', async () => {
      const [created] = await db
        .insert(exams)
        .values({
          classId,
          teacherId,
          title: 'Status Exam',
          maxScore: 100,
          language: 'python',
          durationMinutes: 60,
          status: 'DRAFT',
        })
        .returning();

      const response = await request(app)
        .patch(`/api/backend/teacher/exams/${created.id}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ status: 'SCHEDULED' });

      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe('SCHEDULED');
    });

    it('should return 400 for empty body', async () => {
      const [created] = await db
        .insert(exams)
        .values({
          classId,
          teacherId,
          title: 'No Change',
          maxScore: 100,
          language: 'python',
          durationMinutes: 60,
          status: 'DRAFT',
        })
        .returning();

      const response = await request(app)
        .patch(`/api/backend/teacher/exams/${created.id}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({});

      expect(response.status).toBe(400);
    });

    it('should return 400 when editing an ACTIVE exam', async () => {
      const [created] = await db
        .insert(exams)
        .values({
          classId,
          teacherId,
          title: 'Active Exam',
          maxScore: 100,
          language: 'python',
          durationMinutes: 60,
          status: 'ACTIVE',
        })
        .returning();

      const response = await request(app)
        .patch(`/api/backend/teacher/exams/${created.id}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ title: 'Nope' });

      expect(response.status).toBe(400);
    });

    it('should return 404 for non-existent exam', async () => {
      const response = await request(app)
        .patch(`/api/backend/teacher/exams/${nonExistentId}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ title: 'Ghost' });

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/backend/teacher/exams/:examId/publish', () => {
    it('should publish an exam with questions and return SCHEDULED', async () => {
      const [created] = await db
        .insert(exams)
        .values({
          classId,
          teacherId,
          title: 'Publish Me',
          maxScore: 100,
          language: 'python',
          durationMinutes: 60,
          status: 'DRAFT',
        })
        .returning();

      await db.insert(examQuestions).values({
        examId: created.id,
        title: 'Q1',
        maxScore: 100,
        language: 'python',
        orderIndex: 0,
      });

      const response = await request(app)
        .post(`/api/backend/teacher/exams/${created.id}/publish`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe('SCHEDULED');
    });

    it('should return 400 for exam with no questions', async () => {
      const [created] = await db
        .insert(exams)
        .values({
          classId,
          teacherId,
          title: 'Empty Exam',
          maxScore: 100,
          language: 'python',
          durationMinutes: 60,
          status: 'DRAFT',
        })
        .returning();

      const response = await request(app)
        .post(`/api/backend/teacher/exams/${created.id}/publish`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(400);
    });

    it('should return 404 for non-existent exam', async () => {
      const response = await request(app)
        .post(`/api/backend/teacher/exams/${nonExistentId}/publish`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/backend/teacher/exams/:examId', () => {
    it('should delete exam and return 200', async () => {
      const [created] = await db
        .insert(exams)
        .values({
          classId,
          teacherId,
          title: 'Delete Me',
          maxScore: 100,
          language: 'python',
          durationMinutes: 60,
          status: 'DRAFT',
        })
        .returning();

      const response = await request(app)
        .delete(`/api/backend/teacher/exams/${created.id}`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(200);

      const found = await db.select().from(exams).where(eq(exams.id, created.id));
      expect(found).toHaveLength(0);
    });

    it('should return 400 when deleting an ACTIVE exam', async () => {
      const [created] = await db
        .insert(exams)
        .values({
          classId,
          teacherId,
          title: 'Active Del',
          maxScore: 100,
          language: 'python',
          durationMinutes: 60,
          status: 'ACTIVE',
        })
        .returning();

      const response = await request(app)
        .delete(`/api/backend/teacher/exams/${created.id}`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(400);
    });

    it('should cascade delete questions and test cases', async () => {
      const [created] = await db
        .insert(exams)
        .values({
          classId,
          teacherId,
          title: 'Cascade Del',
          maxScore: 100,
          language: 'python',
          durationMinutes: 60,
          status: 'DRAFT',
        })
        .returning();

      const [q] = await db
        .insert(examQuestions)
        .values({
          examId: created.id,
          title: 'Q1',
          maxScore: 100,
          language: 'python',
          orderIndex: 0,
        })
        .returning();

      const [tc] = await db
        .insert(examTestCases)
        .values({ questionId: q.id, name: 'TC', expectedOutput: 'out', weight: 1, orderIndex: 0 })
        .returning();

      await request(app)
        .delete(`/api/backend/teacher/exams/${created.id}`)
        .set('Authorization', `Bearer ${teacherToken}`);

      const foundQ = await db.select().from(examQuestions).where(eq(examQuestions.id, q.id));
      const foundTC = await db.select().from(examTestCases).where(eq(examTestCases.id, tc.id));
      expect(foundQ).toHaveLength(0);
      expect(foundTC).toHaveLength(0);
    });

    it('should return 404 for non-existent exam', async () => {
      const response = await request(app)
        .delete(`/api/backend/teacher/exams/${nonExistentId}`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/backend/teacher/exams/:examId/questions', () => {
    it('should add a question and return 201', async () => {
      const [exam] = await db
        .insert(exams)
        .values({
          classId,
          teacherId,
          title: 'Q Exam',
          maxScore: 100,
          language: 'python',
          durationMinutes: 60,
          status: 'DRAFT',
        })
        .returning();

      const response = await request(app)
        .post(`/api/backend/teacher/exams/${exam.id}/questions`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ title: 'Write a sum function', maxScore: 50 });

      expect(response.status).toBe(201);
      expect(response.body.data.title).toBe('Write a sum function');
      expect(response.body.data.maxScore).toBe(50);
      expect(response.body.data.orderIndex).toBe(0);
    });

    it('should return 400 for missing title', async () => {
      const [exam] = await db
        .insert(exams)
        .values({
          classId,
          teacherId,
          title: 'Q Exam 2',
          maxScore: 100,
          language: 'python',
          durationMinutes: 60,
          status: 'DRAFT',
        })
        .returning();

      const response = await request(app)
        .post(`/api/backend/teacher/exams/${exam.id}/questions`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ maxScore: 50 });

      expect(response.status).toBe(400);
    });

    it('should return 400 when exam is not in DRAFT status', async () => {
      const [exam] = await db
        .insert(exams)
        .values({
          classId,
          teacherId,
          title: 'Active Q Exam',
          maxScore: 100,
          language: 'python',
          durationMinutes: 60,
          status: 'ACTIVE',
        })
        .returning();

      const response = await request(app)
        .post(`/api/backend/teacher/exams/${exam.id}/questions`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ title: 'Late Question' });

      expect(response.status).toBe(400);
    });

    it('should return 404 for non-existent exam', async () => {
      const response = await request(app)
        .post(`/api/backend/teacher/exams/${nonExistentId}/questions`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ title: 'Ghost Q' });

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/backend/teacher/exams/:examId/questions/:questionId/test-cases', () => {
    it('should add a test case and return 201', async () => {
      const [exam] = await db
        .insert(exams)
        .values({
          classId,
          teacherId,
          title: 'TC Exam',
          maxScore: 100,
          language: 'python',
          durationMinutes: 60,
          status: 'DRAFT',
        })
        .returning();

      const [question] = await db
        .insert(examQuestions)
        .values({ examId: exam.id, title: 'Q1', maxScore: 100, language: 'python', orderIndex: 0 })
        .returning();

      const response = await request(app)
        .post(`/api/backend/teacher/exams/${exam.id}/questions/${question.id}/test-cases`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ name: 'Basic test', expectedOutput: '5', weight: 1 });

      expect(response.status).toBe(201);
      expect(response.body.data.name).toBe('Basic test');
      expect(response.body.data.expectedOutput).toBe('5');
      expect(response.body.data.weight).toBe(1);
    });

    it('should add a test case with sysArgs and inputData', async () => {
      const [exam] = await db
        .insert(exams)
        .values({
          classId,
          teacherId,
          title: 'TC Args Exam',
          maxScore: 100,
          language: 'python',
          durationMinutes: 60,
          status: 'DRAFT',
        })
        .returning();

      const [question] = await db
        .insert(examQuestions)
        .values({ examId: exam.id, title: 'Q2', maxScore: 100, language: 'python', orderIndex: 0 })
        .returning();

      const response = await request(app)
        .post(`/api/backend/teacher/exams/${exam.id}/questions/${question.id}/test-cases`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ name: 'With args', inputData: '3 4', sysArgs: ['--flag'], expectedOutput: '7' });

      expect(response.status).toBe(201);
      expect(response.body.data.inputData).toBe('3 4');
    });

    it('should return 400 if name is missing', async () => {
      const [exam] = await db
        .insert(exams)
        .values({
          classId,
          teacherId,
          title: 'TC No Name',
          maxScore: 100,
          language: 'python',
          durationMinutes: 60,
          status: 'DRAFT',
        })
        .returning();

      const [question] = await db
        .insert(examQuestions)
        .values({ examId: exam.id, title: 'Q3', maxScore: 100, language: 'python', orderIndex: 0 })
        .returning();

      const response = await request(app)
        .post(`/api/backend/teacher/exams/${exam.id}/questions/${question.id}/test-cases`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ expectedOutput: '5' });

      expect(response.status).toBe(400);
    });

    it('should return 400 if expectedOutput is missing', async () => {
      const [exam] = await db
        .insert(exams)
        .values({
          classId,
          teacherId,
          title: 'TC No Output',
          maxScore: 100,
          language: 'python',
          durationMinutes: 60,
          status: 'DRAFT',
        })
        .returning();

      const [question] = await db
        .insert(examQuestions)
        .values({ examId: exam.id, title: 'Q4', maxScore: 100, language: 'python', orderIndex: 0 })
        .returning();

      const response = await request(app)
        .post(`/api/backend/teacher/exams/${exam.id}/questions/${question.id}/test-cases`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ name: 'No output' });

      expect(response.status).toBe(400);
    });

    it('should return 404 for non-existent question', async () => {
      const [exam] = await db
        .insert(exams)
        .values({
          classId,
          teacherId,
          title: 'TC Ghost Q',
          maxScore: 100,
          language: 'python',
          durationMinutes: 60,
          status: 'DRAFT',
        })
        .returning();

      const response = await request(app)
        .post(`/api/backend/teacher/exams/${exam.id}/questions/${nonExistentId}/test-cases`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ name: 'Ghost TC', expectedOutput: 'out' });

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/backend/teacher/exams/:examId/monitor', () => {
    it('should return monitor state with empty students array when no sessions', async () => {
      const [exam] = await db
        .insert(exams)
        .values({
          classId,
          teacherId,
          title: 'Monitor Exam',
          maxScore: 100,
          language: 'python',
          durationMinutes: 60,
          status: 'ACTIVE',
        })
        .returning();

      const response = await request(app)
        .get(`/api/backend/teacher/exams/${exam.id}/monitor`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.examId).toBe(exam.id);
      expect(Array.isArray(response.body.data.students)).toBe(true);
      expect(response.body.data.students).toHaveLength(0);
    });

    it('should return monitor state with student sessions', async () => {
      const [exam] = await db
        .insert(exams)
        .values({
          classId,
          teacherId,
          title: 'Monitor With Students',
          maxScore: 100,
          language: 'python',
          durationMinutes: 60,
          status: 'ACTIVE',
        })
        .returning();

      await db.insert(examSessions).values({
        examId: exam.id,
        studentId,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      });

      const response = await request(app)
        .get(`/api/backend/teacher/exams/${exam.id}/monitor`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.students).toHaveLength(1);
      expect(response.body.data.students[0].studentId).toBe(studentId);
    });

    it('should include submitted sessions in monitor state', async () => {
      const [exam] = await db
        .insert(exams)
        .values({
          classId,
          teacherId,
          title: 'Monitor Submitted',
          maxScore: 100,
          language: 'python',
          durationMinutes: 60,
          status: 'ACTIVE',
        })
        .returning();

      await db.insert(examSessions).values({
        examId: exam.id,
        studentId,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        isSubmitted: true,
        submittedAt: new Date(),
      });

      const response = await request(app)
        .get(`/api/backend/teacher/exams/${exam.id}/monitor`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.students).toHaveLength(1);
      expect(response.body.data.students[0].submittedAt).not.toBeNull();
    });

    it('should return 404 for non-existent exam', async () => {
      const response = await request(app)
        .get(`/api/backend/teacher/exams/${nonExistentId}/monitor`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(404);
    });

    it('should return 401 without token', async () => {
      const response = await request(app).get(
        `/api/backend/teacher/exams/${nonExistentId}/monitor`
      );

      expect(response.status).toBe(401);
    });

    it('should return 403 if user is a student', async () => {
      const [exam] = await db
        .insert(exams)
        .values({
          classId,
          teacherId,
          title: 'Student Monitor Attempt',
          maxScore: 100,
          language: 'python',
          durationMinutes: 60,
          status: 'ACTIVE',
        })
        .returning();

      const response = await request(app)
        .get(`/api/backend/teacher/exams/${exam.id}/monitor`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/backend/teacher/exams/:examId/students/:studentId/files', () => {
    it('should return snapshot with answers for a student session', async () => {
      const [exam] = await db
        .insert(exams)
        .values({
          classId,
          teacherId,
          title: 'Snapshot Exam',
          maxScore: 100,
          language: 'python',
          durationMinutes: 60,
          status: 'ACTIVE',
        })
        .returning();

      const [question] = await db
        .insert(examQuestions)
        .values({
          examId: exam.id,
          title: 'Write a loop',
          maxScore: 100,
          language: 'python',
          orderIndex: 0,
        })
        .returning();

      const [session] = await db
        .insert(examSessions)
        .values({
          examId: exam.id,
          studentId,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        })
        .returning();

      await db.insert(examQuestionSubmissions).values({
        examSessionId: session.id,
        examId: exam.id,
        questionId: question.id,
        studentId,
        code: 'for i in range(10): print(i)',
        status: 'PENDING',
      });

      const response = await request(app)
        .get(`/api/backend/teacher/exams/${exam.id}/students/${studentId}/files`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.studentId).toBe(studentId);
      expect(response.body.data.examType).toBe('closed-book');
      expect(response.body.data.answers).toHaveLength(1);
      expect(response.body.data.answers[0].questionTitle).toBe('Write a loop');
      expect(response.body.data.answers[0].code).toBe('for i in range(10): print(i)');
    });

    it('should return open-book examType when exam is open book', async () => {
      const [exam] = await db
        .insert(exams)
        .values({
          classId,
          teacherId,
          title: 'Open Book Snapshot',
          maxScore: 100,
          language: 'python',
          durationMinutes: 60,
          status: 'ACTIVE',
          isOpenBook: true,
        })
        .returning();

      await db.insert(examSessions).values({
        examId: exam.id,
        studentId,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      });

      const response = await request(app)
        .get(`/api/backend/teacher/exams/${exam.id}/students/${studentId}/files`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.examType).toBe('open-book');
      expect(response.body.data.answers).toHaveLength(0);
    });

    it('should return empty answers when student has no submissions', async () => {
      const [exam] = await db
        .insert(exams)
        .values({
          classId,
          teacherId,
          title: 'No Submissions Exam',
          maxScore: 100,
          language: 'python',
          durationMinutes: 60,
          status: 'ACTIVE',
        })
        .returning();

      await db.insert(examSessions).values({
        examId: exam.id,
        studentId,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      });

      const response = await request(app)
        .get(`/api/backend/teacher/exams/${exam.id}/students/${studentId}/files`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.answers).toHaveLength(0);
    });

    it('should return 404 if exam not found', async () => {
      const response = await request(app)
        .get(`/api/backend/teacher/exams/${nonExistentId}/students/${studentId}/files`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(404);
    });

    it('should return 404 if student has no session', async () => {
      const [exam] = await db
        .insert(exams)
        .values({
          classId,
          teacherId,
          title: 'No Session Exam',
          maxScore: 100,
          language: 'python',
          durationMinutes: 60,
          status: 'ACTIVE',
        })
        .returning();

      const response = await request(app)
        .get(`/api/backend/teacher/exams/${exam.id}/students/${studentId}/files`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(404);
    });

    it('should return 401 without token', async () => {
      const response = await request(app).get(
        `/api/backend/teacher/exams/${nonExistentId}/students/${studentId}/files`
      );

      expect(response.status).toBe(401);
    });

    it('should return 403 if user is a student', async () => {
      const [exam] = await db
        .insert(exams)
        .values({
          classId,
          teacherId,
          title: 'Student Snapshot Attempt',
          maxScore: 100,
          language: 'python',
          durationMinutes: 60,
          status: 'ACTIVE',
        })
        .returning();

      const response = await request(app)
        .get(`/api/backend/teacher/exams/${exam.id}/students/${studentId}/files`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(403);
    });
  });
});
