import { describe, it, expect, beforeAll, afterEach, afterAll, jest } from '@jest/globals';
import request from 'supertest';
import app from '../../app';
import { db } from '../../db';
import { users, files, fileShares } from '../../db/schema';
import { eq } from 'drizzle-orm';
import * as bcrypt from 'bcryptjs';

jest.mock('../../config/redis', () => ({
  deleteDocState: jest.fn().mockResolvedValue(undefined as never),
  saveDocState: jest.fn().mockResolvedValue(undefined as never),
  loadDocState: jest.fn().mockResolvedValue(null as never),
  docStateExists: jest.fn().mockResolvedValue(false as never),
  connectRedis: jest.fn().mockResolvedValue(undefined as never),
  disconnectRedis: jest.fn().mockResolvedValue(undefined as never),
  pubClient: { connect: jest.fn(), quit: jest.fn() },
  subClient: { connect: jest.fn(), quit: jest.fn() },
  storeClient: { connect: jest.fn(), quit: jest.fn() },
}));

describe('FileShareController', () => {
  let authToken: string;
  let otherToken: string;
  let userId: string;
  let otherUserId: string;
  const nonExistentId = '00000000-0000-0000-0000-000000000000';

  beforeAll(async () => {
    const hashedPassword = await bcrypt.hash('Password123', 10);

    await db.delete(users).where(eq(users.email, 'shareowner@gmail.com'));
    await db.delete(users).where(eq(users.email, 'shareother@gmail.com'));

    const [user] = await db
      .insert(users)
      .values({
        email: 'shareowner@gmail.com',
        password: hashedPassword,
        role: 'STUDENT',
        name: 'Share Owner',
      })
      .returning();
    userId = user.id;

    const [other] = await db
      .insert(users)
      .values({
        email: 'shareother@gmail.com',
        password: hashedPassword,
        role: 'STUDENT',
        name: 'Share Other',
      })
      .returning();
    otherUserId = other.id;

    const loginOwner = await request(app).post('/api/backend/auth/login').send({
      email: 'shareowner@gmail.com',
      password: 'Password123',
    });
    authToken = loginOwner.body.data.token;

    const loginOther = await request(app).post('/api/backend/auth/login').send({
      email: 'shareother@gmail.com',
      password: 'Password123',
    });
    otherToken = loginOther.body.data.token;
  });

  afterEach(async () => {
    await db.delete(fileShares).where(eq(fileShares.ownerId, userId));
    await db.delete(files).where(eq(files.userId, userId));
  });

  afterAll(async () => {
    await db.delete(users).where(eq(users.id, userId));
    await db.delete(users).where(eq(users.id, otherUserId));
  });

  async function createFile() {
    const res = await request(app)
      .post('/api/backend/files')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ name: 'shared.py', path: '/shared.py', content: 'print("shared")' });
    return res.body.data;
  }

  // ─── POST /api/backend/share/files/:id ───────────────────────────────────────

  describe('POST /api/backend/share/files/:id', () => {
    it('should create a share link', async () => {
      const file = await createFile();

      const response = await request(app)
        .post(`/api/backend/share/files/${file.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.shareCode).toBeDefined();
      expect(response.body.data.shareCode).toHaveLength(12);
      expect(response.body.data.expiresAt).toBeNull();
    });

    it('should create a share link with expiry', async () => {
      const file = await createFile();

      const response = await request(app)
        .post(`/api/backend/share/files/${file.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ expiresInHours: 24 });

      expect(response.status).toBe(201);
      expect(response.body.data.expiresAt).not.toBeNull();
    });

    it('should return same share code if called twice', async () => {
      const file = await createFile();

      const res1 = await request(app)
        .post(`/api/backend/share/files/${file.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      const res2 = await request(app)
        .post(`/api/backend/share/files/${file.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(res1.body.data.shareCode).toBe(res2.body.data.shareCode);
    });

    it('should return 404 for non-existent file', async () => {
      const response = await request(app)
        .post(`/api/backend/share/files/${nonExistentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(response.status).toBe(404);
    });

    it('should return 401 without auth token', async () => {
      const response = await request(app)
        .post(`/api/backend/share/files/${nonExistentId}`)
        .send({});

      expect(response.status).toBe(401);
    });

    it('should return 400 for invalid file id', async () => {
      const response = await request(app)
        .post('/api/backend/share/files/not-a-uuid')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(response.status).toBe(400);
    });
  });

  // ─── GET /api/backend/share/:code ────────────────────────────────────────────

  describe('GET /api/backend/share/:code', () => {
    it('should resolve a valid share code to a fileId', async () => {
      const file = await createFile();

      const shareRes = await request(app)
        .post(`/api/backend/share/files/${file.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      const code = shareRes.body.data.shareCode;

      const response = await request(app)
        .get(`/api/backend/share/${code}`)
        .set('Authorization', `Bearer ${otherToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.fileId).toBe(file.id);
      expect(response.body.data.ownerId).toBe(userId);
    });

    it('should return 404 for invalid code', async () => {
      const response = await request(app)
        .get('/api/backend/share/invalidcode')
        .set('Authorization', `Bearer ${otherToken}`);

      expect(response.status).toBe(404);
    });

    it('should return 401 without auth token', async () => {
      const response = await request(app).get('/api/backend/share/anycode');
      expect(response.status).toBe(401);
    });
  });

  // ─── DELETE /api/backend/share/files/:id ─────────────────────────────────────

  describe('DELETE /api/backend/share/files/:id', () => {
    it('should revoke an existing share', async () => {
      const file = await createFile();

      await request(app)
        .post(`/api/backend/share/files/${file.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      const revokeResponse = await request(app)
        .delete(`/api/backend/share/files/${file.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(revokeResponse.status).toBe(200);
      expect(revokeResponse.body.message).toBe('Share revoked');
    });

    it('should return 404 when no share exists to revoke', async () => {
      const file = await createFile();

      const response = await request(app)
        .delete(`/api/backend/share/files/${file.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });

    it('after revoke, share code should no longer resolve', async () => {
      const file = await createFile();

      const shareRes = await request(app)
        .post(`/api/backend/share/files/${file.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      const code = shareRes.body.data.shareCode;

      await request(app)
        .delete(`/api/backend/share/files/${file.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      const resolveRes = await request(app)
        .get(`/api/backend/share/${code}`)
        .set('Authorization', `Bearer ${otherToken}`);

      expect(resolveRes.status).toBe(404);
    });

    it('should return 401 without auth token', async () => {
      const response = await request(app).delete(`/api/backend/share/files/${nonExistentId}`);

      expect(response.status).toBe(401);
    });

    it('should return 400 for invalid file id', async () => {
      const response = await request(app)
        .delete('/api/backend/share/files/not-a-uuid')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
    });
  });
});
