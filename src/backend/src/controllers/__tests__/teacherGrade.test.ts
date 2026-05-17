import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import request from 'supertest';
import app from '../../app';
import { db } from '../../db';
import { users, classes, classMembers, grades } from '../../db/schema';
import { eq } from 'drizzle-orm';

describe('TeacherGradeController', () => {
  let teacherToken: string;
  let teacherId: string;
  let studentId: string;
  let classId: string;
  const nonExistentId = '00000000-0000-0000-0000-000000000000';

  beforeAll(async () => {
    await db.delete(classes).where(eq(classes.joinCode, 'GRADECLS1'));
    await db.delete(users).where(eq(users.email, 'ctrlgradet-teacher@gmail.com'));
    await db.delete(users).where(eq(users.email, 'ctrlgradet-student@gmail.com'));

    await request(app).post('/api/backend/auth/register').send({
      email: 'ctrlgradet-teacher@gmail.com',
      password: 'Password123',
      name: 'Teacher',
      role: 'TEACHER',
    });
    await request(app).post('/api/backend/auth/register').send({
      email: 'ctrlgradet-student@gmail.com',
      password: 'Password123',
      name: 'Grade Student',
      role: 'STUDENT',
    });

    const [teacher] = await db
      .select()
      .from(users)
      .where(eq(users.email, 'ctrlgradet-teacher@gmail.com'));
    const [student] = await db
      .select()
      .from(users)
      .where(eq(users.email, 'ctrlgradet-student@gmail.com'));
    teacherId = teacher.id;
    studentId = student.id;

    const login = await request(app)
      .post('/api/backend/auth/login')
      .send({ email: 'ctrlgradet-teacher@gmail.com', password: 'Password123' });
    teacherToken = login.body.data.token;

    const [cls] = await db
      .insert(classes)
      .values({ name: 'Grade Class', teacherId, joinCode: 'GRADECLS1' })
      .returning();
    classId = cls.id;

    await db.insert(classMembers).values({ classId, studentId });
  });

  afterEach(async () => {
    if (classId) {
      await db.delete(grades).where(eq(grades.classId, classId));
    }
  });

  afterAll(async () => {
    if (classId) {
      await db.delete(classMembers).where(eq(classMembers.classId, classId));
      await db.delete(classes).where(eq(classes.id, classId));
    }
    if (teacherId) {
      await db.delete(users).where(eq(users.id, teacherId));
    }
    if (studentId) {
      await db.delete(users).where(eq(users.id, studentId));
    }
  });

  describe('POST /api/backend/teacher/grades/class/:classId', () => {
    it('should record a grade and return 201', async () => {
      const response = await request(app)
        .post(`/api/backend/teacher/grades/class/${classId}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          studentId,
          sourceType: 'ASSIGNMENT',
          sourceId: 'asgn-1',
          score: 80,
          maxScore: 100,
        });

      expect(response.status).toBe(201);
      expect(response.body.data.score).toBe(80);
      expect(response.body.data.percentage).toBe(80);
      expect(response.body.data.releasedAt).toBeNull();
    });

    it('should update existing grade instead of creating duplicate', async () => {
      await request(app)
        .post(`/api/backend/teacher/grades/class/${classId}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          studentId,
          sourceType: 'ASSIGNMENT',
          sourceId: 'asgn-dup',
          score: 70,
          maxScore: 100,
        });

      const response = await request(app)
        .post(`/api/backend/teacher/grades/class/${classId}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          studentId,
          sourceType: 'ASSIGNMENT',
          sourceId: 'asgn-dup',
          score: 90,
          maxScore: 100,
        });

      expect(response.status).toBe(201);
      expect(response.body.data.score).toBe(90);

      const allGrades = await db.select().from(grades).where(eq(grades.classId, classId));
      expect(allGrades.filter((g) => g.sourceId === 'asgn-dup')).toHaveLength(1);
    });

    it('should return 400 if score exceeds maxScore', async () => {
      const response = await request(app)
        .post(`/api/backend/teacher/grades/class/${classId}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          studentId,
          sourceType: 'ASSIGNMENT',
          sourceId: 'asgn-x',
          score: 110,
          maxScore: 100,
        });

      expect(response.status).toBe(400);
    });

    it('should return 400 if required fields are missing', async () => {
      const response = await request(app)
        .post(`/api/backend/teacher/grades/class/${classId}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ studentId, sourceType: 'ASSIGNMENT' });

      expect(response.status).toBe(400);
    });

    it('should return 404 for non-existent class', async () => {
      const response = await request(app)
        .post(`/api/backend/teacher/grades/class/${nonExistentId}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          studentId,
          sourceType: 'ASSIGNMENT',
          sourceId: 'asgn-1',
          score: 80,
          maxScore: 100,
        });

      expect(response.status).toBe(404);
    });

    it('should return 401 without token', async () => {
      const response = await request(app)
        .post(`/api/backend/teacher/grades/class/${classId}`)
        .send({
          studentId,
          sourceType: 'ASSIGNMENT',
          sourceId: 'asgn-1',
          score: 80,
          maxScore: 100,
        });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/backend/teacher/grades/class/:classId', () => {
    it('should return all grades for a class', async () => {
      await db.insert(grades).values({
        studentId,
        classId,
        sourceType: 'ASSIGNMENT',
        sourceId: 'asgn-list',
        score: 85,
        maxScore: 100,
      });

      const response = await request(app)
        .get(`/api/backend/teacher/grades/class/${classId}`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThanOrEqual(1);
      expect(response.body.data[0].student).toBeDefined();
    });

    it('should return 404 for class not owned by teacher', async () => {
      const response = await request(app)
        .get(`/api/backend/teacher/grades/class/${nonExistentId}`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/backend/teacher/grades/class/:classId/source', () => {
    it('should return grades filtered by source', async () => {
      await db.insert(grades).values({
        studentId,
        classId,
        sourceType: 'ASSIGNMENT',
        sourceId: 'asgn-src',
        score: 75,
        maxScore: 100,
      });

      const response = await request(app)
        .get(`/api/backend/teacher/grades/class/${classId}/source`)
        .query({ sourceId: 'asgn-src', sourceType: 'ASSIGNMENT' })
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].sourceId).toBe('asgn-src');
    });

    it('should return 400 if query params are missing', async () => {
      const response = await request(app)
        .get(`/api/backend/teacher/grades/class/${classId}/source`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/backend/teacher/grades/class/:classId/release', () => {
    it('should release grades and return count', async () => {
      await db.insert(grades).values({
        studentId,
        classId,
        sourceType: 'ASSIGNMENT',
        sourceId: 'asgn-release',
        score: 90,
        maxScore: 100,
      });

      const response = await request(app)
        .post(`/api/backend/teacher/grades/class/${classId}/release`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ sourceType: 'ASSIGNMENT', sourceId: 'asgn-release' });

      expect(response.status).toBe(200);
      expect(response.body.data.released).toBe(1);
    });

    it('should return 404 if no grades to release', async () => {
      const response = await request(app)
        .post(`/api/backend/teacher/grades/class/${classId}/release`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ sourceType: 'ASSIGNMENT', sourceId: 'nonexistent' });

      expect(response.status).toBe(404);
    });
  });

  describe('PATCH /api/backend/teacher/grades/:gradeId', () => {
    it('should update a grade score', async () => {
      const [created] = await db
        .insert(grades)
        .values({
          studentId,
          classId,
          sourceType: 'ASSIGNMENT',
          sourceId: 'asgn-upd',
          score: 70,
          maxScore: 100,
        })
        .returning();

      const response = await request(app)
        .patch(`/api/backend/teacher/grades/${created.id}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ score: 95 });

      expect(response.status).toBe(200);
      expect(response.body.data.score).toBe(95);
    });

    it('should return 404 for non-existent grade', async () => {
      const response = await request(app)
        .patch(`/api/backend/teacher/grades/${nonExistentId}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ score: 95 });

      expect(response.status).toBe(404);
    });

    it('should return 400 for empty body', async () => {
      const [created] = await db
        .insert(grades)
        .values({
          studentId,
          classId,
          sourceType: 'ASSIGNMENT',
          sourceId: 'asgn-empty',
          score: 70,
          maxScore: 100,
        })
        .returning();

      const response = await request(app)
        .patch(`/api/backend/teacher/grades/${created.id}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({});

      expect(response.status).toBe(400);
    });
  });

  describe('DELETE /api/backend/teacher/grades/:gradeId', () => {
    it('should delete a grade and return 200', async () => {
      const [created] = await db
        .insert(grades)
        .values({
          studentId,
          classId,
          sourceType: 'EXAM',
          sourceId: 'exam-del',
          score: 60,
          maxScore: 100,
        })
        .returning();

      const response = await request(app)
        .delete(`/api/backend/teacher/grades/${created.id}`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(200);

      const found = await db.select().from(grades).where(eq(grades.id, created.id));
      expect(found).toHaveLength(0);
    });

    it('should return 404 for non-existent grade', async () => {
      const response = await request(app)
        .delete(`/api/backend/teacher/grades/${nonExistentId}`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/backend/teacher/grades/class/:classId/overview', () => {
    it('should return weighted percentage overview for all students', async () => {
      await db.insert(grades).values([
        {
          studentId,
          classId,
          sourceType: 'ASSIGNMENT',
          sourceId: 'ov-asgn-1',
          score: 75,
          maxScore: 100,
        },
        {
          studentId,
          classId,
          sourceType: 'ASSIGNMENT',
          sourceId: 'ov-asgn-2',
          score: 20,
          maxScore: 20,
        },
      ]);

      const response = await request(app)
        .get(`/api/backend/teacher/grades/class/${classId}/overview`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data)).toBe(true);

      const entry = response.body.data.find((e: any) => e.studentId === studentId);
      expect(entry).toBeDefined();
      expect(entry.totalEarned).toBe(95);
      expect(entry.totalPossible).toBe(120);
      expect(entry.percentage).toBe(79.17);
      expect(entry.gradedCount).toBe(2);
    });

    it('should return empty array if no grades exist', async () => {
      const response = await request(app)
        .get(`/api/backend/teacher/grades/class/${classId}/overview`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual([]);
    });

    it('should return 404 for class not owned by teacher', async () => {
      const response = await request(app)
        .get(`/api/backend/teacher/grades/class/${nonExistentId}/overview`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/backend/teacher/grades/class/:classId/student/:studentId', () => {
    it('should return summary and all grades for a student', async () => {
      await db.insert(grades).values([
        {
          studentId,
          classId,
          sourceType: 'ASSIGNMENT',
          sourceId: 'so-asgn-1',
          score: 75,
          maxScore: 100,
        },
        {
          studentId,
          classId,
          sourceType: 'ASSIGNMENT',
          sourceId: 'so-asgn-2',
          score: 20,
          maxScore: 20,
        },
      ]);

      const response = await request(app)
        .get(`/api/backend/teacher/grades/class/${classId}/student/${studentId}`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.studentId).toBe(studentId);
      expect(response.body.data.totalEarned).toBe(95);
      expect(response.body.data.totalPossible).toBe(120);
      expect(response.body.data.percentage).toBe(79.17);
      expect(response.body.data.gradedCount).toBe(2);
      expect(Array.isArray(response.body.data.grades)).toBe(true);
      expect(response.body.data.grades).toHaveLength(2);
      expect(response.body.data.grades[0].student).toBeDefined();
    });

    it('should include both released and unreleased grades', async () => {
      await db.insert(grades).values([
        {
          studentId,
          classId,
          sourceType: 'ASSIGNMENT',
          sourceId: 'so-rel',
          score: 90,
          maxScore: 100,
          releasedAt: new Date(),
        },
        {
          studentId,
          classId,
          sourceType: 'ASSIGNMENT',
          sourceId: 'so-unrel',
          score: 60,
          maxScore: 100,
        },
      ]);

      const response = await request(app)
        .get(`/api/backend/teacher/grades/class/${classId}/student/${studentId}`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(200);
      const sourceIds = response.body.data.grades.map((g: any) => g.sourceId);
      expect(sourceIds).toContain('so-rel');
      expect(sourceIds).toContain('so-unrel');
    });

    it('should return 0% with empty grades array if student has no grades', async () => {
      const response = await request(app)
        .get(`/api/backend/teacher/grades/class/${classId}/student/${studentId}`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.percentage).toBe(0);
      expect(response.body.data.grades).toHaveLength(0);
    });

    it('should return 404 for class not owned by teacher', async () => {
      const response = await request(app)
        .get(`/api/backend/teacher/grades/class/${nonExistentId}/student/${studentId}`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(404);
    });

    it('should return 404 for student not enrolled in class', async () => {
      const response = await request(app)
        .get(`/api/backend/teacher/grades/class/${classId}/student/${nonExistentId}`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(404);
    });
  });
});
