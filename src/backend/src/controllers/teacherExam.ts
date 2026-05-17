/* eslint-disable @typescript-eslint/no-explicit-any */
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { examService } from '../services/exam';
import { ResponseHandler } from '../utils/response';

export class TeacherExamController {
  //POST /api/backend/teacher/exams/:classId
  async createExam(req: AuthRequest, res: Response): Promise<void> {
    try {
      const teacherId = req.user!.userId;
      const classId = req.params.classId as string;
      const {
        title,
        instructions,
        language,
        durationMinutes,
        scheduledStart,
        scheduledEnd,
        maxScore,
        status,
        isOpenBook,
      } = req.body;

      const exam = await examService.createExam(teacherId, classId, {
        title,
        instructions,
        language,
        durationMinutes,
        scheduledStart,
        scheduledEnd,
        maxScore,
        status,
        isOpenBook,
      });

      ResponseHandler.created(res, exam, 'Exam created successfully');
    } catch (error: any) {
      console.error('Create exam error:', error);
      if (error.message === 'Class not found') {
        ResponseHandler.notFound(res, error.message);
        return;
      }
      if (
        error.message === 'Scheduled end time must be after start time' ||
        error.message === 'Invalid scheduled date'
      ) {
        ResponseHandler.badRequest(res, error.message);
        return;
      }
      ResponseHandler.serverError(res, error.message);
    }
  }

  //GET /api/backend/teacher/exams/class/:classId
  async getClassExams(req: AuthRequest, res: Response): Promise<void> {
    try {
      const teacherId = req.user!.userId;
      const classId = req.params.classId as string;

      const exams = await examService.getClassExams(classId, teacherId);

      ResponseHandler.success(res, exams);
    } catch (error: any) {
      console.error('Get class exams error:', error);
      if (error.message === 'Class not found') {
        ResponseHandler.notFound(res, error.message);
        return;
      }
      ResponseHandler.serverError(res, error.message);
    }
  }

  //GET /api/backend/teacher/exams/:examId
  async getExam(req: AuthRequest, res: Response): Promise<void> {
    try {
      const teacherId = req.user!.userId;
      const examId = req.params.examId as string;

      const exam = await examService.getExam(examId, teacherId);

      ResponseHandler.success(res, exam);
    } catch (error: any) {
      console.error('Get exam error:', error);
      if (error.message === 'Exam not found') {
        ResponseHandler.notFound(res, error.message);
        return;
      }
      if (error.message === 'Not authorised') {
        ResponseHandler.forbidden(res, error.message);
        return;
      }
      ResponseHandler.serverError(res, error.message);
    }
  }

  //PATCH /api/backend/teacher/exams/:examId
  async updateExam(req: AuthRequest, res: Response): Promise<void> {
    try {
      const teacherId = req.user!.userId;
      const examId = req.params.examId as string;
      const {
        title,
        instructions,
        language,
        durationMinutes,
        scheduledStart,
        scheduledEnd,
        maxScore,
        status,
      } = req.body;

      const updated = await examService.updateExam(examId, teacherId, {
        title,
        instructions,
        language,
        durationMinutes,
        scheduledStart,
        scheduledEnd,
        maxScore,
        status,
      });

      ResponseHandler.success(res, updated, 'Exam updated successfully');
    } catch (error: any) {
      console.error('Update exam error:', error);
      if (error.message === 'Exam not found or not authorised') {
        ResponseHandler.notFound(res, error.message);
        return;
      }
      if (
        error.message === 'Cannot edit an active or completed exam' ||
        error.message === 'Scheduled end time must be after start time' ||
        error.message === 'At least one field must be provided'
      ) {
        ResponseHandler.badRequest(res, error.message);
        return;
      }
      ResponseHandler.serverError(res, error.message);
    }
  }

