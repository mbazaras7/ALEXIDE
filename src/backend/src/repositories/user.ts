import db from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';
import type { UserData, UserPublic } from '../types/user';

export class UserRepository {
  //Queries

  async findById(userId: string): Promise<UserData | null> {
    const [row] = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(eq(users.id, userId));
    return row ?? null;
  }

  async findByEmail(email: string): Promise<UserData | null> {
    const [row] = await db.select().from(users).where(eq(users.email, email.toLowerCase().trim()));
    return row ?? null;
  }

  //Mutations

  async create(
    email: string,
    password: string,
    name: string,
    role: 'STUDENT' | 'TEACHER' | 'ADMIN'
  ): Promise<UserPublic> {
    const [row] = await db
      .insert(users)
      .values({ email: email.toLowerCase().trim(), password, name, role })
      .returning({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        createdAt: users.createdAt,
      });
    return row;
  }

  async update(userId: string, updates: Partial<{ name: string }>): Promise<UserData | null> {
    const [updated] = await db
      .update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      });
    return updated ?? null;
  }

  async delete(userId: string): Promise<void> {
    await db.delete(users).where(eq(users.id, userId));
  }
}

export const userRepository = new UserRepository();
