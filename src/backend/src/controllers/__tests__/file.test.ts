import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  afterEach,
  beforeEach,
  jest,
} from '@jest/globals';
import request from 'supertest';
import app from '../../app';
import { db } from '../../db';
import { users, files } from '../../db/schema';
import { eq } from 'drizzle-orm';
import * as bcrypt from 'bcryptjs';
//import * as examRedis from '../../services/examRedis';
import * as examMode from '../../middleware/exam';

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

jest.mock('../../services/examRedis', () => ({
  getStudentSession: jest.fn(),
  setStudentSession: jest.fn().mockResolvedValue(undefined as never),
  markStudentSubmitted: jest.fn().mockResolvedValue(undefined as never),
  setActiveExam: jest.fn().mockResolvedValue(undefined as never),
  getActiveExam: jest.fn().mockResolvedValue(null as never),
}));

jest.mock('../../middleware/exam', () => ({
  getActiveClosedBookExam: jest.fn(),
}));

const mockGetActiveClosedBookExam = examMode.getActiveClosedBookExam as jest.MockedFunction<
  typeof examMode.getActiveClosedBookExam
>;

describe('FileController', () => {
  let authToken: string;
  let userId: string;
  const nonExistentId = '00000000-0000-0000-0000-000000000000';

  beforeAll(async () => {
    const hashedPassword = await bcrypt.hash('Password123', 10);
    await db.delete(users).where(eq(users.email, 'filetest@gmail.com'));

    const [user] = await db
      .insert(users)
      .values({
        email: 'filetest@gmail.com',
        password: hashedPassword,
        role: 'STUDENT',
        name: 'File Test User',
      })
      .returning();

    userId = user.id;

    const loginResponse = await request(app).post('/api/backend/auth/login').send({
      email: 'filetest@gmail.com',
      password: 'Password123',
    });

    authToken = loginResponse.body.data.token;
  });

  afterEach(async () => {
    await db.delete(files).where(eq(files.userId, userId));
  });

  afterAll(async () => {
    await db.delete(files).where(eq(files.userId, userId));
    await db.delete(users).where(eq(users.id, userId));
  });

  beforeEach(() => {
    mockGetActiveClosedBookExam.mockResolvedValue(null);
  });

  describe('POST /api/backend/files', () => {
    it('should create a file with content', async () => {
      const response = await request(app)
        .post('/api/backend/files')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'test.py',
          path: '/test.py',
          content: 'print("hello")',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        name: 'test.py',
        path: '/test.py',
        storageKey: expect.stringContaining('test.py'),
        size: 14,
      });
    });

    it('should create a directory', async () => {
      const response = await request(app)
        .post('/api/backend/files')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'src',
          path: '/src',
          isDirectory: true,
        });

      expect(response.status).toBe(201);
      expect(response.body.data).toMatchObject({
        name: 'src',
        isDirectory: true,
        storageKey: null,
      });
    });

    it('should return 401 without auth token', async () => {
      const response = await request(app).post('/api/backend/files').send({
        name: 'test.py',
        path: '/test.py',
      });

      expect(response.status).toBe(401);
    });

    it('should return 400 for invalid data', async () => {
      const response = await request(app)
        .post('/api/backend/files')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: 'print("hello")',
        });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/backend/files/:id', () => {
    it('should get file metadata', async () => {
      const createResponse = await request(app)
        .post('/api/backend/files')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'gettest.py',
          path: '/gettest.py',
          content: 'test',
        });

      const fileId = createResponse.body.data.id;

      const response = await request(app)
        .get(`/api/backend/files/${fileId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject({
        id: fileId,
        name: 'gettest.py',
      });
    });

    it('should return 404 for non-existent file', async () => {
      const response = await request(app)
        .get(`/api/backend/files/${nonExistentId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });
  });

  //Monaco
  describe('GET /api/backend/files/:id/content', () => {
    it('should get file content with metadata', async () => {
      const createResponse = await request(app)
        .post('/api/backend/files')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'content-test.py',
          path: '/content-test.py',
          content: 'print("Hello World")',
        });

      const fileId = createResponse.body.data.id;

      const response = await request(app)
        .get(`/api/backend/files/${fileId}/content`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.content).toBe('print("Hello World")');
      expect(response.body.data.updatedAt).toBeDefined();
      expect(response.body.data.size).toBeGreaterThan(0);
      expect(response.body.data.mimeType).toBeDefined();
    });

    it('should return 404 for non-existent file', async () => {
      const response = await request(app)
        .get(`/api/backend/files/${nonExistentId}/content`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });

    it('should not get content of directory', async () => {
      const createResponse = await request(app)
        .post('/api/backend/files')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'src',
          path: '/src',
          isDirectory: true,
        });

      const dirId = createResponse.body.data.id;

      const response = await request(app)
        .get(`/api/backend/files/${dirId}/content`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
    });
  });

  describe('PUT /api/backend/files/:id/content', () => {
    it('should update file content', async () => {
      const createResponse = await request(app)
        .post('/api/backend/files')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'update-content.py',
          path: '/update-content.py',
          content: 'original content',
        });

      const fileId = createResponse.body.data.id;
      const originalUpdatedAt = createResponse.body.data.updatedAt;

      //Wait to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 100));

      const response = await request(app)
        .put(`/api/backend/files/${fileId}/content`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: 'updated content',
          lastUpdatedAt: originalUpdatedAt,
        });

      expect(response.status).toBe(200);
      expect(response.body.data.updatedAt).not.toBe(originalUpdatedAt);

      const getResponse = await request(app)
        .get(`/api/backend/files/${fileId}/content`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(getResponse.body.data.content).toBe('updated content');
    });

    it('should detect conflicts', async () => {
      const createResponse = await request(app)
        .post('/api/backend/files')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'conflict.py',
          path: '/conflict.py',
          content: 'original',
        });

      const fileId = createResponse.body.data.id;
      const originalUpdatedAt = createResponse.body.data.updatedAt;

      //First update
      await request(app)
        .put(`/api/backend/files/${fileId}/content`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: 'first update',
        });

      //Second update with old timestamp,simulating conflict
      const response = await request(app)
        .put(`/api/backend/files/${fileId}/content`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: 'second update',
          lastUpdatedAt: originalUpdatedAt, //Old timestamp
        });

      expect(response.status).toBe(409); //Conflict
    });

    it('should return 404 for non-existent file', async () => {
      const response = await request(app)
        .put(`/api/backend/files/${nonExistentId}/content`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: 'new content',
        });

      expect(response.status).toBe(404);
    });
  });

  describe('PATCH /api/backend/files/:id/auto-save', () => {
    it('should auto-save file content', async () => {
      const createResponse = await request(app)
        .post('/api/backend/files')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'autosave.py',
          path: '/autosave.py',
          content: 'initial',
        });

      const fileId = createResponse.body.data.id;

      const response = await request(app)
        .patch(`/api/backend/files/${fileId}/auto-save`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: 'auto-saved content',
        });

      expect(response.status).toBe(200);
      expect(response.body.data.hasConflict).toBe(false);

      const getResponse = await request(app)
        .get(`/api/backend/files/${fileId}/content`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(getResponse.body.data.content).toBe('auto-saved content');
    });

    it('should warn about conflicts but still save', async () => {
      const createResponse = await request(app)
        .post('/api/backend/files')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'conflict-autosave.py',
          path: '/conflict-autosave.py',
          content: 'original',
        });

      const fileId = createResponse.body.data.id;
      const originalUpdatedAt = createResponse.body.data.updatedAt;

      await request(app)
        .put(`/api/backend/files/${fileId}/content`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: 'manual update',
        });

      //Auto-save with old timestamp
      const response = await request(app)
        .patch(`/api/backend/files/${fileId}/auto-save`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: 'auto-save update',
          lastUpdatedAt: originalUpdatedAt,
        });

      expect(response.status).toBe(200);
      expect(response.body.data.hasConflict).toBe(true);

      //Verify content was still saved, last write wins
      const getResponse = await request(app)
        .get(`/api/backend/files/${fileId}/content`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(getResponse.body.data.content).toBe('auto-save update');
    });

    it('should return 404 for non-existent file', async () => {
      const response = await request(app)
        .patch(`/api/backend/files/${nonExistentId}/auto-save`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: 'auto-save content',
        });

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/backend/files/:id/download', () => {
    it('should download file content', async () => {
      const createResponse = await request(app)
        .post('/api/backend/files')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'download.py',
          path: '/download.py',
          content: 'print("download test")',
        });

      const fileId = createResponse.body.data.id;

      const response = await request(app)
        .get(`/api/backend/files/${fileId}/download`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.text).toBe('print("download test")');
      expect(response.headers['content-disposition']).toContain('download.py');
    });

    it('should return 404 for non-existent file', async () => {
      const response = await request(app)
        .get(`/api/backend/files/${nonExistentId}/download`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/backend/files', () => {
    it('should list all files', async () => {
      await request(app)
        .post('/api/backend/files')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'list1.py',
          path: '/list1.py',
          content: 'test',
        });

      const response = await request(app)
        .get('/api/backend/files')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/backend/files/tree', () => {
    it('should return file tree', async () => {
      const response = await request(app)
        .get('/api/backend/files/tree')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  describe('PUT /api/backend/files/:id', () => {
    it('should update file content', async () => {
      const createResponse = await request(app)
        .post('/api/backend/files')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'update.py',
          path: '/update.py',
          content: 'original',
        });

      const fileId = createResponse.body.data.id;

      const updateResponse = await request(app)
        .put(`/api/backend/files/${fileId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: 'updated content',
        });

      expect(updateResponse.status).toBe(200);
      expect(updateResponse.body.data.size).toBeGreaterThan(0);

      const downloadResponse = await request(app)
        .get(`/api/backend/files/${fileId}/download`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(downloadResponse.text).toBe('updated content');
    });

    it('should return 404 for non-existent file', async () => {
      const response = await request(app)
        .put(`/api/backend/files/${nonExistentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'new.py',
        });

      expect(response.status).toBe(500);
    });
  });

  describe('DELETE /api/backend/files/:id', () => {
    it('should soft delete file', async () => {
      const createResponse = await request(app)
        .post('/api/backend/files')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'delete.py',
          path: '/delete.py',
          content: 'delete me',
        });

      const fileId = createResponse.body.data.id;

      const deleteResponse = await request(app)
        .delete(`/api/backend/files/${fileId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(deleteResponse.status).toBe(200);

      //Verify file is not accessible
      const getResponse = await request(app)
        .get(`/api/backend/files/${fileId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(getResponse.status).toBe(404);
    });
  });

  describe('DELETE /api/backend/files/:id/permanent', () => {
    it('should permanently delete file', async () => {
      const createResponse = await request(app)
        .post('/api/backend/files')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'permdelete.py',
          path: '/permdelete.py',
          content: 'delete permanently',
        });

      const fileId = createResponse.body.data.id;

      const deleteResponse = await request(app)
        .delete(`/api/backend/files/${fileId}/permanent`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(deleteResponse.status).toBe(200);

      //Verify file is completely gone
      const getResponse = await request(app)
        .get(`/api/backend/files/${fileId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(getResponse.status).toBe(404);
    });
  });

  describe('POST /api/backend/files/:id/move', () => {
    it('should move file to new directory', async () => {
      const dirResponse = await request(app)
        .post('/api/backend/files')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'folder',
          path: '/folder',
          isDirectory: true,
        });

      const dirId = dirResponse.body.data.id;

      const fileResponse = await request(app)
        .post('/api/backend/files')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'test.py',
          path: '/test.py',
          content: 'print("hello")',
        });

      const fileId = fileResponse.body.data.id;

      const moveResponse = await request(app)
        .post(`/api/backend/files/${fileId}/move`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          newParentId: dirId,
          newPath: '/folder/test.py',
        });

      expect(moveResponse.status).toBe(200);
      expect(moveResponse.body.data.path).toBe('/folder/test.py');
      expect(moveResponse.body.data.parentId).toBe(dirId);
    });

    it('should prevent moving directory into itself', async () => {
      const dirResponse = await request(app)
        .post('/api/backend/files')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'folder',
          path: '/folder',
          isDirectory: true,
        });

      const dirId = dirResponse.body.data.id;

      const moveResponse = await request(app)
        .post(`/api/backend/files/${dirId}/move`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          newParentId: dirId,
          newPath: '/folder/folder',
        });

      expect(moveResponse.status).toBe(400);
      expect(moveResponse.body.error).toContain('Cannot move directory into itself');
    });

    it('should prevent moving directory into its subdirectory', async () => {
      // Create parent directory
      const parentResponse = await request(app)
        .post('/api/backend/files')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'parent',
          path: '/parent',
          isDirectory: true,
        });

      const parentId = parentResponse.body.data.id;

      const childResponse = await request(app)
        .post('/api/backend/files')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'child',
          path: '/parent/child',
          parentId: parentId,
          isDirectory: true,
        });

      const childId = childResponse.body.data.id;

      const moveResponse = await request(app)
        .post(`/api/backend/files/${parentId}/move`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          newParentId: childId,
          newPath: '/parent/child/parent',
        });

      expect(moveResponse.status).toBe(400);
      expect(moveResponse.body.error).toContain('Cannot move directory into itself');
    });

    it('should return 404 for non-existent file', async () => {
      const response = await request(app)
        .post(`/api/backend/files/${nonExistentId}/move`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          newPath: '/moved.py',
        });

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/backend/files/:id/copy', () => {
    it('should copy file to new location', async () => {
      const fileResponse = await request(app)
        .post('/api/backend/files')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'original.py',
          path: '/original.py',
          content: 'print("original")',
        });

      expect(fileResponse.status).toBe(201);
      const fileId = fileResponse.body.data.id;

      const copyResponse = await request(app)
        .post(`/api/backend/files/${fileId}/copy`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          newName: 'copy.py',
          newPath: '/copy.py',
        });

      expect(copyResponse.status).toBe(200);
      expect(copyResponse.body.data.name).toBe('copy.py');
      expect(copyResponse.body.data.path).toBe('/copy.py');
      expect(copyResponse.body.data.id).not.toBe(fileId);

      //Verify both files exist
      const originalFile = await request(app)
        .get(`/api/backend/files/${fileId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(originalFile.status).toBe(200);
      expect(originalFile.body.data.path).toBe('/original.py');

      const copiedFile = await request(app)
        .get(`/api/backend/files/${copyResponse.body.data.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(copiedFile.status).toBe(200);
      expect(copiedFile.body.data.path).toBe('/copy.py');

      //Verify content was copied
      const copiedContent = await request(app)
        .get(`/api/backend/files/${copyResponse.body.data.id}/download`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(copiedContent.text).toBe('print("original")');
    });

    it('should copy file into directory', async () => {
      const dirResponse = await request(app)
        .post('/api/backend/files')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'backup',
          path: '/backup',
          isDirectory: true,
        });

      expect(dirResponse.status).toBe(201);
      const dirId = dirResponse.body.data.id;

      const fileResponse = await request(app)
        .post('/api/backend/files')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'app.py',
          path: '/app.py',
          content: 'print("app")',
        });

      expect(fileResponse.status).toBe(201);
      const fileId = fileResponse.body.data.id;

      const copyResponse = await request(app)
        .post(`/api/backend/files/${fileId}/copy`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          newName: 'app.py',
          newPath: '/backup/app.py',
          newParentId: dirId,
        });

      expect(copyResponse.status).toBe(200);
      expect(copyResponse.body.data.path).toBe('/backup/app.py');
      expect(copyResponse.body.data.parentId).toBe(dirId);
    });

    it('should copy directory and all its contents', async () => {
      const dirResponse = await request(app)
        .post('/api/backend/files')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'src',
          path: '/src',
          isDirectory: true,
        });

      expect(dirResponse.status).toBe(201);
      const dirId = dirResponse.body.data.id;

      const file1Response = await request(app)
        .post('/api/backend/files')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'main.py',
          path: '/src/main.py',
          parentId: dirId,
          content: 'print("main")',
        });

      expect(file1Response.status).toBe(201);

      const file2Response = await request(app)
        .post('/api/backend/files')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'utils.py',
          path: '/src/utils.py',
          parentId: dirId,
          content: 'print("utils")',
        });

      expect(file2Response.status).toBe(201);

      const copyResponse = await request(app)
        .post(`/api/backend/files/${dirId}/copy`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          newName: 'src-backup',
          newPath: '/src-backup',
        });

      expect(copyResponse.status).toBe(200);
      expect(copyResponse.body.data.name).toBe('src-backup');
      expect(copyResponse.body.data.isDirectory).toBe(true);

      const newDirId = copyResponse.body.data.id;

      //Verify copied files exist
      const filesResponse = await request(app)
        .get(`/api/backend/files?parentId=${newDirId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(filesResponse.status).toBe(200);
      expect(filesResponse.body.data).toHaveLength(2);

      const fileNames = filesResponse.body.data.map((f: any) => f.name);
      expect(fileNames).toContain('main.py');
      expect(fileNames).toContain('utils.py');

      //Verify content was copied
      const copiedFile = filesResponse.body.data.find((f: any) => f.name === 'main.py');
      const contentResponse = await request(app)
        .get(`/api/backend/files/${copiedFile.id}/download`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(contentResponse.text).toBe('print("main")');
    });

    it('should prevent copying to existing path', async () => {
      const file1Response = await request(app)
        .post('/api/backend/files')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'file1.py',
          path: '/file1.py',
          content: 'print("1")',
        });

      expect(file1Response.status).toBe(201);
      const file1Id = file1Response.body.data.id;

      await request(app)
        .post('/api/backend/files')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'file2.py',
          path: '/file2.py',
          content: 'print("2")',
        });

      const copyResponse = await request(app)
        .post(`/api/backend/files/${file1Id}/copy`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          newName: 'file2.py',
          newPath: '/file2.py',
        });

      expect(copyResponse.status).toBe(400);
      expect(copyResponse.body.error).toContain('already exists');
    });

    it('should return 400 when missing required fields', async () => {
      const fileResponse = await request(app)
        .post('/api/backend/files')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'test.py',
          path: '/test.py',
          content: 'print("test")',
        });

      const fileId = fileResponse.body.data.id;

      const response1 = await request(app)
        .post(`/api/backend/files/${fileId}/copy`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          newPath: '/copy.py',
        });

      expect(response1.status).toBe(400);

      const response2 = await request(app)
        .post(`/api/backend/files/${fileId}/copy`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          newName: 'copy.py',
        });

      expect(response2.status).toBe(400);
    });
  });

  describe('POST /api/backend/files/:id/rename', () => {
    it('should rename a file', async () => {
      const fileResponse = await request(app)
        .post('/api/backend/files')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'old-name.py',
          path: '/old-name.py',
          content: 'print("test")',
        });

      expect(fileResponse.status).toBe(201);
      const fileId = fileResponse.body.data.id;

      const renameResponse = await request(app)
        .post(`/api/backend/files/${fileId}/rename`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          newName: 'new-name.py',
        });

      expect(renameResponse.status).toBe(200);
      expect(renameResponse.body.data.name).toBe('new-name.py');
      expect(renameResponse.body.data.path).toBe('/new-name.py');
      expect(renameResponse.body.data.id).toBe(fileId); // Same ID

      //Verify old name doesnt exist
      const oldFileList = await request(app)
        .get('/api/backend/files')
        .set('Authorization', `Bearer ${authToken}`);

      const fileNames = oldFileList.body.data.map((f: any) => f.name);
      expect(fileNames).not.toContain('old-name.py');
      expect(fileNames).toContain('new-name.py');
    });

    it('should rename a file within a directory', async () => {
      const dirResponse = await request(app)
        .post('/api/backend/files')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'folder',
          path: '/folder',
          isDirectory: true,
        });

      expect(dirResponse.status).toBe(201);
      const dirId = dirResponse.body.data.id;

      const fileResponse = await request(app)
        .post('/api/backend/files')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'old.py',
          path: '/folder/old.py',
          parentId: dirId,
          content: 'print("test")',
        });

      expect(fileResponse.status).toBe(201);
      const fileId = fileResponse.body.data.id;

      const renameResponse = await request(app)
        .post(`/api/backend/files/${fileId}/rename`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          newName: 'new.py',
        });

      expect(renameResponse.status).toBe(200);
      expect(renameResponse.body.data.name).toBe('new.py');
      expect(renameResponse.body.data.path).toBe('/folder/new.py');
      expect(renameResponse.body.data.parentId).toBe(dirId);
    });

    it('should rename a directory and update all descendant paths', async () => {
      const dirResponse = await request(app)
        .post('/api/backend/files')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'old-folder',
          path: '/old-folder',
          isDirectory: true,
        });

      expect(dirResponse.status).toBe(201);
      const dirId = dirResponse.body.data.id;

      const fileResponse = await request(app)
        .post('/api/backend/files')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'test.py',
          path: '/old-folder/test.py',
          parentId: dirId,
          content: 'print("test")',
        });

      expect(fileResponse.status).toBe(201);
      const fileId = fileResponse.body.data.id;

      const subDirResponse = await request(app)
        .post('/api/backend/files')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'subfolder',
          path: '/old-folder/subfolder',
          parentId: dirId,
          isDirectory: true,
        });

      expect(subDirResponse.status).toBe(201);
      const subDirId = subDirResponse.body.data.id;

      const subFileResponse = await request(app)
        .post('/api/backend/files')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'nested.py',
          path: '/old-folder/subfolder/nested.py',
          parentId: subDirId,
          content: 'print("nested")',
        });

      expect(subFileResponse.status).toBe(201);
      const subFileId = subFileResponse.body.data.id;

      const renameResponse = await request(app)
        .post(`/api/backend/files/${dirId}/rename`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          newName: 'new-folder',
        });

      expect(renameResponse.status).toBe(200);
      expect(renameResponse.body.data.name).toBe('new-folder');
      expect(renameResponse.body.data.path).toBe('/new-folder');

      //Verify file path was updated
      const fileCheck = await request(app)
        .get(`/api/backend/files/${fileId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(fileCheck.status).toBe(200);
      expect(fileCheck.body.data.path).toBe('/new-folder/test.py');

      //Verify subdirectory path was updated
      const subDirCheck = await request(app)
        .get(`/api/backend/files/${subDirId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(subDirCheck.status).toBe(200);
      expect(subDirCheck.body.data.path).toBe('/new-folder/subfolder');

      //Verify nested file path was updated
      const subFileCheck = await request(app)
        .get(`/api/backend/files/${subFileId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(subFileCheck.status).toBe(200);
      expect(subFileCheck.body.data.path).toBe('/new-folder/subfolder/nested.py');
    });

    it('should prevent renaming to an existing name in the same directory', async () => {
      const file1Response = await request(app)
        .post('/api/backend/files')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'file1.py',
          path: '/file1.py',
          content: 'print("1")',
        });

      expect(file1Response.status).toBe(201);
      const file1Id = file1Response.body.data.id;

      await request(app)
        .post('/api/backend/files')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'file2.py',
          path: '/file2.py',
          content: 'print("2")',
        });

      const renameResponse = await request(app)
        .post(`/api/backend/files/${file1Id}/rename`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          newName: 'file2.py',
        });

      expect(renameResponse.status).toBe(400);
      expect(renameResponse.body.error).toContain('already exists');
    });

    it('should return 400 for non-existent file', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000001';

      const response = await request(app)
        .post(`/api/backend/files/${nonExistentId}/rename`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          newName: 'new-name.py',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it('should return 400 when missing newName', async () => {
      const fileResponse = await request(app)
        .post('/api/backend/files')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'test.py',
          path: '/test.py',
          content: 'print("test")',
        });

      const fileId = fileResponse.body.data.id;

      const response = await request(app)
        .post(`/api/backend/files/${fileId}/rename`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(response.status).toBe(400);
    });

    it('should preserve file content after rename', async () => {
      const originalContent = 'print("original content")';

      const fileResponse = await request(app)
        .post('/api/backend/files')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'original.py',
          path: '/original.py',
          content: originalContent,
        });

      expect(fileResponse.status).toBe(201);
      const fileId = fileResponse.body.data.id;

      await request(app)
        .post(`/api/backend/files/${fileId}/rename`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          newName: 'renamed.py',
        });

      const contentResponse = await request(app)
        .get(`/api/backend/files/${fileId}/download`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(contentResponse.text).toBe(originalContent);
    });
  });

  describe('GET /api/backend/files/search', () => {
    it('should search files by name', async () => {
      await request(app)
        .post('/api/backend/files')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'important.py',
          path: '/important.py',
          content: 'print("important")',
        });

      await request(app)
        .post('/api/backend/files')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'other.js',
          path: '/other.js',
          content: 'console.log("other")',
        });

      const response = await request(app)
        .get('/api/backend/files/search?q=important')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.data.some((f: any) => f.name.includes('important'))).toBe(true);
    });

    it('should search files by path', async () => {
      const dirResponse = await request(app)
        .post('/api/backend/files')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'docs',
          path: '/docs',
          isDirectory: true,
        });

      await request(app)
        .post('/api/backend/files')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'readme.md',
          path: '/docs/readme.md',
          parentId: dirResponse.body.data.id,
          content: '# README',
        });

      const response = await request(app)
        .get('/api/backend/files/search?q=docs')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.length).toBeGreaterThan(0);
    });

    it('should return empty array when no matches', async () => {
      const response = await request(app)
        .get('/api/backend/files/search?q=nonexistent')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual([]);
    });

    it('should return 400 when search term is missing', async () => {
      const response = await request(app)
        .get('/api/backend/files/search')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/backend/files/trash', () => {
    it('should get deleted files only', async () => {
      // Create two files
      const file1Response = await request(app)
        .post('/api/backend/files')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'deleted.py',
          path: '/deleted.py',
          content: 'print("deleted")',
        });

      const file2Response = await request(app)
        .post('/api/backend/files')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'active.py',
          path: '/active.py',
          content: 'print("active")',
        });

      const deletedId = file1Response.body.data.id;
      const activeId = file2Response.body.data.id;

      await request(app)
        .delete(`/api/backend/files/${deletedId}`)
        .set('Authorization', `Bearer ${authToken}`);

      const trashResponse = await request(app)
        .get('/api/backend/files/trash')
        .set('Authorization', `Bearer ${authToken}`);

      expect(trashResponse.status).toBe(200);
      expect(Array.isArray(trashResponse.body.data)).toBe(true);

      //Should contain deleted file
      expect(trashResponse.body.data.some((f: any) => f.id === deletedId)).toBe(true);

      //Should NOT contain active file
      expect(trashResponse.body.data.some((f: any) => f.id === activeId)).toBe(false);

      //All items should have deletedAt set
      expect(trashResponse.body.data.every((f: any) => f.deletedAt !== null)).toBe(true);
    });

    it('should return empty array when trash is empty', async () => {
      const response = await request(app)
        .get('/api/backend/files/trash')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual([]);
    });
  });

  describe('GET /api/backend/files - Search via query param', () => {
    it('should search files using query parameter', async () => {
      await request(app)
        .post('/api/backend/files')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'test.py',
          path: '/test.py',
          content: 'print("test")',
        });

      const response = await request(app)
        .get('/api/backend/files?search=test')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.some((f: any) => f.name.includes('test'))).toBe(true);
    });
  });

  describe('POST /api/backend/files/:id/restore', () => {
    it('should restore a soft-deleted file', async () => {
      const createResponse = await request(app)
        .post('/api/backend/files')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'restore-test.py',
          path: '/restore-test.py',
          content: 'print("restore me")',
        });

      const fileId = createResponse.body.data.id;
      expect(createResponse.status).toBe(201);

      const deleteResponse = await request(app)
        .delete(`/api/backend/files/${fileId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(deleteResponse.status).toBe(200);

      const trashResponse = await request(app)
        .get('/api/backend/files/trash')
        .set('Authorization', `Bearer ${authToken}`);

      expect(trashResponse.body.data.some((f: any) => f.id === fileId)).toBe(true);

      const restoreResponse = await request(app)
        .post(`/api/backend/files/${fileId}/restore`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(restoreResponse.status).toBe(200);
      expect(restoreResponse.body.success).toBe(true);
      expect(restoreResponse.body.message).toBe('File restored successfully');
      expect(restoreResponse.body.data.id).toBe(fileId);
      expect(restoreResponse.body.data.deletedAt).toBeNull();

      //Verify file is no longer in trash
      const trashAfterRestore = await request(app)
        .get('/api/backend/files/trash')
        .set('Authorization', `Bearer ${authToken}`);

      expect(trashAfterRestore.body.data.some((f: any) => f.id === fileId)).toBe(false);

      //Verify file is accessible again
      const getFileResponse = await request(app)
        .get(`/api/backend/files/${fileId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(getFileResponse.status).toBe(200);
      expect(getFileResponse.body.data.name).toBe('restore-test.py');
    });

    it('should restore a directory with all its children', async () => {
      const dirResponse = await request(app)
        .post('/api/backend/files')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'restore-dir',
          path: '/restore-dir',
          isDirectory: true,
        });

      const dirId = dirResponse.body.data.id;

      const fileResponse = await request(app)
        .post('/api/backend/files')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'child.py',
          path: '/restore-dir/child.py',
          parentId: dirId,
          content: 'print("child file")',
        });

      const childId = fileResponse.body.data.id;

      await request(app)
        .delete(`/api/backend/files/${dirId}`)
        .set('Authorization', `Bearer ${authToken}`);

      //Verify files and directory are in trash
      const trashResponse = await request(app)
        .get('/api/backend/files/trash')
        .set('Authorization', `Bearer ${authToken}`);

      expect(trashResponse.body.data.some((f: any) => f.id === dirId)).toBe(true);
      expect(trashResponse.body.data.some((f: any) => f.id === childId)).toBe(true);

      const restoreResponse = await request(app)
        .post(`/api/backend/files/${dirId}/restore`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(restoreResponse.status).toBe(200);
      expect(restoreResponse.body.data.deletedAt).toBeNull();

      //Verify directory and children are restored
      const dirCheck = await request(app)
        .get(`/api/backend/files/${dirId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(dirCheck.status).toBe(200);

      const childCheck = await request(app)
        .get(`/api/backend/files/${childId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(childCheck.status).toBe(200);

      //Verify neither are in trash
      const trashAfter = await request(app)
        .get('/api/backend/files/trash')
        .set('Authorization', `Bearer ${authToken}`);

      expect(trashAfter.body.data.some((f: any) => f.id === dirId)).toBe(false);
      expect(trashAfter.body.data.some((f: any) => f.id === childId)).toBe(false);
    });

    it('should return 404 when restoring non-existent file', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';

      const response = await request(app)
        .post(`/api/backend/files/${fakeId}/restore`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('File not found');
    });

    it('should return 400 when trying to restore a non-deleted file', async () => {
      const createResponse = await request(app)
        .post('/api/backend/files')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'active-file.py',
          path: '/active-file.py',
          content: 'print("active")',
        });

      const fileId = createResponse.body.data.id;

      const restoreResponse = await request(app)
        .post(`/api/backend/files/${fileId}/restore`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(restoreResponse.status).toBe(400);
      expect(restoreResponse.body.success).toBe(false);
      expect(restoreResponse.body.error).toBe('File is not in trash');
    });

    it('should return 401 when restoring without authentication', async () => {
      const response = await request(app).post('/api/backend/files/some-id/restore');

      expect(response.status).toBe(401);
    });

    it('should restore file and preserve its content', async () => {
      const fileContent = 'print("important data")';

      const createResponse = await request(app)
        .post('/api/backend/files')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'content-test.py',
          path: '/content-test.py',
          content: fileContent,
        });

      const fileId = createResponse.body.data.id;

      await request(app)
        .delete(`/api/backend/files/${fileId}`)
        .set('Authorization', `Bearer ${authToken}`);

      await request(app)
        .post(`/api/backend/files/${fileId}/restore`)
        .set('Authorization', `Bearer ${authToken}`);

      const contentResponse = await request(app)
        .get(`/api/backend/files/${fileId}/content`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(contentResponse.status).toBe(200);
      expect(contentResponse.body.data.content).toBe(fileContent);
    });

    it('should restore nested directory structure correctly', async () => {
      const parentResponse = await request(app)
        .post('/api/backend/files')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'parent-dir',
          path: '/parent-dir',
          isDirectory: true,
        });

      const parentId = parentResponse.body.data.id;

      const childDirResponse = await request(app)
        .post('/api/backend/files')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'child-dir',
          path: '/parent-dir/child-dir',
          parentId: parentId,
          isDirectory: true,
        });

      const childDirId = childDirResponse.body.data.id;

      const fileResponse = await request(app)
        .post('/api/backend/files')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'nested.py',
          path: '/parent-dir/child-dir/nested.py',
          parentId: childDirId,
          content: 'print("nested")',
        });

      const fileId = fileResponse.body.data.id;

      await request(app)
        .delete(`/api/backend/files/${parentId}`)
        .set('Authorization', `Bearer ${authToken}`);

      const trashCheck = await request(app)
        .get('/api/backend/files/trash')
        .set('Authorization', `Bearer ${authToken}`);

      expect(trashCheck.body.data.some((f: any) => f.id === parentId)).toBe(true);
      expect(trashCheck.body.data.some((f: any) => f.id === childDirId)).toBe(true);
      expect(trashCheck.body.data.some((f: any) => f.id === fileId)).toBe(true);

      const restoreResponse = await request(app)
        .post(`/api/backend/files/${parentId}/restore`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(restoreResponse.status).toBe(200);

      const parentCheck = await request(app)
        .get(`/api/backend/files/${parentId}`)
        .set('Authorization', `Bearer ${authToken}`);

      const childDirCheck = await request(app)
        .get(`/api/backend/files/${childDirId}`)
        .set('Authorization', `Bearer ${authToken}`);

      const fileCheck = await request(app)
        .get(`/api/backend/files/${fileId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(parentCheck.status).toBe(200);
      expect(childDirCheck.status).toBe(200);
      expect(fileCheck.status).toBe(200);
    });
  });
  describe('POST /api/backend/files/upload', () => {
    it('should upload a single file successfully', async () => {
      const response = await request(app)
        .post('/api/backend/files/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', Buffer.from('print("hello")'), 'upload-test.py')
        .field('path', '/upload-test.py');

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        name: 'upload-test.py',
        path: '/upload-test.py',
        isDirectory: false,
      });
      expect(response.body.data.storageKey).toBeDefined();
    });

    it('should upload a file with no path and default to /filename', async () => {
      const response = await request(app)
        .post('/api/backend/files/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', Buffer.from('x = 1'), 'nopath.py');

      expect(response.status).toBe(201);
      expect(response.body.data.name).toBe('nopath.py');
      expect(response.body.data.path).toBe('/nopath.py');
    });

    it('should upload a file into a parent directory', async () => {
      const dirResponse = await request(app)
        .post('/api/backend/files')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'uploads', path: '/uploads', isDirectory: true });

      const dirId = dirResponse.body.data.id;

      const response = await request(app)
        .post('/api/backend/files/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', Buffer.from('data = []'), 'data.py')
        .field('path', '/uploads/data.py')
        .field('parentId', dirId);

      expect(response.status).toBe(201);
      expect(response.body.data.path).toBe('/uploads/data.py');
      expect(response.body.data.parentId).toBe(dirId);
    });

    it('should return 400 when no file is attached', async () => {
      const response = await request(app)
        .post('/api/backend/files/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(response.status).toBe(400);
    });

    it('should return 400 when file already exists at path', async () => {
      await request(app)
        .post('/api/backend/files/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', Buffer.from('original'), 'duplicate.py')
        .field('path', '/duplicate.py');

      const response = await request(app)
        .post('/api/backend/files/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', Buffer.from('second'), 'duplicate.py')
        .field('path', '/duplicate.py');

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('already exists');
    });

    it('should return 401 without auth token', async () => {
      const response = await request(app)
        .post('/api/backend/files/upload')
        .attach('file', Buffer.from('x = 1'), 'test.py');

      expect(response.status).toBe(401);
    });

    it('should reject blocked file extensions', async () => {
      const response = await request(app)
        .post('/api/backend/files/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', Buffer.from('malicious'), 'virus.exe');

      expect(response.status).toBe(500);
    });

    it('should return 400 when parentId does not exist', async () => {
      const response = await request(app)
        .post('/api/backend/files/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', Buffer.from('data = []'), 'orphan.py')
        .field('path', '/nonexistent/orphan.py')
        .field('parentId', '00000000-0000-0000-0000-000000000000');

      expect(response.status).toBe(400);
    });
  });

  describe('examFileGuard', () => {
    let examToken: string;
    let examUserId: string;
    let openBookToken: string;
    let openBookUserId: string;
    let teacherToken: string;
    let teacherId: string;
    let closedBookFileId: string;
    let openBookFileId: string;
    let teacherFileId: string;

    beforeAll(async () => {
      const hashedPassword = await bcrypt.hash('Password123', 10);

      await db.delete(users).where(eq(users.email, 'examguard-teacher@gmail.com'));
      const [teacher] = await db
        .insert(users)
        .values({
          email: 'examguard-teacher@gmail.com',
          password: hashedPassword,
          role: 'TEACHER',
          name: 'Guard Teacher',
        })
        .returning();
      teacherId = teacher.id;
      const teacherLogin = await request(app)
        .post('/api/backend/auth/login')
        .send({ email: 'examguard-teacher@gmail.com', password: 'Password123' });
      teacherToken = teacherLogin.body.data.token;

      await db.delete(users).where(eq(users.email, 'examguard-student@gmail.com'));
      const [examUser] = await db
        .insert(users)
        .values({
          email: 'examguard-student@gmail.com',
          password: hashedPassword,
          role: 'STUDENT',
          name: 'Guard Student',
        })
        .returning();
      examUserId = examUser.id;
      const examLogin = await request(app)
        .post('/api/backend/auth/login')
        .send({ email: 'examguard-student@gmail.com', password: 'Password123' });
      examToken = examLogin.body.data.token;

      await db.delete(users).where(eq(users.email, 'examguard-openbook@gmail.com'));
      const [openUser] = await db
        .insert(users)
        .values({
          email: 'examguard-openbook@gmail.com',
          password: hashedPassword,
          role: 'STUDENT',
          name: 'Open Book Student',
        })
        .returning();
      openBookUserId = openUser.id;
      const openLogin = await request(app)
        .post('/api/backend/auth/login')
        .send({ email: 'examguard-openbook@gmail.com', password: 'Password123' });
      openBookToken = openLogin.body.data.token;

      const closedFileRes = await request(app)
        .post('/api/backend/files')
        .set('Authorization', `Bearer ${examToken}`)
        .send({ name: 'closed-file.py', path: '/closed-file.py', content: 'print("blocked")' });
      closedBookFileId = closedFileRes.body.data.id;

      const openFileRes = await request(app)
        .post('/api/backend/files')
        .set('Authorization', `Bearer ${openBookToken}`)
        .send({ name: 'open-file.py', path: '/open-file.py', content: 'print("open")' });
      openBookFileId = openFileRes.body.data.id;

      const teacherFileRes = await request(app)
        .post('/api/backend/files')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ name: 'teacher-file.py', path: '/teacher-file.py', content: 'print("teacher")' });
      teacherFileId = teacherFileRes.body.data.id;
    });

    beforeEach(() => {
      mockGetActiveClosedBookExam.mockImplementation(async (userId: string) => {
        if (userId === examUserId) return 'closed-exam-id';
        return null;
      });
    });

    afterEach(() => {
      mockGetActiveClosedBookExam.mockResolvedValue(null);
    });

    afterAll(async () => {
      const { files: filesTable } = await import('../../db/schema');
      mockGetActiveClosedBookExam.mockReset();
      await db.delete(filesTable).where(eq(filesTable.userId, examUserId));
      await db.delete(filesTable).where(eq(filesTable.userId, openBookUserId));
      await db.delete(filesTable).where(eq(filesTable.userId, teacherId));
      await db.delete(users).where(eq(users.id, examUserId));
      await db.delete(users).where(eq(users.id, openBookUserId));
      await db.delete(users).where(eq(users.id, teacherId));
    });

    it('should block GET /content for student in closed-book exam', async () => {
      const response = await request(app)
        .get(`/api/backend/files/${closedBookFileId}/content`)
        .set('Authorization', `Bearer ${examToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('closed-book');
    });

    it('should block PUT /content for student in closed-book exam', async () => {
      const response = await request(app)
        .put(`/api/backend/files/${closedBookFileId}/content`)
        .set('Authorization', `Bearer ${examToken}`)
        .send({ content: 'hacked' });

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('closed-book');
    });

    it('should block PATCH /auto-save for student in closed-book exam', async () => {
      const response = await request(app)
        .patch(`/api/backend/files/${closedBookFileId}/auto-save`)
        .set('Authorization', `Bearer ${examToken}`)
        .send({ content: 'auto-save attempt' });

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('closed-book');
    });

    it('should block GET /download for student in closed-book exam', async () => {
      const response = await request(app)
        .get(`/api/backend/files/${closedBookFileId}/download`)
        .set('Authorization', `Bearer ${examToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('closed-book');
    });

    it('should block GET /files/tree for student in closed-book exam', async () => {
      const response = await request(app)
        .get('/api/backend/files/tree')
        .set('Authorization', `Bearer ${examToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('closed-book');
    });

    it('should allow GET /content for student in open-book exam', async () => {
      const response = await request(app)
        .get(`/api/backend/files/${openBookFileId}/content`)
        .set('Authorization', `Bearer ${openBookToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.content).toBe('print("open")');
    });

    it('should allow GET /files/tree for student in open-book exam', async () => {
      const response = await request(app)
        .get('/api/backend/files/tree')
        .set('Authorization', `Bearer ${openBookToken}`);

      expect(response.status).toBe(200);
    });

    it('should never block a teacher even if exam is active', async () => {
      const response = await request(app)
        .get(`/api/backend/files/${teacherFileId}/content`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(200);
    });

    it('should not block regular student with no active exam session', async () => {
      const createRes = await request(app)
        .post('/api/backend/files')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'normal-guard.py', path: '/normal-guard.py', content: 'print("normal")' });
      const fileId = createRes.body.data.id;

      const response = await request(app)
        .get(`/api/backend/files/${fileId}/content`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
    });
  });
});
