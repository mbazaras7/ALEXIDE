import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { examService } from '../exam';
import { examRepository } from '../../repositories/exam';
import { classRepository } from '../../repositories/class';
import {
  ExamData,
  ExamWithQuestions,
  ExamQuestionData,
  ExamQuestionWithTestCases,
  ExamTestCaseData,
  ExamSessionData,
} from '../../types/exam';
import { ExamQuestionSubmissionData } from '../../types/examSubmission';
import { examSubmissionRepository } from '../../repositories/examSubmission';
import * as examRedisService from '../examRedis';
import * as examGradingModule from '../examGrading';

jest.mock('../../repositories/exam');
jest.mock('../../repositories/class');
jest.mock('../../repositories/examSubmission');
jest.mock('../examRedis');
jest.mock('../examGrading', () => ({
  examGradingService: {
    gradeExamSession: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
  },
}));

const mockExamRepo = examRepository as jest.Mocked<typeof examRepository>;
const mockClassRepo = classRepository as jest.Mocked<typeof classRepository>;
const mockSubmissionRepo = examSubmissionRepository as jest.Mocked<typeof examSubmissionRepository>;
const mockExamRedis = examRedisService as jest.Mocked<typeof examRedisService>;

const teacherId = 'teacher-123';
const studentId = 'student-456';
const classId = 'class-789';
const examId = 'exam-001';
const questionId = 'q-001';
const testCaseId = 'tc-001';
const sessionId = 'sess-001';
const submissionId = 'sub-001';

const makeClass = () => ({
  id: classId,
  name: 'Python',
  description: null,
  teacherId,
  joinCode: 'ABCD1234',
  createdAt: new Date(),
  updatedAt: new Date(),
});

const makeExam = (overrides: Partial<ExamData> = {}): ExamData => ({
  id: examId,
  classId,
  teacherId,
  title: 'Midterm Exam',
  instructions: null,
  language: 'python',
  durationMinutes: 60,
  scheduledStart: null,
  scheduledEnd: null,
  status: 'DRAFT',
  maxScore: 100,
  createdAt: new Date(),
  updatedAt: new Date(),
  isOpenBook: false,
  ...overrides,
});

