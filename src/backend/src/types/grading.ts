import type { SubmissionStatus } from './submission';
export type { SubmissionStatus }; //re-export so existing imports don't break

export interface SubmissionForGrading {
  id: string;
  assignmentId: string;
  studentId: string;
  code: string;
  status: SubmissionStatus;
  score: number | null;
  maxScore: number | null;
  updatedAt: Date;
}

export interface AssignmentForGrading {
  id: string;
  classId: string;
  teacherId: string;
  title: string;
  description: string | null;
  maxScore: number;
  language: string;
}

export interface SubmissionWithAssignment {
  id: string;
  assignmentId: string;
  status: SubmissionStatus;
}

export interface UpsertGradeData {
  studentId: string;
  classId: string;
  sourceId: string;
  score: number;
  maxScore: number;
}

export interface UpdateSubmissionResultData {
  status: SubmissionStatus;
  score: number;
  maxScore: number;
  testResults: string;
}
