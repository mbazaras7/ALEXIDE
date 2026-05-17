import { describe, it, expect, afterAll, beforeEach } from '@jest/globals';
import { userRepository } from '../user';
import db from '../../db';
import { users } from '../../db/schema';
import { eq } from 'drizzle-orm';

describe('UserRepository', () => {
  const testEmail = 'repo-test@gmail.com';

  beforeEach(async () => {
    await db.delete(users).where(eq(users.email, testEmail));
  });

  afterAll(async () => {
    await db.delete(users).where(eq(users.email, testEmail));
  });

  describe('create', () => {
    it('should create a user and return public fields only', async () => {
      const user = await userRepository.create(testEmail, 'hashedpw', 'Repo User', 'STUDENT');
      expect(user.id).toBeDefined();
      expect(user.email).toBe(testEmail);
      expect(user.name).toBe('Repo User');
      expect(user.role).toBe('STUDENT');
      expect((user as any).password).toBeUndefined();
    });
  });

  describe('findByEmail', () => {
    it('should find an existing user by email', async () => {
      await userRepository.create(testEmail, 'hashedpw', 'Repo User', 'STUDENT');
      const result = await userRepository.findByEmail(testEmail);
      expect(result).not.toBeNull();
      expect(result?.email).toBe(testEmail);
    });

    it('should return null for unknown email', async () => {
      const result = await userRepository.findByEmail('nobody@gmail.com');
      expect(result).toBeNull();
    });

    it('should find user case-insensitively', async () => {
      await userRepository.create(testEmail, 'hashedpw', 'Repo User', 'STUDENT');
      const result = await userRepository.findByEmail(testEmail.toUpperCase());
      expect(result).not.toBeNull();
    });
  });

  describe('findById', () => {
    it('should find user by id', async () => {
      const created = await userRepository.create(testEmail, 'hashedpw', 'Repo User', 'STUDENT');
      const result = await userRepository.findById(created.id);
      expect(result).not.toBeNull();
      expect(result?.id).toBe(created.id);
    });

    it('should return null for unknown id', async () => {
      const result = await userRepository.findById('00000000-0000-0000-0000-000000000000');
      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('should update user name', async () => {
      const created = await userRepository.create(testEmail, 'hashedpw', 'Old Name', 'STUDENT');
      const result = await userRepository.update(created.id, { name: 'New Name' });
      expect(result?.name).toBe('New Name');
    });
  });

  describe('delete', () => {
    it('should delete user', async () => {
      const created = await userRepository.create(testEmail, 'hashedpw', 'Del User', 'STUDENT');
      await userRepository.delete(created.id);
      const result = await userRepository.findById(created.id);
      expect(result).toBeNull();
    });
  });
});
