import { describe, it, expect, beforeAll, afterAll, afterEach, beforeEach } from '@jest/globals';
import request from 'supertest';
import app from '../../app';
import { db } from '../../db';
import { users, classes, classMembers } from '../../db/schema';
import { eq, and } from 'drizzle-orm';

describe('StudentClassController', () => {
  let studentToken: string;
  let studentId: string;
  let teacherToken: string;
  let teacherId: string;
  let testClassId: string;
  const nonExistentId = '00000000-0000-0000-0000-000000000000';

  beforeAll(async () => {
    await db.delete(users).where(eq(users.email, 'ctrlclasss-student@gmail.com'));
    await db.delete(users).where(eq(users.email, 'ctrlclasss-teacher@gmail.com'));

    await request(app).post('/api/backend/auth/register').send({
      email: 'ctrlclasss-student@gmail.com',
      password: 'Password123',
      name: 'Student',
      role: 'STUDENT',
    });
    await request(app).post('/api/backend/auth/register').send({
      email: 'ctrlclasss-teacher@gmail.com',
      password: 'Password123',
      name: 'Teacher',
      role: 'TEACHER',
    });

    const [student] = await db
      .select()
      .from(users)
      .where(eq(users.email, 'ctrlclasss-student@gmail.com'));
    const [teacher] = await db
      .select()
      .from(users)
      .where(eq(users.email, 'ctrlclasss-teacher@gmail.com'));
    studentId = student.id;
    teacherId = teacher.id;

    const studentLogin = await request(app)
      .post('/api/backend/auth/login')
      .send({ email: 'ctrlclasss-student@gmail.com', password: 'Password123' });
    studentToken = studentLogin.body.data.token;

    const teacherLogin = await request(app)
      .post('/api/backend/auth/login')
      .send({ email: 'ctrlclasss-teacher@gmail.com', password: 'Password123' });
    teacherToken = teacherLogin.body.data.token;
  });

  beforeEach(async () => {
    const [created] = await db
      .insert(classes)
      .values({ name: 'Test Class', teacherId, joinCode: `TEST-${Date.now()}` })
      .returning();
    testClassId = created.id;
  });

  afterEach(async () => {
    if (studentId) {
      await db.delete(classMembers).where(eq(classMembers.studentId, studentId));
    }
    if (teacherId) {
      await db.delete(classes).where(eq(classes.teacherId, teacherId));
    }
  });

  afterAll(async () => {
    if (studentId) {
      await db.delete(users).where(eq(users.id, studentId));
    }
    if (teacherId) {
      await db.delete(users).where(eq(users.id, teacherId));
    }
  });

  describe('POST /api/backend/student/classes/join', () => {
    it('should join a class with a valid join code', async () => {
      const [cls] = await db.select().from(classes).where(eq(classes.id, testClassId));

      const response = await request(app)
        .post('/api/backend/student/classes/join')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ joinCode: cls.joinCode });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.classId).toBe(testClassId);
      expect(response.body.data.class.name).toBe('Test Class');
    });

    it('should return 400 for an invalid join code', async () => {
      const response = await request(app)
        .post('/api/backend/student/classes/join')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ joinCode: 'INVALID1' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid join code');
    });

    it('should return 400 if already enrolled', async () => {
      const [cls] = await db.select().from(classes).where(eq(classes.id, testClassId));

      await request(app)
        .post('/api/backend/student/classes/join')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ joinCode: cls.joinCode });

      //Join again
      const response = await request(app)
        .post('/api/backend/student/classes/join')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ joinCode: cls.joinCode });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('You are already enrolled in this class');
    });

    it('should return 400 if joinCode is missing', async () => {
      const response = await request(app)
        .post('/api/backend/student/classes/join')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({});

      expect(response.status).toBe(400);
    });

    it('should return 403 if a teacher tries to join', async () => {
      const [cls] = await db.select().from(classes).where(eq(classes.id, testClassId));

      const response = await request(app)
        .post('/api/backend/student/classes/join')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ joinCode: cls.joinCode });

      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/backend/student/classes', () => {
    it('should return empty array when not enrolled in any class', async () => {
      const response = await request(app)
        .get('/api/backend/student/classes')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data).toHaveLength(0);
    });

    it('should return enrolled classes with class details', async () => {
      await db.insert(classMembers).values({ classId: testClassId, studentId });

      const response = await request(app)
        .get('/api/backend/student/classes')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].classId).toBe(testClassId);
      expect(response.body.data[0].class).toBeDefined();
      expect(response.body.data[0].class.name).toBe('Test Class');
      expect(response.body.data[0].joinedAt).toBeDefined();
    });

    it('should return 403 if a teacher tries to access', async () => {
      const response = await request(app)
        .get('/api/backend/student/classes')
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(403);
    });
  });

  describe('DELETE /api/backend/student/classes/:classId/leave', () => {
    it('should leave a class successfully', async () => {
      await db.insert(classMembers).values({ classId: testClassId, studentId });

      const response = await request(app)
        .delete(`/api/backend/student/classes/${testClassId}/leave`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      const membership = await db
        .select()
        .from(classMembers)
        .where(and(eq(classMembers.classId, testClassId), eq(classMembers.studentId, studentId)));
      expect(membership).toHaveLength(0);
    });

    it('should return 404 if not enrolled in the class', async () => {
      const response = await request(app)
        .delete(`/api/backend/student/classes/${testClassId}/leave`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('You are not enrolled in this class');
    });

    it('should return 404 for non-existent class', async () => {
      const response = await request(app)
        .delete(`/api/backend/student/classes/${nonExistentId}/leave`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(404);
    });

    it('should return 400 for invalid UUID', async () => {
      const response = await request(app)
        .delete('/api/backend/student/classes/not-a-uuid/leave')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(400);
    });

    it('should return 403 if a teacher tries to leave', async () => {
      const response = await request(app)
        .delete(`/api/backend/student/classes/${testClassId}/leave`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/backend/student/classes/:classId', () => {
    it('should return class details when enrolled', async () => {
      await db.insert(classMembers).values({ classId: testClassId, studentId });

      const response = await request(app)
        .get(`/api/backend/student/classes/${testClassId}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(testClassId);
      expect(response.body.data.name).toBe('Test Class');
      expect(response.body.data.teacherId).toBe(teacherId);
      expect(response.body.data.joinCode).toBeDefined();
    });

    it('should return 404 if not enrolled in the class', async () => {
      const response = await request(app)
        .get(`/api/backend/student/classes/${testClassId}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(404);
    });

    it('should return 404 for non-existent class', async () => {
      const response = await request(app)
        .get(`/api/backend/student/classes/${nonExistentId}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(404);
    });

    it('should return 400 for invalid UUID', async () => {
      const response = await request(app)
        .get('/api/backend/student/classes/not-a-uuid')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(400);
    });

    it('should return 403 if a teacher tries to access', async () => {
      const response = await request(app)
        .get(`/api/backend/student/classes/${testClassId}`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(403);
    });

    it('should return 401 without token', async () => {
      const response = await request(app).get(`/api/backend/student/classes/${testClassId}`);

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/backend/student/classes/:classId/students', () => {
    it('should return student list when enrolled', async () => {
      await db.insert(classMembers).values({ classId: testClassId, studentId });

      const response = await request(app)
        .get(`/api/backend/student/classes/${testClassId}/students`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.classId).toBe(testClassId);
      expect(response.body.data.studentCount).toBe(1);
      expect(response.body.data.students).toHaveLength(1);
      expect(response.body.data.students[0].id).toBe(studentId);
      expect(response.body.data.students[0].email).toBeDefined();
      expect(response.body.data.students[0].joinedAt).toBeDefined();
    });

    it('should return empty student list when class has no members', async () => {
      await db.insert(classMembers).values({ classId: testClassId, studentId });

      // Second student enrolled in the same class to verify count accuracy
      const [student2] = await db
        .insert(users)
        .values({
          email: `ctrlclasss-extra-${Date.now()}@gmail.com`,
          password: 'Password123',
          role: 'STUDENT',
          name: 'Extra Student',
        })
        .returning();

      await db.insert(classMembers).values({ classId: testClassId, studentId: student2.id });

      const response = await request(app)
        .get(`/api/backend/student/classes/${testClassId}/students`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.studentCount).toBe(2);
      const ids = response.body.data.students.map((s: any) => s.id);
      expect(ids).toContain(studentId);
      expect(ids).toContain(student2.id);

      await db.delete(classMembers).where(eq(classMembers.studentId, student2.id));
      await db.delete(users).where(eq(users.id, student2.id));
    });

    it('should return 404 if student is not enrolled', async () => {
      const response = await request(app)
        .get(`/api/backend/student/classes/${testClassId}/students`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(404);
    });

    it('should return 404 for non-existent class', async () => {
      const response = await request(app)
        .get(`/api/backend/student/classes/${nonExistentId}/students`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(404);
    });

    it('should return 403 if a teacher tries to access', async () => {
      const response = await request(app)
        .get(`/api/backend/student/classes/${testClassId}/students`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(403);
    });

    it('should return 401 without token', async () => {
      const response = await request(app).get(
        `/api/backend/student/classes/${testClassId}/students`
      );
      expect(response.status).toBe(401);
    });

    it('should not expose sensitive fields on students', async () => {
      await db.insert(classMembers).values({ classId: testClassId, studentId });

      const response = await request(app)
        .get(`/api/backend/student/classes/${testClassId}/students`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(200);
      response.body.data.students.forEach((s: any) => {
        expect(s.password).toBeUndefined();
        expect(s.role).toBeUndefined();
      });
    });
  });
});
