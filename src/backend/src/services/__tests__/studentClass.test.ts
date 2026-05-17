import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { classService } from '../class';
import { classRepository } from '../../repositories/class';
import { ClassData, StudentClassData } from '../../types/class';

jest.mock('../../repositories/class');

const mockClassRepository = classRepository as jest.Mocked<typeof classRepository>;

const studentId = 'student-123';
const classId = 'class-456';

const makeClass = (overrides: Partial<ClassData> = {}): ClassData => ({
  id: classId,
  name: 'Python',
  description: null,
  teacherId: 'teacher-789',
  joinCode: 'ABCD1234',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const makeEnrollment = (): StudentClassData => ({
  id: 'member-1',
  classId,
  studentId,
  joinedAt: new Date(),
  class: makeClass(),
});

describe('ClassService - Student Methods', () => {
  beforeEach(async () => jest.clearAllMocks());

  describe('joinClass', () => {
    it('should join a class successfully', async () => {
      mockClassRepository.findByJoinCode.mockResolvedValue(makeClass());
      mockClassRepository.findMembership.mockResolvedValue(false);
      mockClassRepository.joinClass.mockResolvedValue({
        id: 'member-1',
        classId,
        studentId,
        joinedAt: new Date(),
        student: { id: studentId, name: null, email: '' },
      });
      mockClassRepository.findEnrolledClasses.mockResolvedValue([makeEnrollment()]);

      const result = await classService.joinClass(studentId, 'ABCD1234');

      expect(mockClassRepository.findByJoinCode).toHaveBeenCalledWith('ABCD1234');
      expect(mockClassRepository.findMembership).toHaveBeenCalledWith(classId, studentId);
      expect(mockClassRepository.joinClass).toHaveBeenCalledWith(classId, studentId);
      expect(result.classId).toBe(classId);
    });

    it('should throw if join code is invalid', async () => {
      mockClassRepository.findByJoinCode.mockResolvedValue(null);

      await expect(classService.joinClass(studentId, 'BADCODE')).rejects.toThrow(
        'Invalid join code'
      );
      expect(mockClassRepository.joinClass).not.toHaveBeenCalled();
    });

    it('should throw if student is already enrolled', async () => {
      mockClassRepository.findByJoinCode.mockResolvedValue(makeClass());
      mockClassRepository.findMembership.mockResolvedValue(true);

      await expect(classService.joinClass(studentId, 'ABCD1234')).rejects.toThrow(
        'You are already enrolled in this class'
      );
      expect(mockClassRepository.joinClass).not.toHaveBeenCalled();
    });

    it('should throw if teacher tries to join their own class', async () => {
      mockClassRepository.findByJoinCode.mockResolvedValue(makeClass({ teacherId: studentId }));

      await expect(classService.joinClass(studentId, 'ABCD1234')).rejects.toThrow(
        'Teachers cannot join their own class as a student'
      );
      expect(mockClassRepository.joinClass).not.toHaveBeenCalled();
    });
  });

  describe('leaveClass', () => {
    it('should leave a class successfully', async () => {
      mockClassRepository.findMembership.mockResolvedValue(true);
      mockClassRepository.leaveClass.mockResolvedValue(true);

      await expect(classService.leaveClass(studentId, classId)).resolves.not.toThrow();
      expect(mockClassRepository.leaveClass).toHaveBeenCalledWith(classId, studentId);
    });

    it('should throw if student is not enrolled', async () => {
      mockClassRepository.findMembership.mockResolvedValue(false);

      await expect(classService.leaveClass(studentId, classId)).rejects.toThrow(
        'You are not enrolled in this class'
      );
      expect(mockClassRepository.leaveClass).not.toHaveBeenCalled();
    });

    it('should throw if leave operation fails', async () => {
      mockClassRepository.findMembership.mockResolvedValue(true);
      mockClassRepository.leaveClass.mockResolvedValue(false);

      await expect(classService.leaveClass(studentId, classId)).rejects.toThrow(
        'Failed to leave class'
      );
    });
  });

  describe('getEnrolledClasses', () => {
    it('should return enrolled classes', async () => {
      mockClassRepository.findEnrolledClasses.mockResolvedValue([makeEnrollment()]);

      const result = await classService.getEnrolledClasses(studentId);

      expect(mockClassRepository.findEnrolledClasses).toHaveBeenCalledWith(studentId);
      expect(result).toHaveLength(1);
      expect(result[0].class.name).toBe('Python');
    });

    it('should return empty array if not enrolled anywhere', async () => {
      mockClassRepository.findEnrolledClasses.mockResolvedValue([]);

      const result = await classService.getEnrolledClasses(studentId);
      expect(result).toEqual([]);
    });
  });
});
