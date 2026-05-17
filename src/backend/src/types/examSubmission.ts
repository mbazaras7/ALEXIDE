import { TestResult, SubmissionStatus } from './submission';

export interface ExamQuestionSubmissionData {
  id: string;
  examSessionId: string;
  examId: string;
  questionId: string;
  studentId: string;
  code: string;
  status: SubmissionStatus;
  score: number | null;
  maxScore: number | null;
  testResults: TestResult[] | null;
  submittedAt: Date;
  updatedAt: Date;
}

export interface ExamSubmissionResult {
  submission: ExamQuestionSubmissionData;
  testResults: TestResult[];
  score: number;
  maxScore: number;
  passed: boolean;
}
