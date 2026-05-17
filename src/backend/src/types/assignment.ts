import type { SubmissionStatus } from './submission';

export type AssignmentStatus = 'DRAFT' | 'PUBLISHED' | 'CLOSED';
export type AssignmentFileType = 'STARTER' | 'TEST';

export interface AssignmentData {
  id: string;
  classId: string;
  teacherId: string;
  title: string;
  description: string | null;
  dueDate: Date | null;
  maxScore: number;
  language: string;
  status: AssignmentStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface TestCaseData {
  id: string;
  assignmentId: string;
  name: string;
  inputData: string | null;
  expectedOutput: string;
  sysArgs: string[] | null;
  weight: number;
  orderIndex: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface AssignmentWithTestCases extends AssignmentData {
  testCases: TestCaseData[];
}

export interface TestCasePublic {
  id: string;
  name: string;
  inputData: string | null;
  orderIndex: number;
}

export interface AssignmentWithPublicTestCases extends AssignmentData {
  testCases: TestCasePublic[];
}

export interface CreateAssignmentRequest {
  title: string;
  description?: string;
  dueDate?: string;
  maxScore?: number;
  language?: string;
  status?: AssignmentStatus;
}

export interface UpdateAssignmentRequest {
  title?: string;
  description?: string;
  dueDate?: string;
  maxScore?: number;
  language?: string;
  status?: AssignmentStatus;
}

export interface CreateTestCaseRequest {
  name: string;
  inputData?: string;
  sysArgs?: string[];
  expectedOutput: string;
  weight?: number;
  orderIndex?: number;
}

export interface UpdateTestCaseRequest {
  name?: string;
  inputData?: string;
  sysArgs?: string[] | null;
  expectedOutput?: string;
  weight?: number;
  orderIndex?: number;
}

export interface AssignmentWithSubmissionStatus extends AssignmentData {
  className: string;
  submissionStatus: SubmissionStatus | null;
  submissionScore: number | null;
  submissionMaxScore: number | null;
  submittedAt: Date | null;
}