  //POST /api/backend/teacher/exams/:examId/publish
  async publishExam(req: AuthRequest, res: Response): Promise<void> {
    try {
      const teacherId = req.user!.userId;
      const examId = req.params.examId as string;

      const exam = await examService.publishExam(examId, teacherId);

      ResponseHandler.success(res, exam, 'Exam scheduled successfully');
    } catch (error: any) {
      console.error('Publish exam error:', error);
      if (error.message === 'Exam not found') {
        ResponseHandler.notFound(res, error.message);
        return;
      }
      if (
        error.message === 'Not authorised' ||
        error.message === 'Cannot publish an exam with no questions'
      ) {
        ResponseHandler.badRequest(res, error.message);
        return;
      }
      ResponseHandler.serverError(res, error.message);
    }
  }

  //DELETE /api/backend/teacher/exams/:examId
  async deleteExam(req: AuthRequest, res: Response): Promise<void> {
    try {
      const teacherId = req.user!.userId;
      const examId = req.params.examId as string;

      await examService.deleteExam(examId, teacherId);

      ResponseHandler.success(res, null, 'Exam deleted successfully');
    } catch (error: any) {
      console.error('Delete exam error:', error);
      if (error.message === 'Exam not found or not authorised') {
        ResponseHandler.notFound(res, error.message);
        return;
      }
      if (error.message === 'Cannot delete an active exam') {
        ResponseHandler.badRequest(res, error.message);
        return;
      }
      ResponseHandler.serverError(res, error.message);
    }
  }

  //POST /api/backend/teacher/exams/:examId/questions
  async addQuestion(req: AuthRequest, res: Response): Promise<void> {
    try {
      const teacherId = req.user!.userId;
      const examId = req.params.examId as string;
      const { title, description, maxScore, language, orderIndex } = req.body;

      const question = await examService.addQuestion(examId, teacherId, {
        title,
        description,
        maxScore,
        language,
        orderIndex,
      });

      ResponseHandler.created(res, question, 'Question added successfully');
    } catch (error: any) {
      console.error('Add question error:', error);
      if (error.message === 'Exam not found or not authorised') {
        ResponseHandler.notFound(res, error.message);
        return;
      }
      if (error.message === 'Can only add questions to a DRAFT exam') {
        ResponseHandler.badRequest(res, error.message);
        return;
      }
      ResponseHandler.serverError(res, error.message);
    }
  }

