export type ExamStatus = 'DRAFT' | 'SCHEDULED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';

export interface ExamData {
  id: string;
  classId: string;
  teacherId: string;
  title: string;
  instructions: string | null;
  language: string;
  durationMinutes: number;
  scheduledStart: Date | null;
  scheduledEnd: Date | null;
  status: ExamStatus;
  maxScore: number;
  createdAt: Date;
  updatedAt: Date;
  isOpenBook: boolean;
}

export interface ExamQuestionData {
  id: string;
  examId: string;
  title: string;
  description: string | null;
  maxScore: number;
  language: string;
  orderIndex: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExamTestCaseData {
  id: string;
  questionId: string;
  name: string;
  inputData: string | null;
  expectedOutput: string;
  sysArgs: string[] | null;
  weight: number;
  orderIndex: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExamSessionData {
  id: string;
  examId: string;
  studentId: string;
  startedAt: Date;
  submittedAt: Date | null;
  expiresAt: Date;
  tabSwitchCount: number;
  isSubmitted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExamQuestionWithTestCases extends ExamQuestionData {
  testCases: ExamTestCaseData[];
}

export interface ExamWithQuestions extends ExamData {
  questions: ExamQuestionWithTestCases[];
}

export interface ExamTestCasePublic {
  id: string;
  name: string;
  inputData: string | null;
  orderIndex: number;
}

export interface ExamQuestionWithPublicTestCases extends ExamQuestionData {
  testCases: ExamTestCasePublic[];
}

export interface ExamWithPublicQuestions extends ExamData {
  questions: ExamQuestionWithPublicTestCases[];
}
