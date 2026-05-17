/* eslint-disable @typescript-eslint/no-explicit-any */
import { examRepository } from '../repositories/exam';
import { classRepository } from '../repositories/class';
import {
  ExamData,
  ExamWithQuestions,
  ExamWithPublicQuestions,
  ExamStatus,
  ExamSessionData,
} from '../types/exam';
import { examSubmissionRepository } from '../repositories/examSubmission';
import { examGradingService } from './examGrading';
import * as examRedis from './examRedis';
import { getAllStudentSessions } from './examRedis';
import { MonitorResponse, MonitorStudentState } from '../types/examRedis';

export class ExamService {
  //Teacher services

  async createExam(
    teacherId: string,
    classId: string,
    data: {
      title: string;
      instructions?: string;
      language?: string;
      durationMinutes?: number;
      scheduledStart?: string;
      scheduledEnd?: string;
      maxScore?: number;
      status?: ExamStatus;
      isOpenBook?: boolean;
    }
  ): Promise<ExamData> {
    const cls = await classRepository.findByIdAndTeacher(classId, teacherId);
    if (!cls) {
      throw new Error('Class not found');
    }

    if (data.scheduledStart && data.scheduledEnd) {
      const start = new Date(data.scheduledStart);
      const end = new Date(data.scheduledEnd);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        throw new Error('Invalid scheduled date');
      }
      if (end <= start) {
        throw new Error('Scheduled end time must be after start time');
      }
    }

