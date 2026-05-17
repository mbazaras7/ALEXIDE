import { gradeRepository } from '../repositories/grade';
import { classRepository } from '../repositories/class';
import {
  GradeData,
  GradeWithStudent,
  GradeWithClass,
  RecordGradeRequest,
  UpdateGradeRequest,
  ReleaseGradesRequest,
  SourceType,
  GradeStats,
  ClassPerformanceSummary,
  StudentClassSummary,
  StudentOverview,
} from '../types/grade';

export class GradeService {
  //Teacher methods

  async recordGrade(teacherId: string, data: RecordGradeRequest): Promise<GradeData> {
    const classData = await classRepository.findByIdAndTeacher(data.classId, teacherId);
    if (!classData) {
      throw new Error('Class not found');
    }

    const isMember = await classRepository.findMembership(data.classId, data.studentId);
    if (!isMember) {
      throw new Error('Student is not enrolled in this class');
    }

    if (data.score < 0) {
      throw new Error('Score cannot be negative');
    }
    if (data.maxScore <= 0) {
      throw new Error('Max score must be greater than zero');
    }
    if (data.score > data.maxScore) {
      throw new Error('Score cannot exceed max score');
    }

    const existing = await gradeRepository.findByStudentAndSource(
      data.studentId,
      data.sourceId,
      data.sourceType
    );

    if (existing) {
      const updated = await gradeRepository.update(existing.id, {
        score: data.score,
        maxScore: data.maxScore,
      });
      if (!updated) {
        throw new Error('Failed to update grade');
      }
      return updated;
    }

    return gradeRepository.create(data);
  }

  async updateGrade(
    gradeId: string,
    teacherId: string,
    data: UpdateGradeRequest
  ): Promise<GradeData> {
    const grade = await gradeRepository.findById(gradeId);
    if (!grade) {
      throw new Error('Grade not found');
    }

    const classData = await classRepository.findByIdAndTeacher(grade.classId, teacherId);
    if (!classData) {
      throw new Error('Grade not found');
    }

    if (data.score === undefined && data.maxScore === undefined) {
      throw new Error('At least one field (score or maxScore) must be provided');
    }

    const newScore = data.score ?? grade.score;
    const newMaxScore = data.maxScore ?? grade.maxScore;

    if (newScore < 0) {
      throw new Error('Score cannot be negative');
    }
    if (newMaxScore <= 0) {
      throw new Error('Max score must be greater than zero');
    }
    if (newScore > newMaxScore) {
      throw new Error('Score cannot exceed max score');
    }

    const updated = await gradeRepository.update(gradeId, data);
    if (!updated) {
      throw new Error('Failed to update grade');
    }

    return updated;
  }

  async deleteGrade(gradeId: string, teacherId: string): Promise<void> {
    const grade = await gradeRepository.findById(gradeId);
    if (!grade) {
      throw new Error('Grade not found');
    }

    const classData = await classRepository.findByIdAndTeacher(grade.classId, teacherId);
    if (!classData) {
      throw new Error('Grade not found');
    }

    const deleted = await gradeRepository.delete(gradeId);
    if (!deleted) {
      throw new Error('Failed to delete grade');
    }
  }

  async getGradesBySource(
    teacherId: string,
    sourceId: string,
    sourceType: SourceType,
    classId: string
  ): Promise<GradeWithStudent[]> {
    const classData = await classRepository.findByIdAndTeacher(classId, teacherId);
    if (!classData) {
      throw new Error('Class not found');
    }

    return gradeRepository.findBySource(sourceId, sourceType, classId);
  }

  async getGradesByClass(teacherId: string, classId: string): Promise<GradeWithStudent[]> {
    const classData = await classRepository.findByIdAndTeacher(classId, teacherId);
    if (!classData) {
      throw new Error('Class not found');
    }

    return gradeRepository.findByClass(classId);
  }

  async releaseGrades(
    teacherId: string,
    data: ReleaseGradesRequest
  ): Promise<{ released: number }> {
    const classData = await classRepository.findByIdAndTeacher(data.classId, teacherId);
    if (!classData) {
      throw new Error('Class not found');
    }

    const released = await gradeRepository.releaseGrades(
      data.sourceId,
      data.sourceType,
      data.classId
    );

    if (released === 0) {
      throw new Error('No grades found to release');
    }

    return { released };
  }

  async getClassOverview(teacherId: string, classId: string): Promise<StudentClassSummary[]> {
    const classData = await classRepository.findByIdAndTeacher(classId, teacherId);
    if (!classData) {
      throw new Error('Class not found');
    }

    const allGrades = await gradeRepository.findByClass(classId);
    if (allGrades.length === 0) {
      return [];
    }

    const grouped = allGrades.reduce(
      (acc, grade) => {
        if (!acc[grade.studentId]) {
          acc[grade.studentId] = { totalEarned: 0, totalPossible: 0, gradedCount: 0 };
        }
        acc[grade.studentId].totalEarned += grade.score;
        acc[grade.studentId].totalPossible += grade.maxScore;
        acc[grade.studentId].gradedCount += 1;
        return acc;
      },
      {} as Record<string, { totalEarned: number; totalPossible: number; gradedCount: number }>
    );

    return Object.entries(grouped).map(([studentId, data]) => ({
      studentId,
      totalEarned: data.totalEarned,
      totalPossible: data.totalPossible,
      percentage:
        data.totalPossible > 0
          ? Math.round((data.totalEarned / data.totalPossible) * 10000) / 100
          : 0,
      gradedCount: data.gradedCount,
    }));
  }

