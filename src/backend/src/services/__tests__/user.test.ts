import { describe, it, expect, afterAll, beforeEach } from '@jest/globals';
import { userService } from '../user';
import db from '../../db';
import { users } from '../../db/schema';
import { eq } from 'drizzle-orm';

describe('UserService', () => {
  const testUser = {
    email: 'test@gmail.com',
    password: 'TestPass123',
    name: 'Test User',
    role: 'STUDENT' as const,
  };

  beforeEach(async () => {
    await db.delete(users).where(eq(users.email, testUser.email));
  });

  afterAll(async () => {
    await db.delete(users).where(eq(users.email, testUser.email));
  });

  describe('createUser', () => {
    it('should create a new user successfully', async () => {
      const user = await userService.createUser(
        testUser.email,
        testUser.password,
        testUser.name,
        testUser.role
      );
      expect(user.email).toBe(testUser.email.toLowerCase());
      expect(user.name).toBe(testUser.name);
      expect(user.role).toBe(testUser.role);
      expect(user.id).toBeDefined();
      expect(user.createdAt).toBeDefined();
    });

    it('should throw error if email already exists', async () => {
      await userService.createUser(testUser.email, testUser.password, testUser.name, testUser.role);
      await expect(
        userService.createUser(testUser.email, 'DifferentPass123', 'Different Name', 'TEACHER')
      ).rejects.toThrow();
    });
  });

  describe('findByEmail', () => {
    it('should find existing user by email', async () => {
      await userService.createUser(testUser.email, testUser.password, testUser.name, testUser.role);
      const user = await userService.findByEmail(testUser.email);
      expect(user).not.toBeNull();
      expect(user?.email).toBe(testUser.email.toLowerCase());
    });

    it('should return null if user does not exist', async () => {
      const user = await userService.findByEmail('nonexistent@gmail.com');
      expect(user).toBeNull();
    });

    it('should find user case-insensitively', async () => {
      await userService.createUser(testUser.email, testUser.password, testUser.name, testUser.role);
      const user = await userService.findByEmail('TEST@GMAIL.COM');
      expect(user).not.toBeNull();
    });
  });

  describe('validateUser', () => {
    beforeEach(async () => {
      await userService.createUser(testUser.email, testUser.password, testUser.name, testUser.role);
    });

    it('should validate user with correct credentials', async () => {
      const result = await userService.validateUser(testUser.email, testUser.password);
      expect(result).not.toBeNull();
      expect(result?.email).toBe(testUser.email.toLowerCase());
      expect(result?.role).toBe(testUser.role);
      expect(result?.userId).toBeDefined();
    });

    it('should return null for incorrect password', async () => {
      const result = await userService.validateUser(testUser.email, 'wrongPassword123');
      expect(result).toBeNull();
    });

    it('should return null for non-existent email', async () => {
      const result = await userService.validateUser('nonexistent@gmail.com', testUser.password);
      expect(result).toBeNull();
    });
  });
});
