import { useState } from 'react';

export interface MonitoredStudent {
  studentId: string;
  name: string;
  sessionId: string;
  status: 'active' | 'disconnected' | 'submitted';
  tabSwitchCounter: number;
  joinedAt: string;
  submittedAt: string | null;
}

export interface SnapshotAnswer {
  questionId: string;
  questionTitle: string;
  code: string;
  submittedAt: string | null;
  score: number | null;
}

export interface ExamSnapshot {
  studentId: string;
  studentName: string;
  answers: SnapshotAnswer[];
}

interface UseTeacherExamOptions {
  examId: string | null;
}

export function useTeacherExam({ examId: _examId }: UseTeacherExamOptions) {
  const [snapshot] = useState<ExamSnapshot | null>(null);

  return {
    exam: null,
    students: [] as MonitoredStudent[],
    snapshot,
    snapshotLoading: false,
    isConnected: false,
    error: null,
    alertStudentId: null,
    requestSnapshot: (_studentId: string) => {},
    dismissSnapshot: () => {},
    updateExamStatus: (_status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED') => {},
  };
}
