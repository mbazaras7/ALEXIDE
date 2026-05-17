import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

export interface JwtPayload {
  userId: string;
  email: string;
  role: 'STUDENT' | 'TEACHER' | 'ADMIN';
}

export const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-change-this';

export class JwtService {
  static generateToken(payload: JwtPayload): string {
    const secret = JWT_SECRET;

    //Use the sign method with explicit types
    const token = jwt.sign(payload, secret, { expiresIn: '24H' });
    return token;
  }

  static verifyToken(token: string): JwtPayload | null {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
      return decoded;
    } catch {
      return null;
    }
  }
}
