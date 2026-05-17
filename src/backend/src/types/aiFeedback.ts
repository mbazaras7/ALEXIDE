export interface AiFeedbackInput {
  assignmentTitle: string;
  assignmentDescription: string;
  studentCode: string;
  testResults: AiFeedbackTestResult[];
  totalPassed: number;
  totalTests: number;
}

export interface AiFeedbackTestResult {
  name: string;
  passed: boolean;
  actualOutput: string;
  expectedOutput: string;
}

export interface AiFeedbackOutput {
  feedback: string;
  generatedAt: Date;
}
