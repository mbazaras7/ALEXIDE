/* eslint-disable @typescript-eslint/no-explicit-any */
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { gradeService } from '../services/grade';
import { ResponseHandler } from '../utils/response';
import { SourceType } from '../types/grade';

export class TeacherGradeController {
  //POST /api/backend/teacher/grades/class/:classId
  async recordGrade(req: AuthRequest, res: Response): Promise<void> {
    try {
      const teacherId = req.user!.userId;
      const classId = req.params.classId as string;
      const { studentId, sourceType, sourceId, score, maxScore } = req.body;

      const grade = await gradeService.recordGrade(teacherId, {
        studentId,
        classId,
        sourceType,
        sourceId,
        score,
        maxScore,
      });

      ResponseHandler.created(res, grade, 'Grade recorded successfully');
    } catch (error: any) {
      console.error('Record grade error:', error);
      if (
        error.message === 'Class not found' ||
        error.message === 'Student is not enrolled in this class'
      ) {
        ResponseHandler.notFound(res, error.message);
        return;
      }
      if (error.message.includes('Score') || error.message.includes('Max score')) {
        ResponseHandler.badRequest(res, error.message);
        return;
      }
      ResponseHandler.serverError(res, error.message);
    }
  }

  //PATCH /api/backend/teacher/grades/:gradeId
  async updateGrade(req: AuthRequest, res: Response): Promise<void> {
    try {
      const teacherId = req.user!.userId;
      const gradeId = req.params.gradeId as string;
      const { score, maxScore } = req.body;

      const updated = await gradeService.updateGrade(gradeId, teacherId, {
        score,
        maxScore,
      });

      ResponseHandler.success(res, updated, 'Grade updated successfully');
    } catch (error: any) {
      console.error('Update grade error:', error);
      if (error.message === 'Grade not found') {
        ResponseHandler.notFound(res, error.message);
        return;
      }
      if (
        error.message.includes('Score') ||
        error.message.includes('Max score') ||
        error.message.includes('At least one field')
      ) {
        ResponseHandler.badRequest(res, error.message);
        return;
      }
      ResponseHandler.serverError(res, error.message);
    }
  }

  //DELETE /api/backend/teacher/grades/:gradeId
  async deleteGrade(req: AuthRequest, res: Response): Promise<void> {
    try {
      const teacherId = req.user!.userId;
      const gradeId = req.params.gradeId as string;

      await gradeService.deleteGrade(gradeId, teacherId);

      ResponseHandler.success(res, null, 'Grade deleted successfully');
    } catch (error: any) {
      console.error('Delete grade error:', error);
      if (error.message === 'Grade not found') {
        ResponseHandler.notFound(res, error.message);
        return;
      }
      ResponseHandler.serverError(res, error.message);
    }
  }

  //GET /api/backend/teacher/grades/class/:classId
  async getGradesByClass(req: AuthRequest, res: Response): Promise<void> {
    try {
      const teacherId = req.user!.userId;
      const classId = req.params.classId as string;

      const gradesList = await gradeService.getGradesByClass(teacherId, classId);

      ResponseHandler.success(res, gradesList);
    } catch (error: any) {
      console.error('Get grades by class error:', error);
      if (error.message === 'Class not found') {
        ResponseHandler.notFound(res, error.message);
        return;
      }
      ResponseHandler.serverError(res, error.message);
    }
  }

  //GET /api/backend/teacher/grades/class/:classId/source?sourceId=x&sourceType=ASSIGNMENT
  async getGradesBySource(req: AuthRequest, res: Response): Promise<void> {
    try {
      const teacherId = req.user!.userId;
      const classId = req.params.classId as string;
      const { sourceId, sourceType } = req.query;

      const gradesList = await gradeService.getGradesBySource(
        teacherId,
        sourceId as string,
        sourceType as SourceType,
        classId
      );

      ResponseHandler.success(res, gradesList);
    } catch (error: any) {
      console.error('Get grades by source error:', error);
      if (error.message === 'Class not found') {
        ResponseHandler.notFound(res, error.message);
        return;
      }
      ResponseHandler.serverError(res, error.message);
    }
  }

  //POST /api/backend/teacher/grades/class/:classId/release
  async releaseGrades(req: AuthRequest, res: Response): Promise<void> {
    try {
      const teacherId = req.user!.userId;
      const classId = req.params.classId as string;
      const { sourceType, sourceId } = req.body;

      const result = await gradeService.releaseGrades(teacherId, {
        sourceType,
        sourceId,
        classId,
      });

      ResponseHandler.success(res, result, `${result.released} grade(s) released successfully`);
    } catch (error: any) {
      console.error('Release grades error:', error);
      if (error.message === 'Class not found') {
        ResponseHandler.notFound(res, error.message);
        return;
      }
      if (error.message === 'No grades found to release') {
        ResponseHandler.notFound(res, error.message);
        return;
      }
      ResponseHandler.serverError(res, error.message);
    }
  }

  //GET /api/backend/teacher/grades/class/:classId/overview
  async getClassOverview(req: AuthRequest, res: Response): Promise<void> {
    try {
      const teacherId = req.user!.userId;
      const classId = req.params.classId as string;

      const overview = await gradeService.getClassOverview(teacherId, classId);

      ResponseHandler.success(res, overview);
    } catch (error: any) {
      if (error.message === 'Class not found') {
        ResponseHandler.notFound(res, error.message);
        return;
      }
      ResponseHandler.serverError(res, error.message);
    }
  }

  //GET /api/backend/teacher/grades/class/:classId/student/:studentId
  async getStudentOverview(req: AuthRequest, res: Response): Promise<void> {
    try {
      const teacherId = req.user!.userId;
      const classId = req.params.classId as string;
      const studentId = req.params.studentId as string;

      const overview = await gradeService.getStudentOverview(teacherId, classId, studentId);

      ResponseHandler.success(res, overview);
    } catch (error: any) {
      if (error.message === 'Class not found') {
        ResponseHandler.notFound(res, error.message);
        return;
      }
      if (error.message === 'Student is not enrolled in this class') {
        ResponseHandler.notFound(res, error.message);
        return;
      }
      ResponseHandler.serverError(res, error.message);
    }
  }
}

export const teacherGradeController = new TeacherGradeController();