const makeTestCase = (overrides: Partial<ExamTestCaseData> = {}): ExamTestCaseData => ({
  id: testCaseId,
  questionId,
  name: 'Basic test',
  inputData: null,
  sysArgs: null,
  expectedOutput: '5',
  weight: 1,
  orderIndex: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const makeQuestion = (overrides: Partial<ExamQuestionData> = {}): ExamQuestionData => ({
  id: questionId,
  examId,
  title: 'Write a sum function',
  description: null,
  maxScore: 100,
  language: 'python',
  orderIndex: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const makeQuestionWithTestCases = (
  overrides: Partial<ExamQuestionData> = {}
): ExamQuestionWithTestCases => ({
  ...makeQuestion(overrides),
  testCases: [],
});

const makeExamWithQuestions = (overrides: Partial<ExamData> = {}): ExamWithQuestions => ({
  ...makeExam(overrides),
  questions: [],
});

const makeSession = (overrides: Partial<ExamSessionData> = {}): ExamSessionData => ({
  id: sessionId,
  examId,
  studentId,
  startedAt: new Date(),
  submittedAt: null,
  expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  tabSwitchCount: 0,
  isSubmitted: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const makeSubmission = (
  overrides: Partial<ExamQuestionSubmissionData> = {}
): ExamQuestionSubmissionData => ({
  id: submissionId,
  examSessionId: sessionId,
  examId,
  questionId,
  studentId,
  code: 'print("hello")',
  status: 'PENDING',
  score: null,
  maxScore: null,
  testResults: null,
  submittedAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('ExamService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockExamRedis.setActiveExam.mockResolvedValue(undefined);
    mockExamRedis.setStudentSession.mockResolvedValue(undefined);
    mockExamRedis.markStudentSubmitted.mockResolvedValue(undefined);
    mockExamRedis.getActiveExam.mockResolvedValue(null);
    mockExamRedis.incrementTabSwitch.mockResolvedValue(1);
    mockExamRedis.updateHeartbeat.mockResolvedValue(undefined);
    mockExamRedis.removeStudentSession.mockResolvedValue(undefined);
    mockExamRedis.removeActiveExam.mockResolvedValue(undefined);
    mockExamRedis.getTimeRemaining.mockResolvedValue(null);
    mockExamRedis.getAllStudentSessions.mockResolvedValue([]);
    mockExamRedis.isExamActive.mockResolvedValue(false);

    (
      examGradingModule.examGradingService.gradeExamSession as jest.MockedFunction<
        () => Promise<void>
      >
    ).mockResolvedValue(undefined);
  });

  describe('createExam', () => {
    it('should create a DRAFT exam successfully', async () => {
      mockClassRepo.findByIdAndTeacher.mockResolvedValue(makeClass());
      mockExamRepo.create.mockResolvedValue(makeExam());

      const result = await examService.createExam(teacherId, classId, {
        title: 'Midterm Exam',
      });

      expect(mockExamRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ classId, teacherId, title: 'Midterm Exam' })
      );
      expect(result.status).toBe('DRAFT');
    });

    it('should throw if class not found', async () => {
      mockClassRepo.findByIdAndTeacher.mockResolvedValue(null);

      await expect(examService.createExam(teacherId, classId, { title: 'Exam' })).rejects.toThrow(
        'Class not found'
      );
    });

    it('should throw if scheduledEnd is before scheduledStart', async () => {
      mockClassRepo.findByIdAndTeacher.mockResolvedValue(makeClass());

      await expect(
        examService.createExam(teacherId, classId, {
          title: 'Bad Dates',
          scheduledStart: '2026-04-01T10:00:00.000Z',
          scheduledEnd: '2026-04-01T09:00:00.000Z',
        })
      ).rejects.toThrow('Scheduled end time must be after start time');
    });

    it('should throw if scheduledStart is invalid', async () => {
      mockClassRepo.findByIdAndTeacher.mockResolvedValue(makeClass());

      await expect(
        examService.createExam(teacherId, classId, {
          title: 'Bad Date',
          scheduledStart: 'not-a-date',
          scheduledEnd: 'not-a-date',
        })
      ).rejects.toThrow('Invalid scheduled date');
    });

    it('should create exam with valid scheduled times', async () => {
      mockClassRepo.findByIdAndTeacher.mockResolvedValue(makeClass());
      const start = new Date(Date.now() + 86400000);
      const end = new Date(Date.now() + 90000000);
      mockExamRepo.create.mockResolvedValue(
        makeExam({ scheduledStart: start, scheduledEnd: end, status: 'DRAFT' })
      );

      const result = await examService.createExam(teacherId, classId, {
        title: 'Scheduled Exam',
        scheduledStart: start.toISOString(),
        scheduledEnd: end.toISOString(),
      });

      expect(result.scheduledStart).toEqual(start);
      expect(result.scheduledEnd).toEqual(end);
    });
  });

  describe('getExam', () => {
    it('should return exam with questions and test cases', async () => {
      mockExamRepo.findByIdWithQuestions.mockResolvedValue(makeExamWithQuestions());

      const result = await examService.getExam(examId, teacherId);
      expect(result.id).toBe(examId);
      expect(result.questions).toHaveLength(0);
    });

    it('should throw if exam not found', async () => {
      mockExamRepo.findByIdWithQuestions.mockResolvedValue(null);

      await expect(examService.getExam(examId, teacherId)).rejects.toThrow('Exam not found');
    });

    it('should throw if teacher does not own the exam', async () => {
      mockExamRepo.findByIdWithQuestions.mockResolvedValue(
        makeExamWithQuestions({ teacherId: 'other-teacher' })
      );

      await expect(examService.getExam(examId, teacherId)).rejects.toThrow('Not authorised');
    });
  });

  describe('getClassExams', () => {
    it('should return all exams for the class belonging to the teacher', async () => {
      mockExamRepo.findAllByClassAndTeacher.mockResolvedValue([
        makeExam(),
        makeExam({ id: 'exam-2', title: 'Final Exam' }),
      ]);

      const result = await examService.getClassExams(classId, teacherId);
      expect(result).toHaveLength(2);
    });

    it('should return empty array if no exams exist', async () => {
      mockExamRepo.findAllByClassAndTeacher.mockResolvedValue([]);

      const result = await examService.getClassExams(classId, teacherId);
      expect(result).toHaveLength(0);
    });
  });

  describe('updateExam', () => {
    it('should update exam title', async () => {
      mockExamRepo.findByIdAndTeacher.mockResolvedValue(makeExam());
      mockExamRepo.update.mockResolvedValue(makeExam({ title: 'Updated Title' }));

      const result = await examService.updateExam(examId, teacherId, { title: 'Updated Title' });
      expect(result.title).toBe('Updated Title');
    });

    it('should update duration', async () => {
      mockExamRepo.findByIdAndTeacher.mockResolvedValue(makeExam());
      mockExamRepo.update.mockResolvedValue(makeExam({ durationMinutes: 90 }));

      const result = await examService.updateExam(examId, teacherId, { durationMinutes: 90 });
      expect(result.durationMinutes).toBe(90);
    });

    it('should throw if exam not found', async () => {
      mockExamRepo.findByIdAndTeacher.mockResolvedValue(null);

      await expect(examService.updateExam(examId, teacherId, { title: 'X' })).rejects.toThrow(
        'Exam not found or not authorised'
      );
    });

    it('should throw if exam is ACTIVE', async () => {
      mockExamRepo.findByIdAndTeacher.mockResolvedValue(makeExam({ status: 'ACTIVE' }));

      await expect(examService.updateExam(examId, teacherId, { title: 'X' })).rejects.toThrow(
        'Cannot edit an active or completed exam'
      );
    });

    it('should throw if exam is COMPLETED', async () => {
      mockExamRepo.findByIdAndTeacher.mockResolvedValue(makeExam({ status: 'COMPLETED' }));

      await expect(examService.updateExam(examId, teacherId, { title: 'X' })).rejects.toThrow(
        'Cannot edit an active or completed exam'
      );
    });

    it('should throw if no fields provided', async () => {
      mockExamRepo.findByIdAndTeacher.mockResolvedValue(makeExam());

      await expect(examService.updateExam(examId, teacherId, {})).rejects.toThrow(
        'At least one field must be provided'
      );
    });
  });

  describe('publishExam', () => {
    it('should publish an exam with at least one question', async () => {
      const examWithQuestion = makeExamWithQuestions();
      examWithQuestion.questions = [makeQuestionWithTestCases()];
      mockExamRepo.findByIdWithQuestions.mockResolvedValue(examWithQuestion);
      mockExamRepo.update.mockResolvedValue(makeExam({ status: 'SCHEDULED' }));

      const result = await examService.publishExam(examId, teacherId);
      expect(result.status).toBe('SCHEDULED');
    });

    it('should throw if exam has no questions', async () => {
      mockExamRepo.findByIdWithQuestions.mockResolvedValue(makeExamWithQuestions());

      await expect(examService.publishExam(examId, teacherId)).rejects.toThrow(
        'Cannot publish an exam with no questions'
      );
    });

    it('should throw if exam not found', async () => {
      mockExamRepo.findByIdWithQuestions.mockResolvedValue(null);

      await expect(examService.publishExam(examId, teacherId)).rejects.toThrow('Exam not found');
    });

    it('should throw if teacher does not own the exam', async () => {
      mockExamRepo.findByIdWithQuestions.mockResolvedValue(
        makeExamWithQuestions({ teacherId: 'other-teacher' })
      );

      await expect(examService.publishExam(examId, teacherId)).rejects.toThrow('Not authorised');
    });
  });

  describe('deleteExam', () => {
    it('should delete a DRAFT exam', async () => {
      mockExamRepo.findByIdAndTeacher.mockResolvedValue(makeExam());
      mockExamRepo.delete.mockResolvedValue(true);

      await expect(examService.deleteExam(examId, teacherId)).resolves.not.toThrow();
      expect(mockExamRepo.delete).toHaveBeenCalledWith(examId, teacherId);
    });

    it('should delete a SCHEDULED exam', async () => {
      mockExamRepo.findByIdAndTeacher.mockResolvedValue(makeExam({ status: 'SCHEDULED' }));
      mockExamRepo.delete.mockResolvedValue(true);

      await expect(examService.deleteExam(examId, teacherId)).resolves.not.toThrow();
    });

    it('should throw if exam is ACTIVE', async () => {
      mockExamRepo.findByIdAndTeacher.mockResolvedValue(makeExam({ status: 'ACTIVE' }));

      await expect(examService.deleteExam(examId, teacherId)).rejects.toThrow(
        'Cannot delete an active exam'
      );
    });

    it('should throw if exam not found', async () => {
      mockExamRepo.findByIdAndTeacher.mockResolvedValue(null);

      await expect(examService.deleteExam(examId, teacherId)).rejects.toThrow(
        'Exam not found or not authorised'
      );
    });
  });

  describe('addQuestion', () => {
    it('should add a question to a DRAFT exam', async () => {
      mockExamRepo.findByIdAndTeacher.mockResolvedValue(makeExam({ status: 'DRAFT' }));
      mockExamRepo.addQuestion.mockResolvedValue(makeQuestion());

      const result = await examService.addQuestion(examId, teacherId, {
        title: 'Write a sum function',
      });

      expect(mockExamRepo.addQuestion).toHaveBeenCalledWith(
        expect.objectContaining({ examId, title: 'Write a sum function' })
      );
      expect(result.title).toBe('Write a sum function');
    });

    it('should throw if exam is not DRAFT', async () => {
      mockExamRepo.findByIdAndTeacher.mockResolvedValue(makeExam({ status: 'SCHEDULED' }));

      await expect(
        examService.addQuestion(examId, teacherId, { title: 'Question' })
      ).rejects.toThrow('Can only add questions to a DRAFT exam');
    });

    it('should throw if exam not found', async () => {
      mockExamRepo.findByIdAndTeacher.mockResolvedValue(null);

      await expect(
        examService.addQuestion(examId, teacherId, { title: 'Question' })
      ).rejects.toThrow('Exam not found or not authorised');
    });
  });

  describe('updateQuestion', () => {
    it('should update question title', async () => {
      mockExamRepo.findByIdAndTeacher.mockResolvedValue(makeExam());
      mockExamRepo.findQuestionById.mockResolvedValue(makeQuestion());
      mockExamRepo.updateQuestion.mockResolvedValue(makeQuestion({ title: 'Updated Question' }));

      const result = await examService.updateQuestion(questionId, examId, teacherId, {
        title: 'Updated Question',
      });
      expect(result.title).toBe('Updated Question');
    });

    it('should throw if no fields provided', async () => {
      mockExamRepo.findByIdAndTeacher.mockResolvedValue(makeExam());
      mockExamRepo.findQuestionById.mockResolvedValue(makeQuestion());

      await expect(examService.updateQuestion(questionId, examId, teacherId, {})).rejects.toThrow(
        'At least one field must be provided'
      );
    });

    it('should throw if question not found', async () => {
      mockExamRepo.findByIdAndTeacher.mockResolvedValue(makeExam());
      mockExamRepo.findQuestionById.mockResolvedValue(null);

      await expect(
        examService.updateQuestion(questionId, examId, teacherId, { title: 'X' })
      ).rejects.toThrow('Question not found');
    });

    it('should throw if question belongs to a different exam', async () => {
      mockExamRepo.findByIdAndTeacher.mockResolvedValue(makeExam());
      mockExamRepo.findQuestionById.mockResolvedValue(makeQuestion({ examId: 'other-exam' }));

      await expect(
        examService.updateQuestion(questionId, examId, teacherId, { title: 'X' })
      ).rejects.toThrow('Question not found');
    });

    it('should throw if teacher does not own the exam', async () => {
      mockExamRepo.findByIdAndTeacher.mockResolvedValue(null);

      await expect(
        examService.updateQuestion(questionId, examId, teacherId, { title: 'X' })
      ).rejects.toThrow('Exam not found or not authorised');
    });
  });

  describe('deleteQuestion', () => {
    it('should delete a question successfully', async () => {
      mockExamRepo.findByIdAndTeacher.mockResolvedValue(makeExam());
      mockExamRepo.findQuestionById.mockResolvedValue(makeQuestion());
      mockExamRepo.deleteQuestion.mockResolvedValue(true);

      await expect(
        examService.deleteQuestion(questionId, examId, teacherId)
      ).resolves.not.toThrow();

      expect(mockExamRepo.deleteQuestion).toHaveBeenCalledWith(questionId);
    });

    it('should throw if question not found', async () => {
      mockExamRepo.findByIdAndTeacher.mockResolvedValue(makeExam());
      mockExamRepo.findQuestionById.mockResolvedValue(null);

      await expect(examService.deleteQuestion(questionId, examId, teacherId)).rejects.toThrow(
        'Question not found'
      );
    });

    it('should throw if teacher does not own the exam', async () => {
      mockExamRepo.findByIdAndTeacher.mockResolvedValue(null);

      await expect(examService.deleteQuestion(questionId, examId, teacherId)).rejects.toThrow(
        'Exam not found or not authorised'
      );
    });
  });

  describe('addTestCase', () => {
    it('should add a test case to a question', async () => {
      mockExamRepo.findByIdAndTeacher.mockResolvedValue(makeExam());
      mockExamRepo.findQuestionById.mockResolvedValue(makeQuestion());
      mockExamRepo.addTestCase.mockResolvedValue(makeTestCase());

      const result = await examService.addTestCase(questionId, examId, teacherId, {
        name: 'Basic test',
        expectedOutput: '5',
      });

      expect(mockExamRepo.addTestCase).toHaveBeenCalledWith(
        expect.objectContaining({ questionId, name: 'Basic test', expectedOutput: '5' })
      );
      expect(result.name).toBe('Basic test');
      expect(result.sysArgs).toBeNull();
    });

    it('should add a test case with sysArgs', async () => {
      mockExamRepo.findByIdAndTeacher.mockResolvedValue(makeExam());
      mockExamRepo.findQuestionById.mockResolvedValue(makeQuestion());
      mockExamRepo.addTestCase.mockResolvedValue(makeTestCase({ sysArgs: ['hello', 'world'] }));

      const result = await examService.addTestCase(questionId, examId, teacherId, {
        name: 'Args test',
        expectedOutput: 'hello world',
        sysArgs: ['hello', 'world'],
      });

      expect(mockExamRepo.addTestCase).toHaveBeenCalledWith(
        expect.objectContaining({ sysArgs: ['hello', 'world'] })
      );
      expect(result.sysArgs).toEqual(['hello', 'world']);
    });

    it('should throw if exam not found', async () => {
      mockExamRepo.findByIdAndTeacher.mockResolvedValue(null);

      await expect(
        examService.addTestCase(questionId, examId, teacherId, {
          name: 'Test',
          expectedOutput: '5',
        })
      ).rejects.toThrow('Exam not found or not authorised');
    });

    it('should throw if question not found or belongs to different exam', async () => {
      mockExamRepo.findByIdAndTeacher.mockResolvedValue(makeExam());
      mockExamRepo.findQuestionById.mockResolvedValue(null);

      await expect(
        examService.addTestCase(questionId, examId, teacherId, {
          name: 'Test',
          expectedOutput: '5',
        })
      ).rejects.toThrow('Question not found');
    });
  });

  describe('updateTestCase', () => {
    it('should update test case name', async () => {
      mockExamRepo.findByIdAndTeacher.mockResolvedValue(makeExam());
      mockExamRepo.findQuestionById.mockResolvedValue(makeQuestion());
      mockExamRepo.updateTestCase.mockResolvedValue(makeTestCase({ name: 'Updated Test' }));

      const result = await examService.updateTestCase(testCaseId, questionId, examId, teacherId, {
        name: 'Updated Test',
      });
      expect(result.name).toBe('Updated Test');
    });

    it('should update sysArgs', async () => {
      mockExamRepo.findByIdAndTeacher.mockResolvedValue(makeExam());
      mockExamRepo.findQuestionById.mockResolvedValue(makeQuestion());
      mockExamRepo.updateTestCase.mockResolvedValue(makeTestCase({ sysArgs: ['a', 'b'] }));

      const result = await examService.updateTestCase(testCaseId, questionId, examId, teacherId, {
        sysArgs: ['a', 'b'],
      });

      expect(mockExamRepo.updateTestCase).toHaveBeenCalledWith(
        testCaseId,
        expect.objectContaining({ sysArgs: ['a', 'b'] })
      );
      expect(result.sysArgs).toEqual(['a', 'b']);
    });

    it('should clear sysArgs when set to null', async () => {
      mockExamRepo.findByIdAndTeacher.mockResolvedValue(makeExam());
      mockExamRepo.findQuestionById.mockResolvedValue(makeQuestion());
      mockExamRepo.updateTestCase.mockResolvedValue(makeTestCase({ sysArgs: null }));

      const result = await examService.updateTestCase(testCaseId, questionId, examId, teacherId, {
        sysArgs: null,
      });
      expect(result.sysArgs).toBeNull();
    });

    it('should throw if no fields provided', async () => {
      mockExamRepo.findByIdAndTeacher.mockResolvedValue(makeExam());
      mockExamRepo.findQuestionById.mockResolvedValue(makeQuestion());

      await expect(
        examService.updateTestCase(testCaseId, questionId, examId, teacherId, {})
      ).rejects.toThrow('At least one field must be provided');
    });

    it('should throw if test case not found', async () => {
      mockExamRepo.findByIdAndTeacher.mockResolvedValue(makeExam());
      mockExamRepo.findQuestionById.mockResolvedValue(makeQuestion());
      mockExamRepo.updateTestCase.mockResolvedValue(null);

      await expect(
        examService.updateTestCase(testCaseId, questionId, examId, teacherId, { name: 'X' })
      ).rejects.toThrow('Test case not found');
    });

    it('should throw if teacher does not own the exam', async () => {
      mockExamRepo.findByIdAndTeacher.mockResolvedValue(null);

      await expect(
        examService.updateTestCase(testCaseId, questionId, examId, teacherId, { name: 'X' })
      ).rejects.toThrow('Exam not found or not authorised');
    });
  });

  describe('deleteTestCase', () => {
    it('should delete test case successfully', async () => {
      mockExamRepo.findByIdAndTeacher.mockResolvedValue(makeExam());
      mockExamRepo.findQuestionById.mockResolvedValue(makeQuestion());
      mockExamRepo.deleteTestCase.mockResolvedValue(true);

      await expect(
        examService.deleteTestCase(testCaseId, questionId, examId, teacherId)
      ).resolves.not.toThrow();
    });

    it('should throw if test case not found', async () => {
      mockExamRepo.findByIdAndTeacher.mockResolvedValue(makeExam());
      mockExamRepo.findQuestionById.mockResolvedValue(makeQuestion());
      mockExamRepo.deleteTestCase.mockResolvedValue(false);

      await expect(
        examService.deleteTestCase(testCaseId, questionId, examId, teacherId)
      ).rejects.toThrow('Test case not found');
    });

    it('should throw if teacher does not own the exam', async () => {
      mockExamRepo.findByIdAndTeacher.mockResolvedValue(null);

      await expect(
        examService.deleteTestCase(testCaseId, questionId, examId, teacherId)
      ).rejects.toThrow('Exam not found or not authorised');
    });
  });

  describe('getStudentFileSnapshot', () => {
    it('should return closed-book snapshot with answers mapped to question titles', async () => {
      mockExamRepo.findByIdAndTeacher.mockResolvedValue(makeExam({ isOpenBook: false }));
      mockExamRepo.findSessionByExamAndStudent.mockResolvedValue(makeSession());
      mockSubmissionRepo.findBySession.mockResolvedValue([makeSubmission()]);
      mockExamRepo.findByIdWithQuestions.mockResolvedValue({
        ...makeExamWithQuestions(),
        questions: [makeQuestionWithTestCases()],
      });

      const result = await examService.getStudentFileSnapshot(examId, teacherId, studentId);

      expect(result.examType).toBe('closed-book');
      expect(result.studentId).toBe(studentId);
      expect(result.answers).toHaveLength(1);
      expect(result.answers[0]).toEqual({
        questionId,
        questionTitle: 'Write a sum function',
        code: 'print("hello")',
        status: 'PENDING',
      });
    });

    it('should return open-book snapshot with answers mapped to question titles', async () => {
      mockExamRepo.findByIdAndTeacher.mockResolvedValue(makeExam({ isOpenBook: true }));
      mockExamRepo.findSessionByExamAndStudent.mockResolvedValue(makeSession());
      mockSubmissionRepo.findBySession.mockResolvedValue([makeSubmission()]);
      mockExamRepo.findByIdWithQuestions.mockResolvedValue({
        ...makeExamWithQuestions(),
        questions: [makeQuestionWithTestCases()],
      });

      const result = await examService.getStudentFileSnapshot(examId, teacherId, studentId);

      expect(result.examType).toBe('open-book');
      expect(result.answers).toHaveLength(1);
    });

    it('should return "Unknown" as questionTitle if question is not found in map', async () => {
      mockExamRepo.findByIdAndTeacher.mockResolvedValue(makeExam());
      mockExamRepo.findSessionByExamAndStudent.mockResolvedValue(makeSession());
      mockSubmissionRepo.findBySession.mockResolvedValue([
        makeSubmission({ questionId: 'non-existent-q' }),
      ]);
      mockExamRepo.findByIdWithQuestions.mockResolvedValue(makeExamWithQuestions());

      const result = await examService.getStudentFileSnapshot(examId, teacherId, studentId);

      expect(result.answers[0].questionTitle).toBe('Unknown');
    });

    it('should return empty answers array if student has no submissions', async () => {
      mockExamRepo.findByIdAndTeacher.mockResolvedValue(makeExam());
      mockExamRepo.findSessionByExamAndStudent.mockResolvedValue(makeSession());
      mockSubmissionRepo.findBySession.mockResolvedValue([]);
      mockExamRepo.findByIdWithQuestions.mockResolvedValue(makeExamWithQuestions());

      const result = await examService.getStudentFileSnapshot(examId, teacherId, studentId);

      expect(result.answers).toHaveLength(0);
    });

    it('should throw if exam not found or teacher not authorised', async () => {
      mockExamRepo.findByIdAndTeacher.mockResolvedValue(null);

      await expect(
        examService.getStudentFileSnapshot(examId, teacherId, studentId)
      ).rejects.toThrow('Exam not found or not authorised');
    });

    it('should throw if student has no session', async () => {
      mockExamRepo.findByIdAndTeacher.mockResolvedValue(makeExam());
      mockExamRepo.findSessionByExamAndStudent.mockResolvedValue(null);

      await expect(
        examService.getStudentFileSnapshot(examId, teacherId, studentId)
      ).rejects.toThrow('Student has no active session');
    });

    it('should handle null examWithQuestions gracefully', async () => {
      mockExamRepo.findByIdAndTeacher.mockResolvedValue(makeExam());
      mockExamRepo.findSessionByExamAndStudent.mockResolvedValue(makeSession());
      mockSubmissionRepo.findBySession.mockResolvedValue([makeSubmission()]);
      mockExamRepo.findByIdWithQuestions.mockResolvedValue(null);

      const result = await examService.getStudentFileSnapshot(examId, teacherId, studentId);

      expect(result.answers[0].questionTitle).toBe('Unknown');
    });
  });

  describe('getClassExamsForStudent', () => {
    it('should return SCHEDULED and ACTIVE exams only', async () => {
      mockClassRepo.findMembership.mockResolvedValue(true);
      mockExamRepo.findAllByClass.mockResolvedValue([
        makeExam({ status: 'DRAFT' }),
        makeExam({ id: 'exam-2', status: 'SCHEDULED' }),
        makeExam({ id: 'exam-3', status: 'ACTIVE' }),
        makeExam({ id: 'exam-4', status: 'COMPLETED' }),
      ]);

      const result = await examService.getClassExamsForStudent(classId, studentId);
      expect(result).toHaveLength(2);
      expect(result.map((e) => e.status)).toContain('SCHEDULED');
      expect(result.map((e) => e.status)).toContain('ACTIVE');
    });

    it('should exclude DRAFT and COMPLETED exams', async () => {
      mockClassRepo.findMembership.mockResolvedValue(true);
      mockExamRepo.findAllByClass.mockResolvedValue([
        makeExam({ status: 'DRAFT' }),
        makeExam({ id: 'exam-2', status: 'COMPLETED' }),
      ]);

      const result = await examService.getClassExamsForStudent(classId, studentId);
      expect(result).toHaveLength(0);
    });

    it('should throw if student is not enrolled', async () => {
      mockClassRepo.findMembership.mockResolvedValue(false);

      await expect(examService.getClassExamsForStudent(classId, studentId)).rejects.toThrow(
        'Not enrolled in this class'
      );
    });
  });

  describe('getExamForStudent', () => {
    it('should return exam without expectedOutput in test cases', async () => {
      const examWithQuestion = makeExamWithQuestions({ status: 'ACTIVE' });
      const questionWithCase = makeQuestionWithTestCases();
      questionWithCase.testCases = [makeTestCase({ expectedOutput: 'secret' })];
      examWithQuestion.questions = [questionWithCase];

      mockExamRepo.findByIdWithQuestions.mockResolvedValue(examWithQuestion);
      mockClassRepo.findMembership.mockResolvedValue(true);

      const result = await examService.getExamForStudent(examId, studentId);

      expect(result.questions).toHaveLength(1);
      expect((result.questions[0].testCases[0] as any).expectedOutput).toBeUndefined();
      expect(result.questions[0].testCases[0].name).toBe('Basic test');
    });

    it('should return SCHEDULED exam to enrolled student', async () => {
      mockExamRepo.findByIdWithQuestions.mockResolvedValue(
        makeExamWithQuestions({ status: 'SCHEDULED' })
      );
      mockClassRepo.findMembership.mockResolvedValue(true);

      const result = await examService.getExamForStudent(examId, studentId);
      expect(result.status).toBe('SCHEDULED');
    });

    it('should throw if exam is DRAFT', async () => {
      mockExamRepo.findByIdWithQuestions.mockResolvedValue(
        makeExamWithQuestions({ status: 'DRAFT' })
      );

      await expect(examService.getExamForStudent(examId, studentId)).rejects.toThrow(
        'Exam is not available'
      );
    });

    it('should throw if exam is COMPLETED', async () => {
      mockExamRepo.findByIdWithQuestions.mockResolvedValue(
        makeExamWithQuestions({ status: 'COMPLETED' })
      );

      await expect(examService.getExamForStudent(examId, studentId)).rejects.toThrow(
        'Exam is not available'
      );
    });

    it('should throw if student is not enrolled', async () => {
      mockExamRepo.findByIdWithQuestions.mockResolvedValue(
        makeExamWithQuestions({ status: 'ACTIVE' })
      );
      mockClassRepo.findMembership.mockResolvedValue(false);

      await expect(examService.getExamForStudent(examId, studentId)).rejects.toThrow(
        'Not enrolled in this class'
      );
    });

    it('should throw if exam not found', async () => {
      mockExamRepo.findByIdWithQuestions.mockResolvedValue(null);

      await expect(examService.getExamForStudent(examId, studentId)).rejects.toThrow(
        'Exam not found'
      );
    });
  });

  describe('startExamSession', () => {
    it('should create a session for an ACTIVE exam', async () => {
      mockExamRepo.findById.mockResolvedValue(makeExam({ status: 'ACTIVE' }));
      mockClassRepo.findMembership.mockResolvedValue(true);
      mockExamRepo.findSessionByExamAndStudent.mockResolvedValue(null);
      mockExamRepo.createSession.mockResolvedValue(makeSession());

      const result = await examService.startExamSession(examId, studentId);

      expect(mockExamRepo.createSession).toHaveBeenCalledWith(
        expect.objectContaining({ examId, studentId })
      );
      expect(result.isSubmitted).toBe(false);
      expect(result.tabSwitchCount).toBe(0);
    });

    it('should set expiresAt based on durationMinutes', async () => {
      const before = Date.now();
      mockExamRepo.findById.mockResolvedValue(makeExam({ status: 'ACTIVE', durationMinutes: 60 }));
      mockClassRepo.findMembership.mockResolvedValue(true);
      mockExamRepo.findSessionByExamAndStudent.mockResolvedValue(null);
      mockExamRepo.createSession.mockResolvedValue(makeSession());

      await examService.startExamSession(examId, studentId);

      const call = mockExamRepo.createSession.mock.calls[0][0] as any;
      const diffMinutes = (call.expiresAt.getTime() - before) / 60000;
      expect(diffMinutes).toBeGreaterThanOrEqual(59.9);
      expect(diffMinutes).toBeLessThanOrEqual(60.1);
    });

    it('should throw if exam is not ACTIVE', async () => {
      mockExamRepo.findById.mockResolvedValue(makeExam({ status: 'SCHEDULED' }));

      await expect(examService.startExamSession(examId, studentId)).rejects.toThrow(
        'Exam is not active'
      );
    });

    it('should throw if session already exists', async () => {
      mockExamRepo.findById.mockResolvedValue(makeExam({ status: 'ACTIVE' }));
      mockClassRepo.findMembership.mockResolvedValue(true);
      mockExamRepo.findSessionByExamAndStudent.mockResolvedValue(makeSession());

      await expect(examService.startExamSession(examId, studentId)).rejects.toThrow(
        'Exam session already exists'
      );
    });

    it('should throw if student is not enrolled', async () => {
      mockExamRepo.findById.mockResolvedValue(makeExam({ status: 'ACTIVE' }));
      mockClassRepo.findMembership.mockResolvedValue(false);

      await expect(examService.startExamSession(examId, studentId)).rejects.toThrow(
        'Not enrolled in this class'
      );
    });

    it('should throw if exam not found', async () => {
      mockExamRepo.findById.mockResolvedValue(null);

      await expect(examService.startExamSession(examId, studentId)).rejects.toThrow(
        'Exam not found'
      );
    });
  });

  describe('getStudentSession', () => {
    it('should return the session for an exam', async () => {
      mockExamRepo.findSessionByExamAndStudent.mockResolvedValue(makeSession());

      const result = await examService.getStudentSession(examId, studentId);
      expect(result.examId).toBe(examId);
      expect(result.studentId).toBe(studentId);
      expect(result.isSubmitted).toBe(false);
    });

    it('should throw if session not found', async () => {
      mockExamRepo.findSessionByExamAndStudent.mockResolvedValue(null);

      await expect(examService.getStudentSession(examId, studentId)).rejects.toThrow(
        'Session not found'
      );
    });
  });

  describe('submitExamSession', () => {
    it('should submit an active session', async () => {
      const submittedAt = new Date();
      mockExamRepo.findSessionByExamAndStudent.mockResolvedValue(makeSession());
      mockExamRepo.updateSession.mockResolvedValue(makeSession({ isSubmitted: true, submittedAt }));

      const result = await examService.submitExamSession(examId, studentId);
      expect(result.isSubmitted).toBe(true);
      expect(result.submittedAt).toEqual(submittedAt);
    });

    it('should throw if session not found', async () => {
      mockExamRepo.findSessionByExamAndStudent.mockResolvedValue(null);

      await expect(examService.submitExamSession(examId, studentId)).rejects.toThrow(
        'Session not found'
      );
    });

    it('should throw if already submitted', async () => {
      mockExamRepo.findSessionByExamAndStudent.mockResolvedValue(
        makeSession({ isSubmitted: true })
      );

      await expect(examService.submitExamSession(examId, studentId)).rejects.toThrow(
        'Exam already submitted'
      );
    });

    it('should throw if session has expired', async () => {
      mockExamRepo.findSessionByExamAndStudent.mockResolvedValue(
        makeSession({ expiresAt: new Date(Date.now() - 1000) })
      );

      await expect(examService.submitExamSession(examId, studentId)).rejects.toThrow(
        'Exam session has expired'
      );
    });

    it('should call examGradingService.gradeExamSession after submission', async () => {
      mockExamRepo.findSessionByExamAndStudent.mockResolvedValue(makeSession());
      mockExamRepo.updateSession.mockResolvedValue(
        makeSession({ isSubmitted: true, submittedAt: new Date() })
      );

      await examService.submitExamSession(examId, studentId);

      expect(mockExamRepo.updateSession).toHaveBeenCalledWith(
        examId,
        studentId,
        expect.objectContaining({ isSubmitted: true })
      );
    });
  });

  describe('recordTabSwitch', () => {
    it('should increment tab switch count', async () => {
      mockExamRepo.findSessionByExamAndStudent.mockResolvedValue(
        makeSession({ tabSwitchCount: 2 })
      );
      mockExamRepo.updateSession.mockResolvedValue(makeSession({ tabSwitchCount: 3 }));

      const result = await examService.recordTabSwitch(examId, studentId);
      expect(result.tabSwitchCount).toBe(3);
    });

    it('should throw if session not found', async () => {
      mockExamRepo.findSessionByExamAndStudent.mockResolvedValue(null);

      await expect(examService.recordTabSwitch(examId, studentId)).rejects.toThrow(
        'Session not found'
      );
    });

    it('should throw if exam already submitted', async () => {
      mockExamRepo.findSessionByExamAndStudent.mockResolvedValue(
        makeSession({ isSubmitted: true })
      );

      await expect(examService.recordTabSwitch(examId, studentId)).rejects.toThrow(
        'Exam already submitted'
      );
    });
  });

  describe('saveAnswer', () => {
    it('should save an answer successfully', async () => {
      mockExamRepo.findSessionByExamAndStudent.mockResolvedValue(makeSession());
      mockExamRepo.findQuestionById.mockResolvedValue(makeQuestion());
      mockSubmissionRepo.upsert.mockResolvedValue(makeSubmission());

      const result = await examService.saveAnswer(examId, questionId, studentId, 'print("hello")');

      expect(mockSubmissionRepo.upsert).toHaveBeenCalledWith({
        examSessionId: sessionId,
        examId,
        questionId,
        studentId,
        code: 'print("hello")',
      });
      expect(result.code).toBe('print("hello")');
      expect(result.status).toBe('PENDING');
    });

    it('should throw if session not found', async () => {
      mockExamRepo.findSessionByExamAndStudent.mockResolvedValue(null);

      await expect(
        examService.saveAnswer(examId, questionId, studentId, 'print("x")')
      ).rejects.toThrow('Session not found');
    });

    it('should throw if exam already submitted', async () => {
      mockExamRepo.findSessionByExamAndStudent.mockResolvedValue(
        makeSession({ isSubmitted: true })
      );

      await expect(
        examService.saveAnswer(examId, questionId, studentId, 'print("x")')
      ).rejects.toThrow('Exam already submitted');
    });

    it('should throw if session has expired', async () => {
      mockExamRepo.findSessionByExamAndStudent.mockResolvedValue(
        makeSession({ expiresAt: new Date(Date.now() - 1000) })
      );

      await expect(
        examService.saveAnswer(examId, questionId, studentId, 'print("x")')
      ).rejects.toThrow('Exam session has expired');
    });

    it('should throw if question not found', async () => {
      mockExamRepo.findSessionByExamAndStudent.mockResolvedValue(makeSession());
      mockExamRepo.findQuestionById.mockResolvedValue(null);

      await expect(
        examService.saveAnswer(examId, questionId, studentId, 'print("x")')
      ).rejects.toThrow('Question not found');
    });

    it('should throw if question belongs to a different exam', async () => {
      mockExamRepo.findSessionByExamAndStudent.mockResolvedValue(makeSession());
      mockExamRepo.findQuestionById.mockResolvedValue(makeQuestion({ examId: 'other-exam' }));

      await expect(
        examService.saveAnswer(examId, questionId, studentId, 'print("x")')
      ).rejects.toThrow('Question not found');
    });
  });

  describe('getSessionAnswers', () => {
    it('should return all answers for a session', async () => {
      const submissions = [
        makeSubmission({ questionId: 'q-001', code: 'print("a")' }),
        makeSubmission({ id: 'sub-002', questionId: 'q-002', code: 'print("b")' }),
      ];
      mockExamRepo.findSessionByExamAndStudent.mockResolvedValue(makeSession());
      mockSubmissionRepo.findBySession.mockResolvedValue(submissions);

      const result = await examService.getSessionAnswers(examId, studentId);

      expect(mockSubmissionRepo.findBySession).toHaveBeenCalledWith(sessionId);
      expect(result).toHaveLength(2);
      expect(result[0].code).toBe('print("a")');
      expect(result[1].code).toBe('print("b")');
    });

    it('should return empty array if no answers saved yet', async () => {
      mockExamRepo.findSessionByExamAndStudent.mockResolvedValue(makeSession());
      mockSubmissionRepo.findBySession.mockResolvedValue([]);

      const result = await examService.getSessionAnswers(examId, studentId);

      expect(result).toHaveLength(0);
    });

    it('should throw if session not found', async () => {
      mockExamRepo.findSessionByExamAndStudent.mockResolvedValue(null);

      await expect(examService.getSessionAnswers(examId, studentId)).rejects.toThrow(
        'Session not found'
      );
    });
  });

  describe('autoSubmitExam', () => {
    beforeEach(() => {
      mockExamRepo.findActiveSessionsByExam.mockReset();
      mockExamRepo.findById.mockReset();
      mockExamRepo.updateSession.mockReset();
      mockExamRepo.update.mockReset();
      mockExamRepo.findSessionByExamAndStudent.mockReset();
    });

    it('should auto-submit all active sessions for an exam', async () => {
      const session1 = makeSession({ id: 'sess-auto-1', studentId: 'student-1' });
      const session2 = makeSession({ id: 'sess-auto-2', studentId: 'student-2' });

      mockExamRepo.findActiveSessionsByExam.mockResolvedValue([session1, session2]);
      mockExamRepo.findById.mockResolvedValue(makeExam());
      mockExamRepo.updateSession.mockResolvedValue(
        makeSession({ isSubmitted: true, submittedAt: new Date() })
      );
      mockExamRepo.update.mockResolvedValue(makeExam({ status: 'COMPLETED' }));

      await examService.autoSubmitExam(examId);

      expect(mockExamRepo.findActiveSessionsByExam).toHaveBeenCalledWith(examId);
      expect(mockExamRepo.updateSession).toHaveBeenCalledTimes(2);
      expect(mockExamRepo.updateSession).toHaveBeenCalledWith(
        examId,
        'student-1',
        expect.objectContaining({ isSubmitted: true })
      );
      expect(mockExamRepo.updateSession).toHaveBeenCalledWith(
        examId,
        'student-2',
        expect.objectContaining({ isSubmitted: true })
      );
      expect(mockExamRepo.update).toHaveBeenCalledWith(
        examId,
        teacherId,
        expect.objectContaining({ status: 'COMPLETED' })
      );
    });

    it('should call examGradingService.gradeExamSession for each submitted session', async () => {
      const session1 = makeSession({ id: 'sess-grade-1', studentId: 'student-grade-1' });

      mockExamRepo.findActiveSessionsByExam.mockResolvedValue([session1]);
      mockExamRepo.findById.mockResolvedValue(makeExam());
      mockExamRepo.updateSession.mockResolvedValue(
        makeSession({ isSubmitted: true, submittedAt: new Date() })
      );
      mockExamRepo.update.mockResolvedValue(makeExam({ status: 'COMPLETED' }));

      await examService.autoSubmitExam(examId);
      await new Promise((r) => setTimeout(r, 50));

      expect(examGradingModule.examGradingService.gradeExamSession).toHaveBeenCalledWith(
        examId,
        'student-grade-1',
        'sess-grade-1'
      );
    });

    it('should call examRedis.markStudentSubmitted for each session', async () => {
      const session1 = makeSession({ id: 'sess-redis-1', studentId: 'student-redis-1' });

      mockExamRepo.findActiveSessionsByExam.mockResolvedValue([session1]);
      mockExamRepo.findById.mockResolvedValue(makeExam());
      mockExamRepo.updateSession.mockResolvedValue(
        makeSession({ isSubmitted: true, submittedAt: new Date() })
      );
      mockExamRepo.update.mockResolvedValue(makeExam({ status: 'COMPLETED' }));

      await examService.autoSubmitExam(examId);
      await new Promise((r) => setTimeout(r, 50));

      expect(mockExamRedis.markStudentSubmitted).toHaveBeenCalledWith(examId, 'student-redis-1');
    });

    it('should do nothing if there are no active sessions', async () => {
      mockExamRepo.findActiveSessionsByExam.mockResolvedValue([]);
      mockExamRepo.findById.mockResolvedValue(makeExam());
      mockExamRepo.update.mockResolvedValue(makeExam({ status: 'COMPLETED' }));

      await examService.autoSubmitExam(examId);

      expect(mockExamRepo.updateSession).not.toHaveBeenCalled();
      expect(mockExamRedis.markStudentSubmitted).not.toHaveBeenCalled();
    });

    it('should still mark exam COMPLETED even if one session updateSession fails', async () => {
      const session1 = makeSession({ id: 'sess-fail-1', studentId: 'student-fail-1' });
      const session2 = makeSession({ id: 'sess-fail-2', studentId: 'student-fail-2' });

      mockExamRepo.findActiveSessionsByExam.mockResolvedValue([session1, session2]);
      mockExamRepo.findById.mockResolvedValue(makeExam());
      mockExamRepo.updateSession
        .mockRejectedValueOnce(new Error('DB error'))
        .mockResolvedValueOnce(makeSession({ isSubmitted: true, submittedAt: new Date() }));
      mockExamRepo.update.mockResolvedValue(makeExam({ status: 'COMPLETED' }));

      await expect(examService.autoSubmitExam(examId)).resolves.not.toThrow();

      expect(mockExamRepo.updateSession).toHaveBeenCalledTimes(2);
      expect(mockExamRepo.update).toHaveBeenCalledWith(
        examId,
        teacherId,
        expect.objectContaining({ status: 'COMPLETED' })
      );
    });
  });
});
