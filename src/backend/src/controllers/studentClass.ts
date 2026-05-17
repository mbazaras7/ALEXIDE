/* eslint-disable @typescript-eslint/no-explicit-any */
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { classService } from '../services/class';
import { ResponseHandler } from '../utils/response';

export class StudentClassController {
  //POST /api/backend/student/classes/join
  async joinClass(req: AuthRequest, res: Response): Promise<void> {
    try {
      const studentId = req.user!.userId;
      const { joinCode } = req.body;

      const enrollment = await classService.joinClass(studentId, joinCode);

      ResponseHandler.created(res, enrollment, 'Successfully joined class');
    } catch (error: any) {
      console.error('Join class error:', error);
      if (
        error.message === 'Invalid join code' ||
        error.message === 'You are already enrolled in this class' ||
        error.message === 'Teachers cannot join their own class as a student'
      ) {
        ResponseHandler.error(res, error.message, 400);
        return;
      }
      ResponseHandler.error(res, error.message);
    }
  }

  //DELETE /api/backend/student/classes/:classId/leave
  async leaveClass(req: AuthRequest, res: Response): Promise<void> {
    try {
      const studentId = req.user!.userId;
      const classId = req.params.classId as string;

      await classService.leaveClass(studentId, classId);

      ResponseHandler.success(res, null, 'Successfully left class');
    } catch (error: any) {
      console.error('Leave class error:', error);
      if (error.message === 'You are not enrolled in this class') {
        ResponseHandler.notFound(res, error.message);
        return;
      }
      ResponseHandler.error(res, error.message);
    }
  }

  //GET /api/backend/student/classes
  async getEnrolledClasses(req: AuthRequest, res: Response): Promise<void> {
    try {
      const studentId = req.user!.userId;

      const classes = await classService.getEnrolledClasses(studentId);

      ResponseHandler.success(res, classes);
    } catch (error: any) {
      console.error('Get enrolled classes error:', error);
      ResponseHandler.error(res, error.message);
    }
  }

  //GET /api/backend/student/classes/:classId
  async getEnrolledClass(req: AuthRequest, res: Response): Promise<void> {
    try {
      const studentId = req.user!.userId;
      const classId = req.params.classId as string;

      const classData = await classService.getEnrolledClass(studentId, classId);

      ResponseHandler.success(res, classData);
    } catch (error: any) {
      console.error('Get enrolled class error:', error);
      if (error.message === 'Class not found') {
        ResponseHandler.notFound(res, error.message);
        return;
      }
      ResponseHandler.error(res, error.message);
    }
  }

  //GET /api/backend/student/classes/:classId/students
  async getClassStudents(req: AuthRequest, res: Response): Promise<void> {
    try {
      const studentId = req.user!.userId;
      const classId = req.params.classId as string;

      const students = await classService.getClassStudents(classId, studentId, 'STUDENT');

      ResponseHandler.success(res, students);
    } catch (error: any) {
      console.error('Get class students error:', error);
      if (error.message === 'Class not found') {
        ResponseHandler.notFound(res, error.message);
        return;
      }
      ResponseHandler.error(res, error.message);
    }
  }
}

export const studentClassController = new StudentClassController();
