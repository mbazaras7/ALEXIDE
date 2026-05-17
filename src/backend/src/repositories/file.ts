import db from '../db';
import { files, fileShares, users } from '../db/schema';
import { eq, and, isNull, desc, or, like, isNotNull, gt } from 'drizzle-orm';
import type { FileMetadata, ListFilesQuery } from '../types/file';

//Types

type FileRow = typeof files.$inferSelect;

export class FileRepository {
  //lookups

  async create(data: {
    userId: string;
    name: string;
    path: string;
    parentId?: string | null;
    isDirectory?: boolean;
    mimeType?: string;
    size?: number;
    storageKey?: string;
  }): Promise<FileMetadata> {
    const [file] = await db
      .insert(files)
      .values({
        userId: data.userId,
        name: data.name,
        path: data.path,
        parentId: data.parentId ?? null,
        isDirectory: data.isDirectory ?? false,
        mimeType: data.mimeType ?? null,
        size: data.size ?? 0,
        storageKey: data.storageKey ?? null,
      })
      .returning();

    return this.mapToFileMetadata(file);
  }

  async findById(fileId: string, userId: string): Promise<FileMetadata | null> {
    const [file] = await db
      .select()
      .from(files)
      .where(and(eq(files.id, fileId), this.activeFile(userId)));
    return file ? this.mapToFileMetadata(file) : null;
  }

  async findByIdWithoutOwnership(fileId: string): Promise<FileMetadata | null> {
    const [file] = await db
      .select()
      .from(files)
      .where(and(eq(files.id, fileId), isNull(files.deletedAt)));
    return file ? this.mapToFileMetadata(file) : null;
  }

  async findByIdIncludingDeleted(fileId: string, userId: string): Promise<FileMetadata | null> {
    const [file] = await db
      .select()
      .from(files)
      .where(and(eq(files.id, fileId), eq(files.userId, userId)));
    return file ? this.mapToFileMetadata(file) : null;
  }

  async findByPath(path: string, userId: string): Promise<FileMetadata | null> {
    const [file] = await db
      .select()
      .from(files)
      .where(and(eq(files.path, path), this.activeFile(userId)));
    return file ? this.mapToFileMetadata(file) : null;
  }

  async pathExists(path: string, userId: string): Promise<boolean> {
    const [file] = await db
      .select({ id: files.id })
      .from(files)
      .where(and(eq(files.path, path), this.activeFile(userId)));
    return !!file;
  }

  //Collection queries

  async list(userId: string, query: ListFilesQuery = {}): Promise<FileMetadata[]> {
    const conditions = [eq(files.userId, userId)];

    if (!query.includeDeleted) {
      conditions.push(isNull(files.deletedAt));
    }

    if (query.parentId !== undefined) {
      conditions.push(
        query.parentId === null ? isNull(files.parentId) : eq(files.parentId, query.parentId)
      );
    }

    if (query.search) {
      const term = `%${query.search}%`;
      conditions.push(or(like(files.name, term), like(files.path, term))!);
    }

    const results = await db
      .select()
      .from(files)
      .where(and(...conditions))
      .orderBy(desc(files.isDirectory), files.name)
      .limit(query.limit ?? 100)
      .offset(query.offset ?? 0);

    return results.map((f) => this.mapToFileMetadata(f));
  }

  async getChildren(parentId: string, userId: string): Promise<FileMetadata[]> {
    const results = await db
      .select()
      .from(files)
      .where(and(eq(files.parentId, parentId), this.activeFile(userId)))
      .orderBy(desc(files.isDirectory), files.name);
    return results.map((f) => this.mapToFileMetadata(f));
  }

  async getDescendants(fileId: string, userId: string): Promise<FileMetadata[]> {
    const allFiles = await db.select().from(files).where(eq(files.userId, userId));

    const descendants: FileMetadata[] = [];

    const collect = (parentId: string) => {
      for (const child of allFiles.filter((f) => f.parentId === parentId)) {
        descendants.push(this.mapToFileMetadata(child));
        if (child.isDirectory) collect(child.id);
      }
    };

    collect(fileId);
    return descendants;
  }

  async search(query: string, userId: string): Promise<FileMetadata[]> {
    const term = `%${query}%`;
    const results = await db
      .select()
      .from(files)
      .where(and(this.activeFile(userId), or(like(files.name, term), like(files.path, term))))
      .orderBy(desc(files.isDirectory), files.name);
    return results.map((f) => this.mapToFileMetadata(f));
  }

  async getDeleted(userId: string): Promise<FileMetadata[]> {
    const results = await db
      .select()
      .from(files)
      .where(and(eq(files.userId, userId), isNotNull(files.deletedAt)))
      .orderBy(desc(files.deletedAt));
    return results.map((f) => this.mapToFileMetadata(f));
  }

  //mutations

  async update(
    fileId: string,
    data: {
      name?: string;
      path?: string;
      parentId?: string | null;
      size?: number;
      storageKey?: string;
    }
  ): Promise<FileMetadata> {
    const [updated] = await db
      .update(files)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(files.id, fileId))
      .returning();
    if (!updated) throw new Error('File not found');
    return this.mapToFileMetadata(updated);
  }

  async softDelete(fileId: string, userId: string): Promise<boolean> {
    const [deleted] = await db
      .update(files)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(files.id, fileId), this.activeFile(userId)))
      .returning();

    return !!deleted;
  }

  async hardDelete(fileId: string, userId: string): Promise<boolean> {
    const result = await db
      .delete(files)
      .where(and(eq(files.id, fileId), eq(files.userId, userId)))
      .returning();

    return result.length > 0;
  }

  async restore(fileId: string, userId: string): Promise<FileMetadata> {
    const [restored] = await db
      .update(files)
      .set({ deletedAt: null, updatedAt: new Date() })
      .where(and(eq(files.id, fileId), eq(files.userId, userId), isNotNull(files.deletedAt)))
      .returning();
    if (!restored) throw new Error('Failed to restore file');
    return this.mapToFileMetadata(restored);
  }

  //Access control

  async canUserAccessFile(fileId: string, userId: string): Promise<boolean> {
    const [file] = await db
      .select()
      .from(files)
      .where(and(eq(files.id, fileId), isNull(files.deletedAt)));

    if (!file) return false;

    if (file.userId === userId) return true;

    const [user] = await db.select({ role: users.role }).from(users).where(eq(users.id, userId));
    if (user?.role === 'TEACHER') return true;

    const [share] = await db
      .select({ id: fileShares.id })
      .from(fileShares)
      .where(and(eq(fileShares.fileId, fileId), this.activeShare()));
    return !!share;
  }

  //Private helpers

  //Owned by userId and not soft-deleted
  private activeFile(userId: string) {
    return and(eq(files.userId, userId), isNull(files.deletedAt));
  }

  //Share link exists and has not expired
  private activeShare() {
    return or(isNull(fileShares.expiresAt), gt(fileShares.expiresAt, new Date()));
  }

  private mapToFileMetadata(file: FileRow): FileMetadata {
    return {
      id: file.id,
      userId: file.userId,
      name: file.name,
      path: file.path,
      parentId: file.parentId,
      isDirectory: file.isDirectory,
      mimeType: file.mimeType,
      size: file.size,
      storageKey: file.storageKey,
      deletedAt: file.deletedAt,
      createdAt: file.createdAt,
      updatedAt: file.updatedAt,
    };
  }
}

export const fileRepository = new FileRepository();
