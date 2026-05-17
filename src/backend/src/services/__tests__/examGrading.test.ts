import { examGradingService } from '../examGrading';
import { examRepository } from '../../repositories/exam';
import { examSubmissionRepository } from '../../repositories/examSubmission';
import { gradeRepository } from '../../repositories/grade';
import { executionService } from '../execution';
import { describe, it, expect, beforeEach, jest } from '@jest/globals';

jest.mock('../../repositories/exam');
jest.mock('../../repositories/examSubmission');
jest.mock('../../repositories/grade');
jest.mock('../execution');

const mockExamRepo = examRepository as jest.Mocked<typeof examRepository>;
const mockSubRepo = examSubmissionRepository as jest.Mocked<typeof examSubmissionRepository>;
const mockGradeRepo = gradeRepository as jest.Mocked<typeof gradeRepository>;
const mockExecution = executionService as jest.Mocked<typeof executionService>;

const makeSubmission = (overrides = {}) => ({
  id: 'sub-1',
  examSessionId: 'session-1',
  examId: 'exam-1',
  questionId: 'q-1',
  studentId: 'student-1',
  code: 'print("hello")',
  status: 'PENDING' as const,
  score: null,
  maxScore: null,
  testResults: null,
  submittedAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const makeTestCase = (overrides = {}) => ({
  id: 'tc-1',
  questionId: 'q-1',
  name: 'Basic test',
  inputData: null,
  expectedOutput: '5',
  sysArgs: null,
  weight: 1,
  orderIndex: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const makeExamWithQuestions = (overrides: any = {}) => ({
  id: 'exam-1',
  classId: 'class-1',
  teacherId: 'teacher-1',
  title: 'Test Exam',
  instructions: null,
  language: 'python',
  durationMinutes: 60,
  scheduledStart: null,
  scheduledEnd: null,
  status: 'ACTIVE' as const,
  maxScore: 100,
  createdAt: new Date(),
  updatedAt: new Date(),
  isOpenBook: false,
  questions: [
    {
      id: 'q-1',
      examId: 'exam-1',
      title: 'Q1',
      description: null,
      maxScore: 50,
      language: 'python',
      orderIndex: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      testCases: [makeTestCase()],
    },
  ],
  ...overrides,
});

describe('ExamGradingService', () => {
  beforeEach(async () => jest.clearAllMocks());

  describe('gradeQuestionSubmission', () => {
    it('should grade a passing submission correctly', async () => {
      mockSubRepo.findById.mockResolvedValue(makeSubmission());
      mockExamRepo.findByIdWithQuestions.mockResolvedValue(makeExamWithQuestions());
      mockExecution.executeCode.mockResolvedValue({ output: '5', exitCode: 0 });
      mockSubRepo.updateResult.mockResolvedValue({} as any);

      await examGradingService.gradeQuestionSubmission('sub-1');

      expect(mockSubRepo.updateResult).toHaveBeenCalledWith('sub-1', {
        status: 'COMPLETED',
        score: 50,
        maxScore: 50,
        testResults: [expect.objectContaining({ name: 'Basic test', passed: true, weight: 1 })],
      });
    });

    it('should grade a failing submission correctly', async () => {
      mockSubRepo.findById.mockResolvedValue(makeSubmission());
      mockExamRepo.findByIdWithQuestions.mockResolvedValue(makeExamWithQuestions());
      mockExecution.executeCode.mockResolvedValue({ output: '999', exitCode: 0 });
      mockSubRepo.updateResult.mockResolvedValue({} as any);

      await examGradingService.gradeQuestionSubmission('sub-1');

      expect(mockSubRepo.updateResult).toHaveBeenCalledWith('sub-1', {
        status: 'FAILED',
        score: 0,
        maxScore: 50,
        testResults: [expect.objectContaining({ name: 'Basic test', passed: false, weight: 1 })],
      });
    });

    it('should score proportionally with unequal weights', async () => {
      const exam = makeExamWithQuestions({
        questions: [
          {
            ...makeExamWithQuestions().questions[0],
            maxScore: 100,
            testCases: [
              makeTestCase({ id: 'tc-1', name: 'Light', expectedOutput: 'a', weight: 1 }),
              makeTestCase({ id: 'tc-2', name: 'Heavy', expectedOutput: 'b', weight: 3 }),
            ],
          },
        ],
      });

      mockSubRepo.findById.mockResolvedValue(makeSubmission());
      mockExamRepo.findByIdWithQuestions.mockResolvedValue(exam);
      mockExecution.executeCode
        .mockResolvedValueOnce({ output: 'a', exitCode: 0 })
        .mockResolvedValueOnce({ output: 'wrong', exitCode: 0 });
      mockSubRepo.updateResult.mockResolvedValue({} as any);

      await examGradingService.gradeQuestionSubmission('sub-1');

      expect(mockSubRepo.updateResult).toHaveBeenCalledWith('sub-1', {
        status: 'FAILED',
        score: 25,
        maxScore: 100,
        testResults: expect.arrayContaining([
          expect.objectContaining({ name: 'Light', passed: true, weight: 1 }),
          expect.objectContaining({ name: 'Heavy', passed: false, weight: 3 }),
        ]),
      });
    });

    it('should score correctly when only the heavy test case passes', async () => {
      const exam = makeExamWithQuestions({
        questions: [
          {
            ...makeExamWithQuestions().questions[0],
            maxScore: 100,
            testCases: [
              makeTestCase({ id: 'tc-1', name: 'Light', expectedOutput: 'a', weight: 1 }),
              makeTestCase({ id: 'tc-2', name: 'Heavy', expectedOutput: 'b', weight: 3 }),
            ],
          },
        ],
      });

      mockSubRepo.findById.mockResolvedValue(makeSubmission());
      mockExamRepo.findByIdWithQuestions.mockResolvedValue(exam);
      mockExecution.executeCode
        .mockResolvedValueOnce({ output: 'wrong', exitCode: 0 })
        .mockResolvedValueOnce({ output: 'b', exitCode: 0 });
      mockSubRepo.updateResult.mockResolvedValue({} as any);

      await examGradingService.gradeQuestionSubmission('sub-1');

      expect(mockSubRepo.updateResult).toHaveBeenCalledWith('sub-1', {
        status: 'FAILED',
        score: 75,
        maxScore: 100,
        testResults: expect.anything(),
      });
    });

    it('should auto-pass questions with no test cases', async () => {
      const exam = makeExamWithQuestions({
        questions: [{ ...makeExamWithQuestions().questions[0], testCases: [] }],
      });

      mockSubRepo.findById.mockResolvedValue(makeSubmission());
      mockExamRepo.findByIdWithQuestions.mockResolvedValue(exam);
      mockSubRepo.updateResult.mockResolvedValue({} as any);

      await examGradingService.gradeQuestionSubmission('sub-1');

      expect(mockExecution.executeCode).not.toHaveBeenCalled();
      expect(mockSubRepo.updateResult).toHaveBeenCalledWith('sub-1', {
        status: 'COMPLETED',
        score: 50,
        maxScore: 50,
        testResults: [],
      });
    });

    it('should return early if submission not found', async () => {
      mockSubRepo.findById.mockResolvedValue(null);

      await examGradingService.gradeQuestionSubmission('nonexistent');

      expect(mockExecution.executeCode).not.toHaveBeenCalled();
      expect(mockSubRepo.updateResult).not.toHaveBeenCalled();
    });

    it('should return early if exam not found', async () => {
      mockSubRepo.findById.mockResolvedValue(makeSubmission());
      mockExamRepo.findByIdWithQuestions.mockResolvedValue(null);

      await examGradingService.gradeQuestionSubmission('sub-1');

      expect(mockSubRepo.updateResult).not.toHaveBeenCalled();
    });

    it('should return early if question not found on exam', async () => {
      mockSubRepo.findById.mockResolvedValue(makeSubmission({ questionId: 'nonexistent-q' }));
      mockExamRepo.findByIdWithQuestions.mockResolvedValue(makeExamWithQuestions());

      await examGradingService.gradeQuestionSubmission('sub-1');

      expect(mockSubRepo.updateResult).not.toHaveBeenCalled();
    });
  });

  describe('gradeExamSession', () => {
    it('should grade all pending submissions and create grade', async () => {
      const exam = { ...makeExamWithQuestions(), maxScore: 100 };
      const pendingSub = makeSubmission({ status: 'PENDING' as const });
      const gradedSub = {
        ...makeSubmission(),
        status: 'COMPLETED' as const,
        score: 40,
        maxScore: 50,
      };

      mockExamRepo.findById.mockResolvedValue(exam);
      mockSubRepo.findBySession
        .mockResolvedValueOnce([pendingSub])
        .mockResolvedValueOnce([gradedSub]);
      mockSubRepo.findById.mockResolvedValue(pendingSub);
      mockExamRepo.findByIdWithQuestions.mockResolvedValue(exam);
      mockExecution.executeCode.mockResolvedValue({ output: '5', exitCode: 0 });
      mockSubRepo.updateResult.mockResolvedValue({} as any);
      mockGradeRepo.findByStudentAndSource.mockResolvedValue(null);
      mockGradeRepo.create.mockResolvedValue({} as any);

      await examGradingService.gradeExamSession('exam-1', 'student-1', 'session-1');

      expect(mockGradeRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          studentId: 'student-1',
          classId: 'class-1',
          sourceType: 'EXAM',
          sourceId: 'Test Exam',
          score: 40,
          maxScore: 50,
        })
      );
    });

    it('should update existing grade if one already exists', async () => {
      const exam = { ...makeExamWithQuestions(), maxScore: 100 };
      const existingGrade = {
        id: 'grade-1',
        studentId: 'student-1',
        classId: 'class-1',
        sourceType: 'EXAM' as const,
        sourceId: 'exam-1',
        score: 20,
        maxScore: 100,
        percentage: 20,
        releasedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockExamRepo.findById.mockResolvedValue(exam);
      mockSubRepo.findBySession.mockResolvedValue([]);
      mockGradeRepo.findByStudentAndSource.mockResolvedValue(existingGrade);
      mockGradeRepo.update.mockResolvedValue({} as any);

      await examGradingService.gradeExamSession('exam-1', 'student-1', 'session-1');

      expect(mockGradeRepo.update).toHaveBeenCalledWith('grade-1', { score: 0, maxScore: 100 });
      expect(mockGradeRepo.create).not.toHaveBeenCalled();
    });

    it('should skip already graded submissions', async () => {
      const exam = makeExamWithQuestions();
      const completedSub = makeSubmission({
        status: 'COMPLETED' as const,
        score: 50,
        maxScore: 50,
      });

      mockExamRepo.findById.mockResolvedValue(exam);
      mockSubRepo.findBySession
        .mockResolvedValueOnce([completedSub])
        .mockResolvedValueOnce([completedSub]);
      mockGradeRepo.findByStudentAndSource.mockResolvedValue(null);
      mockGradeRepo.create.mockResolvedValue({} as any);

      await examGradingService.gradeExamSession('exam-1', 'student-1', 'session-1');

      expect(mockExecution.executeCode).not.toHaveBeenCalled();
    });

    it('should return early if exam not found', async () => {
      mockExamRepo.findById.mockResolvedValue(null);

      await examGradingService.gradeExamSession('nonexistent', 'student-1', 'session-1');

      expect(mockSubRepo.findBySession).not.toHaveBeenCalled();
      expect(mockGradeRepo.create).not.toHaveBeenCalled();
    });
  });
});
