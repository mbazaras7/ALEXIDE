import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import request from 'supertest';
import app from '../../app';
import { db } from '../../db';
import { users, classes, classMembers, exams, examSessions, examQuestions } from '../../db/schema';
import { eq } from 'drizzle-orm';

describe('StudentExamController', () => {
  let teacherToken: string;
  let teacherId: string;
  let studentToken: string;
  let studentId: string;
  let student2Token: string;
  let student2Id: string;
  let classId: string;
  const nonExistentId = '00000000-0000-0000-0000-000000000000';

  beforeAll(async () => {
    await db.delete(classes).where(eq(classes.joinCode, 'STUEXM1'));
    await db.delete(users).where(eq(users.email, 'stu-exam-teacher@gmail.com'));
    await db.delete(users).where(eq(users.email, 'stu-exam-student@gmail.com'));
    await db.delete(users).where(eq(users.email, 'stu-exam-student2@gmail.com'));

    await request(app).post('/api/backend/auth/register').send({
      email: 'stu-exam-teacher@gmail.com',
      password: 'Password123',
      name: 'Stu Exam Teacher',
      role: 'TEACHER',
    });
    await request(app).post('/api/backend/auth/register').send({
      email: 'stu-exam-student@gmail.com',
      password: 'Password123',
      name: 'Stu Exam Student',
      role: 'STUDENT',
    });
    await request(app).post('/api/backend/auth/register').send({
      email: 'stu-exam-student2@gmail.com',
      password: 'Password123',
      name: 'Stu Exam Student 2',
      role: 'STUDENT',
    });

    const [teacher] = await db
      .select()
      .from(users)
      .where(eq(users.email, 'stu-exam-teacher@gmail.com'));
    const [student] = await db
      .select()
      .from(users)
      .where(eq(users.email, 'stu-exam-student@gmail.com'));
    const [student2] = await db
      .select()
      .from(users)
      .where(eq(users.email, 'stu-exam-student2@gmail.com'));
    teacherId = teacher.id;
    studentId = student.id;
    student2Id = student2.id;

    const teacherLogin = await request(app)
      .post('/api/backend/auth/login')
      .send({ email: 'stu-exam-teacher@gmail.com', password: 'Password123' });
    teacherToken = teacherLogin.body.data.token;

    const studentLogin = await request(app)
      .post('/api/backend/auth/login')
      .send({ email: 'stu-exam-student@gmail.com', password: 'Password123' });
    studentToken = studentLogin.body.data.token;

    const student2Login = await request(app)
      .post('/api/backend/auth/login')
      .send({ email: 'stu-exam-student2@gmail.com', password: 'Password123' });
    student2Token = student2Login.body.data.token;

    const [cls] = await db
      .insert(classes)
      .values({ name: 'Student Exam Class', teacherId, joinCode: 'STUEXM1' })
      .returning();
    classId = cls.id;

    await db.insert(classMembers).values({ classId, studentId });
  });

  afterEach(async () => {
    if (classId) {
      await db
        .delete(examSessions)
        .where(
          eq(
            examSessions.examId,
            (await db.select({ id: exams.id }).from(exams).where(eq(exams.classId, classId)))[0]
              ?.id ?? nonExistentId
          )
        );
      await db.delete(exams).where(eq(exams.classId, classId));
    }
  });

  afterAll(async () => {
    if (classId) await db.delete(classes).where(eq(classes.id, classId));
    if (student2Id) await db.delete(users).where(eq(users.id, student2Id));
    if (studentId) await db.delete(users).where(eq(users.id, studentId));
    if (teacherId) await db.delete(users).where(eq(users.id, teacherId));
  });

  describe('GET /api/backend/student/exams/class/:classId', () => {
    it('should return ACTIVE and SCHEDULED exams for enrolled student', async () => {
      await db.insert(exams).values([
        {
          classId,
          teacherId,
          title: 'Active Exam',
          maxScore: 100,
          language: 'python',
          durationMinutes: 60,
          status: 'ACTIVE',
        },
        {
          classId,
          teacherId,
          title: 'Scheduled Exam',
          maxScore: 100,
          language: 'python',
          durationMinutes: 60,
          status: 'SCHEDULED',
        },
        {
          classId,
          teacherId,
          title: 'Draft Exam',
          maxScore: 100,
          language: 'python',
          durationMinutes: 60,
          status: 'DRAFT',
        },
      ]);

      const response = await request(app)
        .get(`/api/backend/student/exams/class/${classId}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data)).toBe(true);
      const statuses = response.body.data.map((e: any) => e.status);
      expect(statuses).not.toContain('DRAFT');
      expect(statuses.length).toBeGreaterThanOrEqual(2);
    });

    it('should return 403 for unenrolled student', async () => {
      const response = await request(app)
        .get(`/api/backend/student/exams/class/${classId}`)
        .set('Authorization', `Bearer ${student2Token}`);

      expect(response.status).toBe(404);
    });

    it('should return 401 without token', async () => {
      const response = await request(app).get(`/api/backend/student/exams/class/${classId}`);

      expect(response.status).toBe(401);
    });

    it('should return 403 if user is a teacher', async () => {
      const response = await request(app)
        .get(`/api/backend/student/exams/class/${classId}`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/backend/student/exams/:examId', () => {
    it('should return exam with public test cases (no expectedOutput)', async () => {
      const [exam] = await db
        .insert(exams)
        .values({
          classId,
          teacherId,
          title: 'Public Exam',
          maxScore: 100,
          language: 'python',
          durationMinutes: 60,
          status: 'ACTIVE',
        })
        .returning();

      const { examQuestions: eqTable, examTestCases: etcTable } = await import('../../db/schema');

      const [question] = await db
        .insert(eqTable)
        .values({ examId: exam.id, title: 'Q1', maxScore: 100, language: 'python', orderIndex: 0 })
        .returning();

      await db.insert(etcTable).values({
        questionId: question.id,
        name: 'TC1',
        expectedOutput: 'secret',
        weight: 1,
        orderIndex: 0,
      });

      const response = await request(app)
        .get(`/api/backend/student/exams/${exam.id}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.id).toBe(exam.id);
      expect(Array.isArray(response.body.data.questions)).toBe(true);

      const tc = response.body.data.questions[0].testCases[0];
      expect(tc.expectedOutput).toBeUndefined();
      expect(tc.name).toBe('TC1');
      expect(tc.id).toBeDefined();
    });

    it('should return 403 for DRAFT exam', async () => {
      const [exam] = await db
        .insert(exams)
        .values({
          classId,
          teacherId,
          title: 'Draft Only',
          maxScore: 100,
          language: 'python',
          durationMinutes: 60,
          status: 'DRAFT',
        })
        .returning();

      const response = await request(app)
        .get(`/api/backend/student/exams/${exam.id}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(403);
    });

    it('should return 403 for unenrolled student', async () => {
      const [exam] = await db
        .insert(exams)
        .values({
          classId,
          teacherId,
          title: 'Unrolled Exam',
          maxScore: 100,
          language: 'python',
          durationMinutes: 60,
          status: 'ACTIVE',
        })
        .returning();

      const response = await request(app)
        .get(`/api/backend/student/exams/${exam.id}`)
        .set('Authorization', `Bearer ${student2Token}`);

      expect(response.status).toBe(403);
    });

    it('should return 404 for non-existent exam', async () => {
      const response = await request(app)
        .get(`/api/backend/student/exams/${nonExistentId}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/backend/student/exams/:examId/start', () => {
    it('should create session and return expiresAt', async () => {
      const [exam] = await db
        .insert(exams)
        .values({
          classId,
          teacherId,
          title: 'Start Exam',
          maxScore: 100,
          language: 'python',
          durationMinutes: 60,
          status: 'ACTIVE',
        })
        .returning();

      const response = await request(app)
        .post(`/api/backend/student/exams/${exam.id}/start`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(201);
      expect(response.body.data.examId).toBe(exam.id);
      expect(response.body.data.studentId).toBe(studentId);
      expect(response.body.data.isSubmitted).toBe(false);
      expect(response.body.data.expiresAt).toBeDefined();
      expect(response.body.data.tabSwitchCount).toBe(0);
    });

    it('should return 400 when starting an already started exam', async () => {
      const [exam] = await db
        .insert(exams)
        .values({
          classId,
          teacherId,
          title: 'Double Start',
          maxScore: 100,
          language: 'python',
          durationMinutes: 60,
          status: 'ACTIVE',
        })
        .returning();

      await request(app)
        .post(`/api/backend/student/exams/${exam.id}/start`)
        .set('Authorization', `Bearer ${studentToken}`);

      const response = await request(app)
        .post(`/api/backend/student/exams/${exam.id}/start`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Exam session already exists');
    });

    it('should return 400 for SCHEDULED (not ACTIVE) exam', async () => {
      const [exam] = await db
        .insert(exams)
        .values({
          classId,
          teacherId,
          title: 'Not Active',
          maxScore: 100,
          language: 'python',
          durationMinutes: 60,
          status: 'SCHEDULED',
        })
        .returning();

      const response = await request(app)
        .post(`/api/backend/student/exams/${exam.id}/start`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(400);
    });

    it('should return 400 for unenrolled student', async () => {
      const [exam] = await db
        .insert(exams)
        .values({
          classId,
          teacherId,
          title: 'Unroll Start',
          maxScore: 100,
          language: 'python',
          durationMinutes: 60,
          status: 'ACTIVE',
        })
        .returning();

      const response = await request(app)
        .post(`/api/backend/student/exams/${exam.id}/start`)
        .set('Authorization', `Bearer ${student2Token}`);

      expect(response.status).toBe(400);
    });

    it('should return 404 for non-existent exam', async () => {
      const response = await request(app)
        .post(`/api/backend/student/exams/${nonExistentId}/start`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/backend/student/exams/:examId/session', () => {
    it('should return session for started exam', async () => {
      const [exam] = await db
        .insert(exams)
        .values({
          classId,
          teacherId,
          title: 'Session Exam',
          maxScore: 100,
          language: 'python',
          durationMinutes: 60,
          status: 'ACTIVE',
        })
        .returning();

      await request(app)
        .post(`/api/backend/student/exams/${exam.id}/start`)
        .set('Authorization', `Bearer ${studentToken}`);

      const response = await request(app)
        .get(`/api/backend/student/exams/${exam.id}/session`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.examId).toBe(exam.id);
      expect(response.body.data.isSubmitted).toBe(false);
    });

    it('should return 404 if session does not exist', async () => {
      const [exam] = await db
        .insert(exams)
        .values({
          classId,
          teacherId,
          title: 'No Session',
          maxScore: 100,
          language: 'python',
          durationMinutes: 60,
          status: 'ACTIVE',
        })
        .returning();

      const response = await request(app)
        .get(`/api/backend/student/exams/${exam.id}/session`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/backend/student/exams/:examId/tab-switch', () => {
    it('should increment tab switch count', async () => {
      const [exam] = await db
        .insert(exams)
        .values({
          classId,
          teacherId,
          title: 'Tab Exam',
          maxScore: 100,
          language: 'python',
          durationMinutes: 60,
          status: 'ACTIVE',
        })
        .returning();

      await request(app)
        .post(`/api/backend/student/exams/${exam.id}/start`)
        .set('Authorization', `Bearer ${studentToken}`);

      const r1 = await request(app)
        .post(`/api/backend/student/exams/${exam.id}/tab-switch`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(r1.status).toBe(200);
      expect(r1.body.data.tabSwitchCount).toBe(1);

      const r2 = await request(app)
        .post(`/api/backend/student/exams/${exam.id}/tab-switch`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(r2.body.data.tabSwitchCount).toBe(2);
    });

    it('should return 404 if no session exists', async () => {
      const [exam] = await db
        .insert(exams)
        .values({
          classId,
          teacherId,
          title: 'Tab No Session',
          maxScore: 100,
          language: 'python',
          durationMinutes: 60,
          status: 'ACTIVE',
        })
        .returning();

      const response = await request(app)
        .post(`/api/backend/student/exams/${exam.id}/tab-switch`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/backend/student/exams/:examId/submit', () => {
    it('should submit exam and mark session as submitted', async () => {
      const [exam] = await db
        .insert(exams)
        .values({
          classId,
          teacherId,
          title: 'Submit Exam',
          maxScore: 100,
          language: 'python',
          durationMinutes: 60,
          status: 'ACTIVE',
        })
        .returning();

      await request(app)
        .post(`/api/backend/student/exams/${exam.id}/start`)
        .set('Authorization', `Bearer ${studentToken}`);

      const response = await request(app)
        .post(`/api/backend/student/exams/${exam.id}/submit`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.isSubmitted).toBe(true);
      expect(response.body.data.submittedAt).not.toBeNull();
    });

    it('should return 400 when submitting an already submitted exam', async () => {
      const [exam] = await db
        .insert(exams)
        .values({
          classId,
          teacherId,
          title: 'Double Submit',
          maxScore: 100,
          language: 'python',
          durationMinutes: 60,
          status: 'ACTIVE',
        })
        .returning();

      await request(app)
        .post(`/api/backend/student/exams/${exam.id}/start`)
        .set('Authorization', `Bearer ${studentToken}`);

      await request(app)
        .post(`/api/backend/student/exams/${exam.id}/submit`)
        .set('Authorization', `Bearer ${studentToken}`);

      const response = await request(app)
        .post(`/api/backend/student/exams/${exam.id}/submit`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Exam already submitted');
    });

    it('should return 400 when submitting after exam already submitted', async () => {
      const [exam] = await db
        .insert(exams)
        .values({
          classId,
          teacherId,
          title: 'Tab Then Submit',
          maxScore: 100,
          language: 'python',
          durationMinutes: 60,
          status: 'ACTIVE',
        })
        .returning();

      await request(app)
        .post(`/api/backend/student/exams/${exam.id}/start`)
        .set('Authorization', `Bearer ${studentToken}`);

      await request(app)
        .post(`/api/backend/student/exams/${exam.id}/submit`)
        .set('Authorization', `Bearer ${studentToken}`);

      const tabResponse = await request(app)
        .post(`/api/backend/student/exams/${exam.id}/tab-switch`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(tabResponse.status).toBe(400);
      expect(tabResponse.body.error).toBe('Exam already submitted');
    });

    it('should return 404 if no session exists', async () => {
      const [exam] = await db
        .insert(exams)
        .values({
          classId,
          teacherId,
          title: 'Submit No Session',
          maxScore: 100,
          language: 'python',
          durationMinutes: 60,
          status: 'ACTIVE',
        })
        .returning();

      const response = await request(app)
        .post(`/api/backend/student/exams/${exam.id}/submit`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/backend/student/exams/:examId/questions/:questionId/answer', () => {
    it('should save an answer successfully', async () => {
      const [exam] = await db
        .insert(exams)
        .values({
          classId,
          teacherId,
          title: 'Answer Exam',
          maxScore: 100,
          language: 'python',
          durationMinutes: 60,
          status: 'ACTIVE',
        })
        .returning();

      const [question] = await db
        .insert(examQuestions)
        .values({ examId: exam.id, title: 'Q1', maxScore: 100, language: 'python', orderIndex: 0 })
        .returning();

      await request(app)
        .post(`/api/backend/student/exams/${exam.id}/start`)
        .set('Authorization', `Bearer ${studentToken}`);

      const response = await request(app)
        .post(`/api/backend/student/exams/${exam.id}/questions/${question.id}/answer`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ code: 'print("hello")' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.code).toBe('print("hello")');
      expect(response.body.data.questionId).toBe(question.id);
    });

    it('should allow updating an answer (upsert)', async () => {
      const [exam] = await db
        .insert(exams)
        .values({
          classId,
          teacherId,
          title: 'Upsert Answer Exam',
          maxScore: 100,
          language: 'python',
          durationMinutes: 60,
          status: 'ACTIVE',
        })
        .returning();

      const [question] = await db
        .insert(examQuestions)
        .values({ examId: exam.id, title: 'Q1', maxScore: 100, language: 'python', orderIndex: 0 })
        .returning();

      await request(app)
        .post(`/api/backend/student/exams/${exam.id}/start`)
        .set('Authorization', `Bearer ${studentToken}`);

      await request(app)
        .post(`/api/backend/student/exams/${exam.id}/questions/${question.id}/answer`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ code: 'print("v1")' });

      const response = await request(app)
        .post(`/api/backend/student/exams/${exam.id}/questions/${question.id}/answer`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ code: 'print("v2")' });

      expect(response.status).toBe(200);
      expect(response.body.data.code).toBe('print("v2")');
    });

    it('should return 400 when exam already submitted', async () => {
      const [exam] = await db
        .insert(exams)
        .values({
          classId,
          teacherId,
          title: 'Submitted Answer Exam',
          maxScore: 100,
          language: 'python',
          durationMinutes: 60,
          status: 'ACTIVE',
        })
        .returning();

      const [question] = await db
        .insert(examQuestions)
        .values({ examId: exam.id, title: 'Q1', maxScore: 100, language: 'python', orderIndex: 0 })
        .returning();

      await request(app)
        .post(`/api/backend/student/exams/${exam.id}/start`)
        .set('Authorization', `Bearer ${studentToken}`);

      await request(app)
        .post(`/api/backend/student/exams/${exam.id}/submit`)
        .set('Authorization', `Bearer ${studentToken}`);

      const response = await request(app)
        .post(`/api/backend/student/exams/${exam.id}/questions/${question.id}/answer`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ code: 'print("late")' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Exam already submitted');
    });

    it('should return 400 for question not in this exam', async () => {
      const [exam] = await db
        .insert(exams)
        .values({
          classId,
          teacherId,
          title: 'Wrong Q Exam',
          maxScore: 100,
          language: 'python',
          durationMinutes: 60,
          status: 'ACTIVE',
        })
        .returning();

      await request(app)
        .post(`/api/backend/student/exams/${exam.id}/start`)
        .set('Authorization', `Bearer ${studentToken}`);

      const response = await request(app)
        .post(`/api/backend/student/exams/${exam.id}/questions/${nonExistentId}/answer`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ code: 'print("x")' });

      expect(response.status).toBe(400);
    });

    it('should return 404 if no session exists', async () => {
      const [exam] = await db
        .insert(exams)
        .values({
          classId,
          teacherId,
          title: 'No Session Answer',
          maxScore: 100,
          language: 'python',
          durationMinutes: 60,
          status: 'ACTIVE',
        })
        .returning();

      const [question] = await db
        .insert(examQuestions)
        .values({ examId: exam.id, title: 'Q1', maxScore: 100, language: 'python', orderIndex: 0 })
        .returning();

      const response = await request(app)
        .post(`/api/backend/student/exams/${exam.id}/questions/${question.id}/answer`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ code: 'print("x")' });

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/backend/student/exams/:examId/answers', () => {
    it('should return all saved answers for the session', async () => {
      const [exam] = await db
        .insert(exams)
        .values({
          classId,
          teacherId,
          title: 'Get Answers Exam',
          maxScore: 100,
          language: 'python',
          durationMinutes: 60,
          status: 'ACTIVE',
        })
        .returning();

      const [question] = await db
        .insert(examQuestions)
        .values({ examId: exam.id, title: 'Q1', maxScore: 100, language: 'python', orderIndex: 0 })
        .returning();

      await request(app)
        .post(`/api/backend/student/exams/${exam.id}/start`)
        .set('Authorization', `Bearer ${studentToken}`);

      await request(app)
        .post(`/api/backend/student/exams/${exam.id}/questions/${question.id}/answer`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ code: 'print("answer")' });

      const response = await request(app)
        .get(`/api/backend/student/exams/${exam.id}/answers`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBe(1);
      expect(response.body.data[0].code).toBe('print("answer")');
    });

    it('should return empty array if no answers saved yet', async () => {
      const [exam] = await db
        .insert(exams)
        .values({
          classId,
          teacherId,
          title: 'Empty Answers Exam',
          maxScore: 100,
          language: 'python',
          durationMinutes: 60,
          status: 'ACTIVE',
        })
        .returning();

      await request(app)
        .post(`/api/backend/student/exams/${exam.id}/start`)
        .set('Authorization', `Bearer ${studentToken}`);

      const response = await request(app)
        .get(`/api/backend/student/exams/${exam.id}/answers`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBe(0);
    });

    it('should return 404 when no session exists', async () => {
      const [exam] = await db
        .insert(exams)
        .values({
          classId,
          teacherId,
          title: 'No Session Answers',
          maxScore: 100,
          language: 'python',
          durationMinutes: 60,
          status: 'ACTIVE',
        })
        .returning();

      const response = await request(app)
        .get(`/api/backend/student/exams/${exam.id}/answers`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(404);
    });
  });
});
