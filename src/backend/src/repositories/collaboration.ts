import db from '../db';
import { collaborationStates } from '../db/schema';
import { eq } from 'drizzle-orm';
import type { CollaborationState } from '../types/collaboration';

export class CollaborationRepository {
  //Queries

  async findByFileId(fileId: string): Promise<CollaborationState | null> {
    const [state] = await db
      .select()
      .from(collaborationStates)
      .where(eq(collaborationStates.fileId, fileId));

    return state ?? null;
  }

  //Mutations

  async upsert(fileId: string, stateVector: string): Promise<CollaborationState> {
    const existing = await this.findByFileId(fileId);

    if (existing) {
      const [updated] = await db
        .update(collaborationStates)
        .set({ stateVector, updatedAt: new Date() })
        .where(eq(collaborationStates.fileId, fileId))
        .returning();
      return updated;
    }

    const [created] = await db
      .insert(collaborationStates)
      .values({ fileId, stateVector })
      .returning();
    return created;
  }

  async delete(fileId: string): Promise<void> {
    await db.delete(collaborationStates).where(eq(collaborationStates.fileId, fileId));
  }
}

export const collaborationRepository = new CollaborationRepository();
