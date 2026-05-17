import { describe, it, expect, beforeAll, afterEach, afterAll } from '@jest/globals';
import { db } from '../../db';
import { files, users } from '../../db/schema';
import { fileRepository } from '../file';
import { eq } from 'drizzle-orm';

describe('FileRepository', () => {
  let testUserId: string;

  beforeAll(async () => {
    const [user] = await db
      .insert(users)
      .values({
        email: 'test@gmail.com',
        password: 'hashed_password',
        role: 'STUDENT',
        name: 'Test User',
      })
      .returning();
    testUserId = user.id;
  });

  afterEach(async () => {
    await db.delete(files).where(eq(files.userId, testUserId));
  });

  afterAll(async () => {
    await db.delete(users).where(eq(users.id, testUserId));
  });

  describe('create', () => {
    it('should create a file', async () => {
      const result = await fileRepository.create({
        userId: testUserId,
        name: 'test.py',
        path: '/test.py',
        mimeType: 'text/plain',
        size: 17,
        storageKey: 'users/test/test.py',
      });

      expect(result).toMatchObject({
        userId: testUserId,
        name: 'test.py',
        path: '/test.py',
        storageKey: 'users/test/test.py',
        size: 17,
      });
      expect(result.id).toBeDefined();
      expect(result.createdAt).toBeInstanceOf(Date);
    });

    it('should create a directory', async () => {
      const result = await fileRepository.create({
        userId: testUserId,
        name: 'src',
        path: '/src',
        isDirectory: true,
      });

      expect(result).toMatchObject({
        name: 'src',
        isDirectory: true,
        storageKey: null,
        size: 0,
      });
    });
  });

  describe('findById', () => {
    it('should find file by id', async () => {
      const created = await fileRepository.create({
        userId: testUserId,
        name: 'test.py',
        path: '/test.py',
        storageKey: 'users/test/test.py',
      });

      const found = await fileRepository.findById(created.id, testUserId);

      expect(found).toMatchObject({
        id: created.id,
        name: 'test.py',
      });
    });

    it('should return null for non-existent file', async () => {
      const found = await fileRepository.findById('non-existent-id', testUserId);
      expect(found).toBeNull();
    });
  });

  describe('findByPath', () => {
    it('should find file by path', async () => {
      await fileRepository.create({
        userId: testUserId,
        name: 'test.py',
        path: '/test.py',
      });

      const found = await fileRepository.findByPath('/test.py', testUserId);

      expect(found).toMatchObject({
        name: 'test.py',
        path: '/test.py',
      });
    });

    it('should return null if path not found', async () => {
      const found = await fileRepository.findByPath('/nonexistent.py', testUserId);
      expect(found).toBeNull();
    });
  });

  describe('pathExists', () => {
    it('should return true if path exists', async () => {
      await fileRepository.create({
        userId: testUserId,
        name: 'test.py',
        path: '/test.py',
      });

      const exists = await fileRepository.pathExists('/test.py', testUserId);
      expect(exists).toBe(true);
    });

    it('should return false if path does not exist', async () => {
      const exists = await fileRepository.pathExists('/nonexistent.py', testUserId);
      expect(exists).toBe(false);
    });

    it('should return false for deleted files', async () => {
      const created = await fileRepository.create({
        userId: testUserId,
        name: 'test.py',
        path: '/test.py',
      });

      await fileRepository.softDelete(created.id, testUserId);

      const exists = await fileRepository.pathExists('/test.py', testUserId);
      expect(exists).toBe(false);
    });
  });

  describe('list', () => {
    it('should list all files for user', async () => {
      await fileRepository.create({
        userId: testUserId,
        name: 'file1.py',
        path: '/file1.py',
      });

      await fileRepository.create({
        userId: testUserId,
        name: 'file2.py',
        path: '/file2.py',
      });

      const files = await fileRepository.list(testUserId);

      expect(files).toHaveLength(2);
      expect(files.map((f) => f.name)).toEqual(expect.arrayContaining(['file1.py', 'file2.py']));
    });

    it('should filter by parentId', async () => {
      const dir = await fileRepository.create({
        userId: testUserId,
        name: 'src',
        path: '/src',
        isDirectory: true,
      });

      await fileRepository.create({
        userId: testUserId,
        name: 'main.py',
        path: '/src/main.py',
        parentId: dir.id,
      });

      await fileRepository.create({
        userId: testUserId,
        name: 'root.py',
        path: '/root.py',
        parentId: null,
      });

      const childrenOfDir = await fileRepository.list(testUserId, { parentId: dir.id });
      const rootFiles = await fileRepository.list(testUserId, { parentId: null });

      expect(childrenOfDir).toHaveLength(1);
      expect(childrenOfDir[0].name).toBe('main.py');
      expect(rootFiles).toHaveLength(2); // src + root.py
    });

    it('should include deleted files when requested', async () => {
      const file = await fileRepository.create({
        userId: testUserId,
        name: 'test.py',
        path: '/test.py',
      });

      await fileRepository.softDelete(file.id, testUserId);

      const files = await fileRepository.list(testUserId, { includeDeleted: true });

      expect(files).toHaveLength(1);
      expect(files[0].deletedAt).not.toBeNull();
    });
  });

  describe('update', () => {
    it('should update file storageKey', async () => {
      const created = await fileRepository.create({
        userId: testUserId,
        name: 'test.py',
        path: '/test.py',
        storageKey: 'old-key',
      });

      const updated = await fileRepository.update(created.id, {
        storageKey: 'new-key',
      });

      expect(updated?.storageKey).toBe('new-key');
    });

    it('should update file name and path', async () => {
      const created = await fileRepository.create({
        userId: testUserId,
        name: 'test.py',
        path: '/test.py',
      });

      const updated = await fileRepository.update(created.id, {
        name: 'renamed.py',
        path: '/renamed.py',
      });

      expect(updated).toMatchObject({
        name: 'renamed.py',
        path: '/renamed.py',
      });
    });
  });

  describe('softDelete', () => {
    it('should soft delete file', async () => {
      const created = await fileRepository.create({
        userId: testUserId,
        name: 'test.py',
        path: '/test.py',
      });

      const deleted = await fileRepository.softDelete(created.id, testUserId);

      expect(deleted).toBe(true);

      const found = await fileRepository.findById(created.id, testUserId);
      expect(found).toBeNull();
    });

    it('should return false if file not found', async () => {
      const deleted = await fileRepository.softDelete('non-existent', testUserId);

      expect(deleted).toBe(false);
    });
  });

  describe('hardDelete', () => {
    it('should permanently delete file', async () => {
      const created = await fileRepository.create({
        userId: testUserId,
        name: 'test.py',
        path: '/test.py',
      });

      const deleted = await fileRepository.hardDelete(created.id, testUserId);

      expect(deleted).toBe(true);

      const files = await fileRepository.list(testUserId, { includeDeleted: true });
      expect(files).toHaveLength(0);
    });

    it('should return false if file not found', async () => {
      const deleted = await fileRepository.hardDelete('non-existent', testUserId);

      expect(deleted).toBe(false);
    });
  });

  describe('getChildren', () => {
    it('should get all children of directory', async () => {
      const dir = await fileRepository.create({
        userId: testUserId,
        name: 'src',
        path: '/src',
        isDirectory: true,
      });

      await fileRepository.create({
        userId: testUserId,
        name: 'main.py',
        path: '/src/main.py',
        parentId: dir.id,
      });

      await fileRepository.create({
        userId: testUserId,
        name: 'utils.py',
        path: '/src/utils.py',
        parentId: dir.id,
      });

      const children = await fileRepository.getChildren(dir.id, testUserId);

      expect(children).toHaveLength(2);
      expect(children.map((c) => c.name)).toEqual(expect.arrayContaining(['main.py', 'utils.py']));
    });

    it('should return empty array if no children', async () => {
      const dir = await fileRepository.create({
        userId: testUserId,
        name: 'empty',
        path: '/empty',
        isDirectory: true,
      });

      const children = await fileRepository.getChildren(dir.id, testUserId);

      expect(children).toHaveLength(0);
    });
  });

  describe('getDescendants', () => {
    it('should get all descendants recursively', async () => {
      const parent = await fileRepository.create({
        userId: testUserId,
        name: 'parent',
        path: '/parent',
        isDirectory: true,
      });

      const child1 = await fileRepository.create({
        userId: testUserId,
        name: 'child1',
        path: '/parent/child1',
        parentId: parent.id,
        isDirectory: true,
      });

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const child2 = await fileRepository.create({
        userId: testUserId,
        name: 'child2',
        path: '/parent/child2',
        parentId: parent.id,
        isDirectory: true,
      });

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const grandchild = await fileRepository.create({
        userId: testUserId,
        name: 'grandchild',
        path: '/parent/child1/grandchild',
        parentId: child1.id,
        isDirectory: true,
      });

      const descendants = await fileRepository.getDescendants(parent.id, testUserId);
      expect(descendants).toHaveLength(3);
      const names = descendants.map((d) => d.name);
      expect(names).toContain('child1');
      expect(names).toContain('child2');
      expect(names).toContain('grandchild');
    });

    it('should return empty array if no descendants', async () => {
      const dir = await fileRepository.create({
        userId: testUserId,
        name: 'empty',
        path: '/empty',
        isDirectory: true,
      });

      const descendants = await fileRepository.getDescendants(dir.id, testUserId);

      expect(descendants).toHaveLength(0);
    });
  });

  describe('search', () => {
    it('should search files by name', async () => {
      await fileRepository.create({
        userId: testUserId,
        name: 'test.py',
        path: '/test.py',
      });

      await fileRepository.create({
        userId: testUserId,
        name: 'main.py',
        path: '/main.py',
      });

      await fileRepository.create({
        userId: testUserId,
        name: 'testing.js',
        path: '/testing.js',
      });

      const results = await fileRepository.search('test', testUserId);

      expect(results).toHaveLength(2);
      expect(results.map((f) => f.name)).toEqual(expect.arrayContaining(['test.py', 'testing.js']));
    });

    it('should search files by path', async () => {
      const dir = await fileRepository.create({
        userId: testUserId,
        name: 'src',
        path: '/src',
        isDirectory: true,
      });

      await fileRepository.create({
        userId: testUserId,
        name: 'main.py',
        path: '/src/main.py',
        parentId: dir.id,
      });

      await fileRepository.create({
        userId: testUserId,
        name: 'test.py',
        path: '/tests/test.py',
      });

      const results = await fileRepository.search('src', testUserId);

      expect(results).toHaveLength(2);
      expect(results.some((f) => f.name === 'src')).toBe(true);
      expect(results.some((f) => f.name === 'main.py')).toBe(true);
    });

    it('should not return deleted files', async () => {
      const file = await fileRepository.create({
        userId: testUserId,
        name: 'deleted.py',
        path: '/deleted.py',
      });

      await fileRepository.create({
        userId: testUserId,
        name: 'active.py',
        path: '/active.py',
      });

      await fileRepository.softDelete(file.id, testUserId);

      const results = await fileRepository.search('deleted', testUserId);

      expect(results).toHaveLength(0);
    });

    it('should return empty array for no matches', async () => {
      await fileRepository.create({
        userId: testUserId,
        name: 'test.py',
        path: '/test.py',
      });

      const results = await fileRepository.search('nonexistent', testUserId);

      expect(results).toHaveLength(0);
    });

    it('should only return files for the specific user', async () => {
      const [otherUser] = await db
        .insert(users)
        .values({
          email: 'other@gmail.com',
          password: 'hashed_password',
          role: 'STUDENT',
          name: 'Other User',
        })
        .returning();

      await fileRepository.create({
        userId: testUserId,
        name: 'my-test.py',
        path: '/my-test.py',
      });

      await fileRepository.create({
        userId: otherUser.id,
        name: 'their-test.py',
        path: '/their-test.py',
      });

      const results = await fileRepository.search('test', testUserId);

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('my-test.py');
      expect(results[0].userId).toBe(testUserId);

      await db.delete(files).where(eq(files.userId, otherUser.id));
      await db.delete(users).where(eq(users.id, otherUser.id));
    });
  });

  describe('getDeleted', () => {
    it('should return all deleted files for user', async () => {
      const file1 = await fileRepository.create({
        userId: testUserId,
        name: 'deleted1.py',
        path: '/deleted1.py',
      });

      const file2 = await fileRepository.create({
        userId: testUserId,
        name: 'deleted2.py',
        path: '/deleted2.py',
      });

      await fileRepository.create({
        userId: testUserId,
        name: 'active.py',
        path: '/active.py',
      });

      await fileRepository.softDelete(file1.id, testUserId);
      await fileRepository.softDelete(file2.id, testUserId);

      const deletedFiles = await fileRepository.getDeleted(testUserId);

      expect(deletedFiles).toHaveLength(2);
      expect(deletedFiles.map((f) => f.name)).toEqual(
        expect.arrayContaining(['deleted1.py', 'deleted2.py'])
      );
      expect(deletedFiles.every((f) => f.deletedAt !== null)).toBe(true);
    });

    it('should return empty array when no deleted files', async () => {
      await fileRepository.create({
        userId: testUserId,
        name: 'active.py',
        path: '/active.py',
      });

      const deletedFiles = await fileRepository.getDeleted(testUserId);

      expect(deletedFiles).toHaveLength(0);
    });

    it('should include deleted directories', async () => {
      const dir = await fileRepository.create({
        userId: testUserId,
        name: 'deleted-dir',
        path: '/deleted-dir',
        isDirectory: true,
      });

      const file = await fileRepository.create({
        userId: testUserId,
        name: 'deleted-file.py',
        path: '/deleted-file.py',
      });

      await fileRepository.softDelete(dir.id, testUserId);
      await fileRepository.softDelete(file.id, testUserId);

      const deletedFiles = await fileRepository.getDeleted(testUserId);

      expect(deletedFiles).toHaveLength(2);
      expect(deletedFiles.some((f) => f.isDirectory)).toBe(true);
      expect(deletedFiles.some((f) => !f.isDirectory)).toBe(true);
    });

    it('should only return deleted files for specific user', async () => {
      const [otherUser] = await db
        .insert(users)
        .values({
          email: 'other2@gmail.com',
          password: 'hashed_password',
          role: 'STUDENT',
          name: 'Other User 2',
        })
        .returning();

      const myFile = await fileRepository.create({
        userId: testUserId,
        name: 'my-deleted.py',
        path: '/my-deleted.py',
      });

      const theirFile = await fileRepository.create({
        userId: otherUser.id,
        name: 'their-deleted.py',
        path: '/their-deleted.py',
      });

      await fileRepository.softDelete(myFile.id, testUserId);
      await fileRepository.softDelete(theirFile.id, otherUser.id);

      const deletedFiles = await fileRepository.getDeleted(testUserId);

      expect(deletedFiles).toHaveLength(1);
      expect(deletedFiles[0].name).toBe('my-deleted.py');
      expect(deletedFiles[0].userId).toBe(testUserId);

      // Cleanup
      await db.delete(files).where(eq(files.userId, otherUser.id));
      await db.delete(users).where(eq(users.id, otherUser.id));
    });

    it('should include all metadata for deleted files', async () => {
      const file = await fileRepository.create({
        userId: testUserId,
        name: 'detailed.py',
        path: '/src/detailed.py',
        mimeType: 'text/x-python',
        size: 1234,
        storageKey: 'users/test/detailed.py',
      });

      await fileRepository.softDelete(file.id, testUserId);

      const deletedFiles = await fileRepository.getDeleted(testUserId);

      expect(deletedFiles).toHaveLength(1);
      expect(deletedFiles[0]).toMatchObject({
        id: file.id,
        name: 'detailed.py',
        path: '/src/detailed.py',
        mimeType: 'text/x-python',
        size: 1234,
        storageKey: 'users/test/detailed.py',
      });
      expect(deletedFiles[0].deletedAt).not.toBeNull();
    });
  });

  describe('restore', () => {
    it('should restore a soft-deleted file', async () => {
      const file = await fileRepository.create({
        userId: testUserId,
        name: 'restore-me.py',
        path: '/restore-me.py',
      });

      await fileRepository.softDelete(file.id, testUserId);

      const restored = await fileRepository.restore(file.id, testUserId);

      expect(restored.id).toBe(file.id);
      expect(restored.name).toBe('restore-me.py');
      expect(restored.deletedAt).toBeNull();

      const found = await fileRepository.findById(file.id, testUserId);
      expect(found).not.toBeNull();
      expect(found?.deletedAt).toBeNull();
    });

    it('should restore a directory', async () => {
      const dir = await fileRepository.create({
        userId: testUserId,
        name: 'restore-dir',
        path: '/restore-dir',
        isDirectory: true,
      });

      await fileRepository.softDelete(dir.id, testUserId);

      const restored = await fileRepository.restore(dir.id, testUserId);

      expect(restored.isDirectory).toBe(true);
      expect(restored.deletedAt).toBeNull();
    });

    it('should preserve all file metadata on restore', async () => {
      const file = await fileRepository.create({
        userId: testUserId,
        name: 'metadata.py',
        path: '/src/metadata.py',
        mimeType: 'text/x-python',
        size: 5678,
        storageKey: 'users/test/metadata.py',
      });

      const originalCreatedAt = file.createdAt;

      await fileRepository.softDelete(file.id, testUserId);

      const restored = await fileRepository.restore(file.id, testUserId);

      expect(restored).toMatchObject({
        id: file.id,
        name: 'metadata.py',
        path: '/src/metadata.py',
        mimeType: 'text/x-python',
        size: 5678,
        storageKey: 'users/test/metadata.py',
        userId: testUserId,
      });
      expect(restored.createdAt).toEqual(originalCreatedAt);
      expect(restored.deletedAt).toBeNull();
    });

    it('should update the updatedAt timestamp', async () => {
      const file = await fileRepository.create({
        userId: testUserId,
        name: 'timestamp.py',
        path: '/timestamp.py',
      });

      const originalUpdatedAt = file.updatedAt;

      await fileRepository.softDelete(file.id, testUserId);

      await new Promise((resolve) => setTimeout(resolve, 10));

      const restored = await fileRepository.restore(file.id, testUserId);

      expect(restored.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
    });

    it('should throw error if file not found', async () => {
      await expect(fileRepository.restore('non-existent-id', testUserId)).rejects.toThrow(
        'Failed to restore file'
      );
    });

    it('should throw error if trying to restore file from another user', async () => {
      const [otherUser] = await db
        .insert(users)
        .values({
          email: 'other3@gmail.com',
          password: 'hashed_password',
          role: 'STUDENT',
          name: 'Other User 3',
        })
        .returning();

      const theirFile = await fileRepository.create({
        userId: otherUser.id,
        name: 'their-file.py',
        path: '/their-file.py',
      });

      await fileRepository.softDelete(theirFile.id, otherUser.id);

      await expect(fileRepository.restore(theirFile.id, testUserId)).rejects.toThrow(
        'Failed to restore file'
      );

      await db.delete(files).where(eq(files.userId, otherUser.id));
      await db.delete(users).where(eq(users.id, otherUser.id));
    });
  });
});
