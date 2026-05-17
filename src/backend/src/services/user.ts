import bcrypt from 'bcrypt';
import type { JwtPayload } from '../config/auth';
import { userRepository } from '../repositories/user';
import type { UserPublic, UserData } from '../types/user';

const BCRYPT_ROUNDS = 10;

export class UserService {
  async createUser(
    email: string,
    password: string,
    name: string,
    role: 'STUDENT' | 'TEACHER' | 'ADMIN'
  ): Promise<UserPublic> {
    const hashedPassword = await this.hashPassword(password);
    return userRepository.create(email, hashedPassword, name, role);
  }

  async findByEmail(email: string): Promise<UserData | null> {
    return userRepository.findByEmail(email);
  }

  async findById(userId: string): Promise<UserData | null> {
    return userRepository.findById(userId);
  }

  async validateUser(email: string, password: string): Promise<JwtPayload | null> {
    const user = await this.findByEmail(email);
    if (!user) {
      return null;
    }

    const isValid = await this.verifyPassword(password, user.password as string);
    if (!isValid) {
      return null;
    }

    return { userId: user.id, email: user.email, role: user.role };
  }

  async updateUser(userId: string, updates: Partial<{ name: string }>): Promise<UserData | null> {
    return userRepository.update(userId, updates);
  }

  async deleteUser(userId: string): Promise<void> {
    return userRepository.delete(userId);
  }

  //Private helpers

  private async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, BCRYPT_ROUNDS);
  }

  private async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }
}

export const userService = new UserService();
