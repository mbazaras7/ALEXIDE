import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { Request, Response, NextFunction } from 'express';
import { authenticate, requireRole, requireTeacher, requireStudent } from '../auth';
import { JwtService } from '../../config/auth';

describe('Auth Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {
      headers: {},
    };

    mockRes = {
      status: jest.fn().mockReturnThis() as any,
      json: jest.fn().mockReturnThis() as any,
    };
    mockNext = jest.fn();
  });

  describe('authenticate', () => {
    it('should authenticate valid token', () => {
      const payload = {
        userId: 'test-user-123',
        email: 'test@dcu.ie',
        role: 'STUDENT' as const,
      };
      const token = JwtService.generateToken(payload);

      mockReq.headers = {
        authorization: `Bearer ${token}`,
      };

      authenticate(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect((mockReq as any).user).toEqual(expect.objectContaining(payload));
    });

    it('should reject missing Authorization header', () => {
      mockReq.headers = {};

      authenticate(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Missing or invalid Authorization header',
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject incorrect Authorization header', () => {
      mockReq.headers = {
        authorization: 'NotBearer token123',
      };

      authenticate(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject invalid token', () => {
      mockReq.headers = {
        authorization: 'Bearer invalid.token.here',
      };

      authenticate(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Invalid or expired token',
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject token without Bearer prefix', () => {
      const payload = {
        userId: 'test-user-123',
        email: 'test@dcu.ie',
        role: 'STUDENT' as const,
      };
      const token = JwtService.generateToken(payload);

      mockReq.headers = {
        authorization: token,
      };

      authenticate(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('requireRole', () => {
    beforeEach(() => {
      (mockReq as any).user = {
        userId: 'test-123',
        email: 'student@dcu.ie',
        role: 'STUDENT',
      };
    });

    it('should allow access for matching role', () => {
      const middleware = requireRole(['STUDENT']);
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should allow access for multiple allowed roles', () => {
      const middleware = requireRole(['STUDENT', 'TEACHER']);
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should deny access for non-matching role', () => {
      const middleware = requireRole(['TEACHER', 'ADMIN']);
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Insufficient permissions',
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should deny access if user not authenticated', () => {
      delete (mockReq as any).user;

      const middleware = requireRole(['STUDENT']);
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('requireTeacher', () => {
    it('should allow access for teacher', () => {
      (mockReq as any).user = {
        userId: 'teacher-123',
        email: 'teacher@dcu.ie',
        role: 'TEACHER',
      };

      requireTeacher(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should deny access for student', () => {
      (mockReq as any).user = {
        userId: 'student-123',
        email: 'student@dcu.ie',
        role: 'STUDENT',
      };

      requireTeacher(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('requireStudent', () => {
    it('should allow access for student', () => {
      (mockReq as any).user = {
        userId: 'student-123',
        email: 'student@dcu.ie',
        role: 'STUDENT',
      };

      requireStudent(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should deny access for teacher', () => {
      (mockReq as any).user = {
        userId: 'teacher-123',
        email: 'teacher@dcu.ie',
        role: 'TEACHER',
      };

      requireStudent(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });
});
