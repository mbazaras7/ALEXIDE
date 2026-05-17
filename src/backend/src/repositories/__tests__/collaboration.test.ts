import { describe, it, expect, beforeAll, afterEach, afterAll } from '@jest/globals';
import { db } from '../../db';
import { files, users, collaborationStates } from '../../db/schema';
import { collaborationRepository } from '../collaboration';
import { fileRepository } from '../file';
import { eq } from 'drizzle-orm';

describe('CollaborationRepository', () => {
  let testUserId: string;
  let testFileId: string;

  beforeAll(async () => {
    const [user] = await db
      .insert(users)
      .values({
        email: 'collabrepo@gmail.com',
        password: 'hashed',
        role: 'STUDENT',
        name: 'Collab Repo User',
      })
      .returning();
    testUserId = user.id;

    const file = await fileRepository.create({
      userId: testUserId,
      name: 'collab-test.py',
      path: '/collab-test.py',
    });
    testFileId = file.id;
  });

  afterEach(async () => {
    await db.delete(collaborationStates).where(eq(collaborationStates.fileId, testFileId));
  });

  afterAll(async () => {
    await db.delete(files).where(eq(files.userId, testUserId));
    await db.delete(users).where(eq(users.id, testUserId));
  });

  describe('findByFileId', () => {
    it('should return null when no state exists', async () => {
      const result = await collaborationRepository.findByFileId(testFileId);
      expect(result).toBeNull();
    });

    it('should find existing state by fileId', async () => {
      await collaborationRepository.upsert(testFileId, 'base64stateA==');
      const result = await collaborationRepository.findByFileId(testFileId);

      expect(result).not.toBeNull();
      expect(result!.fileId).toBe(testFileId);
      expect(result!.stateVector).toBe('base64stateA==');
    });

    it('should return null for non-existent fileId', async () => {
      const result = await collaborationRepository.findByFileId(
        '00000000-0000-0000-0000-000000000000'
      );
      expect(result).toBeNull();
    });
  });

  describe('upsert', () => {
    it('should create a new state when none exists', async () => {
      const result = await collaborationRepository.upsert(testFileId, 'initialstate==');

      expect(result.fileId).toBe(testFileId);
      expect(result.stateVector).toBe('initialstate==');
      expect(result.id).toBeDefined();
      expect(result.updatedAt).toBeInstanceOf(Date);
    });

    it('should update existing state', async () => {
      await collaborationRepository.upsert(testFileId, 'state-v1==');

      await new Promise((resolve) => setTimeout(resolve, 10));

      const updated = await collaborationRepository.upsert(testFileId, 'state-v2==');

      expect(updated.stateVector).toBe('state-v2==');
      expect(updated.fileId).toBe(testFileId);
    });

    it('should update the updatedAt timestamp on update', async () => {
      const first = await collaborationRepository.upsert(testFileId, 'state-v1==');

      await new Promise((resolve) => setTimeout(resolve, 10));

      const second = await collaborationRepository.upsert(testFileId, 'state-v2==');

      expect(second.updatedAt.getTime()).toBeGreaterThan(first.updatedAt.getTime());
    });

    it('should only have one record per file after multiple upserts', async () => {
      await collaborationRepository.upsert(testFileId, 'state-v1==');
      await collaborationRepository.upsert(testFileId, 'state-v2==');
      await collaborationRepository.upsert(testFileId, 'state-v3==');

      const allStates = await db
        .select()
        .from(collaborationStates)
        .where(eq(collaborationStates.fileId, testFileId));

      expect(allStates).toHaveLength(1);
      expect(allStates[0].stateVector).toBe('state-v3==');
    });
  });

  describe('delete', () => {
    it('should delete an existing state', async () => {
      await collaborationRepository.upsert(testFileId, 'state==');
      await collaborationRepository.delete(testFileId);

      const result = await collaborationRepository.findByFileId(testFileId);
      expect(result).toBeNull();
    });

    it('should not throw when deleting non-existent state', async () => {
      await expect(
        collaborationRepository.delete('00000000-0000-0000-0000-000000000000')
      ).resolves.not.toThrow();
    });

    it('should only delete state for the specified file', async () => {
      const otherFile = await fileRepository.create({
        userId: testUserId,
        name: 'other-collab.py',
        path: '/other-collab.py',
      });

      await collaborationRepository.upsert(testFileId, 'state-a==');
      await collaborationRepository.upsert(otherFile.id, 'state-b==');

      await collaborationRepository.delete(testFileId);

      const remaining = await collaborationRepository.findByFileId(otherFile.id);
      expect(remaining).not.toBeNull();
      expect(remaining!.stateVector).toBe('state-b==');

      await db.delete(collaborationStates).where(eq(collaborationStates.fileId, otherFile.id));
      await db.delete(files).where(eq(files.id, otherFile.id));
    });
  });
});
