/* eslint-disable @typescript-eslint/no-explicit-any */
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { assignmentService } from '../services/assignment';
import { ResponseHandler } from '../utils/response';

export class TeacherAssignmentController {
  //POST /api/backend/teacher/assignments/class/:classId
  async createAssignment(req: AuthRequest, res: Response): Promise<void> {
    try {
      const teacherId = req.user!.userId;
      const classId = req.params.classId as string;
      const { title, description, dueDate, maxScore, language, status } = req.body;

      const assignment = await assignmentService.createAssignment(teacherId, classId, {
        title,
        description,
        dueDate,
        maxScore,
        language,
        status,
      });

      ResponseHandler.created(res, assignment, 'Assignment created successfully');
    } catch (error: any) {
      console.error('Create assignment error:', error);
      if (error.message === 'Class not found') {
        ResponseHandler.notFound(res, error.message);
        return;
      }
      if (
        error.message === 'Invalid due date' ||
        error.message === 'Due date cannot be in the past'
      ) {
        ResponseHandler.badRequest(res, error.message);
        return;
      }
      ResponseHandler.serverError(res, error.message);
    }
  }

  //GET /api/backend/teacher/assignments/class/:classId
  async getClassAssignments(req: AuthRequest, res: Response): Promise<void> {
    try {
      const teacherId = req.user!.userId;
      const classId = req.params.classId as string;

      const assignmentList = await assignmentService.getClassAssignments(classId, teacherId);

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

  //GET /api/backend/teacher/assignments/:assignmentId
  async getAssignment(req: AuthRequest, res: Response): Promise<void> {
    try {
      const teacherId = req.user!.userId;
      const assignmentId = req.params.assignmentId as string;

      const assignment = await assignmentService.getAssignment(assignmentId, teacherId);

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

  //PATCH /api/backend/teacher/assignments/:assignmentId
  async updateAssignment(req: AuthRequest, res: Response): Promise<void> {
    try {
      const teacherId = req.user!.userId;
      const assignmentId = req.params.assignmentId as string;
      const { title, description, dueDate, maxScore, language, status } = req.body;

      const updated = await assignmentService.updateAssignment(assignmentId, teacherId, {
        title,
        description,
        dueDate,
        maxScore,
        language,
        status,
      });

      ResponseHandler.success(res, updated, 'Assignment updated successfully');
    } catch (error: any) {
      console.error('Update assignment error:', error);
      if (error.message === 'Assignment not found') {
        ResponseHandler.notFound(res, error.message);
        return;
      }
      if (
        error.message === 'At least one field must be provided' ||
        error.message === 'Invalid due date'
      ) {
        ResponseHandler.badRequest(res, error.message);
        return;
      }
      ResponseHandler.serverError(res, error.message);
    }
  }

  // DELETE /api/backend/teacher/assignments/:assignmentId
  async deleteAssignment(req: AuthRequest, res: Response): Promise<void> {
    try {
      const teacherId = req.user!.userId;
      const assignmentId = req.params.assignmentId as string;

      await assignmentService.deleteAssignment(assignmentId, teacherId);

      ResponseHandler.success(res, null, 'Assignment deleted successfully');
    } catch (error: any) {
      console.error('Delete assignment error:', error);
      if (error.message === 'Assignment not found') {
        ResponseHandler.notFound(res, error.message);
        return;
      }
      ResponseHandler.serverError(res, error.message);
    }
  }

  //POST /api/backend/teacher/assignments/:assignmentId/test-cases
  async addTestCase(req: AuthRequest, res: Response): Promise<void> {
    try {
      const teacherId = req.user!.userId;
      const assignmentId = req.params.assignmentId as string;
      const { name, inputData, expectedOutput, weight, orderIndex } = req.body;

      const testCase = await assignmentService.addTestCase(assignmentId, teacherId, {
        name,
        inputData,
        expectedOutput,
        weight,
        orderIndex,
      });

      ResponseHandler.created(res, testCase, 'Test case added successfully');
    } catch (error: any) {
      console.error('Add test case error:', error);
      if (error.message === 'Assignment not found') {
        ResponseHandler.notFound(res, error.message);
        return;
      }
      ResponseHandler.serverError(res, error.message);
    }
  }

  //GET /api/backend/teacher/assignments/:assignmentId/test-cases
  async getTestCases(req: AuthRequest, res: Response): Promise<void> {
    try {
      const teacherId = req.user!.userId;
      const assignmentId = req.params.assignmentId as string;

      const cases = await assignmentService.getTestCases(assignmentId, teacherId);

      ResponseHandler.success(res, cases);
    } catch (error: any) {
      console.error('Get test cases error:', error);
      if (error.message === 'Assignment not found') {
        ResponseHandler.notFound(res, error.message);
        return;
      }
      ResponseHandler.serverError(res, error.message);
    }
  }

  //PATCH /api/backend/teacher/assignments/test-cases/:testCaseId
  async updateTestCase(req: AuthRequest, res: Response): Promise<void> {
    try {
      const teacherId = req.user!.userId;
      const testCaseId = req.params.testCaseId as string;
      const { name, inputData, expectedOutput, weight, orderIndex } = req.body;

      const updated = await assignmentService.updateTestCase(testCaseId, teacherId, {
        name,
        inputData,
        expectedOutput,
        weight,
        orderIndex,
      });

      ResponseHandler.success(res, updated, 'Test case updated successfully');
    } catch (error: any) {
      console.error('Update test case error:', error);
      if (error.message === 'Test case not found') {
        ResponseHandler.notFound(res, error.message);
        return;
      }
      if (error.message === 'At least one field must be provided') {
        ResponseHandler.badRequest(res, error.message);
        return;
      }
      ResponseHandler.serverError(res, error.message);
    }
  }

  //DELETE /api/backend/teacher/assignments/test-cases/:testCaseId
  async deleteTestCase(req: AuthRequest, res: Response): Promise<void> {
    try {
      const teacherId = req.user!.userId;
      const testCaseId = req.params.testCaseId as string;

      await assignmentService.deleteTestCase(testCaseId, teacherId);

      ResponseHandler.success(res, null, 'Test case deleted successfully');
    } catch (error: any) {
      console.error('Delete test case error:', error);
      if (error.message === 'Test case not found') {
        ResponseHandler.notFound(res, error.message);
        return;
      }
      ResponseHandler.serverError(res, error.message);
    }
  }
}

export const teacherAssignmentController = new TeacherAssignmentController();
