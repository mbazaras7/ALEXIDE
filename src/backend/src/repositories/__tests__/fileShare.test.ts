import { describe, it, expect, beforeAll, afterEach, afterAll } from '@jest/globals';
import { db } from '../../db';
import { files, users, fileShares } from '../../db/schema';
import { fileRepository } from '../file';
import { fileShareRepository } from '../fileShare';
import { eq } from 'drizzle-orm';

describe('FileShareRepository', () => {
  let testUserId: string;
  let testFileId: string;

  beforeAll(async () => {
    const [user] = await db
      .insert(users)
      .values({
        email: 'sharerep@gmail.com',
        password: 'hashed_password',
        role: 'STUDENT',
        name: 'Share Repo Test User',
      })
      .returning();
    testUserId = user.id;

    const file = await fileRepository.create({
      userId: testUserId,
      name: 'share-test.py',
      path: '/share-test.py',
    });
    testFileId = file.id;
  });

  afterEach(async () => {
    await db.delete(fileShares).where(eq(fileShares.ownerId, testUserId));
  });

  afterAll(async () => {
    await db.delete(files).where(eq(files.userId, testUserId));
    await db.delete(users).where(eq(users.id, testUserId));
  });

  describe('create', () => {
    it('should create a share with no expiry', async () => {
      const share = await fileShareRepository.create(testFileId, testUserId);

      expect(share).toMatchObject({
        fileId: testFileId,
        ownerId: testUserId,
        expiresAt: null,
      });
      expect(share.shareCode).toBeDefined();
      expect(share.shareCode).toHaveLength(12);
      expect(share.id).toBeDefined();
    });

    it('should create a share with expiry', async () => {
      const share = await fileShareRepository.create(testFileId, testUserId, 24);

      expect(share.expiresAt).not.toBeNull();
      const expectedExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
      expect(share.expiresAt!.getTime()).toBeCloseTo(expectedExpiry.getTime(), -3);
    });
  });

  describe('findByCode', () => {
    it('should find a share by code', async () => {
      const created = await fileShareRepository.create(testFileId, testUserId);
      const found = await fileShareRepository.findByCode(created.shareCode);

      expect(found).not.toBeNull();
      expect(found!.id).toBe(created.id);
      expect(found!.fileId).toBe(testFileId);
    });

    it('should return null for non-existent code', async () => {
      const found = await fileShareRepository.findByCode('nonexistent');
      expect(found).toBeNull();
    });

    it('should return null for expired share', async () => {
      const [share] = await db
        .insert(fileShares)
        .values({
          fileId: testFileId,
          ownerId: testUserId,
          shareCode: 'expiredcode',
          expiresAt: new Date(Date.now() - 1000), // expired 1 second ago
        })
        .returning();

      const found = await fileShareRepository.findByCode(share.shareCode);
      expect(found).toBeNull();
    });

    it('should return share with future expiry', async () => {
      const share = await fileShareRepository.create(testFileId, testUserId, 24);
      const found = await fileShareRepository.findByCode(share.shareCode);
      expect(found).not.toBeNull();
    });
  });

  describe('findByFileAndOwner', () => {
    it('should find existing share', async () => {
      const created = await fileShareRepository.create(testFileId, testUserId);
      const found = await fileShareRepository.findByFileAndOwner(testFileId, testUserId);

      expect(found).not.toBeNull();
      expect(found!.id).toBe(created.id);
    });

    it('should return null if no share exists', async () => {
      const found = await fileShareRepository.findByFileAndOwner(testFileId, testUserId);
      expect(found).toBeNull();
    });
  });

  describe('canUserAccessSharedFile', () => {
    it('should return true when active share exists', async () => {
      await fileShareRepository.create(testFileId, testUserId);
      const canAccess = await fileShareRepository.canUserAccessSharedFile(
        'any-user-id',
        testFileId
      );
      expect(canAccess).toBe(true);
    });

    it('should return false when no share exists', async () => {
      const canAccess = await fileShareRepository.canUserAccessSharedFile(
        'any-user-id',
        testFileId
      );
      expect(canAccess).toBe(false);
    });

    it('should return false when share is expired', async () => {
      await db.insert(fileShares).values({
        fileId: testFileId,
        ownerId: testUserId,
        shareCode: 'expiredacc',
        expiresAt: new Date(Date.now() - 1000),
      });

      const canAccess = await fileShareRepository.canUserAccessSharedFile(
        'any-user-id',
        testFileId
      );
      expect(canAccess).toBe(false);
    });
  });

  describe('deleteByFileAndOwner', () => {
    it('should delete share', async () => {
      await fileShareRepository.create(testFileId, testUserId);
      await fileShareRepository.deleteByFileAndOwner(testFileId, testUserId);

      const found = await fileShareRepository.findByFileAndOwner(testFileId, testUserId);
      expect(found).toBeNull();
    });

    it('should not throw when no share exists', async () => {
      await expect(
        fileShareRepository.deleteByFileAndOwner(testFileId, testUserId)
      ).resolves.not.toThrow();
    });
  });
});
