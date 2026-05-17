import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import request from 'supertest';
import app from '../../app';
import { db } from '../../db';
import { users, classes, classMembers } from '../../db/schema';
import { eq } from 'drizzle-orm';

describe('TeacherClassController', () => {
  let teacherToken: string;
  let teacherId: string;
  let otherTeacherId: string;
  let studentToken: string;
  let studentId: string;
  const nonExistentId = '00000000-0000-0000-0000-000000000000';

  beforeAll(async () => {
    await db.delete(users).where(eq(users.email, 'ctrlclasst-teacher@gmail.com'));
    await db.delete(users).where(eq(users.email, 'ctrlclasst-other-teacher@gmail.com'));
    await db.delete(users).where(eq(users.email, 'ctrlclasst-student@gmail.com'));

    await request(app).post('/api/backend/auth/register').send({
      email: 'ctrlclasst-teacher@gmail.com',
      password: 'Password123',
      name: 'Teacher',
      role: 'TEACHER',
    });
    await request(app).post('/api/backend/auth/register').send({
      email: 'ctrlclasst-other-teacher@gmail.com',
      password: 'Password123',
      name: 'Other Teacher',
      role: 'TEACHER',
    });
    await request(app).post('/api/backend/auth/register').send({
      email: 'ctrlclasst-student@gmail.com',
      password: 'Password123',
      name: 'Student',
      role: 'STUDENT',
    });

    const [teacher] = await db
      .select()
      .from(users)
      .where(eq(users.email, 'ctrlclasst-teacher@gmail.com'));
    const [other] = await db
      .select()
      .from(users)
      .where(eq(users.email, 'ctrlclasst-other-teacher@gmail.com'));
    const [student] = await db
      .select()
      .from(users)
      .where(eq(users.email, 'ctrlclasst-student@gmail.com'));
    teacherId = teacher.id;
    otherTeacherId = other.id;
    studentId = student.id;

    const teacherLogin = await request(app)
      .post('/api/backend/auth/login')
      .send({ email: 'ctrlclasst-teacher@gmail.com', password: 'Password123' });
    teacherToken = teacherLogin.body.data.token;

    const studentLogin = await request(app)
      .post('/api/backend/auth/login')
      .send({ email: 'ctrlclasst-student@gmail.com', password: 'Password123' });
    studentToken = studentLogin.body.data.token;
  });

  afterEach(async () => {
    if (teacherId) {
      await db
        .delete(classMembers)
        .where(
          eq(
            classMembers.classId,
            db
              .select({ id: classes.id })
              .from(classes)
              .where(eq(classes.teacherId, teacherId)) as any
          )
        )
        .catch(() => {});
      await db.delete(classes).where(eq(classes.teacherId, teacherId));
    }
    if (otherTeacherId) {
      await db.delete(classes).where(eq(classes.teacherId, otherTeacherId));
    }
  });

  afterAll(async () => {
    if (teacherId) {
      await db.delete(users).where(eq(users.id, teacherId));
    }
    if (otherTeacherId) {
      await db.delete(users).where(eq(users.id, otherTeacherId));
    }
    if (studentId) {
      await db.delete(users).where(eq(users.id, studentId));
    }
  });

  describe('POST /api/backend/teacher/classes', () => {
    it('should create a class and return 201', async () => {
      const response = await request(app)
        .post('/api/backend/teacher/classes')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ name: 'Python', description: 'Intro' });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        name: 'Python',
        description: 'Intro',
        teacherId,
      });
      expect(response.body.data.joinCode).toBeDefined();
      expect(response.body.data.joinCode.length).toBe(8);
    });

    it('should return 400 if name is missing', async () => {
      const response = await request(app)
        .post('/api/backend/teacher/classes')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ description: 'No name here' });

      expect(response.status).toBe(400);
    });

    it('should return 401 without auth token', async () => {
      const response = await request(app)
        .post('/api/backend/teacher/classes')
        .send({ name: 'Unauthorised' });

      expect(response.status).toBe(401);
    });

    it('should return 403 if user is a student', async () => {
      const response = await request(app)
        .post('/api/backend/teacher/classes')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ name: 'Sneaky Class' });

      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/backend/teacher/classes', () => {
    it('should return all classes for teacher with memberCount', async () => {
      await db.insert(classes).values([
        { name: 'Class A', teacherId, joinCode: `CLASSA-${Date.now()}` },
        { name: 'Class B', teacherId, joinCode: `CLASSB-${Date.now()}` },
      ]);

      const response = await request(app)
        .get('/api/backend/teacher/classes')
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThanOrEqual(2);
      response.body.data.forEach((c: any) => {
        expect(typeof c.memberCount).toBe('number');
      });
    });

    it('should not return classes from other teachers', async () => {
      const [myClass] = await db
        .insert(classes)
        .values({ name: 'Mine', teacherId, joinCode: `MINE-${Date.now()}` })
        .returning();

      const [theirClass] = await db
        .insert(classes)
        .values({ name: 'Theirs', teacherId: otherTeacherId, joinCode: `THEIR-${Date.now()}` })
        .returning();

      const response = await request(app)
        .get('/api/backend/teacher/classes')
        .set('Authorization', `Bearer ${teacherToken}`);

      const ids = response.body.data.map((c: any) => c.id);
      expect(ids).toContain(myClass.id);
      expect(ids).not.toContain(theirClass.id);
    });

    it('should return 401 without token', async () => {
      const response = await request(app).get('/api/backend/teacher/classes');
      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/backend/teacher/classes/:id', () => {
    it('should return class with members array', async () => {
      const [created] = await db
        .insert(classes)
        .values({ name: 'Detail Class', teacherId, joinCode: `DETAIL-${Date.now()}` })
        .returning();

      await db.insert(classMembers).values({ classId: created.id, studentId });

      const response = await request(app)
        .get(`/api/backend/teacher/classes/${created.id}`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.id).toBe(created.id);
      expect(Array.isArray(response.body.data.members)).toBe(true);
      expect(response.body.data.members[0].studentId).toBe(studentId);
    });

    it('should return 404 for class owned by another teacher', async () => {
      const [created] = await db
        .insert(classes)
        .values({ name: 'Not Yours', teacherId: otherTeacherId, joinCode: `NTYRS-${Date.now()}` })
        .returning();

      const response = await request(app)
        .get(`/api/backend/teacher/classes/${created.id}`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(404);
    });

    it('should return 404 for non-existent class', async () => {
      const response = await request(app)
        .get(`/api/backend/teacher/classes/${nonExistentId}`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(404);
    });

    it('should return 400 for invalid UUID', async () => {
      const response = await request(app)
        .get('/api/backend/teacher/classes/not-a-uuid')
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(400);
    });
  });

  describe('PATCH /api/backend/teacher/classes/:id', () => {
    it('should update class name', async () => {
      const [created] = await db
        .insert(classes)
        .values({ name: 'Old Name', teacherId, joinCode: `UPD-${Date.now()}` })
        .returning();

      const response = await request(app)
        .patch(`/api/backend/teacher/classes/${created.id}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ name: 'New Name' });

      expect(response.status).toBe(200);
      expect(response.body.data.name).toBe('New Name');
    });

    it('should return 400 if body is empty', async () => {
      const [created] = await db
        .insert(classes)
        .values({ name: 'No Update', teacherId, joinCode: `NOUPD-${Date.now()}` })
        .returning();

      const response = await request(app)
        .patch(`/api/backend/teacher/classes/${created.id}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({});

      expect(response.status).toBe(400);
    });

    it('should return 404 for class owned by another teacher', async () => {
      const [created] = await db
        .insert(classes)
        .values({ name: 'Protected', teacherId: otherTeacherId, joinCode: `PROT-${Date.now()}` })
        .returning();

      const response = await request(app)
        .patch(`/api/backend/teacher/classes/${created.id}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ name: 'Stolen' });

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/backend/teacher/classes/:id/regenerate-code', () => {
    it('should return a new 8-char join code', async () => {
      const [created] = await db
        .insert(classes)
        .values({ name: 'Regen Class', teacherId, joinCode: 'OLDCODE1' })
        .returning();

      const response = await request(app)
        .post(`/api/backend/teacher/classes/${created.id}/regenerate-code`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.joinCode).toBeDefined();
      expect(response.body.data.joinCode).not.toBe('OLDCODE1');
      expect(response.body.data.joinCode.length).toBe(8);
    });

    it('should return 404 for class owned by another teacher', async () => {
      const [created] = await db
        .insert(classes)
        .values({ name: 'Other Regen', teacherId: otherTeacherId, joinCode: 'OTHERREG' })
        .returning();

      const response = await request(app)
        .post(`/api/backend/teacher/classes/${created.id}/regenerate-code`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/backend/teacher/classes/:id', () => {
    it('should delete class and return 200', async () => {
      const [created] = await db
        .insert(classes)
        .values({ name: 'Delete Me', teacherId, joinCode: `DEL-${Date.now()}` })
        .returning();

      const response = await request(app)
        .delete(`/api/backend/teacher/classes/${created.id}`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(200);

      const found = await db.select().from(classes).where(eq(classes.id, created.id));
      expect(found).toHaveLength(0);
    });

    it('should return 404 for class owned by another teacher', async () => {
      const [created] = await db
        .insert(classes)
        .values({ name: 'Not Mine', teacherId: otherTeacherId, joinCode: `NTMN-${Date.now()}` })
        .returning();

      const response = await request(app)
        .delete(`/api/backend/teacher/classes/${created.id}`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(404);
    });

    it('should confirm class is gone after deletion', async () => {
      const [created] = await db
        .insert(classes)
        .values({ name: 'Gone Class', teacherId, joinCode: `GONE-${Date.now()}` })
        .returning();

      await request(app)
        .delete(`/api/backend/teacher/classes/${created.id}`)
        .set('Authorization', `Bearer ${teacherToken}`);

      const check = await request(app)
        .get(`/api/backend/teacher/classes/${created.id}`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(check.status).toBe(404);
    });
  });

  describe('DELETE /api/backend/teacher/classes/:id/students/:studentId', () => {
    it('should remove a student from the class', async () => {
      const [created] = await db
        .insert(classes)
        .values({ name: 'Remove Student', teacherId, joinCode: `REM-${Date.now()}` })
        .returning();

      await db.insert(classMembers).values({ classId: created.id, studentId });

      const response = await request(app)
        .delete(`/api/backend/teacher/classes/${created.id}/students/${studentId}`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(200);

      const members = await db
        .select()
        .from(classMembers)
        .where(eq(classMembers.classId, created.id));
      expect(members).toHaveLength(0);
    });

    it('should return 404 if student is not in the class', async () => {
      const [created] = await db
        .insert(classes)
        .values({ name: 'No Student', teacherId, joinCode: `NOSTUD-${Date.now()}` })
        .returning();

      const response = await request(app)
        .delete(`/api/backend/teacher/classes/${created.id}/students/${nonExistentId}`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(404);
    });

    it('should return 404 if class belongs to another teacher', async () => {
      const [created] = await db
        .insert(classes)
        .values({
          name: 'Wrong Teacher',
          teacherId: otherTeacherId,
          joinCode: `WRTCH-${Date.now()}`,
        })
        .returning();

      await db.insert(classMembers).values({ classId: created.id, studentId });

      const response = await request(app)
        .delete(`/api/backend/teacher/classes/${created.id}/students/${studentId}`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(404);
    });

    it('should return 400 for invalid studentId UUID', async () => {
      const [created] = await db
        .insert(classes)
        .values({ name: 'UUID Check', teacherId, joinCode: `UUID-${Date.now()}` })
        .returning();

      const response = await request(app)
        .delete(`/api/backend/teacher/classes/${created.id}/students/not-a-uuid`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(400);
    });
  });
  describe('GET /api/backend/teacher/classes/:id/students', () => {
    it('should return empty student list when class has no members', async () => {
      const [created] = await db
        .insert(classes)
        .values({ name: 'Empty Class', teacherId, joinCode: `EMSTU-${Date.now()}` })
        .returning();

      const response = await request(app)
        .get(`/api/backend/teacher/classes/${created.id}/students`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.classId).toBe(created.id);
      expect(response.body.data.studentCount).toBe(0);
      expect(response.body.data.students).toHaveLength(0);
    });

    it('should return students with correct fields when enrolled', async () => {
      const [created] = await db
        .insert(classes)
        .values({ name: 'Populated Class', teacherId, joinCode: `POPSTU-${Date.now()}` })
        .returning();

      await db.insert(classMembers).values({ classId: created.id, studentId });

      const response = await request(app)
        .get(`/api/backend/teacher/classes/${created.id}/students`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.studentCount).toBe(1);
      expect(response.body.data.students[0].id).toBe(studentId);
      expect(response.body.data.students[0].name).toBe('Student');
      expect(response.body.data.students[0].email).toBe('ctrlclasst-student@gmail.com');
      expect(response.body.data.students[0].joinedAt).toBeDefined();
    });

    it('should return correct count with multiple students', async () => {
      const [created] = await db
        .insert(classes)
        .values({ name: 'Multi Class', teacherId, joinCode: `MULTSTU-${Date.now()}` })
        .returning();

      const [student2] = await db
        .insert(users)
        .values({
          email: `ctrlclasst-extra-${Date.now()}@gmail.com`,
          password: 'Password123',
          role: 'STUDENT',
          name: 'Extra Student',
        })
        .returning();

      await db.insert(classMembers).values([
        { classId: created.id, studentId },
        { classId: created.id, studentId: student2.id },
      ]);

      const response = await request(app)
        .get(`/api/backend/teacher/classes/${created.id}/students`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.studentCount).toBe(2);
      const ids = response.body.data.students.map((s: any) => s.id);
      expect(ids).toContain(studentId);
      expect(ids).toContain(student2.id);

      await db.delete(classMembers).where(eq(classMembers.studentId, student2.id));
      await db.delete(users).where(eq(users.id, student2.id));
    });

    it('should return 404 for class owned by another teacher', async () => {
      const [created] = await db
        .insert(classes)
        .values({
          name: 'Other Teacher Class',
          teacherId: otherTeacherId,
          joinCode: `OTHSTU-${Date.now()}`,
        })
        .returning();

      const response = await request(app)
        .get(`/api/backend/teacher/classes/${created.id}/students`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(404);
    });

    it('should return 404 for non-existent class', async () => {
      const response = await request(app)
        .get(`/api/backend/teacher/classes/${nonExistentId}/students`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(404);
    });

    it('should return 400 for invalid UUID', async () => {
      const response = await request(app)
        .get('/api/backend/teacher/classes/not-a-uuid/students')
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(400);
    });

    it('should return 403 if a student tries to access', async () => {
      const [created] = await db
        .insert(classes)
        .values({ name: 'Student Access', teacherId, joinCode: `STUACC-${Date.now()}` })
        .returning();

      const response = await request(app)
        .get(`/api/backend/teacher/classes/${created.id}/students`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(403);
    });

    it('should return 401 without token', async () => {
      const [created] = await db
        .insert(classes)
        .values({ name: 'No Auth Class', teacherId, joinCode: `NOAUTH-${Date.now()}` })
        .returning();

      const response = await request(app).get(
        `/api/backend/teacher/classes/${created.id}/students`
      );

      expect(response.status).toBe(401);
    });

    it('should not expose sensitive fields on students', async () => {
      const [created] = await db
        .insert(classes)
        .values({ name: 'Safe Fields Class', teacherId, joinCode: `SAFE-${Date.now()}` })
        .returning();

      await db.insert(classMembers).values({ classId: created.id, studentId });

      const response = await request(app)
        .get(`/api/backend/teacher/classes/${created.id}/students`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(200);
      response.body.data.students.forEach((s: any) => {
        expect(s.password).toBeUndefined();
        expect(s.role).toBeUndefined();
      });
    });

    it('should reflect updated count after removing a student', async () => {
      const [created] = await db
        .insert(classes)
        .values({ name: 'Count After Remove', teacherId, joinCode: `CNTREM-${Date.now()}` })
        .returning();

      await db.insert(classMembers).values({ classId: created.id, studentId });

      const before = await request(app)
        .get(`/api/backend/teacher/classes/${created.id}/students`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(before.body.data.studentCount).toBe(1);

      await request(app)
        .delete(`/api/backend/teacher/classes/${created.id}/students/${studentId}`)
        .set('Authorization', `Bearer ${teacherToken}`);

      const after = await request(app)
        .get(`/api/backend/teacher/classes/${created.id}/students`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(after.body.data.studentCount).toBe(0);
      expect(after.body.data.students).toHaveLength(0);
    });
  });
});
