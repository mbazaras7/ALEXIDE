import db from '../db';
import { fileShares } from '../db/schema';
import { eq, and, gt, or, isNull } from 'drizzle-orm';
import { randomBytes } from 'crypto';
import type { FileShareData } from '../types/fileShare';

//Types

type FileShareRow = typeof fileShares.$inferSelect;

export class FileShareRepository {
  //Queries

  async findByCode(shareCode: string): Promise<FileShareData | null> {
    const [row] = await db
      .select()
      .from(fileShares)
      .where(and(eq(fileShares.shareCode, shareCode), this.activeShare()));
    return row ? this.mapToFileShareData(row) : null;
  }

  async findByFileAndOwner(fileId: string, ownerId: string): Promise<FileShareData | null> {
    const [row] = await db
      .select()
      .from(fileShares)
      .where(and(eq(fileShares.fileId, fileId), eq(fileShares.ownerId, ownerId)));
    return row ? this.mapToFileShareData(row) : null;
  }

  async canUserAccessSharedFile(_userId: string, fileId: string): Promise<boolean> {
    const [share] = await db
      .select({ id: fileShares.id })
      .from(fileShares)
      .where(and(eq(fileShares.fileId, fileId), this.activeShare()));
    return !!share;
  }

  //Mutations

  async create(fileId: string, ownerId: string, expiresInHours?: number): Promise<FileShareData> {
    const shareCode = randomBytes(6).toString('hex');
    const expiresAt = expiresInHours
      ? new Date(Date.now() + expiresInHours * 60 * 60 * 1000)
      : null;
    const [row] = await db
      .insert(fileShares)
      .values({ fileId, ownerId, shareCode, expiresAt })
      .returning();
    return this.mapToFileShareData(row);
  }

  async deleteByFileAndOwner(fileId: string, ownerId: string): Promise<void> {
    await db
      .delete(fileShares)
      .where(and(eq(fileShares.fileId, fileId), eq(fileShares.ownerId, ownerId)));
  }

  //Private helpers

  //Share link exists and has not expired
  private activeShare() {
    return or(isNull(fileShares.expiresAt), gt(fileShares.expiresAt, new Date()));
  }

  private mapToFileShareData(row: FileShareRow): FileShareData {
    return {
      id: row.id,
      fileId: row.fileId,
      ownerId: row.ownerId,
      shareCode: row.shareCode,
      expiresAt: row.expiresAt,
      createdAt: row.createdAt,
    };
  }
}

export const fileShareRepository = new FileShareRepository();
