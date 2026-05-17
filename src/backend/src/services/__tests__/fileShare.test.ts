import { describe, it, expect, beforeAll, afterEach, afterAll } from '@jest/globals';
import { db } from '../../db';
import { files, users, fileShares } from '../../db/schema';
import { fileShareService } from '../fileShare';
import { fileRepository } from '../../repositories/file';
import { eq } from 'drizzle-orm';

describe('FileShareService', () => {
  let testUserId: string;
  let testFileId: string;

  beforeAll(async () => {
    const [user] = await db
      .insert(users)
      .values({
        email: 'shareservice@gmail.com',
        password: 'hashed',
        role: 'STUDENT',
        name: 'Share Service User',
      })
      .returning();
    testUserId = user.id;

    const file = await fileRepository.create({
      userId: testUserId,
      name: 'service-test.py',
      path: '/service-test.py',
    });
    testFileId = file.id;
  });

  afterEach(async () => {
    await db.delete(fileShares).where(eq(fileShares.fileId, testFileId));
  });

  afterAll(async () => {
    await db.delete(files).where(eq(files.userId, testUserId));
    await db.delete(users).where(eq(users.id, testUserId));
  });

  describe('createShare', () => {
    it('should create a new share', async () => {
      const share = await fileShareService.createShare(testFileId, testUserId);

      expect(share.fileId).toBe(testFileId);
      expect(share.ownerId).toBe(testUserId);
      expect(share.shareCode).toHaveLength(12);
      expect(share.expiresAt).toBeNull();
    });

    it('should create a share with expiry', async () => {
      const share = await fileShareService.createShare(testFileId, testUserId, 24);

      expect(share.expiresAt).not.toBeNull();
      const expectedExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
      expect(share.expiresAt!.getTime()).toBeCloseTo(expectedExpiry.getTime(), -3);
    });

    it('should return existing share if already created', async () => {
      const first = await fileShareService.createShare(testFileId, testUserId);
      const second = await fileShareService.createShare(testFileId, testUserId);

      expect(first.id).toBe(second.id);
      expect(first.shareCode).toBe(second.shareCode);
    });

    it('should throw if file does not exist', async () => {
      await expect(
        fileShareService.createShare('00000000-0000-0000-0000-000000000000', testUserId)
      ).rejects.toThrow('File not found');
    });

    it('should throw if file belongs to another user', async () => {
      const [otherUser] = await db
        .insert(users)
        .values({
          email: 'other-share@gmail.com',
          password: 'hashed',
          role: 'STUDENT',
          name: 'Other',
        })
        .returning();

      await expect(fileShareService.createShare(testFileId, otherUser.id)).rejects.toThrow(
        'File not found'
      );

      await db.delete(users).where(eq(users.id, otherUser.id));
    });
  });

  describe('resolveShare', () => {
    it('should resolve a valid share code', async () => {
      const created = await fileShareService.createShare(testFileId, testUserId);
      const resolved = await fileShareService.resolveShare(created.shareCode);

      expect(resolved.fileId).toBe(testFileId);
      expect(resolved.ownerId).toBe(testUserId);
    });

    it('should throw for invalid share code', async () => {
      await expect(fileShareService.resolveShare('invalidcode')).rejects.toThrow(
        'Share link is invalid or has expired'
      );
    });

    it('should throw for expired share code', async () => {
      await db.insert(fileShares).values({
        fileId: testFileId,
        ownerId: testUserId,
        shareCode: 'expiredcode1',
        expiresAt: new Date(Date.now() - 1000),
      });

      await expect(fileShareService.resolveShare('expiredcode1')).rejects.toThrow(
        'Share link is invalid or has expired'
      );
    });

    it('should resolve a share with a future expiry', async () => {
      const share = await fileShareService.createShare(testFileId, testUserId, 24);
      const resolved = await fileShareService.resolveShare(share.shareCode);

      expect(resolved.fileId).toBe(testFileId);
    });
  });

  describe('revokeShare', () => {
    it('should revoke an existing share', async () => {
      await fileShareService.createShare(testFileId, testUserId);
      await fileShareService.revokeShare(testFileId, testUserId);

      await expect(
        fileShareService.resolveShare(
          (await fileShareService.createShare(testFileId, testUserId)).shareCode
        )
      ).resolves.toBeDefined();
    });

    it('should throw if no share exists to revoke', async () => {
      await expect(fileShareService.revokeShare(testFileId, testUserId)).rejects.toThrow(
        'No active share found for this file'
      );
    });

    it('should not affect other files shares', async () => {
      const otherFile = await fileRepository.create({
        userId: testUserId,
        name: 'other.py',
        path: '/other.py',
      });

      const share = await fileShareService.createShare(otherFile.id, testUserId);
      await fileShareService.createShare(testFileId, testUserId);
      await fileShareService.revokeShare(testFileId, testUserId);

      const resolved = await fileShareService.resolveShare(share.shareCode);
      expect(resolved.fileId).toBe(otherFile.id);

      await db.delete(fileShares).where(eq(fileShares.fileId, otherFile.id));
      await db.delete(files).where(eq(files.id, otherFile.id));
    });
  });
});
