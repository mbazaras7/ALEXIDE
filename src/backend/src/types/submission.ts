export type SubmissionStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';

export interface TestResult {
  name: string;
  passed: boolean;
  actualOutput: string;
  expectedOutput: string;
  weight: number;
}

export interface SubmissionData {
  id: string;
  assignmentId: string;
  studentId: string;
  code: string;
  status: SubmissionStatus;
  score: number | null;
  maxScore: number | null;
  testResults: TestResult[] | null;
  submittedAt: Date;
  updatedAt: Date;
  aiFeedback: string | null;
  aiFeedbackGeneratedAt: Date | null;
  feedback: string | null;
  feedbackUpdatedAt: Date | null;
}

export interface StudentSubmissionData {
  id: string;
  assignmentId: string;
  code: string;
  status: SubmissionStatus;
  score: number | null;
  maxScore: number | null;
  testResults: TestResult[] | null;
  submittedAt: Date;
  updatedAt: Date;
  feedback: string | null;
  feedbackUpdatedAt: Date | null;
}
