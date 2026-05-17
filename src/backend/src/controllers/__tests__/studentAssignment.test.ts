import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import request from 'supertest';
import app from '../../app';
import { db } from '../../db';
import { users, classes, classMembers, assignments, testCases } from '../../db/schema';
import { eq } from 'drizzle-orm';

describe('StudentAssignmentController', () => {
  let teacherToken: string;
  let teacherId: string;
  let studentToken: string;
  let studentId: string;
  let otherStudentToken: string;
  let otherStudentId: string;
  let classId: string;
  let otherClassId: string;
  const nonExistentId = '00000000-0000-0000-0000-000000000000';

  beforeAll(async () => {
    await db.delete(classes).where(eq(classes.joinCode, 'STDASGN1'));
    await db.delete(classes).where(eq(classes.joinCode, 'STDASGN2'));
    await db.delete(users).where(eq(users.email, 'ctrl--teacher@gmail.com'));
    await db.delete(users).where(eq(users.email, 'ctrl--student@gmail.com'));
    await db.delete(users).where(eq(users.email, 'student-other@gmail.com'));

    await request(app).post('/api/backend/auth/register').send({
      email: 'ctrl--teacher@gmail.com',
      password: 'Password123',
      name: 'Teacher',
      role: 'TEACHER',
    });
    await request(app).post('/api/backend/auth/register').send({
      email: 'ctrl--student@gmail.com',
      password: 'Password123',
      name: 'Student',
      role: 'STUDENT',
    });
    await request(app).post('/api/backend/auth/register').send({
      email: 'student-other@gmail.com',
      password: 'Password123',
      name: 'Other Student',
      role: 'STUDENT',
    });

    const [teacher] = await db
      .select()
      .from(users)
      .where(eq(users.email, 'ctrl--teacher@gmail.com'));
    const [student] = await db
      .select()
      .from(users)
      .where(eq(users.email, 'ctrl--student@gmail.com'));
    const [otherStudent] = await db
      .select()
      .from(users)
      .where(eq(users.email, 'student-other@gmail.com'));
    teacherId = teacher.id;
    studentId = student.id;
    otherStudentId = otherStudent.id;

    const teacherLogin = await request(app)
      .post('/api/backend/auth/login')
      .send({ email: 'ctrl--teacher@gmail.com', password: 'Password123' });
    teacherToken = teacherLogin.body.data.token;

    const studentLogin = await request(app)
      .post('/api/backend/auth/login')
      .send({ email: 'ctrl--student@gmail.com', password: 'Password123' });
    studentToken = studentLogin.body.data.token;

    const otherStudentLogin = await request(app)
      .post('/api/backend/auth/login')
      .send({ email: 'student-other@gmail.com', password: 'Password123' });
    otherStudentToken = otherStudentLogin.body.data.token;

    const [cls] = await db
      .insert(classes)
      .values({ name: 'Student Asgn Class', teacherId, joinCode: 'STDASGN1' })
      .returning();
    classId = cls.id;

    await db.insert(classMembers).values({ classId, studentId });

    const [otherCls] = await db
      .insert(classes)
      .values({ name: 'Other Class', teacherId, joinCode: 'STDASGN2' })
      .returning();
    otherClassId = otherCls.id;
  });

  afterEach(async () => {
    await db.delete(assignments).where(eq(assignments.classId, classId));
    await db.delete(assignments).where(eq(assignments.classId, otherClassId));
  });

  afterAll(async () => {
    await db.delete(classMembers).where(eq(classMembers.classId, classId));
    await db.delete(classes).where(eq(classes.id, classId));
    await db.delete(classes).where(eq(classes.id, otherClassId));
    await db.delete(users).where(eq(users.id, teacherId));
    await db.delete(users).where(eq(users.id, studentId));
    await db.delete(users).where(eq(users.id, otherStudentId));
  });

  async function createAssignment(
    overrides: Partial<{
      title: string;
      status: 'DRAFT' | 'PUBLISHED' | 'CLOSED';
      dueDate: Date | null;
      targetClassId: string;
    }> = {}
  ) {
    const [asgn] = await db
      .insert(assignments)
      .values({
        classId: overrides.targetClassId ?? classId,
        teacherId,
        title: overrides.title ?? 'Test Assignment',
        maxScore: 100,
        language: 'python',
        status: overrides.status ?? 'DRAFT',
        dueDate: overrides.dueDate ?? null,
      })
      .returning();
    return asgn;
  }

  async function addTestCases(assignmentId: string) {
    const [tc1] = await db
      .insert(testCases)
      .values({
        assignmentId,
        name: 'Should print hello',
        inputData: null,
        expectedOutput: 'hello',
        weight: 1,
        orderIndex: 0,
      })
      .returning();

    const [tc2] = await db
      .insert(testCases)
      .values({
        assignmentId,
        name: 'Should add numbers',
        inputData: '2 3',
        expectedOutput: '5',
        weight: 2,
        orderIndex: 1,
      })
      .returning();

    return [tc1, tc2];
  }

  describe('GET /api/backend/student/assignments', () => {
    it('should return PUBLISHED and CLOSED assignments but not DRAFT', async () => {
      await createAssignment({ title: 'Draft Asgn', status: 'DRAFT' });
      await createAssignment({ title: 'Published Asgn', status: 'PUBLISHED' });
      await createAssignment({ title: 'Closed Asgn', status: 'CLOSED' });

      const response = await request(app)
        .get('/api/backend/student/assignments')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data)).toBe(true);

      const titles = response.body.data.map((a: any) => a.title);
      expect(titles).toContain('Published Asgn');
      expect(titles).toContain('Closed Asgn');
      expect(titles).not.toContain('Draft Asgn');
    });

    it('should include status field on each assignment', async () => {
      await createAssignment({ title: 'Published Asgn', status: 'PUBLISHED' });
      await createAssignment({ title: 'Closed Asgn', status: 'CLOSED' });

      const response = await request(app)
        .get('/api/backend/student/assignments')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(200);
      response.body.data.forEach((a: any) => {
        expect(['PUBLISHED', 'CLOSED']).toContain(a.status);
      });
    });

    it('should not return assignments from classes student is not enrolled in', async () => {
      await createAssignment({
        title: 'Other Class Asgn',
        status: 'PUBLISHED',
        targetClassId: otherClassId,
      });

      const response = await request(app)
        .get('/api/backend/student/assignments')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(200);
      const titles = response.body.data.map((a: any) => a.title);
      expect(titles).not.toContain('Other Class Asgn');
    });

    it('should return assignments sorted by due date ascending', async () => {
      const later = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const sooner = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);

      await createAssignment({ title: 'Due Later', status: 'PUBLISHED', dueDate: later });
      await createAssignment({ title: 'Due Sooner', status: 'PUBLISHED', dueDate: sooner });

      const response = await request(app)
        .get('/api/backend/student/assignments')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(200);
      const titles = response.body.data.map((a: any) => a.title);
      expect(titles.indexOf('Due Sooner')).toBeLessThan(titles.indexOf('Due Later'));
    });

    it('should return empty array if no published or closed assignments', async () => {
      await createAssignment({ title: 'Draft Only', status: 'DRAFT' });

      const response = await request(app)
        .get('/api/backend/student/assignments')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(0);
    });

    it('should return empty array if student is not enrolled anywhere', async () => {
      const response = await request(app)
        .get('/api/backend/student/assignments')
        .set('Authorization', `Bearer ${otherStudentToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(0);
    });

    it('should return 401 without token', async () => {
      const response = await request(app).get('/api/backend/student/assignments');
      expect(response.status).toBe(401);
    });

    it('should return 403 if user is a teacher', async () => {
      const response = await request(app)
        .get('/api/backend/student/assignments')
        .set('Authorization', `Bearer ${teacherToken}`);
      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/backend/student/assignments/:assignmentId', () => {
    it('should return published assignment with public test cases', async () => {
      const asgn = await createAssignment({ status: 'PUBLISHED' });
      await addTestCases(asgn.id);

      const response = await request(app)
        .get(`/api/backend/student/assignments/${asgn.id}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.id).toBe(asgn.id);
      expect(Array.isArray(response.body.data.testCases)).toBe(true);
      expect(response.body.data.testCases).toHaveLength(2);
    });

    it('should return closed assignment with public test cases', async () => {
      const asgn = await createAssignment({ status: 'CLOSED' });
      await addTestCases(asgn.id);

      const response = await request(app)
        .get(`/api/backend/student/assignments/${asgn.id}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.id).toBe(asgn.id);
      expect(response.body.data.status).toBe('CLOSED');
      expect(response.body.data.testCases).toHaveLength(2);
    });

    it('should NOT expose expectedOutput to student on PUBLISHED assignment', async () => {
      const asgn = await createAssignment({ status: 'PUBLISHED' });
      await addTestCases(asgn.id);

      const response = await request(app)
        .get(`/api/backend/student/assignments/${asgn.id}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(200);
      response.body.data.testCases.forEach((tc: any) => {
        expect(tc.expectedOutput).toBeUndefined();
      });
    });

    it('should NOT expose expectedOutput to student on CLOSED assignment', async () => {
      const asgn = await createAssignment({ status: 'CLOSED' });
      await addTestCases(asgn.id);

      const response = await request(app)
        .get(`/api/backend/student/assignments/${asgn.id}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(200);
      response.body.data.testCases.forEach((tc: any) => {
        expect(tc.expectedOutput).toBeUndefined();
      });
    });

    it('should expose id, name, inputData and orderIndex to student', async () => {
      const asgn = await createAssignment({ status: 'PUBLISHED' });
      await addTestCases(asgn.id);

      const response = await request(app)
        .get(`/api/backend/student/assignments/${asgn.id}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(200);
      const tc = response.body.data.testCases[0];
      expect(tc.id).toBeDefined();
      expect(tc.name).toBeDefined();
      expect(tc.orderIndex).toBeDefined();
      expect(Object.keys(tc)).toContain('inputData');
    });

    it('should return 404 for a DRAFT assignment', async () => {
      const asgn = await createAssignment({ status: 'DRAFT' });

      const response = await request(app)
        .get(`/api/backend/student/assignments/${asgn.id}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(404);
    });

    it('should return 404 for non-enrolled student on PUBLISHED assignment', async () => {
      const asgn = await createAssignment({ status: 'PUBLISHED' });

      const response = await request(app)
        .get(`/api/backend/student/assignments/${asgn.id}`)
        .set('Authorization', `Bearer ${otherStudentToken}`);

      expect(response.status).toBe(404);
    });

    it('should return 404 for non-enrolled student on CLOSED assignment', async () => {
      const asgn = await createAssignment({ status: 'CLOSED' });

      const response = await request(app)
        .get(`/api/backend/student/assignments/${asgn.id}`)
        .set('Authorization', `Bearer ${otherStudentToken}`);

      expect(response.status).toBe(404);
    });

    it('should return 404 for non-existent assignment', async () => {
      const response = await request(app)
        .get(`/api/backend/student/assignments/${nonExistentId}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(404);
    });

    it('should return 403 if user is a teacher', async () => {
      const asgn = await createAssignment({ status: 'PUBLISHED' });

      const response = await request(app)
        .get(`/api/backend/student/assignments/${asgn.id}`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/backend/student/assignments/class/:classId', () => {
    it('should return PUBLISHED and CLOSED assignments but not DRAFT', async () => {
      await createAssignment({ title: 'Draft', status: 'DRAFT' });
      await createAssignment({ title: 'Published', status: 'PUBLISHED' });
      await createAssignment({ title: 'Closed', status: 'CLOSED' });

      const response = await request(app)
        .get(`/api/backend/student/assignments/class/${classId}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(200);
      const titles = response.body.data.map((a: any) => a.title);
      expect(titles).toContain('Published');
      expect(titles).toContain('Closed');
      expect(titles).not.toContain('Draft');
    });

    it('should return assignments sorted by due date ascending', async () => {
      const later = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const sooner = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);

      await createAssignment({ title: 'Due Later', status: 'PUBLISHED', dueDate: later });
      await createAssignment({ title: 'Due Sooner', status: 'CLOSED', dueDate: sooner });

      const response = await request(app)
        .get(`/api/backend/student/assignments/class/${classId}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(200);
      const titles = response.body.data.map((a: any) => a.title);
      expect(titles.indexOf('Due Sooner')).toBeLessThan(titles.indexOf('Due Later'));
    });

    it('should return empty array if only DRAFT assignments exist', async () => {
      await createAssignment({ title: 'Draft Only', status: 'DRAFT' });

      const response = await request(app)
        .get(`/api/backend/student/assignments/class/${classId}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(0);
    });

    it('should return 404 if student is not enrolled in the class', async () => {
      const response = await request(app)
        .get(`/api/backend/student/assignments/class/${otherClassId}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(404);
    });

    it('should return 404 for non-existent class', async () => {
      const response = await request(app)
        .get(`/api/backend/student/assignments/class/${nonExistentId}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(404);
    });

    it('should return 403 if user is a teacher', async () => {
      const response = await request(app)
        .get(`/api/backend/student/assignments/class/${classId}`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(403);
    });
  });
});
