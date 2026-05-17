import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { classService } from '../class';
import { classRepository } from '../../repositories/class';
import {
  ClassData,
  ClassWithMemberCount,
  ClassWithMembers,
  StudentClassData,
  ClassStudentList,
} from '../../types/class';

jest.mock('../../repositories/class');

const mockClassRepository = classRepository as jest.Mocked<typeof classRepository>;

const mockTeacherId = 'teacher-123';
const mockClassId = 'class-456';
const mockStudentId = 'student-abc';

const makeClass = (overrides: Partial<ClassData> = {}): ClassData => ({
  id: mockClassId,
  name: 'Python 101',
  description: 'Intro to Python',
  teacherId: mockTeacherId,
  joinCode: 'ABCD1234',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const makeStudentList = (overrides: Partial<ClassStudentList> = {}): ClassStudentList => ({
  classId: mockClassId,
  studentCount: 2,
  students: [
    { id: 'student-1', name: 'Alice', email: 'alice@example.com', joinedAt: new Date() },
    { id: 'student-2', name: 'Bob', email: 'bob@example.com', joinedAt: new Date() },
  ],
  ...overrides,
});

describe('ClassService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createClass', () => {
    it('should create a class with a unique join code', async () => {
      const created = makeClass();
      mockClassRepository.findByJoinCode.mockResolvedValue(null);
      mockClassRepository.create.mockResolvedValue(created);

      const result = await classService.createClass(mockTeacherId, {
        name: 'Python',
        description: 'Intro',
      });

      expect(mockClassRepository.findByJoinCode).toHaveBeenCalled();
      expect(mockClassRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Python', teacherId: mockTeacherId })
      );
      expect(result).toEqual(created);
    });

    it('should retry join code generation on collision', async () => {
      const existing = makeClass({ joinCode: 'COLLISION' });
      const created = makeClass({ joinCode: 'NEWCODE1' });

      mockClassRepository.findByJoinCode
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce(null);

      mockClassRepository.create.mockResolvedValue(created);

      const result = await classService.createClass(mockTeacherId, { name: 'Test' });
      expect(mockClassRepository.findByJoinCode).toHaveBeenCalledTimes(2);
      expect(result).toEqual(created);
    });

    it('should throw if join code generation fails 5 times', async () => {
      mockClassRepository.findByJoinCode.mockResolvedValue(makeClass());

      await expect(classService.createClass(mockTeacherId, { name: 'Test' })).rejects.toThrow(
        'Failed to generate a unique join code'
      );
    });
  });

  describe('getTeacherClasses', () => {
    it('should return all classes with member counts', async () => {
      const mockClasses: ClassWithMemberCount[] = [
        { ...makeClass(), memberCount: 5 },
        { ...makeClass({ id: 'class-789', name: 'JS 101' }), memberCount: 3 },
      ];

      mockClassRepository.findAllByTeacher.mockResolvedValue(mockClasses);

      const result = await classService.getTeacherClasses(mockTeacherId);

      expect(mockClassRepository.findAllByTeacher).toHaveBeenCalledWith(mockTeacherId);
      expect(result).toHaveLength(2);
      expect(result[0].memberCount).toBe(5);
    });

    it('should return empty array if teacher has no classes', async () => {
      mockClassRepository.findAllByTeacher.mockResolvedValue([]);

      const result = await classService.getTeacherClasses(mockTeacherId);
      expect(result).toEqual([]);
    });
  });

  describe('getClassWithMembers', () => {
    it('should return class with members', async () => {
      const mockClassWithMembers: ClassWithMembers = {
        ...makeClass(),
        members: [
          {
            id: 'member-1',
            classId: mockClassId,
            studentId: 'student-1',
            joinedAt: new Date(),
            student: { id: 'student-1', name: 'Alice', email: 'alice@example.com' },
          },
        ],
      };

      mockClassRepository.findByIdWithMembers.mockResolvedValue(mockClassWithMembers);

      const result = await classService.getClassWithMembers(mockClassId, mockTeacherId);

      expect(mockClassRepository.findByIdWithMembers).toHaveBeenCalledWith(
        mockClassId,
        mockTeacherId
      );
      expect(result.members).toHaveLength(1);
      expect(result.members[0].student.name).toBe('Alice');
    });

    it('should throw if class not found', async () => {
      mockClassRepository.findByIdWithMembers.mockResolvedValue(null);

      await expect(classService.getClassWithMembers(mockClassId, mockTeacherId)).rejects.toThrow(
        'Class not found'
      );
    });
  });

  describe('updateClass', () => {
    it('should update class name', async () => {
      const updated = makeClass({ name: 'Updated Name' });
      mockClassRepository.update.mockResolvedValue(updated);

      const result = await classService.updateClass(mockClassId, mockTeacherId, {
        name: 'Updated Name',
      });

      expect(mockClassRepository.update).toHaveBeenCalledWith(mockClassId, mockTeacherId, {
        name: 'Updated Name',
      });
      expect(result.name).toBe('Updated Name');
    });

    it('should throw if no fields provided', async () => {
      await expect(classService.updateClass(mockClassId, mockTeacherId, {})).rejects.toThrow(
        'At least one field'
      );

      expect(mockClassRepository.update).not.toHaveBeenCalled();
    });

    it('should throw if class not found', async () => {
      mockClassRepository.update.mockResolvedValue(null);

      await expect(
        classService.updateClass(mockClassId, mockTeacherId, { name: 'New' })
      ).rejects.toThrow('Class not found');
    });
  });

  describe('regenerateJoinCode', () => {
    it('should regenerate join code successfully', async () => {
      const original = makeClass({ joinCode: 'OLDCODE1' });
      const updated = makeClass({ joinCode: 'NEWCODE1' });

      mockClassRepository.findByIdAndTeacher.mockResolvedValue(original);
      mockClassRepository.findByJoinCode.mockResolvedValue(null);
      mockClassRepository.updateJoinCode.mockResolvedValue(updated);

      const result = await classService.regenerateJoinCode(mockClassId, mockTeacherId);

      expect(result.joinCode).toBe('NEWCODE1');
      expect(result.joinCode).not.toBe('OLDCODE1');
    });

    it('should throw if class not found or not owned by teacher', async () => {
      mockClassRepository.findByIdAndTeacher.mockResolvedValue(null);

      await expect(classService.regenerateJoinCode(mockClassId, mockTeacherId)).rejects.toThrow(
        'Class not found'
      );
    });
  });

  describe('deleteClass', () => {
    it('should delete class successfully', async () => {
      mockClassRepository.findByIdAndTeacher.mockResolvedValue(makeClass());
      mockClassRepository.delete.mockResolvedValue(true);

      await expect(classService.deleteClass(mockClassId, mockTeacherId)).resolves.not.toThrow();

      expect(mockClassRepository.delete).toHaveBeenCalledWith(mockClassId, mockTeacherId);
    });

    it('should throw if class not found', async () => {
      mockClassRepository.findByIdAndTeacher.mockResolvedValue(null);

      await expect(classService.deleteClass(mockClassId, mockTeacherId)).rejects.toThrow(
        'Class not found'
      );
    });

    it('should throw if deletion fails', async () => {
      mockClassRepository.findByIdAndTeacher.mockResolvedValue(makeClass());
      mockClassRepository.delete.mockResolvedValue(false);

      await expect(classService.deleteClass(mockClassId, mockTeacherId)).rejects.toThrow(
        'Failed to delete class'
      );
    });
  });

  describe('removeStudent', () => {
    it('should remove a student from the class', async () => {
      mockClassRepository.findByIdAndTeacher.mockResolvedValue(makeClass());
      mockClassRepository.removeMember.mockResolvedValue(true);

      await expect(
        classService.removeStudent(mockClassId, 'student-1', mockTeacherId)
      ).resolves.not.toThrow();

      expect(mockClassRepository.removeMember).toHaveBeenCalledWith(
        mockClassId,
        'student-1',
        mockTeacherId
      );
    });

    it('should throw if class not found', async () => {
      mockClassRepository.findByIdAndTeacher.mockResolvedValue(null);

      await expect(
        classService.removeStudent(mockClassId, 'student-1', mockTeacherId)
      ).rejects.toThrow('Class not found');
    });

    it('should throw if student not in class', async () => {
      mockClassRepository.findByIdAndTeacher.mockResolvedValue(makeClass());
      mockClassRepository.removeMember.mockResolvedValue(false);

      await expect(
        classService.removeStudent(mockClassId, 'student-999', mockTeacherId)
      ).rejects.toThrow('Student not found in this class');
    });
  });

  describe('joinClass', () => {
    it('should join a class successfully', async () => {
      const mockEnrollment: StudentClassData = {
        id: 'member-1',
        classId: mockClassId,
        studentId: mockTeacherId,
        joinedAt: new Date(),
        class: makeClass(),
      };

      mockClassRepository.findByJoinCode.mockResolvedValue(makeClass());
      mockClassRepository.findMembership.mockResolvedValue(false);
      mockClassRepository.joinClass.mockResolvedValue({
        id: 'member-1',
        classId: mockClassId,
        studentId: 'student-abc',
        joinedAt: new Date(),
        student: { id: 'student-abc', name: null, email: '' },
      });
      mockClassRepository.findEnrolledClasses.mockResolvedValue([mockEnrollment]);

      const result = await classService.joinClass('student-abc', 'ABCD1234');

      expect(mockClassRepository.findByJoinCode).toHaveBeenCalledWith('ABCD1234');
      expect(mockClassRepository.findMembership).toHaveBeenCalledWith(mockClassId, 'student-abc');
      expect(mockClassRepository.joinClass).toHaveBeenCalledWith(mockClassId, 'student-abc');
      expect(result.classId).toBe(mockClassId);
    });

    it('should throw if join code is invalid', async () => {
      mockClassRepository.findByJoinCode.mockResolvedValue(null);

      await expect(classService.joinClass('student-abc', 'BADCODE1')).rejects.toThrow(
        'Invalid join code'
      );

      expect(mockClassRepository.findMembership).not.toHaveBeenCalled();
      expect(mockClassRepository.joinClass).not.toHaveBeenCalled();
    });

    it('should throw if student is already enrolled', async () => {
      mockClassRepository.findByJoinCode.mockResolvedValue(makeClass());
      mockClassRepository.findMembership.mockResolvedValue(true);

      await expect(classService.joinClass('student-abc', 'ABCD1234')).rejects.toThrow(
        'You are already enrolled in this class'
      );

      expect(mockClassRepository.joinClass).not.toHaveBeenCalled();
    });

    it('should throw if teacher tries to join their own class', async () => {
      mockClassRepository.findByJoinCode.mockResolvedValue(makeClass({ teacherId: mockTeacherId }));

      await expect(classService.joinClass(mockTeacherId, 'ABCD1234')).rejects.toThrow(
        'Teachers cannot join their own class as a student'
      );

      expect(mockClassRepository.findMembership).not.toHaveBeenCalled();
      expect(mockClassRepository.joinClass).not.toHaveBeenCalled();
    });
  });

  describe('leaveClass', () => {
    it('should leave a class successfully', async () => {
      mockClassRepository.findMembership.mockResolvedValue(true);
      mockClassRepository.leaveClass.mockResolvedValue(true);

      await expect(classService.leaveClass('student-abc', mockClassId)).resolves.not.toThrow();

      expect(mockClassRepository.leaveClass).toHaveBeenCalledWith(mockClassId, 'student-abc');
    });

    it('should throw if student is not enrolled', async () => {
      mockClassRepository.findMembership.mockResolvedValue(false);

      await expect(classService.leaveClass('student-abc', mockClassId)).rejects.toThrow(
        'You are not enrolled in this class'
      );

      expect(mockClassRepository.leaveClass).not.toHaveBeenCalled();
    });

    it('should throw if leave operation fails', async () => {
      mockClassRepository.findMembership.mockResolvedValue(true);
      mockClassRepository.leaveClass.mockResolvedValue(false);

      await expect(classService.leaveClass('student-abc', mockClassId)).rejects.toThrow(
        'Failed to leave class'
      );
    });
  });

  describe('getEnrolledClasses', () => {
    it('should return all enrolled classes for a student', async () => {
      const enrollments: StudentClassData[] = [
        {
          id: 'member-1',
          classId: mockClassId,
          studentId: 'student-abc',
          joinedAt: new Date(),
          class: makeClass(),
        },
        {
          id: 'member-2',
          classId: 'class-789',
          studentId: 'student-abc',
          joinedAt: new Date(),
          class: makeClass({ id: 'class-789', name: 'JS 101' }),
        },
      ];

      mockClassRepository.findEnrolledClasses.mockResolvedValue(enrollments);

      const result = await classService.getEnrolledClasses('student-abc');

      expect(mockClassRepository.findEnrolledClasses).toHaveBeenCalledWith('student-abc');
      expect(result).toHaveLength(2);
      expect(result[0].class.name).toBe('Python 101');
      expect(result[1].class.name).toBe('JS 101');
    });

    it('should return empty array if not enrolled anywhere', async () => {
      mockClassRepository.findEnrolledClasses.mockResolvedValue([]);

      const result = await classService.getEnrolledClasses('student-abc');
      expect(result).toEqual([]);
    });
  });

  describe('getEnrolledClass', () => {
    it('should return class details when student is enrolled', async () => {
      const mockClass = makeClass();

      mockClassRepository.findMembership.mockResolvedValue(true);
      mockClassRepository.findById.mockResolvedValue(mockClass);

      const result = await classService.getEnrolledClass('student-abc', mockClassId);

      expect(mockClassRepository.findMembership).toHaveBeenCalledWith(mockClassId, 'student-abc');
      expect(mockClassRepository.findById).toHaveBeenCalledWith(mockClassId);
      expect(result).toEqual(mockClass);
    });

    it('should throw if student is not enrolled', async () => {
      mockClassRepository.findMembership.mockResolvedValue(false);

      await expect(classService.getEnrolledClass('student-abc', mockClassId)).rejects.toThrow(
        'Class not found'
      );

      expect(mockClassRepository.findById).not.toHaveBeenCalled();
    });

    it('should throw if class does not exist', async () => {
      mockClassRepository.findMembership.mockResolvedValue(true);
      mockClassRepository.findById.mockResolvedValue(null);

      await expect(classService.getEnrolledClass('student-abc', mockClassId)).rejects.toThrow(
        'Class not found'
      );
    });
  });

  describe('getClassStudents', () => {
    describe('as TEACHER', () => {
      it('should return student list when teacher owns the class', async () => {
        const studentList = makeStudentList();
        mockClassRepository.findByIdAndTeacher.mockResolvedValue(makeClass());
        mockClassRepository.findStudentsByClass.mockResolvedValue(studentList);

        const result = await classService.getClassStudents(mockClassId, mockTeacherId, 'TEACHER');

        expect(mockClassRepository.findByIdAndTeacher).toHaveBeenCalledWith(
          mockClassId,
          mockTeacherId
        );
        expect(mockClassRepository.findStudentsByClass).toHaveBeenCalledWith(mockClassId);
        expect(result.classId).toBe(mockClassId);
        expect(result.studentCount).toBe(2);
        expect(result.students).toHaveLength(2);
      });

      it('should throw if teacher does not own the class', async () => {
        mockClassRepository.findByIdAndTeacher.mockResolvedValue(null);

        await expect(
          classService.getClassStudents(mockClassId, mockTeacherId, 'TEACHER')
        ).rejects.toThrow('Class not found');

        expect(mockClassRepository.findStudentsByClass).not.toHaveBeenCalled();
      });

      it('should return empty student list for an empty class', async () => {
        const emptyList = makeStudentList({ studentCount: 0, students: [] });
        mockClassRepository.findByIdAndTeacher.mockResolvedValue(makeClass());
        mockClassRepository.findStudentsByClass.mockResolvedValue(emptyList);

        const result = await classService.getClassStudents(mockClassId, mockTeacherId, 'TEACHER');

        expect(result.studentCount).toBe(0);
        expect(result.students).toHaveLength(0);
      });

      it('should return correct student fields', async () => {
        mockClassRepository.findByIdAndTeacher.mockResolvedValue(makeClass());
        mockClassRepository.findStudentsByClass.mockResolvedValue(makeStudentList());

        const result = await classService.getClassStudents(mockClassId, mockTeacherId, 'TEACHER');

        expect(result.students[0].id).toBe('student-1');
        expect(result.students[0].name).toBe('Alice');
        expect(result.students[0].email).toBe('alice@example.com');
        expect(result.students[0].joinedAt).toBeInstanceOf(Date);
      });
    });

    describe('as STUDENT', () => {
      it('should return student list when student is enrolled', async () => {
        const studentList = makeStudentList();
        mockClassRepository.findMembership.mockResolvedValue(true);
        mockClassRepository.findStudentsByClass.mockResolvedValue(studentList);

        const result = await classService.getClassStudents(mockClassId, mockStudentId, 'STUDENT');

        expect(mockClassRepository.findMembership).toHaveBeenCalledWith(mockClassId, mockStudentId);
        expect(mockClassRepository.findStudentsByClass).toHaveBeenCalledWith(mockClassId);
        expect(result.studentCount).toBe(2);
        expect(result.students).toHaveLength(2);
      });

      it('should throw if student is not enrolled', async () => {
        mockClassRepository.findMembership.mockResolvedValue(false);

        await expect(
          classService.getClassStudents(mockClassId, mockStudentId, 'STUDENT')
        ).rejects.toThrow('Class not found');

        expect(mockClassRepository.findStudentsByClass).not.toHaveBeenCalled();
      });

      it('should return correct student fields', async () => {
        mockClassRepository.findMembership.mockResolvedValue(true);
        mockClassRepository.findStudentsByClass.mockResolvedValue(makeStudentList());

        const result = await classService.getClassStudents(mockClassId, mockStudentId, 'STUDENT');

        expect(result.students[1].id).toBe('student-2');
        expect(result.students[1].name).toBe('Bob');
        expect(result.students[1].email).toBe('bob@example.com');
        expect(result.students[1].joinedAt).toBeInstanceOf(Date);
      });

      it('should not call findByIdAndTeacher for student role', async () => {
        mockClassRepository.findMembership.mockResolvedValue(true);
        mockClassRepository.findStudentsByClass.mockResolvedValue(makeStudentList());

        await classService.getClassStudents(mockClassId, mockStudentId, 'STUDENT');

        expect(mockClassRepository.findByIdAndTeacher).not.toHaveBeenCalled();
      });
    });
  });
});
