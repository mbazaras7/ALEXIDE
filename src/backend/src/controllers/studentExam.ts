/* eslint-disable @typescript-eslint/no-explicit-any */
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { examService } from '../services/exam';
import { ResponseHandler } from '../utils/response';

export class StudentExamController {
  //GET /api/backend/student/exams/class/:classId
  async getClassExams(req: AuthRequest, res: Response): Promise<void> {
    try {
      const studentId = req.user!.userId;
      const classId = req.params.classId as string;

      const exams = await examService.getClassExamsForStudent(classId, studentId);

      ResponseHandler.success(res, exams);
    } catch (error: any) {
      console.error('Get class exams (student) error:', error);
      if (error.message === 'Class not found' || error.message === 'Not enrolled in this class') {
        ResponseHandler.notFound(res, error.message);
        return;
      }
      ResponseHandler.serverError(res, error.message);
    }
  }

  //GET /api/backend/student/exams/:examId
  async getExam(req: AuthRequest, res: Response): Promise<void> {
    try {
      const studentId = req.user!.userId;
      const examId = req.params.examId as string;

      const exam = await examService.getExamForStudent(examId, studentId);

      ResponseHandler.success(res, exam);
    } catch (error: any) {
      console.error('Get exam (student) error:', error);
      if (error.message === 'Exam not found') {
        ResponseHandler.notFound(res, error.message);
        return;
      }
      if (
        error.message === 'Not enrolled in this class' ||
        error.message === 'Exam is not available'
      ) {
        ResponseHandler.forbidden(res, error.message);
        return;
      }
      ResponseHandler.serverError(res, error.message);
    }
  }

  //POST /api/backend/student/exams/:examId/start
  async startExam(req: AuthRequest, res: Response): Promise<void> {
    try {
      const studentId = req.user!.userId;
      const examId = req.params.examId as string;

      const session = await examService.startExamSession(examId, studentId);

      ResponseHandler.created(res, session, 'Exam started successfully');
    } catch (error: any) {
      console.error('Start exam error:', error);
      if (error.message === 'Exam not found') {
        ResponseHandler.notFound(res, error.message);
        return;
      }
      if (
        error.message === 'Not enrolled in this class' ||
        error.message === 'Exam is not active' ||
        error.message === 'Exam session already exists'
      ) {
        ResponseHandler.badRequest(res, error.message);
        return;
      }
      ResponseHandler.serverError(res, error.message);
    }
  }

  //GET /api/backend/student/exams/:examId/session
  async getSession(req: AuthRequest, res: Response): Promise<void> {
    try {
      const studentId = req.user!.userId;
      const examId = req.params.examId as string;

      const session = await examService.getStudentSession(examId, studentId);

      ResponseHandler.success(res, session);
    } catch (error: any) {
      console.error('Get exam session error:', error);
      if (error.message === 'Session not found') {
        ResponseHandler.notFound(res, error.message);
        return;
      }
      ResponseHandler.serverError(res, error.message);
    }
  }

  //POST /api/backend/student/exams/:examId/submit
  async submitExam(req: AuthRequest, res: Response): Promise<void> {
    try {
      const studentId = req.user!.userId;
      const examId = req.params.examId as string;

      const session = await examService.submitExamSession(examId, studentId);

      ResponseHandler.success(res, session, 'Exam submitted successfully');
    } catch (error: any) {
      console.error('Submit exam error:', error);
      if (error.message === 'Session not found') {
        ResponseHandler.notFound(res, error.message);
        return;
      }
      if (
        error.message === 'Exam already submitted' ||
        error.message === 'Exam session has expired'
      ) {
        ResponseHandler.badRequest(res, error.message);
        return;
      }
      ResponseHandler.serverError(res, error.message);
    }
  }

  //POST /api/backend/student/exams/:examId/tab-switch
  async recordTabSwitch(req: AuthRequest, res: Response): Promise<void> {
    try {
      const studentId = req.user!.userId;
      const examId = req.params.examId as string;

      const result = await examService.recordTabSwitch(examId, studentId);

      ResponseHandler.success(res, result);
    } catch (error: any) {
      console.error('Record tab switch error:', error);
      if (error.message === 'Session not found') {
        ResponseHandler.notFound(res, error.message);
        return;
      }
      if (error.message === 'Exam already submitted') {
        ResponseHandler.badRequest(res, error.message);
        return;
      }
      ResponseHandler.serverError(res, error.message);
    }
  }

  //POST /api/backend/student/exams/:examId/questions/:questionId/answer
  async saveAnswer(req: AuthRequest, res: Response): Promise<void> {
    //Student saves/updates their code for a question in the exam
    try {
      const studentId = req.user!.userId;
      const examId = req.params.examId as string;
      const questionId = req.params.questionId as string;
      const { code } = req.body;

      const result = await examService.saveAnswer(examId, questionId, studentId, code);

      ResponseHandler.success(res, result, 'Answer saved successfully');
    } catch (error: any) {
      console.error('Save answer error:', error);
      if (error.message === 'Session not found') {
        ResponseHandler.notFound(res, error.message);
        return;
      }
      if (
        error.message === 'Exam already submitted' ||
        error.message === 'Exam session has expired' ||
        error.message === 'Question not found'
      ) {
        ResponseHandler.badRequest(res, error.message);
        return;
      }
      ResponseHandler.serverError(res, error.message);
    }
  }

  //GET /api/backend/student/exams/:examId/answers
  async getAnswers(req: AuthRequest, res: Response): Promise<void> {
    //Returns all saved answers for the student's current session
    try {
      const studentId = req.user!.userId;
      const examId = req.params.examId as string;

      const answers = await examService.getSessionAnswers(examId, studentId);

      ResponseHandler.success(res, answers);
    } catch (error: any) {
      console.error('Get answers error:', error);
      if (error.message === 'Session not found') {
        ResponseHandler.notFound(res, error.message);
        return;
      }
      ResponseHandler.serverError(res, error.message);
    }
  }
}

export const studentExamController = new StudentExamController();
