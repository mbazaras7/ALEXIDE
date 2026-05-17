import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import request from 'supertest';
import app from '../../app';
import { db } from '../../db';
import { users, classes, classMembers, grades } from '../../db/schema';
import { eq } from 'drizzle-orm';

describe('StudentGradeController', () => {
  let studentToken: string;
  let studentId: string;
  let teacherId: string;
  let classId: string;

  beforeAll(async () => {
    await db.delete(classes).where(eq(classes.joinCode, 'SGRADE001'));
    await db.delete(users).where(eq(users.email, 'ctrlgrades-teacher@gmail.com'));
    await db.delete(users).where(eq(users.email, 'ctrlgrades-student@gmail.com'));

    const teacherReg = await request(app).post('/api/backend/auth/register').send({
      email: 'ctrlGradeS-teacher@gmail.com',
      password: 'Password123',
      name: 'Grade Teacher',
      role: 'TEACHER',
    });
    console.log('TEACHER REG:', teacherReg.status, JSON.stringify(teacherReg.body));

    const studentReg = await request(app).post('/api/backend/auth/register').send({
      email: 'ctrlgrades-student@gmail.com',
      password: 'Password123',
      name: 'Grade Student',
      role: 'STUDENT',
    });
    console.log('STUDENT REG:', studentReg.status, JSON.stringify(studentReg.body));

    const teacherRows = await db
      .select()
      .from(users)
      .where(eq(users.email, 'ctrlgrades-teacher@gmail.com'));
    console.log('TEACHER ROWS LOWER:', teacherRows.length);
    const studentRows = await db
      .select()
      .from(users)
      .where(eq(users.email, 'ctrlgrades-student@gmail.com'));
    console.log('TEACHER ROWS:', teacherRows.length);
    console.log('STUDENT ROWS:', studentRows.length);

    const teacher = teacherRows[0];
    const student = studentRows[0];
    teacherId = teacher.id;
    studentId = student.id;

    const login = await request(app)
      .post('/api/backend/auth/login')
      .send({ email: 'ctrlGradeS-student@gmail.com', password: 'Password123' });
    studentToken = login.body.data.token;

    const [cls] = await db
      .insert(classes)
      .values({ name: 'Student Grade Class', teacherId, joinCode: 'SGRADE001' })
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

  describe('GET /api/backend/student/grades', () => {
    it('should return empty array when no grades released', async () => {
      await db.insert(grades).values({
        studentId,
        classId,
        sourceType: 'ASSIGNMENT',
        sourceId: 'unreleased',
        score: 80,
        maxScore: 100,
      });

      const response = await request(app)
        .get('/api/backend/student/grades')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(0);
    });

    it('should return only released grades', async () => {
      await db.insert(grades).values([
        {
          studentId,
          classId,
          sourceType: 'ASSIGNMENT',
          sourceId: 'released-asgn',
          score: 90,
          maxScore: 100,
          releasedAt: new Date(),
        },
        {
          studentId,
          classId,
          sourceType: 'ASSIGNMENT',
          sourceId: 'unreleased-asgn',
          score: 70,
          maxScore: 100,
        },
      ]);

      const response = await request(app)
        .get('/api/backend/student/grades')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(200);
      const sourceIds = response.body.data.map((g: any) => g.sourceId);
      expect(sourceIds).toContain('released-asgn');
      expect(sourceIds).not.toContain('unreleased-asgn');
    });

    it('should include class details on each grade', async () => {
      await db.insert(grades).values({
        studentId,
        classId,
        sourceType: 'EXAM',
        sourceId: 'exam-1',
        score: 85,
        maxScore: 100,
        releasedAt: new Date(),
      });

      const response = await request(app)
        .get('/api/backend/student/grades')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data[0].class).toBeDefined();
      expect(response.body.data[0].class.name).toBe('Student Grade Class');
    });

    it('should return 401 without token', async () => {
      const response = await request(app).get('/api/backend/student/grades');
      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/backend/student/grades/class/:classId', () => {
    it('should return released grades for the class', async () => {
      await db.insert(grades).values({
        studentId,
        classId,
        sourceType: 'ASSIGNMENT',
        sourceId: 'cls-asgn-1',
        score: 88,
        maxScore: 100,
        releasedAt: new Date(),
      });

      const response = await request(app)
        .get(`/api/backend/student/grades/class/${classId}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].sourceId).toBe('cls-asgn-1');
      expect(response.body.data[0].percentage).toBe(88);
    });

    it('should not return unreleased grades', async () => {
      await db.insert(grades).values({
        studentId,
        classId,
        sourceType: 'ASSIGNMENT',
        sourceId: 'hidden-asgn',
        score: 50,
        maxScore: 100,
      });

      const response = await request(app)
        .get(`/api/backend/student/grades/class/${classId}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(200);
      const sourceIds = response.body.data.map((g: any) => g.sourceId);
      expect(sourceIds).not.toContain('hidden-asgn');
    });

    it('should return 401 without token', async () => {
      const response = await request(app).get(`/api/backend/student/grades/class/${classId}`);

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/backend/student/grades/:gradeId', () => {
    it('should return a specific released grade', async () => {
      const [created] = await db
        .insert(grades)
        .values({
          studentId,
          classId,
          sourceType: 'ASSIGNMENT',
          sourceId: 'specific-1',
          score: 88,
          maxScore: 100,
          releasedAt: new Date(),
        })
        .returning();

      const response = await request(app)
        .get(`/api/backend/student/grades/${created.id}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.id).toBe(created.id);
      expect(response.body.data.percentage).toBe(88);
      expect(response.body.data.class).toBeDefined();
    });

    it('should return 404 for unreleased grade', async () => {
      const [created] = await db
        .insert(grades)
        .values({
          studentId,
          classId,
          sourceType: 'ASSIGNMENT',
          sourceId: 'unreleased-id',
          score: 70,
          maxScore: 100,
        })
        .returning();

      const response = await request(app)
        .get(`/api/backend/student/grades/${created.id}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(404);
    });

    it('should return 404 for a grade belonging to another student', async () => {
      const [otherStudent] = await db
        .insert(users)
        .values({ email: `grade${Date.now()}@gmail.com`, password: 'Password321', role: 'STUDENT' })
        .returning();

      const [created] = await db
        .insert(grades)
        .values({
          studentId: otherStudent.id,
          classId,
          sourceType: 'ASSIGNMENT',
          sourceId: 'other-grade',
          score: 90,
          maxScore: 100,
          releasedAt: new Date(),
        })
        .returning();

      const response = await request(app)
        .get(`/api/backend/student/grades/${created.id}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(404);

      await db.delete(grades).where(eq(grades.id, created.id));
      await db.delete(users).where(eq(users.id, otherStudent.id));
    });

    it('should return 400 for invalid UUID', async () => {
      const response = await request(app)
        .get('/api/backend/student/grades/not-a-uuid')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(400);
    });

    it('should return 401 without token', async () => {
      const response = await request(app).get(
        `/api/backend/student/grades/00000000-0000-0000-0000-000000000000`
      );

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/backend/student/grades/class/:classId/stats', () => {
    it('should return stats with zero values when no released grades', async () => {
      const response = await request(app)
        .get(`/api/backend/student/grades/class/${classId}/stats`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.totalGrades).toBe(0);
      expect(response.body.data.averagePercentage).toBe(0);
    });

    it('should return correct stats with released grades', async () => {
      await db.insert(grades).values([
        {
          studentId,
          classId,
          sourceType: 'ASSIGNMENT',
          sourceId: 'stats-a1',
          score: 80,
          maxScore: 100,
          releasedAt: new Date(),
        },
        {
          studentId,
          classId,
          sourceType: 'ASSIGNMENT',
          sourceId: 'stats-a2',
          score: 60,
          maxScore: 100,
          releasedAt: new Date(),
        },
        {
          studentId,
          classId,
          sourceType: 'EXAM',
          sourceId: 'stats-e1',
          score: 90,
          maxScore: 100,
          releasedAt: new Date(),
        },
      ]);

      const response = await request(app)
        .get(`/api/backend/student/grades/class/${classId}/stats`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.totalGrades).toBe(3);
      expect(response.body.data.assignmentCount).toBe(2);
      expect(response.body.data.examCount).toBe(1);
      expect(response.body.data.highestPercentage).toBe(90);
      expect(response.body.data.lowestPercentage).toBe(60);
      expect(response.body.data.assignmentAverage).toBe(70);
      expect(response.body.data.examAverage).toBe(90);
    });

    it('should not count unreleased grades in stats', async () => {
      await db.insert(grades).values([
        {
          studentId,
          classId,
          sourceType: 'ASSIGNMENT',
          sourceId: 'stats-rel',
          score: 80,
          maxScore: 100,
          releasedAt: new Date(),
        },
        {
          studentId,
          classId,
          sourceType: 'ASSIGNMENT',
          sourceId: 'stats-unrel',
          score: 10,
          maxScore: 100,
        },
      ]);

      const response = await request(app)
        .get(`/api/backend/student/grades/class/${classId}/stats`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.body.data.totalGrades).toBe(1);
      expect(response.body.data.averagePercentage).toBe(80);
    });

    it('should return 400 for invalid class UUID', async () => {
      const response = await request(app)
        .get('/api/backend/student/grades/class/not-a-uuid/stats')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/backend/student/grades/summary', () => {
    it('should return empty array when no released grades', async () => {
      const response = await request(app)
        .get('/api/backend/student/grades/summary')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual([]);
    });

    it('should return summary per class', async () => {
      await db.insert(grades).values([
        {
          studentId,
          classId,
          sourceType: 'ASSIGNMENT',
          sourceId: 'sum-1',
          score: 80,
          maxScore: 100,
          releasedAt: new Date(),
        },
        {
          studentId,
          classId,
          sourceType: 'EXAM',
          sourceId: 'sum-2',
          score: 90,
          maxScore: 100,
          releasedAt: new Date(),
        },
      ]);

      const response = await request(app)
        .get('/api/backend/student/grades/summary')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].className).toBe('Student Grade Class');
      expect(response.body.data[0].totalGrades).toBe(2);
      expect(response.body.data[0].averagePercentage).toBe(85);
      expect(response.body.data[0].highestPercentage).toBe(90);
      expect(response.body.data[0].lowestPercentage).toBe(80);
    });

    it('should return 401 without token', async () => {
      const response = await request(app).get('/api/backend/student/grades/summary');
      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/backend/student/grades/class/:classId/filter', () => {
    it('should return only ASSIGNMENT grades', async () => {
      await db.insert(grades).values([
        {
          studentId,
          classId,
          sourceType: 'ASSIGNMENT',
          sourceId: 'flt-a1',
          score: 80,
          maxScore: 100,
          releasedAt: new Date(),
        },
        {
          studentId,
          classId,
          sourceType: 'EXAM',
          sourceId: 'flt-e1',
          score: 70,
          maxScore: 100,
          releasedAt: new Date(),
        },
      ]);

      const response = await request(app)
        .get(`/api/backend/student/grades/class/${classId}/filter`)
        .query({ sourceType: 'ASSIGNMENT' })
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.every((g: any) => g.sourceType === 'ASSIGNMENT')).toBe(true);
      expect(response.body.data.some((g: any) => g.sourceId === 'flt-e1')).toBe(false);
    });

    it('should return only EXAM grades', async () => {
      await db.insert(grades).values([
        {
          studentId,
          classId,
          sourceType: 'ASSIGNMENT',
          sourceId: 'flt-a2',
          score: 80,
          maxScore: 100,
          releasedAt: new Date(),
        },
        {
          studentId,
          classId,
          sourceType: 'EXAM',
          sourceId: 'flt-e2',
          score: 95,
          maxScore: 100,
          releasedAt: new Date(),
        },
      ]);

      const response = await request(app)
        .get(`/api/backend/student/grades/class/${classId}/filter`)
        .query({ sourceType: 'EXAM' })
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.every((g: any) => g.sourceType === 'EXAM')).toBe(true);
    });

    it('should return 400 for invalid sourceType', async () => {
      const response = await request(app)
        .get(`/api/backend/student/grades/class/${classId}/filter`)
        .query({ sourceType: 'HOMEWORK' })
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(400);
    });

    it('should return 400 if sourceType is missing', async () => {
      const response = await request(app)
        .get(`/api/backend/student/grades/class/${classId}/filter`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(400);
    });

    it('should not return unreleased grades even with correct type', async () => {
      await db.insert(grades).values({
        studentId,
        classId,
        sourceType: 'ASSIGNMENT',
        sourceId: 'flt-hidden',
        score: 50,
        maxScore: 100,
      });

      const response = await request(app)
        .get(`/api/backend/student/grades/class/${classId}/filter`)
        .query({ sourceType: 'ASSIGNMENT' })
        .set('Authorization', `Bearer ${studentToken}`);

      const sourceIds = response.body.data.map((g: any) => g.sourceId);
      expect(sourceIds).not.toContain('flt-hidden');
    });

    it('should return 401 without token', async () => {
      const response = await request(app)
        .get(`/api/backend/student/grades/class/${classId}/filter`)
        .query({ sourceType: 'ASSIGNMENT' });

      expect(response.status).toBe(401);
    });
  });
});
