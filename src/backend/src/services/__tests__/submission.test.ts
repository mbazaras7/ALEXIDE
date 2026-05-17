import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { submissionService } from '../submission';
import { submissionRepository } from '../../repositories/submission';
import { classRepository } from '../../repositories/class';
import { assignmentRepository } from '../../repositories/assignment';
import { gradingService } from '../grading';

jest.mock('../../repositories/submission');
jest.mock('../../repositories/class');
jest.mock('../../repositories/assignment');
jest.mock('../grading');

const mockSubmissionRepo = submissionRepository as jest.Mocked<typeof submissionRepository>;
const mockClassRepo = classRepository as jest.Mocked<typeof classRepository>;
const mockAssignmentRepo = assignmentRepository as jest.Mocked<typeof assignmentRepository>;
const mockGradingService = gradingService as jest.Mocked<typeof gradingService>;

const mockAssignment = {
  id: 'asgn-1',
  classId: 'class-1',
  teacherId: 'teacher-1',
  title: 'Test',
  status: 'PUBLISHED',
  dueDate: null,
  maxScore: 100,
  language: 'python',
} as any;

const mockStudentSubmission = {
  id: 'sub-1',
  assignmentId: 'asgn-1',
  code: 'print("hello")',
  status: 'COMPLETED',
  score: 100,
  maxScore: 100,
  testResults: [{ name: 'Test 1', passed: true, actualOutput: 'hello', expectedOutput: 'hello' }],
  submittedAt: new Date(),
  updatedAt: new Date(),
  feedback: null,
  feedbackUpdatedAt: null,
} as any;

