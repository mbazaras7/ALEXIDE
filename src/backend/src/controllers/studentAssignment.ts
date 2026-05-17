/* eslint-disable @typescript-eslint/no-explicit-any */
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { assignmentService } from '../services/assignment';
import { ResponseHandler } from '../utils/response';

export class StudentAssignmentController {
  //GET /api/backend/student/assignments
  async getMyAssignments(req: AuthRequest, res: Response): Promise<void> {
    try {
      const studentId = req.user!.userId;

      const assignmentList = await assignmentService.getPublishedAssignmentsForStudent(studentId);

      ResponseHandler.success(res, assignmentList);
    } catch (error: any) {
      console.error('Get student assignments error:', error);
      ResponseHandler.serverError(res, error.message);
    }
  }

  //GET /api/backend/student/assignments/:assignmentId
  async getAssignment(req: AuthRequest, res: Response): Promise<void> {
    try {
      const studentId = req.user!.userId;
      const assignmentId = req.params.assignmentId as string;

      const assignment = await assignmentService.getPublishedAssignment(assignmentId, studentId);

      ResponseHandler.success(res, assignment);
    } catch (error: any) {
      console.error('Get assignment error:', error);
      if (error.message === 'Assignment not found') {
        ResponseHandler.notFound(res, error.message);
        return;
      }
      ResponseHandler.serverError(res, error.message);
    }
  }

  //GET /api/backend/student/assignments/class/:classId
  async getClassAssignments(req: AuthRequest, res: Response): Promise<void> {
    try {
      const studentId = req.user!.userId;
      const classId = req.params.classId as string;

      const assignmentList = await assignmentService.getPublishedAssignmentsByClass(
        classId,
        studentId
      );

      ResponseHandler.success(res, assignmentList);
    } catch (error: any) {
      console.error('Get class assignments error:', error);
      if (error.message === 'Class not found') {
        ResponseHandler.notFound(res, error.message);
        return;
      }
      ResponseHandler.serverError(res, error.message);
    }
  }
}

export const studentAssignmentController = new StudentAssignmentController();
