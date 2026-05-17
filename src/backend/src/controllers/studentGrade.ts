/* eslint-disable @typescript-eslint/no-explicit-any */
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { gradeService } from '../services/grade';
import { ResponseHandler } from '../utils/response';
import { SourceType } from '../types/grade';

export class StudentGradeController {
  //GET /api/backend/student/grades
  async getMyGrades(req: AuthRequest, res: Response): Promise<void> {
    try {
      const studentId = req.user!.userId;

      const gradesList = await gradeService.getMyGrades(studentId);

      ResponseHandler.success(res, gradesList);
    } catch (error: any) {
      console.error('Get my grades error:', error);
      ResponseHandler.serverError(res, error.message);
    }
  }

  //GET /api/backend/student/grades/class/:classId
  async getMyGradesForClass(req: AuthRequest, res: Response): Promise<void> {
    try {
      const studentId = req.user!.userId;
      const classId = req.params.classId as string;

      const gradesList = await gradeService.getMyGradesForClass(studentId, classId);

      ResponseHandler.success(res, gradesList);
    } catch (error: any) {
      console.error('Get my grades for class error:', error);
      if (error.message === 'You are not enrolled in this class') {
        ResponseHandler.forbidden(res, error.message);
        return;
      }
      ResponseHandler.serverError(res, error.message);
    }
  }

  //GET /api/backend/student/grades/:gradeId
  async getMyGradeById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const studentId = req.user!.userId;
      const gradeId = req.params.gradeId as string;

      const grade = await gradeService.getMyGradeById(studentId, gradeId);

      ResponseHandler.success(res, grade);
    } catch (error: any) {
      console.error('Get grade by id error:', error);
      if (error.message === 'Grade not found') {
        ResponseHandler.notFound(res, error.message);
        return;
      }
      ResponseHandler.serverError(res, error.message);
    }
  }

  //GET /api/backend/student/grades/class/:classId/stats
  async getMyStatsForClass(req: AuthRequest, res: Response): Promise<void> {
    try {
      const studentId = req.user!.userId;
      const classId = req.params.classId as string;

      const stats = await gradeService.getMyStatsForClass(studentId, classId);

      ResponseHandler.success(res, stats);
    } catch (error: any) {
      console.error('Get grade stats error:', error);
      if (error.message === 'You are not enrolled in this class') {
        ResponseHandler.forbidden(res, error.message);
        return;
      }
      ResponseHandler.serverError(res, error.message);
    }
  }

  //GET /api/backend/student/grades/summary
  async getMyClassSummaries(req: AuthRequest, res: Response): Promise<void> {
    try {
      const studentId = req.user!.userId;

      const summaries = await gradeService.getMyClassSummaries(studentId);

      ResponseHandler.success(res, summaries);
    } catch (error: any) {
      console.error('Get class summaries error:', error);
      ResponseHandler.serverError(res, error.message);
    }
  }

  //GET /api/backend/student/grades/class/:classId/filter?sourceType=ASSIGNMENT
  async getMyGradesByType(req: AuthRequest, res: Response): Promise<void> {
    try {
      const studentId = req.user!.userId;
      const classId = req.params.classId as string;
      const sourceType = req.query.sourceType as string;

      const grades = await gradeService.getMyGradesByType(
        studentId,
        classId,
        sourceType as SourceType
      );

      ResponseHandler.success(res, grades);
    } catch (error: any) {
      console.error('Get grades by type error:', error);
      if (error.message === 'You are not enrolled in this class') {
        ResponseHandler.forbidden(res, error.message);
        return;
      }
      ResponseHandler.serverError(res, error.message);
    }
  }
}

export const studentGradeController = new StudentGradeController();
