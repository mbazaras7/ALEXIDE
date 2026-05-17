import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { assignmentService } from '../assignment';
import { assignmentRepository } from '../../repositories/assignment';
import { classRepository } from '../../repositories/class';
import { AssignmentData, AssignmentWithTestCases, TestCaseData } from '../../types/assignment';

jest.mock('../../repositories/assignment');
jest.mock('../../repositories/class');

const mockAssignmentRepo = assignmentRepository as jest.Mocked<typeof assignmentRepository>;
const mockClassRepo = classRepository as jest.Mocked<typeof classRepository>;

const teacherId = 'teacher-123';
const studentId = 'student-456';
const classId = 'class-789';
const assignmentId = 'asgn-001';
const testCaseId = 'tc-001';

const makeClass = () => ({
  id: classId,
  name: 'Python',
  description: null,
  teacherId,
  joinCode: 'ABCD1234',
  createdAt: new Date(),
  updatedAt: new Date(),
});

const makeAssignment = (overrides: Partial<AssignmentData> = {}): AssignmentData => ({
  id: assignmentId,
  classId,
  teacherId,
  title: 'Test Assignment',
  description: null,
  dueDate: null,
  maxScore: 100,
  language: 'python',
  status: 'DRAFT',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const makeAssignmentWithTestCases = (
  overrides: Partial<AssignmentData> = {}
): AssignmentWithTestCases => ({
  ...makeAssignment(overrides),
  testCases: [],
});

const makeTestCase = (overrides: Partial<TestCaseData> = {}): TestCaseData => ({
  id: testCaseId,
  assignmentId,
  name: 'Test 1',
  inputData: null,
  sysArgs: null,
  expectedOutput: 'hello',
  weight: 1,
  orderIndex: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('AssignmentService', () => {
  beforeEach(async () => jest.clearAllMocks());

  describe('createAssignment', () => {
    it('should create a DRAFT assignment successfully', async () => {
      mockClassRepo.findByIdAndTeacher.mockResolvedValue(makeClass());
      mockAssignmentRepo.create.mockResolvedValue(makeAssignment());

      const result = await assignmentService.createAssignment(teacherId, classId, {
        title: 'Test Assignment',
      });

      expect(mockAssignmentRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ classId, teacherId, title: 'Test Assignment' })
      );
      expect(result.status).toBe('DRAFT');
    });

    it('should create with PUBLISHED status', async () => {
      mockClassRepo.findByIdAndTeacher.mockResolvedValue(makeClass());
      mockAssignmentRepo.create.mockResolvedValue(makeAssignment({ status: 'PUBLISHED' }));

      const result = await assignmentService.createAssignment(teacherId, classId, {
        title: 'Published',
        status: 'PUBLISHED',
      });

      expect(result.status).toBe('PUBLISHED');
    });

    it('should throw if class not found', async () => {
      mockClassRepo.findByIdAndTeacher.mockResolvedValue(null);

      await expect(
        assignmentService.createAssignment(teacherId, classId, { title: 'Test' })
      ).rejects.toThrow('Class not found');
    });

    it('should throw if due date is in the past', async () => {
      mockClassRepo.findByIdAndTeacher.mockResolvedValue(makeClass());

      await expect(
        assignmentService.createAssignment(teacherId, classId, {
          title: 'Late',
          dueDate: '2020-01-01T00:00:00.000Z',
        })
      ).rejects.toThrow('Due date cannot be in the past');
    });

    it('should throw if due date is invalid', async () => {
      mockClassRepo.findByIdAndTeacher.mockResolvedValue(makeClass());

      await expect(
        assignmentService.createAssignment(teacherId, classId, {
          title: 'Bad Date',
          dueDate: 'not-a-date',
        })
      ).rejects.toThrow('Invalid due date');
    });
  });

  describe('getAssignment', () => {
    it('should return assignment with test cases', async () => {
      mockAssignmentRepo.findByIdWithTestCasesAndTeacher.mockResolvedValue(
        makeAssignmentWithTestCases()
      );

      const result = await assignmentService.getAssignment(assignmentId, teacherId);
      expect(result.id).toBe(assignmentId);
      expect(result.testCases).toHaveLength(0);
    });

    it('should throw if assignment not found', async () => {
      mockAssignmentRepo.findByIdWithTestCasesAndTeacher.mockResolvedValue(null);

      await expect(assignmentService.getAssignment(assignmentId, teacherId)).rejects.toThrow(
        'Assignment not found'
      );
    });
  });

  describe('getClassAssignments', () => {
    it('should return assignments for a class', async () => {
      mockClassRepo.findByIdAndTeacher.mockResolvedValue(makeClass());
      mockAssignmentRepo.findAllByClassAndTeacher.mockResolvedValue([
        makeAssignment(),
        makeAssignment({ id: 'asgn-2', title: 'Second' }),
      ]);

      const result = await assignmentService.getClassAssignments(classId, teacherId);
      expect(result).toHaveLength(2);
    });

    it('should throw if class not found', async () => {
      mockClassRepo.findByIdAndTeacher.mockResolvedValue(null);

      await expect(assignmentService.getClassAssignments(classId, teacherId)).rejects.toThrow(
        'Class not found'
      );
    });
  });

  describe('updateAssignment', () => {
    it('should update title', async () => {
      mockAssignmentRepo.findByIdAndTeacher.mockResolvedValue(makeAssignment());
      mockAssignmentRepo.update.mockResolvedValue(makeAssignment({ title: 'Updated' }));

      const result = await assignmentService.updateAssignment(assignmentId, teacherId, {
        title: 'Updated',
      });
      expect(result.title).toBe('Updated');
    });

    it('should publish an assignment', async () => {
      mockAssignmentRepo.findByIdAndTeacher.mockResolvedValue(makeAssignment());
      mockAssignmentRepo.update.mockResolvedValue(makeAssignment({ status: 'PUBLISHED' }));

      const result = await assignmentService.updateAssignment(assignmentId, teacherId, {
        status: 'PUBLISHED',
      });
      expect(result.status).toBe('PUBLISHED');
    });

    it('should clear due date when empty string is passed', async () => {
      mockAssignmentRepo.findByIdAndTeacher.mockResolvedValue(makeAssignment());
      mockAssignmentRepo.update.mockResolvedValue(makeAssignment({ dueDate: null }));

      const result = await assignmentService.updateAssignment(assignmentId, teacherId, {
        dueDate: '',
      });
      expect(result.dueDate).toBeNull();
    });

    it('should throw if no fields provided', async () => {
      mockAssignmentRepo.findByIdAndTeacher.mockResolvedValue(makeAssignment());

      await expect(assignmentService.updateAssignment(assignmentId, teacherId, {})).rejects.toThrow(
        'At least one field must be provided'
      );
    });

    it('should throw if assignment not found', async () => {
      mockAssignmentRepo.findByIdAndTeacher.mockResolvedValue(null);

      await expect(
        assignmentService.updateAssignment(assignmentId, teacherId, { title: 'X' })
      ).rejects.toThrow('Assignment not found');
    });
  });

  describe('deleteAssignment', () => {
    it('should delete assignment with no files successfully', async () => {
      mockAssignmentRepo.findByIdWithTestCasesAndTeacher.mockResolvedValue(
        makeAssignmentWithTestCases()
      );
      mockAssignmentRepo.delete.mockResolvedValue(true);

      await expect(
        assignmentService.deleteAssignment(assignmentId, teacherId)
      ).resolves.not.toThrow();

      expect(mockAssignmentRepo.delete).toHaveBeenCalledWith(assignmentId, teacherId);
    });

    it('should throw if assignment not found', async () => {
      mockAssignmentRepo.findByIdWithTestCasesAndTeacher.mockResolvedValue(null);

      await expect(assignmentService.deleteAssignment(assignmentId, teacherId)).rejects.toThrow(
        'Assignment not found'
      );
    });
  });

  describe('addTestCase', () => {
    it('should add a test case to an assignment', async () => {
      mockAssignmentRepo.findByIdAndTeacher.mockResolvedValue(makeAssignment());
      mockAssignmentRepo.addTestCase.mockResolvedValue(makeTestCase());

      const result = await assignmentService.addTestCase(assignmentId, teacherId, {
        name: 'Test 1',
        expectedOutput: 'hello',
      });

      expect(mockAssignmentRepo.addTestCase).toHaveBeenCalledWith(
        expect.objectContaining({ assignmentId, name: 'Test 1' })
      );
      expect(result.name).toBe('Test 1');
      expect(result.sysArgs).toBeNull();
    });

    it('should add a test case with sysArgs', async () => {
      mockAssignmentRepo.findByIdAndTeacher.mockResolvedValue(makeAssignment());
      mockAssignmentRepo.addTestCase.mockResolvedValue(
        makeTestCase({ sysArgs: ['hello', 'world'] })
      );

      const result = await assignmentService.addTestCase(assignmentId, teacherId, {
        name: 'Test with args',
        expectedOutput: 'hello world',
        sysArgs: ['hello', 'world'],
      });

      expect(mockAssignmentRepo.addTestCase).toHaveBeenCalledWith(
        expect.objectContaining({ sysArgs: ['hello', 'world'] })
      );
      expect(result.sysArgs).toEqual(['hello', 'world']);
    });

    it('should throw if assignment not found', async () => {
      mockAssignmentRepo.findByIdAndTeacher.mockResolvedValue(null);

      await expect(
        assignmentService.addTestCase(assignmentId, teacherId, {
          name: 'Test',
          expectedOutput: 'out',
        })
      ).rejects.toThrow('Assignment not found');
    });
  });

  describe('updateTestCase', () => {
    it('should update test case name', async () => {
      mockAssignmentRepo.findTestCaseById.mockResolvedValue(makeTestCase());
      mockAssignmentRepo.findByIdAndTeacher.mockResolvedValue(makeAssignment());
      mockAssignmentRepo.updateTestCase.mockResolvedValue(makeTestCase({ name: 'Updated' }));

      const result = await assignmentService.updateTestCase(testCaseId, teacherId, {
        name: 'Updated',
      });
      expect(result.name).toBe('Updated');
    });

    it('should update sysArgs', async () => {
      mockAssignmentRepo.findTestCaseById.mockResolvedValue(makeTestCase());
      mockAssignmentRepo.findByIdAndTeacher.mockResolvedValue(makeAssignment());
      mockAssignmentRepo.updateTestCase.mockResolvedValue(
        makeTestCase({ sysArgs: ['arg1', 'arg2'] })
      );

      const result = await assignmentService.updateTestCase(testCaseId, teacherId, {
        sysArgs: ['arg1', 'arg2'],
      });

      expect(mockAssignmentRepo.updateTestCase).toHaveBeenCalledWith(
        testCaseId,
        expect.objectContaining({ sysArgs: ['arg1', 'arg2'] })
      );
      expect(result.sysArgs).toEqual(['arg1', 'arg2']);
    });

    it('should clear sysArgs when set to null', async () => {
      mockAssignmentRepo.findTestCaseById.mockResolvedValue(makeTestCase({ sysArgs: ['old-arg'] }));
      mockAssignmentRepo.findByIdAndTeacher.mockResolvedValue(makeAssignment());
      mockAssignmentRepo.updateTestCase.mockResolvedValue(makeTestCase({ sysArgs: null }));

      const result = await assignmentService.updateTestCase(testCaseId, teacherId, {
        sysArgs: null,
      });

      expect(result.sysArgs).toBeNull();
    });

    it('should throw if test case not found', async () => {
      mockAssignmentRepo.findTestCaseById.mockResolvedValue(null);

      await expect(
        assignmentService.updateTestCase(testCaseId, teacherId, { name: 'X' })
      ).rejects.toThrow('Test case not found');
    });

    it('should throw if teacher does not own the assignment', async () => {
      mockAssignmentRepo.findTestCaseById.mockResolvedValue(makeTestCase());
      mockAssignmentRepo.findByIdAndTeacher.mockResolvedValue(null);

      await expect(
        assignmentService.updateTestCase(testCaseId, teacherId, { name: 'X' })
      ).rejects.toThrow('Test case not found');
    });

    it('should throw if no fields provided', async () => {
      mockAssignmentRepo.findTestCaseById.mockResolvedValue(makeTestCase());
      mockAssignmentRepo.findByIdAndTeacher.mockResolvedValue(makeAssignment());

      await expect(assignmentService.updateTestCase(testCaseId, teacherId, {})).rejects.toThrow(
        'At least one field must be provided'
      );
    });
  });

  describe('deleteTestCase', () => {
    it('should delete test case successfully', async () => {
      mockAssignmentRepo.findTestCaseById.mockResolvedValue(makeTestCase());
      mockAssignmentRepo.findByIdAndTeacher.mockResolvedValue(makeAssignment());
      mockAssignmentRepo.deleteTestCase.mockResolvedValue(true);

      await expect(assignmentService.deleteTestCase(testCaseId, teacherId)).resolves.not.toThrow();
    });

    it('should throw if test case not found', async () => {
      mockAssignmentRepo.findTestCaseById.mockResolvedValue(null);

      await expect(assignmentService.deleteTestCase(testCaseId, teacherId)).rejects.toThrow(
        'Test case not found'
      );
    });

    it('should throw if teacher does not own the assignment', async () => {
      mockAssignmentRepo.findTestCaseById.mockResolvedValue(makeTestCase());
      mockAssignmentRepo.findByIdAndTeacher.mockResolvedValue(null);

      await expect(assignmentService.deleteTestCase(testCaseId, teacherId)).rejects.toThrow(
        'Test case not found'
      );
    });
  });

  describe('getTestCases', () => {
    it('should return test cases for an assignment', async () => {
      mockAssignmentRepo.findByIdAndTeacher.mockResolvedValue(makeAssignment());
      mockAssignmentRepo.findTestCasesByAssignment.mockResolvedValue([
        makeTestCase(),
        makeTestCase({ id: 'tc-2', name: 'Test 2' }),
      ]);

      const result = await assignmentService.getTestCases(assignmentId, teacherId);
      expect(result).toHaveLength(2);
    });

    it('should return test cases with sysArgs when present', async () => {
      mockAssignmentRepo.findByIdAndTeacher.mockResolvedValue(makeAssignment());
      mockAssignmentRepo.findTestCasesByAssignment.mockResolvedValue([
        makeTestCase({ sysArgs: ['arg1'] }),
        makeTestCase({ id: 'tc-2', sysArgs: null }),
      ]);

      const result = await assignmentService.getTestCases(assignmentId, teacherId);
      expect(result[0].sysArgs).toEqual(['arg1']);
      expect(result[1].sysArgs).toBeNull();
    });

    it('should throw if assignment not found', async () => {
      mockAssignmentRepo.findByIdAndTeacher.mockResolvedValue(null);

      await expect(assignmentService.getTestCases(assignmentId, teacherId)).rejects.toThrow(
        'Assignment not found'
      );
    });
  });

  describe('getPublishedAssignment', () => {
    it('should return PUBLISHED assignment with public test cases only', async () => {
      mockAssignmentRepo.findByIdWithTestCases.mockResolvedValue({
        ...makeAssignmentWithTestCases({ status: 'PUBLISHED' }),
        testCases: [makeTestCase({ expectedOutput: 'secret-output' })],
      });
      mockClassRepo.findMembership.mockResolvedValue(true);

      const result = await assignmentService.getPublishedAssignment(assignmentId, studentId);

      expect(result.testCases).toHaveLength(1);
      expect((result.testCases[0] as any).expectedOutput).toBeUndefined();
      expect(result.testCases[0].name).toBe('Test 1');
    });

    it('should return CLOSED assignment with public test cases only', async () => {
      mockAssignmentRepo.findByIdWithTestCases.mockResolvedValue({
        ...makeAssignmentWithTestCases({ status: 'CLOSED' }),
        testCases: [makeTestCase({ expectedOutput: 'secret-output' })],
      });
      mockClassRepo.findMembership.mockResolvedValue(true);

      const result = await assignmentService.getPublishedAssignment(assignmentId, studentId);

      expect(result.status).toBe('CLOSED');
      expect(result.testCases).toHaveLength(1);
      expect((result.testCases[0] as any).expectedOutput).toBeUndefined();
    });

    it('should throw if assignment is DRAFT', async () => {
      mockAssignmentRepo.findByIdWithTestCases.mockResolvedValue(
        makeAssignmentWithTestCases({ status: 'DRAFT' })
      );

      await expect(
        assignmentService.getPublishedAssignment(assignmentId, studentId)
      ).rejects.toThrow('Assignment not found');
    });

    it('should throw if student is not enrolled', async () => {
      mockAssignmentRepo.findByIdWithTestCases.mockResolvedValue(
        makeAssignmentWithTestCases({ status: 'PUBLISHED' })
      );
      mockClassRepo.findMembership.mockResolvedValue(false);

      await expect(
        assignmentService.getPublishedAssignment(assignmentId, studentId)
      ).rejects.toThrow('Assignment not found');
    });

    it('should throw if student is not enrolled in class with CLOSED assignment', async () => {
      mockAssignmentRepo.findByIdWithTestCases.mockResolvedValue(
        makeAssignmentWithTestCases({ status: 'CLOSED' })
      );
      mockClassRepo.findMembership.mockResolvedValue(false);

      await expect(
        assignmentService.getPublishedAssignment(assignmentId, studentId)
      ).rejects.toThrow('Assignment not found');
    });
  });

  describe('getPublishedAssignmentsForStudent', () => {
    it('should return PUBLISHED and CLOSED assignments sorted by due date', async () => {
      mockClassRepo.findEnrolledClasses.mockResolvedValue([
        { classId, joinedAt: new Date() } as any,
      ]);

      const soon = new Date(Date.now() + 86400000);
      const later = new Date(Date.now() + 172800000);

      mockAssignmentRepo.findAllByClassWithClassName.mockResolvedValue([
        { ...makeAssignment({ status: 'PUBLISHED', dueDate: later }), className: 'Python' },
        { ...makeAssignment({ id: 'asgn-2', status: 'DRAFT' }), className: 'Python' },
        {
          ...makeAssignment({ id: 'asgn-3', status: 'CLOSED', dueDate: soon }),
          className: 'Python',
        },
      ] as any);

      const result = await assignmentService.getPublishedAssignmentsForStudent(studentId);

      expect(result).toHaveLength(2);
      expect(result[0].status).toBe('CLOSED');
      expect(result[1].status).toBe('PUBLISHED');
      expect(result[0].dueDate!.getTime()).toBeLessThan(result[1].dueDate!.getTime());
    });

    it('should exclude DRAFT assignments', async () => {
      mockClassRepo.findEnrolledClasses.mockResolvedValue([
        { classId, joinedAt: new Date() } as any,
      ]);

      mockAssignmentRepo.findAllByClassWithClassName.mockResolvedValue([
        { ...makeAssignment({ status: 'DRAFT' }), className: 'Python' },
        { ...makeAssignment({ id: 'asgn-2', status: 'DRAFT' }), className: 'Python' },
      ] as any);

      const result = await assignmentService.getPublishedAssignmentsForStudent(studentId);
      expect(result).toHaveLength(0);
    });

    it('should return empty array if not enrolled in any class', async () => {
      mockClassRepo.findEnrolledClasses.mockResolvedValue([]);

      const result = await assignmentService.getPublishedAssignmentsForStudent(studentId);
      expect(result).toHaveLength(0);
    });
  });

  describe('getPublishedAssignmentsByClass', () => {
    it('should return PUBLISHED and CLOSED assignments for enrolled student', async () => {
      mockClassRepo.findMembership.mockResolvedValue(true);
      mockAssignmentRepo.findAllByClass.mockResolvedValue([
        makeAssignment({ status: 'PUBLISHED' }),
        makeAssignment({ id: 'asgn-2', status: 'DRAFT' }),
        makeAssignment({ id: 'asgn-3', status: 'CLOSED' }),
      ]);

      const result = await assignmentService.getPublishedAssignmentsByClass(classId, studentId);

      expect(result).toHaveLength(2);
      expect(result.map((a) => a.status)).toContain('PUBLISHED');
      expect(result.map((a) => a.status)).toContain('CLOSED');
    });

    it('should exclude DRAFT assignments', async () => {
      mockClassRepo.findMembership.mockResolvedValue(true);
      mockAssignmentRepo.findAllByClass.mockResolvedValue([
        makeAssignment({ status: 'DRAFT' }),
        makeAssignment({ id: 'asgn-2', status: 'DRAFT' }),
      ]);

      const result = await assignmentService.getPublishedAssignmentsByClass(classId, studentId);
      expect(result).toHaveLength(0);
    });

    it('should sort results by due date ascending', async () => {
      mockClassRepo.findMembership.mockResolvedValue(true);

      const soon = new Date(Date.now() + 86400000);
      const later = new Date(Date.now() + 172800000);

      mockAssignmentRepo.findAllByClass.mockResolvedValue([
        makeAssignment({ status: 'PUBLISHED', dueDate: later }),
        makeAssignment({ id: 'asgn-2', status: 'CLOSED', dueDate: soon }),
      ]);

      const result = await assignmentService.getPublishedAssignmentsByClass(classId, studentId);

      expect(result).toHaveLength(2);
      expect(result[0].dueDate!.getTime()).toBeLessThan(result[1].dueDate!.getTime());
    });

    it('should throw if student is not enrolled', async () => {
      mockClassRepo.findMembership.mockResolvedValue(false);

      await expect(
        assignmentService.getPublishedAssignmentsByClass(classId, studentId)
      ).rejects.toThrow('Class not found');
    });

    it('should return empty array if only DRAFT assignments exist', async () => {
      mockClassRepo.findMembership.mockResolvedValue(true);
      mockAssignmentRepo.findAllByClass.mockResolvedValue([makeAssignment({ status: 'DRAFT' })]);

      const result = await assignmentService.getPublishedAssignmentsByClass(classId, studentId);
      expect(result).toHaveLength(0);
    });
  });
});
