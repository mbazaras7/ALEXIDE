import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import app from '../../app';
import db from '../../db';
import { users } from '../../db/schema';
import { eq } from 'drizzle-orm';

describe('UserController', () => {
  const testUser = {
    email: 'ctrl-user-test@gmail.com',
    password: 'TestPass123',
    name: 'Test User',
    role: 'STUDENT',
  };

  let authToken: string;
  let userId: string;

  beforeAll(async () => {
    await db.delete(users).where(eq(users.email, testUser.email));
    await db.delete(users).where(eq(users.email, 'ctrl-teacher-test@dcu.ie'));
  });

  afterAll(async () => {
    await db.delete(users).where(eq(users.email, testUser.email));
    await db.delete(users).where(eq(users.email, 'ctrl-teacher-test@dcu.ie'));
  });

  beforeEach(async () => {
    await db.delete(users).where(eq(users.email, testUser.email));

    const registerResponse = await request(app).post('/api/backend/auth/register').send(testUser);
    userId = registerResponse.body.data.id;

    const loginResponse = await request(app)
      .post('/api/backend/auth/login')
      .send({ email: testUser.email, password: testUser.password });
    authToken = loginResponse.body.data.token;
  });

  describe('POST /api/backend/auth/register', () => {
    it('should register a new user successfully', async () => {
      await db.delete(users).where(eq(users.email, testUser.email));

      const response = await request(app)
        .post('/api/backend/auth/register')
        .send(testUser)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('User registered successfully');
      expect(response.body.data.email).toBe(testUser.email.toLowerCase());
      expect(response.body.data.name).toBe(testUser.name);
      expect(response.body.data.role).toBe(testUser.role);
      expect(response.body.data.id).toBeDefined();
      expect(response.body.data.password).toBeUndefined();
    });

    it('should reject duplicate email', async () => {
      const response = await request(app)
        .post('/api/backend/auth/register')
        .send(testUser)
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('already exists');
    });

    it('should reject invalid email format', async () => {
      const response = await request(app)
        .post('/api/backend/auth/register')
        .send({ ...testUser, email: 'not-an-email' })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should reject a weak password', async () => {
      const response = await request(app)
        .post('/api/backend/auth/register')
        .send({ ...testUser, password: 'weak' })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should reject missing name', async () => {
      const response = await request(app)
        .post('/api/backend/auth/register')
        .send({ email: testUser.email, password: testUser.password, role: testUser.role })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should reject an invalid role', async () => {
      const response = await request(app)
        .post('/api/backend/auth/register')
        .send({ ...testUser, role: 'EMPLOYEE' })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should accept TEACHER role', async () => {
      const response = await request(app)
        .post('/api/backend/auth/register')
        .send({ ...testUser, email: 'ctrl-teacher-test@dcu.ie', role: 'TEACHER' })
        .expect(201);

      expect(response.body.data.role).toBe('TEACHER');
    });
  });

  describe('POST /api/backend/auth/login', () => {
    it('should login with correct credentials and return a token', async () => {
      const response = await request(app)
        .post('/api/backend/auth/login')
        .send({ email: testUser.email, password: testUser.password })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.token).toBeDefined();
      expect(typeof response.body.data.token).toBe('string');
      expect(response.body.data.user.email).toBe(testUser.email.toLowerCase());
      expect(response.body.data.user.role).toBe(testUser.role);
      expect(response.body.data.user.id).toBeDefined();
    });

    it('should return a valid 3-part JWT token', async () => {
      const response = await request(app)
        .post('/api/backend/auth/login')
        .send({ email: testUser.email, password: testUser.password });

      const token = response.body.data.token;
      expect(token.split('.')).toHaveLength(3);
    });

    it('should login case-insensitively', async () => {
      const response = await request(app)
        .post('/api/backend/auth/login')
        .send({ email: testUser.email.toUpperCase(), password: testUser.password })
        .expect(200);

      expect(response.body.data.token).toBeDefined();
    });

    it('should reject an incorrect password', async () => {
      const response = await request(app)
        .post('/api/backend/auth/login')
        .send({ email: testUser.email, password: 'WrongPassword123' })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid');
    });

    it('should reject a non-existent email', async () => {
      const response = await request(app)
        .post('/api/backend/auth/login')
        .send({ email: 'nobody@gmail.com', password: testUser.password })
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should reject a missing password', async () => {
      const response = await request(app)
        .post('/api/backend/auth/login')
        .send({ email: testUser.email })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should reject a missing email', async () => {
      const response = await request(app)
        .post('/api/backend/auth/login')
        .send({ password: testUser.password })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/backend/auth/me', () => {
    it('should return the current user profile', async () => {
      const response = await request(app)
        .get('/api/backend/auth/me')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.id).toBe(userId);
      expect(response.body.data.user.email).toBe(testUser.email.toLowerCase());
      expect(response.body.data.user.name).toBe(testUser.name);
      expect(response.body.data.user.role).toBe(testUser.role);
      expect(response.body.data.user.password).toBeUndefined();
      expect(response.body.data.user.createdAt).toBeDefined();
    });

    it('should return 401 with no token', async () => {
      const response = await request(app).get('/api/backend/auth/me').expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Missing or invalid Authorization header');
    });
  });

  describe('PUT /api/backend/auth/me', () => {
    it('should update user name successfully', async () => {
      const response = await request(app)
        .put('/api/backend/auth/me')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Updated Name' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.name).toBe('Updated Name');
      expect(response.body.data.user.id).toBe(userId);
      expect(response.body.data.user.updatedAt).toBeDefined();
    });

    it('should reject an empty name', async () => {
      const response = await request(app)
        .put('/api/backend/auth/me')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: '' })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should return 401 when not authenticated', async () => {
      const response = await request(app)
        .put('/api/backend/auth/me')
        .send({ name: 'New Name' })
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/backend/auth/logout', () => {
    it('should logout successfully', async () => {
      const response = await request(app)
        .post('/api/backend/auth/logout')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Logged out successfully');
    });

    it('should return 401 when not authenticated', async () => {
      const response = await request(app).post('/api/backend/auth/logout').expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/backend/auth/delete', () => {
    it('should delete the account successfully', async () => {
      const response = await request(app)
        .delete('/api/backend/auth/delete')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Account deleted successfully');

      // Confirm user no longer exists in DB
      const deleted = await db.select().from(users).where(eq(users.id, userId));
      expect(deleted).toHaveLength(0);
    });

    it('should return 401 when not authenticated', async () => {
      const response = await request(app).delete('/api/backend/auth/delete').expect(401);

      expect(response.body.success).toBe(false);
    });
  });
});
