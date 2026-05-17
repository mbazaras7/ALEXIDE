import type { StudentInfo } from './class';

export type SourceType = 'ASSIGNMENT' | 'EXAM';

export interface GradeData {
  id: string;
  studentId: string;
  classId: string;
  sourceType: SourceType;
  sourceId: string;
  score: number;
  maxScore: number;
  percentage: number; //(score / maxScore) * 100
  releasedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface GradeWithStudent extends GradeData {
  student: StudentInfo;
}

export interface GradeWithClass extends GradeData {
  class: {
    id: string;
    name: string;
  };
}

export interface RecordGradeRequest {
  studentId: string;
  classId: string;
  sourceType: SourceType;
  sourceId: string;
  score: number;
  maxScore: number;
}

export interface UpdateGradeRequest {
  score?: number;
  maxScore?: number;
}

export interface ReleaseGradesRequest {
  sourceType: SourceType;
  sourceId: string;
  classId: string;
}

export interface GradeStats {
  totalGrades: number;
  averagePercentage: number;
  highestPercentage: number;
  lowestPercentage: number;
  assignmentCount: number;
  examCount: number;
  assignmentAverage: number;
  examAverage: number;
}

export interface ClassPerformanceSummary {
  classId: string;
  className: string;
  totalGrades: number;
  averagePercentage: number;
  highestPercentage: number;
  lowestPercentage: number;
}

export interface StudentClassSummary {
  studentId: string;
  totalEarned: number;
  totalPossible: number;
  percentage: number;
  gradedCount: number;
}

export interface StudentOverview extends StudentClassSummary {
  grades: (GradeData & {
    student: StudentInfo;
  })[];
}