    return examRepository.create({
      classId,
      teacherId,
      title: data.title,
      instructions: data.instructions,
      language: data.language,
      durationMinutes: data.durationMinutes,
      scheduledStart: data.scheduledStart ? new Date(data.scheduledStart) : undefined,
      scheduledEnd: data.scheduledEnd ? new Date(data.scheduledEnd) : undefined,
      maxScore: data.maxScore,
      status: data.status,
      isOpenBook: data.isOpenBook,
    });
  }

  async getClassExams(classId: string, teacherId: string): Promise<ExamData[]> {
    return examRepository.findAllByClassAndTeacher(classId, teacherId);
  }

  async getExam(examId: string, teacherId: string): Promise<ExamWithQuestions> {
    const exam = await examRepository.findByIdWithQuestions(examId);
    if (!exam) {
      throw new Error('Exam not found');
    }
    if (exam.teacherId !== teacherId) {
      throw new Error('Not authorised');
    }
    return exam;
  }

  async updateExam(
    examId: string,
    teacherId: string,
    data: {
      title?: string;
      instructions?: string | null;
      language?: string;
      durationMinutes?: number;
      scheduledStart?: string | null;
      scheduledEnd?: string | null;
      maxScore?: number;
      status?: ExamStatus;
    }
  ): Promise<ExamData> {
    const existing = await examRepository.findByIdAndTeacher(examId, teacherId);
    if (!existing) {
      throw new Error('Exam not found or not authorised');
    }

    if (existing.status === 'ACTIVE' || existing.status === 'COMPLETED') {
      throw new Error('Cannot edit an active or completed exam');
    }

    const hasFields = Object.values(data).some((v) => v !== undefined);
    if (!hasFields) {
      throw new Error('At least one field must be provided');
    }

    if (data.scheduledStart && data.scheduledEnd) {
      const start = new Date(data.scheduledStart);
      const end = new Date(data.scheduledEnd);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        throw new Error('Invalid scheduled date');
      }
      if (end <= start) {
        throw new Error('Scheduled end time must be after start time');
      }
    }

    const updated = await examRepository.update(examId, teacherId, {
      ...data,
      scheduledStart: data.scheduledStart
        ? new Date(data.scheduledStart)
        : data.scheduledStart === null
          ? null
          : undefined,
      scheduledEnd: data.scheduledEnd
        ? new Date(data.scheduledEnd)
        : data.scheduledEnd === null
          ? null
          : undefined,
    });

    if (!updated) {
      throw new Error('Exam not found or not authorised');
    }

    return updated;
  }

  async publishExam(examId: string, teacherId: string): Promise<ExamData> {
    const exam = await examRepository.findByIdWithQuestions(examId);
    if (!exam) {
      throw new Error('Exam not found');
    }
    if (exam.teacherId !== teacherId) {
      throw new Error('Not authorised');
    }
    if (exam.questions.length === 0) {
      throw new Error('Cannot publish an exam with no questions');
    }

    const updated = await examRepository.update(examId, teacherId, { status: 'SCHEDULED' });
    if (!updated) {
      throw new Error('Publish failed');
    }

    return updated;
  }

  async deleteExam(examId: string, teacherId: string): Promise<void> {
    const existing = await examRepository.findByIdAndTeacher(examId, teacherId);
    if (!existing) {
      throw new Error('Exam not found or not authorised');
    }
    if (existing.status === 'ACTIVE') {
      throw new Error('Cannot delete an active exam');
    }

    const deleted = await examRepository.delete(examId, teacherId);
    if (!deleted) {
      throw new Error('Exam not found or not authorised');
    }
  }

  async addQuestion(
    examId: string,
    teacherId: string,
    data: {
      title: string;
      description?: string;
      maxScore?: number;
      language?: string;
      orderIndex?: number;
    }
  ) {
    const exam = await examRepository.findByIdAndTeacher(examId, teacherId);
    if (!exam) {
      throw new Error('Exam not found or not authorised');
    }
    if (exam.status !== 'DRAFT') {
      throw new Error('Can only add questions to a DRAFT exam');
    }

    return examRepository.addQuestion({ examId, ...data });
  }

  async updateQuestion(
    questionId: string,
    examId: string,
    teacherId: string,
    data: {
      title?: string;
      description?: string | null;
      maxScore?: number;
      language?: string;
      orderIndex?: number;
    }
  ) {
    const exam = await examRepository.findByIdAndTeacher(examId, teacherId);
    if (!exam) {
      throw new Error('Exam not found or not authorised');
    }

    const question = await examRepository.findQuestionById(questionId);
    if (!question || question.examId !== examId) {
      throw new Error('Question not found');
    }

    const hasFields = Object.values(data).some((v) => v !== undefined);
    if (!hasFields) {
      throw new Error('At least one field must be provided');
    }

    const updated = await examRepository.updateQuestion(questionId, data);
    if (!updated) {
      throw new Error('Question not found');
    }

    return updated;
  }

  async deleteQuestion(questionId: string, examId: string, teacherId: string): Promise<void> {
    const exam = await examRepository.findByIdAndTeacher(examId, teacherId);
    if (!exam) {
      throw new Error('Exam not found or not authorised');
    }

    const question = await examRepository.findQuestionById(questionId);
    if (!question || question.examId !== examId) {
      throw new Error('Question not found');
    }

    const deleted = await examRepository.deleteQuestion(questionId);
    if (!deleted) {
      throw new Error('Question not found');
    }
  }

  async addTestCase(
    questionId: string,
    examId: string,
    teacherId: string,
    data: {
      name: string;
      inputData?: string;
      sysArgs?: string[];
      expectedOutput: string;
      weight?: number;
      orderIndex?: number;
    }
  ) {
    const exam = await examRepository.findByIdAndTeacher(examId, teacherId);
    if (!exam) {
      throw new Error('Exam not found or not authorised');
    }

    const question = await examRepository.findQuestionById(questionId);
    if (!question || question.examId !== examId) {
      throw new Error('Question not found');
    }

    return examRepository.addTestCase({ questionId, ...data });
  }

  async updateTestCase(
    testCaseId: string,
    questionId: string,
    examId: string,
    teacherId: string,
    data: {
      name?: string;
      inputData?: string | null;
      sysArgs?: string[] | null;
      expectedOutput?: string;
      weight?: number;
      orderIndex?: number;
    }
  ) {
    const exam = await examRepository.findByIdAndTeacher(examId, teacherId);
    if (!exam) {
      throw new Error('Exam not found or not authorised');
    }

    const question = await examRepository.findQuestionById(questionId);
    if (!question || question.examId !== examId) {
      throw new Error('Question not found');
    }

    const hasFields = Object.values(data).some((v) => v !== undefined);
    if (!hasFields) {
      throw new Error('At least one field must be provided');
    }

    const updated = await examRepository.updateTestCase(testCaseId, data);
    if (!updated) {
      throw new Error('Test case not found');
    }

    return updated;
  }

  async deleteTestCase(
    testCaseId: string,
    questionId: string,
    examId: string,
    teacherId: string
  ): Promise<void> {
    const exam = await examRepository.findByIdAndTeacher(examId, teacherId);
    if (!exam) {
      throw new Error('Exam not found or not authorised');
    }

    const question = await examRepository.findQuestionById(questionId);
    if (!question || question.examId !== examId) {
      throw new Error('Question not found');
    }

    const deleted = await examRepository.deleteTestCase(testCaseId);
    if (!deleted) {
      throw new Error('Test case not found');
    }
  }

  async getExamMonitorState(examId: string, teacherId: string): Promise<MonitorResponse> {
    const exam = await examRepository.findByIdAndTeacher(examId, teacherId);
    if (!exam) {
      throw new Error('Exam not found or not authorised');
    }

    const dbSessions = await examRepository.findAllSessionsByExam(examId);
    const redisSessions = await getAllStudentSessions(examId);
    const redisMap = new Map(redisSessions.map((s) => [s.studentId, s]));

    const classStudents = await classRepository.findStudentsByClass(exam.classId);
    const nameMap = new Map(classStudents.students.map((s) => [s.id, s.name ?? s.email]));

    const students: MonitorStudentState[] = dbSessions.map((session) => {
      const redis = redisMap.get(session.studentId);
      return {
        studentId: session.studentId,
        name: nameMap.get(session.studentId) ?? session.studentId,
        sessionId: session.id,
        status: session.isSubmitted ? 'SUBMITTED' : (redis?.status ?? 'EXPIRED'),
        tabSwitches: redis?.tabSwitches ?? session.tabSwitchCount,
        lastHeartbeat: redis?.lastHeartbeat ?? null,
        joinedAt: redis?.joinedAt ?? session.createdAt.toISOString(),
        submittedAt: session.submittedAt?.toISOString() ?? null,
        isOnline: redis?.status === 'ACTIVE',
      };
    });

    return {
      examId,
      totalStudents: students.length,
      submitted: students.filter((s) => s.status === 'SUBMITTED').length,
      active: students.filter((s) => s.isOnline).length,
      students,
    };
  }

  async getStudentFileSnapshot(
    examId: string,
    teacherId: string,
    studentId: string
  ): Promise<{
    studentId: string;
    studentName: string;
    examType: 'open-book' | 'closed-book';
    answers: { questionId: string; questionTitle: string; code: string; status: string }[];
  }> {
    const exam = await examRepository.findByIdAndTeacher(examId, teacherId);
    if (!exam) {
      throw new Error('Exam not found or not authorised');
    }

    const session = await examRepository.findSessionByExamAndStudent(examId, studentId);
    if (!session) {
      throw new Error('Student has no active session');
    }

    const classStudents = await classRepository.findStudentsByClass(exam.classId);
    const studentRecord = classStudents?.students?.find((s) => s.id === studentId);
    const studentName = studentRecord?.name ?? studentRecord?.email ?? studentId;

    const submissions = await examSubmissionRepository.findBySession(session.id);
    const examWithQuestions = await examRepository.findByIdWithQuestions(examId);
    const questionMap = new Map((examWithQuestions?.questions ?? []).map((q) => [q.id, q.title]));

    return {
      studentId,
      studentName,
      examType: exam.isOpenBook ? 'open-book' : 'closed-book',
      answers: submissions.map((sub) => ({
        questionId: sub.questionId,
        questionTitle: questionMap.get(sub.questionId) ?? 'Unknown',
        code: sub.code,
        status: sub.status,
      })),
    };
  }

  //Student Services

  async getClassExamsForStudent(classId: string, studentId: string): Promise<ExamData[]> {
    const membership = await classRepository.findMembership(classId, studentId);
    if (!membership) {
      throw new Error('Not enrolled in this class');
    }

    const allExams = await examRepository.findAllByClass(classId);
    return allExams.filter((e) => e.status === 'SCHEDULED' || e.status === 'ACTIVE');
  }

  async getExamForStudent(examId: string, studentId: string): Promise<ExamWithPublicQuestions> {
    const exam = await examRepository.findByIdWithQuestions(examId);
    if (!exam) {
      throw new Error('Exam not found');
    }

    if (exam.status !== 'SCHEDULED' && exam.status !== 'ACTIVE') {
      throw new Error('Exam is not available');
    }

    const membership = await classRepository.findMembership(exam.classId, studentId);
    if (!membership) {
      throw new Error('Not enrolled in this class');
    }

    return {
      ...exam,
      questions: exam.questions.map((q) => ({
        ...q,
        testCases: q.testCases.map((tc) => ({
          id: tc.id,
          name: tc.name,
          inputData: tc.inputData,
          orderIndex: tc.orderIndex,
        })),
      })),
    };
  }

  async startExamSession(examId: string, studentId: string): Promise<ExamSessionData> {
    const exam = await examRepository.findById(examId);
    if (!exam) {
      throw new Error('Exam not found');
    }
    if (exam.status !== 'ACTIVE') {
      throw new Error('Exam is not active');
    }

    const membership = await classRepository.findMembership(exam.classId, studentId);
    if (!membership) {
      throw new Error('Not enrolled in this class');
    }

    const existing = await examRepository.findSessionByExamAndStudent(examId, studentId);
    if (existing) {
      throw new Error('Exam session already exists');
    }

    const redisState = await examRedis.getActiveExam(examId);
    const expiresAt = redisState?.endTime
      ? new Date(redisState.endTime)
      : new Date(Date.now() + exam.durationMinutes * 60 * 1000);
    const session = await examRepository.createSession({ examId, studentId, expiresAt });

    const alreadyInRedis = await examRedis.getActiveExam(examId);
    if (!alreadyInRedis) {
      await examRedis.setActiveExam(
        {
          examId,
          classId: exam.classId,
          teacherId: exam.teacherId,
          status: 'ACTIVE',
          startTime: new Date().toISOString(),
          endTime: expiresAt.toISOString(),
          durationMinutes: exam.durationMinutes,
        },
        exam.durationMinutes
      );
    }

    await examRedis.setStudentSession(
      {
        studentId,
        examId,
        sessionId: session.id,
        joinedAt: new Date().toISOString(),
        tabSwitches: 0,
        status: 'ACTIVE',
        lastHeartbeat: new Date().toISOString(),
      },
      exam.durationMinutes
    );

    return session;
  }

  async getStudentSession(examId: string, studentId: string): Promise<ExamSessionData> {
    const session = await examRepository.findSessionByExamAndStudent(examId, studentId);
    if (!session) {
      throw new Error('Session not found');
    }
    return session;
  }

  async submitExamSession(examId: string, studentId: string): Promise<ExamSessionData> {
    const session = await examRepository.findSessionByExamAndStudent(examId, studentId);
    if (!session) {
      throw new Error('Session not found');
    }
    if (session.isSubmitted) {
      throw new Error('Exam already submitted');
    }
    if (new Date() > session.expiresAt) {
      throw new Error('Exam session has expired');
    }

    const updated = await examRepository.updateSession(examId, studentId, {
      isSubmitted: true,
      submittedAt: new Date(),
    });
    if (!updated) {
      throw new Error('Session not found');
    }

    await examRedis
      .markStudentSubmitted(examId, studentId)
      .catch((err: Error) =>
        console.warn(`[ExamRedis] Failed to mark submitted in Redis: ${err.message}`)
      );

    examGradingService.gradeExamSession(examId, studentId, session.id).catch((err) => {
      console.error(`Failed for examId:${examId} studentId:${studentId}:`, err.message);
    });

    return updated;
  }

  async recordTabSwitch(examId: string, studentId: string): Promise<{ tabSwitchCount: number }> {
    const session = await examRepository.findSessionByExamAndStudent(examId, studentId);
    if (!session) {
      throw new Error('Session not found');
    }
    if (session.isSubmitted) {
      throw new Error('Exam already submitted');
    }

    const newCount = session.tabSwitchCount + 1;
    await examRepository.updateSession(examId, studentId, { tabSwitchCount: newCount });
    return { tabSwitchCount: newCount };
  }

  async saveAnswer(examId: string, questionId: string, studentId: string, code: string) {
    const session = await examRepository.findSessionByExamAndStudent(examId, studentId);
    if (!session) {
      throw new Error('Session not found');
    }
    if (session.isSubmitted) {
      throw new Error('Exam already submitted');
    }
    if (new Date() > session.expiresAt) {
      throw new Error('Exam session has expired');
    }

    const question = await examRepository.findQuestionById(questionId);
    if (!question || question.examId !== examId) {
      throw new Error('Question not found');
    }

    return examSubmissionRepository.upsert({
      examSessionId: session.id,
      examId,
      questionId,
      studentId,
      code,
    });
  }

  async getSessionAnswers(examId: string, studentId: string) {
    const session = await examRepository.findSessionByExamAndStudent(examId, studentId);
    if (!session) {
      throw new Error('Session not found');
    }

    return examSubmissionRepository.findBySession(session.id);
  }

  async autoSubmitExam(examId: string): Promise<void> {
    const exam = await examRepository.findById(examId);
    if (!exam || exam.status === 'COMPLETED') {
      console.log(`autoSubmitExam: exam ${examId} already completed, skipping.`);
      return;
    }

    console.log(`Auto-submitting all active sessions for examId:${examId}`);

    const activeSessions = await examRepository.findActiveSessionsByExam(examId);

    if (activeSessions.length === 0) {
      console.log(`No active sessions to auto-submit for examId:${examId}`);
      return;
    }

    for (const session of activeSessions) {
      try {
        await examRepository.updateSession(examId, session.studentId, {
          isSubmitted: true,
          submittedAt: new Date(),
        });

        void (async () => {
          try {
            await examRedis.markStudentSubmitted(examId, session.studentId);
          } catch (err: any) {
            console.warn(
              `Auto-submit Redis mark failed for studentId:${session.studentId}: ${err.message}`
            );
          }
          try {
            await examGradingService.gradeExamSession(examId, session.studentId, session.id);
          } catch (err: any) {
            console.error(
              `Auto-submit grading failed for studentId:${session.studentId}: ${err.message}`
            );
          }
        })();

        console.log(`Auto-submitted studentId:${session.studentId} examId:${examId}`);
      } catch (err: any) {
        console.error(`Auto-submit failed for studentId:${session.studentId}: ${err.message}`);
      }
    }

    const updatedExam = await examRepository.findById(examId);
    if (!updatedExam) {
      console.warn(`Auto-submit failed to mark exam COMPLETED: exam ${examId} not found`);
      return;
    }

    await examRepository
      .update(examId, updatedExam.teacherId, { status: 'COMPLETED' })
      .catch((err: any) => {
        console.warn(`Auto-submit failed to mark exam COMPLETED: ${err.message}`);
      });
  }
}

export const examService = new ExamService();