  async getStudentOverview(
    teacherId: string,
    classId: string,
    studentId: string
  ): Promise<StudentOverview> {
    const classData = await classRepository.findByIdAndTeacher(classId, teacherId);
    if (!classData) {
      throw new Error('Class not found');
    }

    const isMember = await classRepository.findMembership(classId, studentId);
    if (!isMember) {
      throw new Error('Student is not enrolled in this class');
    }

    const studentGrades = await gradeRepository.findByClassAndStudent(classId, studentId);

    const totalEarned = studentGrades.reduce((sum, g) => sum + g.score, 0);
    const totalPossible = studentGrades.reduce((sum, g) => sum + g.maxScore, 0);
    const percentage =
      totalPossible > 0 ? Math.round((totalEarned / totalPossible) * 10000) / 100 : 0;

    return {
      studentId,
      totalEarned,
      totalPossible,
      percentage,
      gradedCount: studentGrades.length,
      grades: studentGrades,
    };
  }

  //Student methods

  async getMyGrades(studentId: string): Promise<GradeWithClass[]> {
    return gradeRepository.findReleasedByStudent(studentId);
  }

  async getMyGradesForClass(studentId: string, classId: string): Promise<GradeData[]> {
    const isMember = await classRepository.findMembership(classId, studentId);
    if (!isMember) {
      throw new Error('You are not enrolled in this class');
    }

    return gradeRepository.findReleasedByStudentAndClass(studentId, classId);
  }

  async getMyGradeById(studentId: string, gradeId: string): Promise<GradeWithClass> {
    const grade = await gradeRepository.findReleasedByIdAndStudent(gradeId, studentId);

    if (!grade) {
      throw new Error('Grade not found');
    }

    return grade;
  }

  async getMyStatsForClass(studentId: string, classId: string): Promise<GradeStats> {
    const isMember = await classRepository.findMembership(classId, studentId);
    if (!isMember) {
      throw new Error('You are not enrolled in this class');
    }

    const allGrades = await gradeRepository.findAllReleasedByStudentAndClass(studentId, classId);

    if (allGrades.length === 0) {
      return {
        totalGrades: 0,
        averagePercentage: 0,
        highestPercentage: 0,
        lowestPercentage: 0,
        assignmentCount: 0,
        examCount: 0,
        assignmentAverage: 0,
        examAverage: 0,
      };
    }

    const percentages = allGrades.map((g) => g.percentage);
    const assignments = allGrades.filter((g) => g.sourceType === 'ASSIGNMENT');
    const exams = allGrades.filter((g) => g.sourceType === 'EXAM');

    const avg = (arr: number[]) =>
      arr.length === 0 ? 0 : Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 100) / 100;

    return {
      totalGrades: allGrades.length,
      averagePercentage: avg(percentages),
      highestPercentage: Math.max(...percentages),
      lowestPercentage: Math.min(...percentages),
      assignmentCount: assignments.length,
      examCount: exams.length,
      assignmentAverage: avg(assignments.map((g) => g.percentage)),
      examAverage: avg(exams.map((g) => g.percentage)),
    };
  }

  async getMyClassSummaries(studentId: string): Promise<ClassPerformanceSummary[]> {
    const allGrades = await gradeRepository.findReleasedByStudentGroupedByClass(studentId);
    if (allGrades.length === 0) {
      return [];
    }

    const grouped = allGrades.reduce(
      (acc, grade) => {
        if (!acc[grade.classId]) {
          acc[grade.classId] = {
            classId: grade.classId,
            className: grade.className,
            grades: [],
          };
        }
        acc[grade.classId].grades.push(grade.percentage);
        return acc;
      },
      {} as Record<string, { classId: string; className: string; grades: number[] }>
    );

    return Object.values(grouped).map(({ classId, className, grades }) => {
      const avg = Math.round((grades.reduce((a, b) => a + b, 0) / grades.length) * 100) / 100;

      return {
        classId,
        className,
        totalGrades: grades.length,
        averagePercentage: avg,
        highestPercentage: Math.max(...grades),
        lowestPercentage: Math.min(...grades),
      };
    });
  }

  async getMyGradesByType(
    studentId: string,
    classId: string,
    sourceType: SourceType
  ): Promise<GradeData[]> {
    const isMember = await classRepository.findMembership(classId, studentId);
    if (!isMember) {
      throw new Error('You are not enrolled in this class');
    }

    return gradeRepository.findReleasedByStudentClassAndType(studentId, classId, sourceType);
  }
}

export const gradeService = new GradeService();
