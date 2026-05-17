import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validate } from '../validate';

//Tests Zod schema validation middleware
describe('Validation Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {
      body: {},
      query: {},
      params: {},
    };
    mockRes = {
      status: jest.fn().mockReturnThis() as any,
      json: jest.fn().mockReturnThis() as any,
    };
    mockNext = jest.fn();
  });

  describe('validate', () => {
    it('should pass validation for valid data', () => {
      const schema = z.object({
        body: z.object({
          email: z.string().email(),
          password: z.string().min(8),
        }),
      });

      mockReq.body = {
        email: 'test@gmail.com',
        password: 'SecurePass123',
      };

      const middleware = validate(schema);
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should reject invalid email format', () => {
      const schema = z.object({
        body: z.object({
          email: z.string().email(),
        }),
      });

      mockReq.body = {
        email: 'invalid-email',
      };

      const middleware = validate(schema);
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Validation failed',
          errors: expect.arrayContaining([
            expect.objectContaining({
              field: 'body.email',
            }),
          ]),
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject missing required fields', () => {
      const schema = z.object({
        body: z.object({
          email: z.string(),
          password: z.string(),
        }),
      });

      mockReq.body = {
        email: 'test@gmail.com',
        //password is missing
      };

      const middleware = validate(schema);
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          errors: expect.arrayContaining([
            expect.objectContaining({
              field: 'body.password',
            }),
          ]),
        })
      );
    });

    it('should validate query parameters', () => {
      const schema = z.object({
        query: z.object({
          page: z.string(),
          limit: z.string(),
        }),
      });

      mockReq.query = {
        page: '1',
        limit: '10',
      };

      const middleware = validate(schema);
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should return multiple validation errors', () => {
      const schema = z.object({
        body: z.object({
          email: z.string().email(),
          password: z.string().min(8),
          name: z.string().min(1),
        }),
      });

      mockReq.body = {
        email: 'invalid',
        password: 'short',
        name: '',
      };

      const middleware = validate(schema);
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          errors: expect.arrayContaining([
            expect.objectContaining({ field: 'body.email' }),
            expect.objectContaining({ field: 'body.password' }),
            expect.objectContaining({ field: 'body.name' }),
          ]),
        })
      );
    });
  });
});