  //PATCH /api/backend/teacher/exams/:examId/questions/:questionId
  async updateQuestion(req: AuthRequest, res: Response): Promise<void> {
    try {
      const teacherId = req.user!.userId;
      const examId = req.params.examId as string;
      const questionId = req.params.questionId as string;
      const { title, description, maxScore, language, orderIndex } = req.body;

      const updated = await examService.updateQuestion(questionId, examId, teacherId, {
        title,
        description,
        maxScore,
        language,
        orderIndex,
      });

      ResponseHandler.success(res, updated, 'Question updated successfully');
    } catch (error: any) {
      console.error('Update question error:', error);
      if (
        error.message === 'Exam not found or not authorised' ||
        error.message === 'Question not found'
      ) {
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

  //DELETE /api/backend/teacher/exams/:examId/questions/:questionId
  async deleteQuestion(req: AuthRequest, res: Response): Promise<void> {
    try {
      const teacherId = req.user!.userId;
      const examId = req.params.examId as string;
      const questionId = req.params.questionId as string;

      await examService.deleteQuestion(questionId, examId, teacherId);

      ResponseHandler.success(res, null, 'Question deleted successfully');
    } catch (error: any) {
      console.error('Delete question error:', error);
      if (
        error.message === 'Exam not found or not authorised' ||
        error.message === 'Question not found'
      ) {
        ResponseHandler.notFound(res, error.message);
        return;
      }
      ResponseHandler.serverError(res, error.message);
    }
  }

  //POST /api/backend/teacher/exams/:examId/questions/:questionId/testcases
  async addTestCase(req: AuthRequest, res: Response): Promise<void> {
    try {
      const teacherId = req.user!.userId;
      const examId = req.params.examId as string;
      const questionId = req.params.questionId as string;
      const { name, inputData, sysArgs, expectedOutput, weight, orderIndex } = req.body;

      const testCase = await examService.addTestCase(questionId, examId, teacherId, {
        name,
        inputData,
        sysArgs,
        expectedOutput,
        weight,
        orderIndex,
      });

      ResponseHandler.created(res, testCase, 'Test case added successfully');
    } catch (error: any) {
      console.error('Add exam test case error:', error);
      if (
        error.message === 'Exam not found or not authorised' ||
        error.message === 'Question not found'
      ) {
        ResponseHandler.notFound(res, error.message);
        return;
      }
      ResponseHandler.serverError(res, error.message);
    }
  }

  //PATCH /api/backend/teacher/exams/:examId/questions/:questionId/testcases/:testCaseId
  async updateTestCase(req: AuthRequest, res: Response): Promise<void> {
    try {
      const teacherId = req.user!.userId;
      const examId = req.params.examId as string;
      const questionId = req.params.questionId as string;
      const testCaseId = req.params.testCaseId as string;
      const { name, inputData, sysArgs, expectedOutput, weight, orderIndex } = req.body;

      const updated = await examService.updateTestCase(testCaseId, questionId, examId, teacherId, {
        name,
        inputData,
        sysArgs,
        expectedOutput,
        weight,
        orderIndex,
      });

      ResponseHandler.success(res, updated, 'Test case updated successfully');
    } catch (error: any) {
      console.error('Update exam test case error:', error);
      if (
        error.message === 'Exam not found or not authorised' ||
        error.message === 'Question not found' ||
        error.message === 'Test case not found'
      ) {
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

  //DELETE /api/backend/teacher/exams/:examId/questions/:questionId/testcases/:testCaseId
  async deleteTestCase(req: AuthRequest, res: Response): Promise<void> {
    try {
      const teacherId = req.user!.userId;
      const examId = req.params.examId as string;
      const questionId = req.params.questionId as string;
      const testCaseId = req.params.testCaseId as string;

      await examService.deleteTestCase(testCaseId, questionId, examId, teacherId);

      ResponseHandler.success(res, null, 'Test case deleted successfully');
    } catch (error: any) {
      console.error('Delete exam test case error:', error);
      if (
        error.message === 'Exam not found or not authorised' ||
        error.message === 'Question not found' ||
        error.message === 'Test case not found'
      ) {
        ResponseHandler.notFound(res, error.message);
        return;
      }
      ResponseHandler.serverError(res, error.message);
    }
  }

  //GET /api/backend/teacher/exams/:examId/monitor
  async getMonitor(req: AuthRequest, res: Response): Promise<void> {
    try {
      const teacherId = req.user!.userId;
      const examId = req.params.examId as string;

      const state = await examService.getExamMonitorState(examId, teacherId);

      ResponseHandler.success(res, state);
    } catch (error: any) {
      console.error('Get monitor error:', error);
      if (error.message === 'Exam not found or not authorised') {
        ResponseHandler.notFound(res, error.message);
        return;
      }
      ResponseHandler.serverError(res, error.message);
    }
  }

  //GET /api/backend/teacher/exams/:examId/students/:studentId/files
  async getStudentFiles(req: AuthRequest, res: Response): Promise<void> {
    try {
      const teacherId = req.user!.userId;
      const examId = req.params.examId as string;
      const studentId = req.params.studentId as string;

      const snapshot = await examService.getStudentFileSnapshot(examId, teacherId, studentId);

      ResponseHandler.success(res, snapshot);
    } catch (error: any) {
      console.error('Get student files error:', error);
      if (error.message === 'Exam not found or not authorised') {
        ResponseHandler.notFound(res, error.message);
        return;
      }
      if (error.message === 'Student has no active session') {
        ResponseHandler.notFound(res, error.message);
        return;
      }
      ResponseHandler.serverError(res, error.message);
    }
  }
}

export const teacherExamController = new TeacherExamController();
