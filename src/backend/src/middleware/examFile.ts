/* eslint-disable @typescript-eslint/no-explicit-any */
import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { getActiveClosedBookExam } from './exam';

export async function examFileGuard(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const user = req.user;
    if (!user || user.role !== 'STUDENT') return next();

    const blockedExamId = await getActiveClosedBookExam(user.userId);
    if (!blockedExamId) return next();

    res.status(403).json({
      success: false,
      error: 'File access is not allowed during a closed-book exam',
      examId: blockedExamId,
    });
  } catch (err: any) {
    console.warn(`Check failed: ${err.message}`);
    next();
  }
}
