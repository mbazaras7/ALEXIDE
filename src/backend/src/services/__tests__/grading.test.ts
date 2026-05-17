import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { gradingService } from '../grading';
import { executionService } from '../execution';
import { aiFeedbackService } from '../aiFeedback';
import { submissionRepository } from '../../repositories/submission';
import { gradingRepository } from '../../repositories/grading';
import { assignmentRepository } from '../../repositories/assignment';

jest.mock('../execution');
jest.mock('../aiFeedback');
jest.mock('../../repositories/submission');
jest.mock('../../repositories/grading');
jest.mock('../../repositories/assignment');

const mockSubmission = {
  id: 'sub-1',
  assignmentId: 'asgn-1',
  studentId: 'student-1',
  code: 'print("hello")',
  status: 'PENDING' as const,
  score: null,
  maxScore: null,
};

const mockAssignment = {
  id: 'asgn-1',
  classId: 'class-1',
  teacherId: 'teacher-1',
  title: 'Test',
  description: null,
  maxScore: 100,
  language: 'python',
};

const mockTestCases = [
  {
    id: 'tc-1',
    assignmentId: 'asgn-1',
    name: 'Test 1',
    inputData: null,
    expectedOutput: 'hello',
    sysArgs: null,
    weight: 1,
    orderIndex: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'tc-2',
    assignmentId: 'asgn-1',
    name: 'Test 2',
    inputData: '5',
    expectedOutput: '10',
    sysArgs: null,
    weight: 1,
    orderIndex: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

const mockGradingRepo = gradingRepository as jest.Mocked<typeof gradingRepository>;
const mockAssignmentRepo = assignmentRepository as jest.Mocked<typeof assignmentRepository>;
const mockExecutionService = executionService as jest.Mocked<typeof executionService>;
const mockSubmissionRepo = submissionRepository as jest.Mocked<typeof submissionRepository>;
const mockAiFeedback = aiFeedbackService as jest.Mocked<typeof aiFeedbackService>;

describe('GradingService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default happy-path stubs
    mockGradingRepo.setSubmissionRunning.mockResolvedValue(undefined);
    mockGradingRepo.updateSubmissionResult.mockResolvedValue(undefined);
    mockGradingRepo.setSubmissionFailed.mockResolvedValue(undefined);
    mockGradingRepo.upsertGrade.mockResolvedValue(undefined);
    mockSubmissionRepo.saveAiFeedback.mockResolvedValue(undefined as any);
  });

  describe('gradeSubmission', () => {
    it('should throw if submission not found', async () => {
      mockGradingRepo.findSubmissionById.mockResolvedValue(null);
      await expect(gradingService.gradeSubmission('sub-x')).rejects.toThrow('Submission not found');
    });

    it('should throw if assignment not found', async () => {
      mockGradingRepo.findSubmissionById.mockResolvedValue(mockSubmission as any);
      mockGradingRepo.findAssignmentById.mockResolvedValue(null);
      await expect(gradingService.gradeSubmission('sub-1')).rejects.toThrow('Assignment not found');
    });

    it('should set status to RUNNING then final status on success', async () => {
      mockGradingRepo.findSubmissionById.mockResolvedValue(mockSubmission as any);
      mockGradingRepo.findAssignmentById.mockResolvedValue(mockAssignment as any);
      mockAssignmentRepo.findTestCasesByAssignment.mockResolvedValue([mockTestCases[0]] as any);
      mockExecutionService.executeCode.mockResolvedValue({ output: 'hello', exitCode: 0 } as any);
      mockAiFeedback.generateSubmissionFeedback.mockResolvedValue({
        feedback: 'Good',
        generatedAt: new Date(),
      } as any);

      await gradingService.gradeSubmission('sub-1');

      expect(mockGradingRepo.setSubmissionRunning).toHaveBeenCalledWith('sub-1');
      expect(mockGradingRepo.updateSubmissionResult).toHaveBeenCalledWith(
        'sub-1',
        expect.objectContaining({ status: 'COMPLETED', score: 100 })
      );
    });

    it('should score 100 and set COMPLETED when all test cases pass', async () => {
      mockGradingRepo.findSubmissionById.mockResolvedValue(mockSubmission as any);
      mockGradingRepo.findAssignmentById.mockResolvedValue(mockAssignment as any);
      mockAssignmentRepo.findTestCasesByAssignment.mockResolvedValue([mockTestCases[0]] as any);
      mockExecutionService.executeCode.mockResolvedValue({ output: 'hello', exitCode: 0 } as any);
      mockAiFeedback.generateSubmissionFeedback.mockResolvedValue({
        feedback: 'Good',
        generatedAt: new Date(),
      } as any);

      await gradingService.gradeSubmission('sub-1');

      expect(mockGradingRepo.updateSubmissionResult).toHaveBeenCalledWith(
        'sub-1',
        expect.objectContaining({ score: 100, status: 'COMPLETED' })
      );
    });

    it('should score proportionally and set FAILED on partial pass (equal weights)', async () => {
      mockGradingRepo.findSubmissionById.mockResolvedValue(mockSubmission as any);
      mockGradingRepo.findAssignmentById.mockResolvedValue(mockAssignment as any);
      mockAssignmentRepo.findTestCasesByAssignment.mockResolvedValue(mockTestCases as any);
      mockExecutionService.executeCode
        .mockResolvedValueOnce({ output: 'hello', exitCode: 0 } as any)
        .mockResolvedValueOnce({ output: 'wrong', exitCode: 0 } as any);
      mockAiFeedback.generateSubmissionFeedback.mockResolvedValue({
        feedback: 'Good',
        generatedAt: new Date(),
      } as any);

      await gradingService.gradeSubmission('sub-1');

      expect(mockGradingRepo.updateSubmissionResult).toHaveBeenCalledWith(
        'sub-1',
        expect.objectContaining({ score: 50, status: 'FAILED' })
      );
    });

    it('should score correctly with unequal weights', async () => {
      const weightedCases = [
        { ...mockTestCases[0], weight: 1 },
        { ...mockTestCases[1], weight: 3 },
      ];
      mockGradingRepo.findSubmissionById.mockResolvedValue(mockSubmission as any);
      mockGradingRepo.findAssignmentById.mockResolvedValue(mockAssignment as any);
      mockAssignmentRepo.findTestCasesByAssignment.mockResolvedValue(weightedCases as any);
      mockExecutionService.executeCode
        .mockResolvedValueOnce({ output: 'hello', exitCode: 0 } as any)
        .mockResolvedValueOnce({ output: 'wrong', exitCode: 0 } as any);
      mockAiFeedback.generateSubmissionFeedback.mockResolvedValue({
        feedback: 'Good',
        generatedAt: new Date(),
      } as any);

      await gradingService.gradeSubmission('sub-1');

      expect(mockGradingRepo.updateSubmissionResult).toHaveBeenCalledWith(
        'sub-1',
        expect.objectContaining({ score: 25, status: 'FAILED' })
      );
    });

    it('should give full score to the heavy test case when it passes', async () => {
      const weightedCases = [
        { ...mockTestCases[0], weight: 1 },
        { ...mockTestCases[1], weight: 3 },
      ];
      mockGradingRepo.findSubmissionById.mockResolvedValue(mockSubmission as any);
      mockGradingRepo.findAssignmentById.mockResolvedValue(mockAssignment as any);
      mockAssignmentRepo.findTestCasesByAssignment.mockResolvedValue(weightedCases as any);
      mockExecutionService.executeCode
        .mockResolvedValueOnce({ output: 'wrong', exitCode: 0 } as any)
        .mockResolvedValueOnce({ output: '10', exitCode: 0 } as any);
      mockAiFeedback.generateSubmissionFeedback.mockResolvedValue({
        feedback: 'Good',
        generatedAt: new Date(),
      } as any);

      await gradingService.gradeSubmission('sub-1');

      expect(mockGradingRepo.updateSubmissionResult).toHaveBeenCalledWith(
        'sub-1',
        expect.objectContaining({ score: 75, status: 'FAILED' })
      );
    });

    it('should include weight in each testResult', async () => {
      mockGradingRepo.findSubmissionById.mockResolvedValue(mockSubmission as any);
      mockGradingRepo.findAssignmentById.mockResolvedValue(mockAssignment as any);
      mockAssignmentRepo.findTestCasesByAssignment.mockResolvedValue([mockTestCases[0]] as any);
      mockExecutionService.executeCode.mockResolvedValue({ output: 'hello', exitCode: 0 } as any);
      mockAiFeedback.generateSubmissionFeedback.mockResolvedValue({
        feedback: 'Good',
        generatedAt: new Date(),
      } as any);

      await gradingService.gradeSubmission('sub-1');

      const call = mockGradingRepo.updateSubmissionResult.mock.calls[0];
      const results = JSON.parse((call[1] as any).testResults);
      expect(results[0]).toMatchObject({ name: 'Test 1', passed: true, weight: 1 });
    });

    it('should set status to FAILED and rethrow if execution throws', async () => {
      mockGradingRepo.findSubmissionById.mockResolvedValue(mockSubmission as any);
      mockGradingRepo.findAssignmentById.mockResolvedValue(mockAssignment as any);
      mockAssignmentRepo.findTestCasesByAssignment.mockResolvedValue([mockTestCases[0]] as any);
      mockExecutionService.executeCode.mockRejectedValue(new Error('Docker crashed') as never);

      await expect(gradingService.gradeSubmission('sub-1')).rejects.toThrow('Docker crashed');
      expect(mockGradingRepo.setSubmissionFailed).toHaveBeenCalledWith('sub-1');
    });

    it('should upsert a grade record after successful grading', async () => {
      mockGradingRepo.findSubmissionById.mockResolvedValue(mockSubmission as any);
      mockGradingRepo.findAssignmentById.mockResolvedValue(mockAssignment as any);
      mockAssignmentRepo.findTestCasesByAssignment.mockResolvedValue([mockTestCases[0]] as any);
      mockExecutionService.executeCode.mockResolvedValue({ output: 'hello', exitCode: 0 } as any);
      mockAiFeedback.generateSubmissionFeedback.mockResolvedValue({
        feedback: 'Good',
        generatedAt: new Date(),
      } as any);

      await gradingService.gradeSubmission('sub-1');

      expect(mockGradingRepo.upsertGrade).toHaveBeenCalledTimes(1);
      expect(mockGradingRepo.upsertGrade).toHaveBeenCalledWith(
        expect.objectContaining({
          studentId: 'student-1',
          classId: 'class-1',
          sourceId: 'asgn-1',
        })
      );
    });

    it('should fire aiFeedbackService after grading without blocking the result', async () => {
      mockGradingRepo.findSubmissionById.mockResolvedValue(mockSubmission as any);
      mockGradingRepo.findAssignmentById.mockResolvedValue(mockAssignment as any);
      mockAssignmentRepo.findTestCasesByAssignment.mockResolvedValue([mockTestCases[0]] as any);
      mockExecutionService.executeCode.mockResolvedValue({ output: 'hello', exitCode: 0 } as any);
      mockAiFeedback.generateSubmissionFeedback.mockResolvedValue({
        feedback: 'Well done!',
        generatedAt: new Date(),
      } as any);

      await gradingService.gradeSubmission('sub-1');
      await new Promise((r) => setTimeout(r, 0));

      expect(mockAiFeedback.generateSubmissionFeedback).toHaveBeenCalledTimes(1);
      expect(mockAiFeedback.generateSubmissionFeedback).toHaveBeenCalledWith(
        expect.objectContaining({
          assignmentTitle: mockAssignment.title,
          studentCode: mockSubmission.code,
          totalTests: 1,
          totalPassed: 1,
        })
      );
      expect(mockSubmissionRepo.saveAiFeedback).toHaveBeenCalledWith('sub-1', 'Well done!');
    });

    it('should not throw if aiFeedbackService rejects — error is swallowed silently', async () => {
      mockGradingRepo.findSubmissionById.mockResolvedValue(mockSubmission as any);
      mockGradingRepo.findAssignmentById.mockResolvedValue(mockAssignment as any);
      mockAssignmentRepo.findTestCasesByAssignment.mockResolvedValue([mockTestCases[0]] as any);
      mockExecutionService.executeCode.mockResolvedValue({ output: 'hello', exitCode: 0 } as any);
      mockAiFeedback.generateSubmissionFeedback.mockRejectedValue(
        new Error('OpenAI timeout') as never
      );

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      await expect(gradingService.gradeSubmission('sub-1')).resolves.not.toThrow();
      await new Promise((r) => setTimeout(r, 0));

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[aiFeedback]'),
        expect.stringContaining('OpenAI timeout')
      );
      consoleSpy.mockRestore();
    });
  });

  describe('reGradeSubmission', () => {
    it('should throw if submission not found', async () => {
      mockGradingRepo.findSubmissionWithAssignment.mockResolvedValue(null);
      await expect(gradingService.reGradeSubmission('sub-x', 'teacher-1')).rejects.toThrow(
        'Submission not found'
      );
    });

    it('should throw if assignment is not owned by teacher', async () => {
      mockGradingRepo.findSubmissionWithAssignment.mockResolvedValue({
        id: 'sub-1',
        assignmentId: 'asgn-1',
        status: 'COMPLETED',
      } as any);
      mockGradingRepo.findAssignmentByIdAndTeacher.mockResolvedValue(null);

      await expect(gradingService.reGradeSubmission('sub-1', 'teacher-1')).rejects.toThrow(
        'Submission not found'
      );
    });

    it('should throw if submission is already RUNNING', async () => {
      mockGradingRepo.findSubmissionWithAssignment.mockResolvedValue({
        id: 'sub-1',
        assignmentId: 'asgn-1',
        status: 'RUNNING',
      } as any);
      mockGradingRepo.findAssignmentByIdAndTeacher.mockResolvedValue(mockAssignment as any);

      await expect(gradingService.reGradeSubmission('sub-1', 'teacher-1')).rejects.toThrow(
        'Submission is already being graded'
      );
    });

    it('should call gradeSubmission when valid', async () => {
      mockGradingRepo.findSubmissionWithAssignment.mockResolvedValue({
        id: 'sub-1',
        assignmentId: 'asgn-1',
        status: 'COMPLETED',
      } as any);
      mockGradingRepo.findAssignmentByIdAndTeacher.mockResolvedValue(mockAssignment as any);

      const gradeSpy = jest
        .spyOn(gradingService, 'gradeSubmission')
        .mockResolvedValue(undefined as any);

      await gradingService.reGradeSubmission('sub-1', 'teacher-1');
      expect(gradeSpy).toHaveBeenCalledWith('sub-1');
    });

    it('should allow re-grading a FAILED submission', async () => {
      mockGradingRepo.findSubmissionWithAssignment.mockResolvedValue({
        id: 'sub-1',
        assignmentId: 'asgn-1',
        status: 'FAILED',
      } as any);
      mockGradingRepo.findAssignmentByIdAndTeacher.mockResolvedValue(mockAssignment as any);

      const gradeSpy = jest
        .spyOn(gradingService, 'gradeSubmission')
        .mockResolvedValue(undefined as any);

      await gradingService.reGradeSubmission('sub-1', 'teacher-1');
      expect(gradeSpy).toHaveBeenCalledWith('sub-1');
    });
  });
});
