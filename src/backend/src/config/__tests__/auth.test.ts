import { describe, it, expect } from '@jest/globals';
import { JwtService, JwtPayload } from '../auth';

describe('JwtService', () => {
  const testPayload: JwtPayload = {
    userId: 'test-user-id-123',
    email: 'test@gmail.com',
    role: 'STUDENT',
  };

  describe('generateToken', () => {
    it('should generate a valid JWT token', () => {
      const token = JwtService.generateToken(testPayload);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); //JWT has 3 parts
    });

    it('should generate different tokens for different payloads', () => {
      const token1 = JwtService.generateToken(testPayload);
      const token2 = JwtService.generateToken({
        ...testPayload,
        userId: 'different-user-id',
      });

      expect(token1).not.toBe(token2);
    });
  });

  describe('verifyToken', () => {
    it('should verify a valid token', () => {
      const token = JwtService.generateToken(testPayload);
      const verified = JwtService.verifyToken(token);

      expect(verified).toBeDefined();
      expect(verified?.userId).toBe(testPayload.userId);
      expect(verified?.email).toBe(testPayload.email);
      expect(verified?.role).toBe(testPayload.role);
    });

    it('should return null for invalid token', () => {
      const verified = JwtService.verifyToken('invalid.token.here');
      expect(verified).toBeNull();
    });
  });

  describe('Token expiration', () => {
    it('should include expiration claim in token', () => {
      const token = JwtService.generateToken(testPayload);
      const parts = token.split('.');
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());

      expect(payload.exp).toBeDefined();
      expect(payload.exp).toBeGreaterThan(Date.now() / 1000);
    });
  });
});