describe('SubmissionService', () => {
  beforeEach(async () => jest.clearAllMocks());

  describe('submitAssignment', () => {
    it('should throw if neither code nor storageKey is provided', async () => {
      await expect(submissionService.submitAssignment('student-1', 'asgn-1')).rejects.toThrow(
        'Either code or storageKey must be provided'
      );
    });

    it('should throw if assignment not found', async () => {
      mockAssignmentRepo.findById.mockResolvedValueOnce(null);
      await expect(
        submissionService.submitAssignment('student-1', 'asgn-x', 'print()')
      ).rejects.toThrow('Assignment not found');
    });

    it('should throw if assignment is not PUBLISHED', async () => {
      mockAssignmentRepo.findById.mockResolvedValueOnce({ ...mockAssignment, status: 'DRAFT' });
      await expect(
        submissionService.submitAssignment('student-1', 'asgn-1', 'print()')
      ).rejects.toThrow('Assignment is not available for submission');
    });

    it('should throw if student is not enrolled', async () => {
      mockAssignmentRepo.findById.mockResolvedValueOnce(mockAssignment);
      mockClassRepo.findMembership.mockResolvedValueOnce(null as any);
      await expect(
        submissionService.submitAssignment('student-1', 'asgn-1', 'print()')
      ).rejects.toThrow('You are not enrolled in this class');
    });

    it('should throw if due date has passed', async () => {
      const pastDate = new Date(Date.now() - 10000);
      mockAssignmentRepo.findById.mockResolvedValueOnce({ ...mockAssignment, dueDate: pastDate });
      mockClassRepo.findMembership.mockResolvedValueOnce({ id: 'mem-1' } as any);
      await expect(
        submissionService.submitAssignment('student-1', 'asgn-1', 'print()')
      ).rejects.toThrow('Assignment due date has passed');
    });

    it('should upsert submission and trigger grading', async () => {
      mockAssignmentRepo.findById.mockResolvedValueOnce(mockAssignment);
      mockClassRepo.findMembership.mockResolvedValueOnce({ id: 'mem-1' } as any);
      mockSubmissionRepo.upsert.mockResolvedValueOnce({ id: 'sub-1' } as any);
      mockGradingService.gradeSubmission.mockResolvedValueOnce(undefined);
      mockSubmissionRepo.findRawById.mockResolvedValueOnce(mockStudentSubmission);

      const result = await submissionService.submitAssignment('student-1', 'asgn-1', 'print()');
      expect(mockSubmissionRepo.upsert).toHaveBeenCalledWith('asgn-1', 'student-1', 'print()');
      expect(mockGradingService.gradeSubmission).toHaveBeenCalledWith('sub-1');
      expect(result.id).toBe('sub-1');
    });
  });

  describe('getMySubmission', () => {
    it('should return null if no submission exists', async () => {
      mockSubmissionRepo.findByStudentAndAssignment.mockResolvedValueOnce(null);
      const result = await submissionService.getMySubmission('student-1', 'asgn-1');
      expect(result).toBeNull();
    });

    it('should return submission if found', async () => {
      mockSubmissionRepo.findByStudentAndAssignment.mockResolvedValueOnce(mockStudentSubmission);
      const result = await submissionService.getMySubmission('student-1', 'asgn-1');
      expect(result!.id).toBe('sub-1');
      expect(Array.isArray(result!.testResults)).toBe(true);
    });
  });

  describe('getSubmissionAsStudent', () => {
    it('should throw if submission not found', async () => {
      mockSubmissionRepo.findById.mockResolvedValueOnce(null);
      await expect(submissionService.getSubmissionAsStudent('sub-x', 'student-1')).rejects.toThrow(
        'Submission not found'
      );
    });

    it('should return submission if found', async () => {
      mockSubmissionRepo.findById.mockResolvedValueOnce(mockStudentSubmission);
      const result = await submissionService.getSubmissionAsStudent('sub-1', 'student-1');
      expect(result.id).toBe('sub-1');
    });
  });

  describe('getMySubmissionsByClass', () => {
    it('should throw if student not enrolled', async () => {
      mockClassRepo.findMembership.mockResolvedValueOnce(null as any);
      await expect(
        submissionService.getMySubmissionsByClass('student-1', 'class-1')
      ).rejects.toThrow('You are not enrolled in this class');
    });

    it('should return empty array if no assignments in class', async () => {
      mockClassRepo.findMembership.mockResolvedValueOnce({ id: 'mem-1' } as any);
      mockAssignmentRepo.findIdsByClass.mockResolvedValueOnce([]);
      mockSubmissionRepo.findByStudentAndAssignments.mockResolvedValueOnce([]);
      const result = await submissionService.getMySubmissionsByClass('student-1', 'class-1');
      expect(result).toEqual([]);
    });

    it('should return submissions for class assignments', async () => {
      mockClassRepo.findMembership.mockResolvedValueOnce({ id: 'mem-1' } as any);
      mockAssignmentRepo.findIdsByClass.mockResolvedValueOnce(['asgn-1']);
      mockSubmissionRepo.findByStudentAndAssignments.mockResolvedValueOnce([mockStudentSubmission]);
      const result = await submissionService.getMySubmissionsByClass('student-1', 'class-1');
      expect(result).toHaveLength(1);
    });
  });

  describe('getAssignmentSubmissions', () => {
    it('should throw if assignment not found or not owned by teacher', async () => {
      mockAssignmentRepo.findByIdAndTeacher.mockResolvedValueOnce(null);
      await expect(
        submissionService.getAssignmentSubmissions('asgn-x', 'teacher-1')
      ).rejects.toThrow('Assignment not found');
    });

    it('should return all submissions for the assignment', async () => {
      mockAssignmentRepo.findByIdAndTeacher.mockResolvedValueOnce(mockAssignment);
      mockSubmissionRepo.findByAssignment.mockResolvedValueOnce([mockStudentSubmission]);
      const result = await submissionService.getAssignmentSubmissions('asgn-1', 'teacher-1');
      expect(result).toHaveLength(1);
    });
  });

  describe('getSubmissionAsTeacher', () => {
    it('should throw if submission not found', async () => {
      mockSubmissionRepo.findByIdAsTeacher.mockResolvedValueOnce(null);
      await expect(submissionService.getSubmissionAsTeacher('sub-x', 'teacher-1')).rejects.toThrow(
        'Submission not found'
      );
    });

    it('should return submission', async () => {
      mockSubmissionRepo.findByIdAsTeacher.mockResolvedValueOnce(mockStudentSubmission);
      const result = await submissionService.getSubmissionAsTeacher('sub-1', 'teacher-1');
      expect(result.id).toBe('sub-1');
    });
  });

  describe('getClassSubmissions', () => {
    it('should throw if class not found or not owned by teacher', async () => {
      mockClassRepo.findByIdAndTeacher.mockResolvedValueOnce(null as any);
      await expect(submissionService.getClassSubmissions('class-x', 'teacher-1')).rejects.toThrow(
        'Class not found'
      );
    });

    it('should return empty array if no assignments', async () => {
      mockClassRepo.findByIdAndTeacher.mockResolvedValueOnce({ id: 'class-1' } as any);
      mockAssignmentRepo.findIdsByClass.mockResolvedValueOnce([]);
      mockSubmissionRepo.findByAssignmentIds.mockResolvedValueOnce([]);
      const result = await submissionService.getClassSubmissions('class-1', 'teacher-1');
      expect(result).toEqual([]);
    });
  });

  describe('getMySubmissionByClassAndAssignment', () => {
    it('should throw if not enrolled', async () => {
      mockClassRepo.findMembership.mockResolvedValueOnce(null as any);
      await expect(
        submissionService.getMySubmissionByClassAndAssignment('student-1', 'class-1', 'asgn-1')
      ).rejects.toThrow('You are not enrolled in this class');
    });

    it('should throw if assignment not in class', async () => {
      mockClassRepo.findMembership.mockResolvedValueOnce({ id: 'mem-1' } as any);
      mockAssignmentRepo.findByIdAndClass.mockResolvedValueOnce(null);
      await expect(
        submissionService.getMySubmissionByClassAndAssignment('student-1', 'class-1', 'asgn-x')
      ).rejects.toThrow('Assignment not found');
    });

    it('should return null if no submission exists', async () => {
      mockClassRepo.findMembership.mockResolvedValueOnce({ id: 'mem-1' } as any);
      mockAssignmentRepo.findByIdAndClass.mockResolvedValueOnce(mockAssignment);
      mockSubmissionRepo.findByStudentAndAssignment.mockResolvedValueOnce(null);
      const result = await submissionService.getMySubmissionByClassAndAssignment(
        'student-1',
        'class-1',
        'asgn-1'
      );
      expect(result).toBeNull();
    });
  });
});
