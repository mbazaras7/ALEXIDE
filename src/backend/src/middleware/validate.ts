import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { ResponseHandler } from '../utils/response';

//Generic validation middleware using Zod schemas
export const validate = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse({
        body: req.body,
        query: req.query,
        params: req.params,
      });

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        }));
        return ResponseHandler.badRequest(res, 'Validation failed', errors);
      }

      return ResponseHandler.error(res, 'Validation error', 500);
    }
  };
};
