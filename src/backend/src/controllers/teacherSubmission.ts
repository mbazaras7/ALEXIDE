/* eslint-disable @typescript-eslint/no-explicit-any */
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { submissionService } from '../services/submission';
import { ResponseHandler } from '../utils/response';
import { gradingService } from '../services/grading';
import { submissionRepository } from '../repositories/submission';

export class TeacherSubmissionController {
  //GET /api/backend/teacher/submit/assignments/:assignmentId
  async getAssignmentSubmissions(req: AuthRequest, res: Response): Promise<void> {
    try {
      const teacherId = req.user!.userId;
      const assignmentId = req.params.assignmentId as string;

      const result = await submissionService.getAssignmentSubmissions(assignmentId, teacherId);
      ResponseHandler.success(res, result);
    } catch (error: any) {
      if (error.message === 'Assignment not found') {
        ResponseHandler.notFound(res, error.message);
        return;
      }
      ResponseHandler.serverError(res, 'Failed to retrieve submissions');
    }
  }

  //GET /api/backend/teacher/submit/:submissionId
  async getSubmissionById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const teacherId = req.user!.userId;
      const submissionId = req.params.submissionId as string;

      const submission = await submissionService.getSubmissionAsTeacher(submissionId, teacherId);
      ResponseHandler.success(res, submission);
    } catch (error: any) {
      if (error.message === 'Submission not found') {
        ResponseHandler.notFound(res, error.message);
        return;
      }
      ResponseHandler.serverError(res, 'Failed to retrieve submission');
    }
  }

  //GET /api/backend/teacher/submit/classes/:classId
  async getClassSubmissions(req: AuthRequest, res: Response): Promise<void> {
    try {
      const teacherId = req.user!.userId;
      const classId = req.params.classId as string;

      const result = await submissionService.getClassSubmissions(classId, teacherId);
      ResponseHandler.success(res, result);
    } catch (error: any) {
      if (error.message === 'Class not found') {
        ResponseHandler.notFound(res, error.message);
        return;
      }
      ResponseHandler.serverError(res, 'Failed to retrieve submissions');
    }
  }

  //GET /api/backend/teacher/submit/classes/:classId/assignments/:assignmentId
  async getSubmissionsByClassAndAssignment(req: AuthRequest, res: Response): Promise<void> {
    try {
      const teacherId = req.user!.userId;
      const assignmentId = req.params.assignmentId as string;
      const classId = req.params.classId as string;

      const result = await submissionService.getSubmissionsByClassAndAssignment(
        teacherId,
        classId,
        assignmentId
      );
      ResponseHandler.success(res, result);
    } catch (error: any) {
      if (error.message === 'Class not found' || error.message === 'Assignment not found') {
        ResponseHandler.notFound(res, error.message);
        return;
      }
      ResponseHandler.serverError(res, 'Failed to retrieve submissions');
    }
  }

  // POST /api/backend/teacher/submit/assignments/:submissionId/regrade
  async reGradeSubmission(req: AuthRequest, res: Response): Promise<void> {
    try {
      const teacherId = req.user!.userId;
      const submissionId = req.params.submissionId as string;

      await gradingService.reGradeSubmission(submissionId, teacherId);

      ResponseHandler.success(res, null, 'Submission re-graded successfully');
    } catch (error: any) {
      if (error.message === 'Submission not found') {
        ResponseHandler.notFound(res, error.message);
        return;
      }
      if (error.message === 'Submission is already being graded') {
        ResponseHandler.error(res, error.message, 400);
        return;
      }
      ResponseHandler.serverError(res, 'Failed to re-grade submission');
    }
  }

  //GET /api/backend/teacher/submit/assignments/:assignmentId/stats
  async getAssignmentStats(req: AuthRequest, res: Response): Promise<void> {
    try {
      const teacherId = req.user!.userId;
      const assignmentId = req.params.assignmentId as string;

      const stats = await submissionService.getAssignmentStats(assignmentId, teacherId);
      ResponseHandler.success(res, stats);
    } catch (error: any) {
      if (error.message === 'Assignment not found') {
        ResponseHandler.notFound(res, error.message);
        return;
      }
      ResponseHandler.serverError(res, 'Failed to retrieve stats');
    }
  }

  //PATCH /api/backend/teacher/submit/:submissionId/feedback
  async saveFeedback(req: AuthRequest, res: Response): Promise<void> {
    try {
      const teacherId = req.user!.userId;
      const submissionId = req.params.submissionId as string;
      const { feedback } = req.body;

      await submissionService.getSubmissionAsTeacher(submissionId, teacherId);

      const updated = await submissionRepository.saveFeedback(submissionId, feedback);
      ResponseHandler.success(res, updated, 'Feedback saved successfully');
    } catch (error: any) {
      if (error.message === 'Submission not found') {
        ResponseHandler.notFound(res, error.message);
        return;
      }
      ResponseHandler.serverError(res, 'Failed to save feedback');
    }
  }

  //POST /api/backend/teacher/submit/:submissionId/feedback/adopt-ai
  async adoptAiFeedback(req: AuthRequest, res: Response): Promise<void> {
    try {
      const teacherId = req.user!.userId;
      const submissionId = req.params.submissionId as string;

      const submission = await submissionService.getSubmissionAsTeacher(submissionId, teacherId);

      if (!submission.aiFeedback) {
        ResponseHandler.error(res, 'No AI feedback available for this submission', 400);
        return;
      }

      const updated = await submissionRepository.adoptAiFeedback(submissionId);
      ResponseHandler.success(res, updated, 'AI feedback adopted successfully');
    } catch (error: any) {
      if (error.message === 'Submission not found') {
        ResponseHandler.notFound(res, error.message);
        return;
      }
      ResponseHandler.serverError(res, 'Failed to adopt AI feedback');
    }
  }
}

export const teacherSubmissionController = new TeacherSubmissionController();
