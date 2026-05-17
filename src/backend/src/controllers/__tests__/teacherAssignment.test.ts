import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import request from 'supertest';
import app from '../../app';
import { db } from '../../db';
import { users, classes, assignments, testCases } from '../../db/schema';
import { eq } from 'drizzle-orm';

describe('TeacherAssignmentController', () => {
  let teacherToken: string;
  let teacherId: string;
  let studentToken: string;
  let studentId: string;
  let classId: string;
  const nonExistentId = '00000000-0000-0000-0000-000000000000';
  const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  beforeAll(async () => {
    await db.delete(classes).where(eq(classes.joinCode, 'ASGNCTRL1'));
    await db.delete(users).where(eq(users.email, 'ctrl-teacher@gmail.com'));
    await db.delete(users).where(eq(users.email, 'ctrl-student@gmail.com'));

    await request(app).post('/api/backend/auth/register').send({
      email: 'ctrl-teacher@gmail.com',
      password: 'Password123',
      name: 'Teacher',
      role: 'TEACHER',
    });
    await request(app).post('/api/backend/auth/register').send({
      email: 'ctrl-student@gmail.com',
      password: 'Password123',
      name: 'Student',
      role: 'STUDENT',
    });

    const [teacher] = await db
      .select()
      .from(users)
      .where(eq(users.email, 'ctrl-teacher@gmail.com'));
    const [student] = await db
      .select()
      .from(users)
      .where(eq(users.email, 'ctrl-student@gmail.com'));
    teacherId = teacher.id;
    studentId = student.id;

    const teacherLogin = await request(app)
      .post('/api/backend/auth/login')
      .send({ email: 'ctrl-teacher@gmail.com', password: 'Password123' });
    teacherToken = teacherLogin.body.data.token;

    const studentLogin = await request(app)
      .post('/api/backend/auth/login')
      .send({ email: 'ctrl-student@gmail.com', password: 'Password123' });
    studentToken = studentLogin.body.data.token;

    const [cls] = await db
      .insert(classes)
      .values({ name: 'Ctrl Assignment Class', teacherId, joinCode: 'ASGNCTRL1' })
      .returning();
    classId = cls.id;
  });

  afterEach(async () => {
    if (classId) {
      await db.delete(assignments).where(eq(assignments.classId, classId));
    }
  });

  afterAll(async () => {
    if (classId) {
      await db.delete(classes).where(eq(classes.id, classId));
    }
    if (studentId) {
      await db.delete(users).where(eq(users.id, studentId));
    }
    if (teacherId) {
      await db.delete(users).where(eq(users.id, teacherId));
    }
  });

  describe('POST /api/backend/teacher/assignments/class/:classId', () => {
    it('should create a DRAFT assignment and return 201', async () => {
      const response = await request(app)
        .post(`/api/backend/teacher/assignments/class/${classId}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ title: 'Python Basics' });

      expect(response.status).toBe(201);
      expect(response.body.data.title).toBe('Python Basics');
      expect(response.body.data.status).toBe('DRAFT');
      expect(response.body.data.maxScore).toBe(100);
      expect(response.body.data.language).toBe('python');
      expect(response.body.data.classId).toBe(classId);
    });

    it('should create with a future due date', async () => {
      const response = await request(app)
        .post(`/api/backend/teacher/assignments/class/${classId}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ title: 'Due Soon', dueDate: futureDate });

      expect(response.status).toBe(201);
      expect(response.body.data.dueDate).not.toBeNull();
    });

    it('should create with custom maxScore', async () => {
      const response = await request(app)
        .post(`/api/backend/teacher/assignments/class/${classId}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ title: 'Custom Score', maxScore: 50 });

      expect(response.status).toBe(201);
      expect(response.body.data.maxScore).toBe(50);
    });

    it('should return 400 for a past due date', async () => {
      const response = await request(app)
        .post(`/api/backend/teacher/assignments/class/${classId}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ title: 'Late', dueDate: '2020-01-01T00:00:00.000Z' });

      expect(response.status).toBe(400);
    });

    it('should return 400 if title is missing', async () => {
      const response = await request(app)
        .post(`/api/backend/teacher/assignments/class/${classId}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ description: 'No title here' });

      expect(response.status).toBe(400);
    });

    it('should return 400 if title is empty', async () => {
      const response = await request(app)
        .post(`/api/backend/teacher/assignments/class/${classId}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ title: '' });

      expect(response.status).toBe(400);
    });

    it('should return 404 for non-existent class', async () => {
      const response = await request(app)
        .post(`/api/backend/teacher/assignments/class/${nonExistentId}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ title: 'Orphan' });

      expect(response.status).toBe(404);
    });

    it('should return 401 without token', async () => {
      const response = await request(app)
        .post(`/api/backend/teacher/assignments/class/${classId}`)
        .send({ title: 'Unauth' });

      expect(response.status).toBe(401);
    });

    it('should return 403 if user is a student', async () => {
      const response = await request(app)
        .post(`/api/backend/teacher/assignments/class/${classId}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ title: 'Sneaky' });

      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/backend/teacher/assignments/class/:classId', () => {
    it('should return all assignments for a class', async () => {
      await db.insert(assignments).values([
        { classId, teacherId, title: 'A1', maxScore: 100, language: 'python' },
        { classId, teacherId, title: 'A2', maxScore: 100, language: 'python' },
      ]);

      const response = await request(app)
        .get(`/api/backend/teacher/assignments/class/${classId}`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThanOrEqual(2);
    });

    it('should return empty array for class with no assignments', async () => {
      const response = await request(app)
        .get(`/api/backend/teacher/assignments/class/${classId}`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(0);
    });

    it('should return 404 for non-existent class', async () => {
      const response = await request(app)
        .get(`/api/backend/teacher/assignments/class/${nonExistentId}`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/backend/teacher/assignments/:assignmentId', () => {
    it('should return assignment with testCases array', async () => {
      const [created] = await db
        .insert(assignments)
        .values({ classId, teacherId, title: 'Detailed', maxScore: 100, language: 'python' })
        .returning();

      const response = await request(app)
        .get(`/api/backend/teacher/assignments/${created.id}`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.id).toBe(created.id);
      expect(Array.isArray(response.body.data.testCases)).toBe(true);
    });

    it('should return assignment with test cases populated', async () => {
      const [created] = await db
        .insert(assignments)
        .values({ classId, teacherId, title: 'With TC', maxScore: 100, language: 'python' })
        .returning();

      await db.insert(testCases).values({
        assignmentId: created.id,
        name: 'Test hello',
        expectedOutput: 'hello',
      });

      const response = await request(app)
        .get(`/api/backend/teacher/assignments/${created.id}`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.testCases).toHaveLength(1);
      expect(response.body.data.testCases[0].expectedOutput).toBe('hello');
    });

    it('should return 404 for assignment owned by another teacher', async () => {
      const [other] = await db
        .insert(users)
        .values({
          email: `other-ctrl-${Date.now()}@gmail.com`,
          password: 'x',
          role: 'TEACHER',
        })
        .returning();

      const [otherClass] = await db
        .insert(classes)
        .values({
          name: 'Other Class',
          teacherId: other.id,
          joinCode: `OTHCTRL-${Date.now()}`,
        })
        .returning();

      const [created] = await db
        .insert(assignments)
        .values({
          classId: otherClass.id,
          teacherId: other.id,
          title: 'Not Yours',
          maxScore: 100,
          language: 'python',
        })
        .returning();

      const response = await request(app)
        .get(`/api/backend/teacher/assignments/${created.id}`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(404);

      await db.delete(assignments).where(eq(assignments.id, created.id));
      await db.delete(classes).where(eq(classes.id, otherClass.id));
      await db.delete(users).where(eq(users.id, other.id));
    });

    it('should return 404 for non-existent assignment', async () => {
      const response = await request(app)
        .get(`/api/backend/teacher/assignments/${nonExistentId}`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('PATCH /api/backend/teacher/assignments/:assignmentId', () => {
    it('should update title', async () => {
      const [created] = await db
        .insert(assignments)
        .values({ classId, teacherId, title: 'Old Title', maxScore: 100, language: 'python' })
        .returning();

      const response = await request(app)
        .patch(`/api/backend/teacher/assignments/${created.id}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ title: 'New Title' });

      expect(response.status).toBe(200);
      expect(response.body.data.title).toBe('New Title');
    });

    it('should publish an assignment', async () => {
      const [created] = await db
        .insert(assignments)
        .values({ classId, teacherId, title: 'Draft', maxScore: 100, language: 'python' })
        .returning();

      const response = await request(app)
        .patch(`/api/backend/teacher/assignments/${created.id}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ status: 'PUBLISHED' });

      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe('PUBLISHED');
    });

    it('should update maxScore', async () => {
      const [created] = await db
        .insert(assignments)
        .values({ classId, teacherId, title: 'Score Update', maxScore: 100, language: 'python' })
        .returning();

      const response = await request(app)
        .patch(`/api/backend/teacher/assignments/${created.id}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ maxScore: 50 });

      expect(response.status).toBe(200);
      expect(response.body.data.maxScore).toBe(50);
    });

    it('should return 400 for empty body', async () => {
      const [created] = await db
        .insert(assignments)
        .values({ classId, teacherId, title: 'No Change', maxScore: 100, language: 'python' })
        .returning();

      const response = await request(app)
        .patch(`/api/backend/teacher/assignments/${created.id}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({});

      expect(response.status).toBe(400);
    });

    it('should return 404 for non-existent assignment', async () => {
      const response = await request(app)
        .patch(`/api/backend/teacher/assignments/${nonExistentId}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ title: 'Ghost' });

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/backend/teacher/assignments/:assignmentId', () => {
    it('should delete assignment and return 200', async () => {
      const [created] = await db
        .insert(assignments)
        .values({ classId, teacherId, title: 'Delete Me', maxScore: 100, language: 'python' })
        .returning();

      const response = await request(app)
        .delete(`/api/backend/teacher/assignments/${created.id}`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(200);

      const found = await db.select().from(assignments).where(eq(assignments.id, created.id));
      expect(found).toHaveLength(0);
    });

    it('should cascade delete test cases with the assignment', async () => {
      const [created] = await db
        .insert(assignments)
        .values({ classId, teacherId, title: 'Cascade Del', maxScore: 100, language: 'python' })
        .returning();

      const [tc] = await db
        .insert(testCases)
        .values({
          assignmentId: created.id,
          name: 'Should be deleted',
          expectedOutput: 'bye',
        })
        .returning();

      await request(app)
        .delete(`/api/backend/teacher/assignments/${created.id}`)
        .set('Authorization', `Bearer ${teacherToken}`);

      const foundTc = await db.select().from(testCases).where(eq(testCases.id, tc.id));
      expect(foundTc).toHaveLength(0);
    });

    it('should return 404 for non-existent assignment', async () => {
      const response = await request(app)
        .delete(`/api/backend/teacher/assignments/${nonExistentId}`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/backend/teacher/assignments/:assignmentId/test-cases', () => {
    it('should add a test case and return 201', async () => {
      const [created] = await db
        .insert(assignments)
        .values({ classId, teacherId, title: 'TC Parent', maxScore: 100, language: 'python' })
        .returning();

      const response = await request(app)
        .post(`/api/backend/teacher/assignments/${created.id}/test-cases`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ name: 'Should print hello', expectedOutput: 'hello' });

      expect(response.status).toBe(201);
      expect(response.body.data.name).toBe('Should print hello');
      expect(response.body.data.expectedOutput).toBe('hello');
      expect(response.body.data.weight).toBe(1);
      expect(response.body.data.orderIndex).toBe(0);
    });

    it('should add a test case with input data', async () => {
      const [created] = await db
        .insert(assignments)
        .values({ classId, teacherId, title: 'TC Input', maxScore: 100, language: 'python' })
        .returning();

      const response = await request(app)
        .post(`/api/backend/teacher/assignments/${created.id}/test-cases`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          name: 'Add two numbers',
          inputData: '2 3',
          expectedOutput: '5',
          weight: 2,
          orderIndex: 1,
        });

      expect(response.status).toBe(201);
      expect(response.body.data.inputData).toBe('2 3');
      expect(response.body.data.weight).toBe(2);
    });

    it('should return 400 if name is missing', async () => {
      const [created] = await db
        .insert(assignments)
        .values({ classId, teacherId, title: 'TC No Name', maxScore: 100, language: 'python' })
        .returning();

      const response = await request(app)
        .post(`/api/backend/teacher/assignments/${created.id}/test-cases`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ expectedOutput: 'hello' });

      expect(response.status).toBe(400);
    });

    it('should return 400 if expectedOutput is missing', async () => {
      const [created] = await db
        .insert(assignments)
        .values({ classId, teacherId, title: 'TC No Output', maxScore: 100, language: 'python' })
        .returning();

      const response = await request(app)
        .post(`/api/backend/teacher/assignments/${created.id}/test-cases`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ name: 'No output' });

      expect(response.status).toBe(400);
    });

    it('should return 404 for non-existent assignment', async () => {
      const response = await request(app)
        .post(`/api/backend/teacher/assignments/${nonExistentId}/test-cases`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ name: 'Ghost TC', expectedOutput: 'out' });

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/backend/teacher/assignments/:assignmentId/test-cases', () => {
    it('should return all test cases for an assignment', async () => {
      const [created] = await db
        .insert(assignments)
        .values({ classId, teacherId, title: 'Get TC', maxScore: 100, language: 'python' })
        .returning();

      await db.insert(testCases).values([
        { assignmentId: created.id, name: 'TC 1', expectedOutput: 'out1', orderIndex: 0 },
        { assignmentId: created.id, name: 'TC 2', expectedOutput: 'out2', orderIndex: 1 },
      ]);

      const response = await request(app)
        .get(`/api/backend/teacher/assignments/${created.id}/test-cases`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0].expectedOutput).toBeDefined();
    });

    it('should return empty array if no test cases', async () => {
      const [created] = await db
        .insert(assignments)
        .values({ classId, teacherId, title: 'No TC', maxScore: 100, language: 'python' })
        .returning();

      const response = await request(app)
        .get(`/api/backend/teacher/assignments/${created.id}/test-cases`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(0);
    });
  });

  describe('PATCH /api/backend/teacher/assignments/test-cases/:testCaseId', () => {
    it('should update test case name', async () => {
      const [created] = await db
        .insert(assignments)
        .values({ classId, teacherId, title: 'Patch TC', maxScore: 100, language: 'python' })
        .returning();

      const [tc] = await db
        .insert(testCases)
        .values({
          assignmentId: created.id,
          name: 'Old Name',
          expectedOutput: 'out',
        })
        .returning();

      const response = await request(app)
        .patch(`/api/backend/teacher/assignments/test-cases/${tc.id}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ name: 'New Name' });

      expect(response.status).toBe(200);
      expect(response.body.data.name).toBe('New Name');
    });

    it('should update expected output', async () => {
      const [created] = await db
        .insert(assignments)
        .values({ classId, teacherId, title: 'Patch Output', maxScore: 100, language: 'python' })
        .returning();

      const [tc] = await db
        .insert(testCases)
        .values({
          assignmentId: created.id,
          name: 'Output TC',
          expectedOutput: 'old',
        })
        .returning();

      const response = await request(app)
        .patch(`/api/backend/teacher/assignments/test-cases/${tc.id}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ expectedOutput: 'new output' });

      expect(response.status).toBe(200);
      expect(response.body.data.expectedOutput).toBe('new output');
    });

    it('should return 400 for empty body', async () => {
      const [created] = await db
        .insert(assignments)
        .values({ classId, teacherId, title: 'Empty Patch', maxScore: 100, language: 'python' })
        .returning();

      const [tc] = await db
        .insert(testCases)
        .values({
          assignmentId: created.id,
          name: 'TC',
          expectedOutput: 'out',
        })
        .returning();

      const response = await request(app)
        .patch(`/api/backend/teacher/assignments/test-cases/${tc.id}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({});

      expect(response.status).toBe(400);
    });

    it('should return 404 for non-existent test case', async () => {
      const response = await request(app)
        .patch(`/api/backend/teacher/assignments/test-cases/${nonExistentId}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ name: 'Ghost' });

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/backend/teacher/assignments/test-cases/:testCaseId', () => {
    it('should delete test case and return 200', async () => {
      const [created] = await db
        .insert(assignments)
        .values({ classId, teacherId, title: 'Del TC', maxScore: 100, language: 'python' })
        .returning();

      const [tc] = await db
        .insert(testCases)
        .values({
          assignmentId: created.id,
          name: 'Delete Me',
          expectedOutput: 'bye',
        })
        .returning();

      const response = await request(app)
        .delete(`/api/backend/teacher/assignments/test-cases/${tc.id}`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(200);

      const found = await db.select().from(testCases).where(eq(testCases.id, tc.id));
      expect(found).toHaveLength(0);
    });

    it('should return 404 for non-existent test case', async () => {
      const response = await request(app)
        .delete(`/api/backend/teacher/assignments/test-cases/${nonExistentId}`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(404);
    });
  });
});
