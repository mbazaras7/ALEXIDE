import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { gradeService } from '../grade';
import { gradeRepository } from '../../repositories/grade';
import { classRepository } from '../../repositories/class';
import { GradeData } from '../../types/grade';

jest.mock('../../repositories/grade');
jest.mock('../../repositories/class');

const mockGradeRepository = gradeRepository as jest.Mocked<typeof gradeRepository>;
const mockClassRepository = classRepository as jest.Mocked<typeof classRepository>;

const teacherId = 'teacher-123';
const studentId = 'student-456';
const classId = 'class-789';
const gradeId = 'grade-001';

const makeClass = () => ({
  id: classId,
  name: 'Python',
  description: null,
  teacherId,
  joinCode: 'ABCD1234',
  createdAt: new Date(),
  updatedAt: new Date(),
});

const makeGrade = (overrides: Partial<GradeData> = {}): GradeData => ({
  id: gradeId,
  studentId,
  classId,
  sourceType: 'ASSIGNMENT',
  sourceId: 'asgn-1',
  score: 80,
  maxScore: 100,
  percentage: 80,
  releasedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('GradeService', () => {
  beforeEach(async () => jest.clearAllMocks());

  describe('recordGrade', () => {
    it('should create a new grade successfully', async () => {
      mockClassRepository.findByIdAndTeacher.mockResolvedValue(makeClass());
      mockClassRepository.findMembership.mockResolvedValue(true);
      mockGradeRepository.findByStudentAndSource.mockResolvedValue(null);
      mockGradeRepository.create.mockResolvedValue(makeGrade());

      const result = await gradeService.recordGrade(teacherId, {
        studentId,
        classId,
        sourceType: 'ASSIGNMENT',
        sourceId: 'asgn-1',
        score: 80,
        maxScore: 100,
      });

      expect(mockGradeRepository.create).toHaveBeenCalled();
      expect(result.score).toBe(80);
    });

    it('should update existing grade if one already exists', async () => {
      mockClassRepository.findByIdAndTeacher.mockResolvedValue(makeClass());
      mockClassRepository.findMembership.mockResolvedValue(true);
      mockGradeRepository.findByStudentAndSource.mockResolvedValue(makeGrade());
      mockGradeRepository.update.mockResolvedValue(makeGrade({ score: 90, percentage: 90 }));

      const result = await gradeService.recordGrade(teacherId, {
        studentId,
        classId,
        sourceType: 'ASSIGNMENT',
        sourceId: 'asgn-1',
        score: 90,
        maxScore: 100,
      });

      expect(mockGradeRepository.update).toHaveBeenCalledWith(gradeId, {
        score: 90,
        maxScore: 100,
      });
      expect(mockGradeRepository.create).not.toHaveBeenCalled();
      expect(result.score).toBe(90);
    });

    it('should throw if class not found', async () => {
      mockClassRepository.findByIdAndTeacher.mockResolvedValue(null);

      await expect(
        gradeService.recordGrade(teacherId, {
          studentId,
          classId,
          sourceType: 'ASSIGNMENT',
          sourceId: 'asgn-1',
          score: 80,
          maxScore: 100,
        })
      ).rejects.toThrow('Class not found');
    });

    it('should throw if student is not enrolled', async () => {
      mockClassRepository.findByIdAndTeacher.mockResolvedValue(makeClass());
      mockClassRepository.findMembership.mockResolvedValue(false);

      await expect(
        gradeService.recordGrade(teacherId, {
          studentId,
          classId,
          sourceType: 'ASSIGNMENT',
          sourceId: 'asgn-1',
          score: 80,
          maxScore: 100,
        })
      ).rejects.toThrow('Student is not enrolled in this class');
    });

    it('should throw if score exceeds maxScore', async () => {
      mockClassRepository.findByIdAndTeacher.mockResolvedValue(makeClass());
      mockClassRepository.findMembership.mockResolvedValue(true);

      await expect(
        gradeService.recordGrade(teacherId, {
          studentId,
          classId,
          sourceType: 'ASSIGNMENT',
          sourceId: 'asgn-1',
          score: 110,
          maxScore: 100,
        })
      ).rejects.toThrow('Score cannot exceed max score');
    });

    it('should throw if score is negative', async () => {
      mockClassRepository.findByIdAndTeacher.mockResolvedValue(makeClass());
      mockClassRepository.findMembership.mockResolvedValue(true);

      await expect(
        gradeService.recordGrade(teacherId, {
          studentId,
          classId,
          sourceType: 'ASSIGNMENT',
          sourceId: 'asgn-1',
          score: -5,
          maxScore: 100,
        })
      ).rejects.toThrow('Score cannot be negative');
    });
  });

  describe('updateGrade', () => {
    it('should update grade successfully', async () => {
      mockGradeRepository.findById.mockResolvedValue(makeGrade());
      mockClassRepository.findByIdAndTeacher.mockResolvedValue(makeClass());
      mockGradeRepository.update.mockResolvedValue(makeGrade({ score: 95, percentage: 95 }));

      const result = await gradeService.updateGrade(gradeId, teacherId, { score: 95 });
      expect(result.score).toBe(95);
    });

    it('should throw if grade not found', async () => {
      mockGradeRepository.findById.mockResolvedValue(null);

      await expect(gradeService.updateGrade(gradeId, teacherId, { score: 95 })).rejects.toThrow(
        'Grade not found'
      );
    });

    it('should throw if teacher does not own the class', async () => {
      mockGradeRepository.findById.mockResolvedValue(makeGrade());
      mockClassRepository.findByIdAndTeacher.mockResolvedValue(null);

      await expect(gradeService.updateGrade(gradeId, teacherId, { score: 95 })).rejects.toThrow(
        'Grade not found'
      );
    });
  });

  describe('deleteGrade', () => {
    it('should delete grade successfully', async () => {
      mockGradeRepository.findById.mockResolvedValue(makeGrade());
      mockClassRepository.findByIdAndTeacher.mockResolvedValue(makeClass());
      mockGradeRepository.delete.mockResolvedValue(true);

      await expect(gradeService.deleteGrade(gradeId, teacherId)).resolves.not.toThrow();
    });

    it('should throw if grade not found', async () => {
      mockGradeRepository.findById.mockResolvedValue(null);

      await expect(gradeService.deleteGrade(gradeId, teacherId)).rejects.toThrow('Grade not found');
    });
  });

  describe('releaseGrades', () => {
    it('should release grades and return count', async () => {
      mockClassRepository.findByIdAndTeacher.mockResolvedValue(makeClass());
      mockGradeRepository.releaseGrades.mockResolvedValue(3);

      const result = await gradeService.releaseGrades(teacherId, {
        sourceType: 'ASSIGNMENT',
        sourceId: 'asgn-1',
        classId,
      });

      expect(result.released).toBe(3);
    });

    it('should throw if no grades found to release', async () => {
      mockClassRepository.findByIdAndTeacher.mockResolvedValue(makeClass());
      mockGradeRepository.releaseGrades.mockResolvedValue(0);

      await expect(
        gradeService.releaseGrades(teacherId, {
          sourceType: 'ASSIGNMENT',
          sourceId: 'asgn-1',
          classId,
        })
      ).rejects.toThrow('No grades found to release');
    });
  });

  describe('getClassOverview', () => {
    it('should return weighted percentage summary per student', async () => {
      mockClassRepository.findByIdAndTeacher.mockResolvedValue(makeClass());
      mockGradeRepository.findByClass.mockResolvedValue([
        {
          ...makeGrade({ score: 75, maxScore: 100 }),
          student: { id: studentId, name: 'Student', email: 's@test.com' },
        },
        {
          ...makeGrade({ score: 20, maxScore: 20, sourceId: 'asgn-2' }),
          student: { id: studentId, name: 'Student', email: 's@test.com' },
        },
      ]);

      const result = await gradeService.getClassOverview(teacherId, classId);

      expect(result).toHaveLength(1);
      expect(result[0].studentId).toBe(studentId);
      expect(result[0].totalEarned).toBe(95);
      expect(result[0].totalPossible).toBe(120);
      expect(result[0].percentage).toBe(79.17);
      expect(result[0].gradedCount).toBe(2);
    });

    it('should return empty array if no grades exist', async () => {
      mockClassRepository.findByIdAndTeacher.mockResolvedValue(makeClass());
      mockGradeRepository.findByClass.mockResolvedValue([]);

      const result = await gradeService.getClassOverview(teacherId, classId);
      expect(result).toEqual([]);
    });

    it('should throw if class not found', async () => {
      mockClassRepository.findByIdAndTeacher.mockResolvedValue(null);

      await expect(gradeService.getClassOverview(teacherId, classId)).rejects.toThrow(
        'Class not found'
      );
    });

    it('should aggregate multiple students separately', async () => {
      const student2Id = 'student-999';
      mockClassRepository.findByIdAndTeacher.mockResolvedValue(makeClass());
      mockGradeRepository.findByClass.mockResolvedValue([
        {
          ...makeGrade({ score: 80, maxScore: 100 }),
          student: { id: studentId, name: 'A', email: 'a@test.com' },
        },
        {
          ...makeGrade({ score: 50, maxScore: 100, studentId: student2Id }),
          student: { id: student2Id, name: 'B', email: 'b@test.com' },
        },
      ]);

      const result = await gradeService.getClassOverview(teacherId, classId);

      expect(result).toHaveLength(2);
      const s1 = result.find((r) => r.studentId === studentId);
      const s2 = result.find((r) => r.studentId === student2Id);
      expect(s1!.percentage).toBe(80);
      expect(s2!.percentage).toBe(50);
    });
  });

  describe('getStudentOverview', () => {
    it('should return summary and grades for a student', async () => {
      mockClassRepository.findByIdAndTeacher.mockResolvedValue(makeClass());
      mockClassRepository.findMembership.mockResolvedValue(true);
      mockGradeRepository.findByClassAndStudent.mockResolvedValue([
        {
          ...makeGrade({ score: 75, maxScore: 100 }),
          student: { id: studentId, name: 'Student', email: 's@test.com' },
        },
        {
          ...makeGrade({ score: 20, maxScore: 20, sourceId: 'asgn-2' }),
          student: { id: studentId, name: 'Student', email: 's@test.com' },
        },
      ]);

      const result = await gradeService.getStudentOverview(teacherId, classId, studentId);

      expect(result.studentId).toBe(studentId);
      expect(result.totalEarned).toBe(95);
      expect(result.totalPossible).toBe(120);
      expect(result.percentage).toBe(79.17);
      expect(result.gradedCount).toBe(2);
      expect(result.grades).toHaveLength(2);
    });

    it('should return 0% if student has no grades', async () => {
      mockClassRepository.findByIdAndTeacher.mockResolvedValue(makeClass());
      mockClassRepository.findMembership.mockResolvedValue(true);
      mockGradeRepository.findByClassAndStudent.mockResolvedValue([]);

      const result = await gradeService.getStudentOverview(teacherId, classId, studentId);

      expect(result.percentage).toBe(0);
      expect(result.gradedCount).toBe(0);
      expect(result.grades).toHaveLength(0);
    });

    it('should throw if class not found', async () => {
      mockClassRepository.findByIdAndTeacher.mockResolvedValue(null);

      await expect(gradeService.getStudentOverview(teacherId, classId, studentId)).rejects.toThrow(
        'Class not found'
      );
    });

    it('should throw if student is not enrolled', async () => {
      mockClassRepository.findByIdAndTeacher.mockResolvedValue(makeClass());
      mockClassRepository.findMembership.mockResolvedValue(false);

      await expect(gradeService.getStudentOverview(teacherId, classId, studentId)).rejects.toThrow(
        'Student is not enrolled in this class'
      );
    });
  });

  describe('getMyGradesForClass', () => {
    it('should return released grades for enrolled student', async () => {
      mockClassRepository.findMembership.mockResolvedValue(true);
      mockGradeRepository.findReleasedByStudentAndClass.mockResolvedValue([
        makeGrade({ releasedAt: new Date() }),
      ]);

      const result = await gradeService.getMyGradesForClass(studentId, classId);
      expect(result).toHaveLength(1);
    });

    it('should throw if student is not enrolled', async () => {
      mockClassRepository.findMembership.mockResolvedValue(false);

      await expect(gradeService.getMyGradesForClass(studentId, classId)).rejects.toThrow(
        'You are not enrolled in this class'
      );
    });
  });

  describe('getMyGradeById', () => {
    it('should return a released grade by id', async () => {
      const releasedGrade = makeGrade({ releasedAt: new Date() });
      mockGradeRepository.findReleasedByIdAndStudent.mockResolvedValue({
        ...releasedGrade,
        class: { id: classId, name: 'Python' },
      });

      const result = await gradeService.getMyGradeById(studentId, gradeId);
      expect(result.id).toBe(gradeId);
      expect(result.class.name).toBe('Python');
    });

    it('should throw if grade not found or unreleased', async () => {
      mockGradeRepository.findReleasedByIdAndStudent.mockResolvedValue(null);

      await expect(gradeService.getMyGradeById(studentId, gradeId)).rejects.toThrow(
        'Grade not found'
      );
    });
  });

  describe('getMyStatsForClass', () => {
    it('should return correct stats for a class', async () => {
      mockClassRepository.findMembership.mockResolvedValue(true);
      mockGradeRepository.findAllReleasedByStudentAndClass.mockResolvedValue([
        makeGrade({
          sourceType: 'ASSIGNMENT',
          score: 80,
          maxScore: 100,
          percentage: 80,
          releasedAt: new Date(),
        }),
        makeGrade({
          sourceType: 'ASSIGNMENT',
          score: 90,
          maxScore: 100,
          percentage: 90,
          releasedAt: new Date(),
        }),
        makeGrade({
          sourceType: 'EXAM',
          score: 70,
          maxScore: 100,
          percentage: 70,
          releasedAt: new Date(),
        }),
      ]);

      const result = await gradeService.getMyStatsForClass(studentId, classId);

      expect(result.totalGrades).toBe(3);
      expect(result.assignmentCount).toBe(2);
      expect(result.examCount).toBe(1);
      expect(result.assignmentAverage).toBe(85);
      expect(result.examAverage).toBe(70);
      expect(result.highestPercentage).toBe(90);
      expect(result.lowestPercentage).toBe(70);
    });

    it('should return zero stats if no released grades', async () => {
      mockClassRepository.findMembership.mockResolvedValue(true);
      mockGradeRepository.findAllReleasedByStudentAndClass.mockResolvedValue([]);

      const result = await gradeService.getMyStatsForClass(studentId, classId);

      expect(result.totalGrades).toBe(0);
      expect(result.averagePercentage).toBe(0);
    });

    it('should throw if student is not enrolled', async () => {
      mockClassRepository.findMembership.mockResolvedValue(false);

      await expect(gradeService.getMyStatsForClass(studentId, classId)).rejects.toThrow(
        'You are not enrolled in this class'
      );
    });
  });

  describe('getMyClassSummaries', () => {
    it('should return summaries grouped by class', async () => {
      mockGradeRepository.findReleasedByStudentGroupedByClass.mockResolvedValue([
        { ...makeGrade({ percentage: 80, releasedAt: new Date() }), className: 'Python' },
        { ...makeGrade({ percentage: 90, releasedAt: new Date() }), className: 'Python' },
        {
          ...makeGrade({ classId: 'class-999', percentage: 60, releasedAt: new Date() }),
          className: 'JS',
        },
      ]);

      const result = await gradeService.getMyClassSummaries(studentId);

      expect(result).toHaveLength(2);
      const python = result.find((s) => s.className === 'Python');
      expect(python!.totalGrades).toBe(2);
      expect(python!.averagePercentage).toBe(85);
      expect(python!.highestPercentage).toBe(90);
      expect(python!.lowestPercentage).toBe(80);
    });

    it('should return empty array if no released grades', async () => {
      mockGradeRepository.findReleasedByStudentGroupedByClass.mockResolvedValue([]);

      const result = await gradeService.getMyClassSummaries(studentId);
      expect(result).toEqual([]);
    });
  });

  describe('getMyGradesByType', () => {
    it('should return only ASSIGNMENT grades', async () => {
      mockClassRepository.findMembership.mockResolvedValue(true);
      mockGradeRepository.findReleasedByStudentClassAndType.mockResolvedValue([
        makeGrade({ sourceType: 'ASSIGNMENT', releasedAt: new Date() }),
      ]);

      const result = await gradeService.getMyGradesByType(studentId, classId, 'ASSIGNMENT');

      expect(mockGradeRepository.findReleasedByStudentClassAndType).toHaveBeenCalledWith(
        studentId,
        classId,
        'ASSIGNMENT'
      );
      expect(result[0].sourceType).toBe('ASSIGNMENT');
    });

    it('should throw if student is not enrolled', async () => {
      mockClassRepository.findMembership.mockResolvedValue(false);

      await expect(gradeService.getMyGradesByType(studentId, classId, 'EXAM')).rejects.toThrow(
        'You are not enrolled in this class'
      );
    });
  });
});
