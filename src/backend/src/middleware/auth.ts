import { Request, Response, NextFunction } from 'express';
import { JwtService, JwtPayload } from '../config/auth';
import { ResponseHandler } from '../utils/response';

export interface AuthRequest extends Request {
  user?: JwtPayload;
}

export const authenticate = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return ResponseHandler.unauthorized(res, 'Missing or invalid Authorization header');
  }

  const token = authHeader.substring(7); // Remove "Bearer "

  const payload = JwtService.verifyToken(token);

  if (!payload) {
    return ResponseHandler.unauthorized(res, 'Invalid or expired token');
  }

  req.user = payload;
  next();
};

export const requireRole = (allowedRoles: ('STUDENT' | 'TEACHER' | 'ADMIN')[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return ResponseHandler.forbidden(res, 'Insufficient permissions');
    }
    next();
  };
};

export const requireTeacher = requireRole(['TEACHER']);
export const requireStudent = requireRole(['STUDENT']);
