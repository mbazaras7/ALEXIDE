/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { submissionService } from '../services/submission';
import { ResponseHandler } from '../utils/response';
import { submissionRepository } from '../repositories/submission';

export class StudentSubmissionController {
  //POST /api/backend/student/submit/assignments/:assignmentId
  async submitAssignment(req: AuthRequest, res: Response): Promise<void> {
    try {
      const studentId = req.user!.userId;
      const assignmentId = req.params.assignmentId as string;
      const { code, storageKey } = req.body;

      const submission = await submissionService.submitAssignment(
        studentId,
        assignmentId,
        code,
        storageKey
      );
      ResponseHandler.created(res, submission, 'Assignment submitted successfully');
    } catch (error: any) {
      if (error.message === 'Assignment not found') {
        ResponseHandler.notFound(res, error.message);
        return;
      }
      if (
        error.message === 'Assignment is not available for submission' ||
        error.message === 'You are not enrolled in this class' ||
        error.message === 'Assignment due date has passed'
      ) {
        ResponseHandler.error(res, error.message, 400);
        return;
      }
      ResponseHandler.serverError(res, 'Failed to submit assignment');
    }
  }

  //GET /api/backend/student/submit/assignments/:assignmentId
  async getMySubmission(req: AuthRequest, res: Response): Promise<void> {
    try {
      const studentId = req.user!.userId;
      const assignmentId = req.params.assignmentId as string;

      const submission = await submissionService.getMySubmission(studentId, assignmentId);
      if (!submission) {
        ResponseHandler.notFound(res, 'No submission found');
        return;
      }
      ResponseHandler.success(res, submission);
    } catch (error: any) {
      ResponseHandler.serverError(res, 'Failed to retrieve submission');
    }
  }

  //GET /api/backend/student/submit/:submissionId
  async getSubmissionById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const studentId = req.user!.userId;
      const submissionId = req.params.submissionId as string;

      const submission = await submissionService.getSubmissionAsStudent(submissionId, studentId);
      ResponseHandler.success(res, submission);
    } catch (error: any) {
      if (error.message === 'Submission not found') {
        ResponseHandler.notFound(res, error.message);
        return;
      }
      ResponseHandler.serverError(res, 'Failed to retrieve submission');
    }
  }

  //GET /api/backend/student/submit/classes/:classId
  async getMyClassSubmissions(req: AuthRequest, res: Response): Promise<void> {
    try {
      const studentId = req.user!.userId;
      const classId = req.params.classId as string;

      const result = await submissionService.getMySubmissionsByClass(studentId, classId);
      ResponseHandler.success(res, result);
    } catch (error: any) {
      if (error.message === 'You are not enrolled in this class') {
        ResponseHandler.error(res, error.message, 400);
        return;
      }
      ResponseHandler.serverError(res, 'Failed to retrieve submissions');
    }
  }

  //GET /api/backend/student/submit/classes/:classId/assignments/:assignmentId
  async getMySubmissionByClassAndAssignment(req: AuthRequest, res: Response): Promise<void> {
    try {
      const studentId = req.user!.userId;
      const assignmentId = req.params.assignmentId as string;
      const classId = req.params.classId as string;

      const submission = await submissionService.getMySubmissionByClassAndAssignment(
        studentId,
        classId,
        assignmentId
      );

      if (!submission) {
        ResponseHandler.notFound(res, 'No submission found');
        return;
      }
      ResponseHandler.success(res, submission);
    } catch (error: any) {
      if (error.message === 'You are not enrolled in this class') {
        ResponseHandler.error(res, error.message, 400);
        return;
      }
      if (error.message === 'Assignment not found') {
        ResponseHandler.notFound(res, error.message);
        return;
      }
      ResponseHandler.serverError(res, 'Failed to retrieve submission');
    }
  }

  //GET /api/backend/student/submit/:submissionId/feedback
  async getSubmissionFeedback(req: AuthRequest, res: Response): Promise<void> {
    try {
      const studentId = req.user!.userId;
      const submissionId = req.params.submissionId as string;

      const result = await submissionRepository.findWithReleasedFeedback(submissionId, studentId);
      if (!result) {
        ResponseHandler.notFound(res, 'Submission not found');
        return;
      }
      ResponseHandler.success(res, result);
    } catch (error: any) {
      ResponseHandler.serverError(res, 'Failed to retrieve feedback');
    }
  }
}

export const studentSubmissionController = new StudentSubmissionController();
