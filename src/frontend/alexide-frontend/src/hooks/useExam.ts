import { useState, useEffect, useCallback } from 'react';

export interface ExamData {
  id: string;
  classId: string;
  title: string;
  instructions: string | null;
  language: string;
  durationMinutes: number;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  status: 'DRAFT' | 'SCHEDULED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  maxScore: number;
  isOpenBook: boolean;
  createdAt: string;
  updatedAt: string;
  questions: ExamQuestionData[];
}

export interface ExamQuestionData {
  id: string;
  examId: string;
  title: string;
  description: string | null;
  maxScore: number;
  language: string;
  orderIndex: number;
  testCases: ExamTestCaseData[];
}

export interface ExamSessionData {
  id: string;
  examId: string;
  studentId: string;
  startedAt: string;
  submittedAt: string | null;
  expiresAt: string;
  tabSwitchCounter: number;
  isSubmitted: boolean;
}

export interface ExamSubmissionData {
  id: string;
  questionId: string;
  code: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  score: number | null;
  maxScore: number | null;
  testResults: Array<{
    name: string;
    passed: boolean;
    actualOutput: string;
    expectedOutput: string;
    weight: number;
  }> | null;
  submittedAt: string;
}

export interface ExamTestCaseData {
  id: string;
  name: string;
  inputData: string | null;
  orderIndex: number;
  sysArgs: string[] | null;
  weight: number;
}

export type ExamPhase = 'idle' | 'loading' | 'active' | 'submitted' | 'ended' | 'error';

const getToken = () => localStorage.getItem('authToken');

export function useExam({ examId }: { examId: string | null }) {
  const [phase, setPhase] = useState<ExamPhase>('idle');
  const [exam, setExam] = useState<ExamData | null>(null);
  const [session, setSession] = useState<ExamSessionData | null>(null);
  const [submissions, setSubmissions] = useState<ExamSubmissionData[]>([]);
  const [tabSwitchCounter, setTabSwitchCounter] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submitQuestion = useCallback(
    async (questionId: string, code: string): Promise<ExamSubmissionData | null> => {
      if (!examId) return null;
      const res = await fetch(
        `/api/backend/student/exams/${examId}/questions/${questionId}/answer`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
          body: JSON.stringify({ code }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to save answer');
      const submission = data.data as ExamSubmissionData;
      setSubmissions((prev) => {
        const idx = prev.findIndex((s) => s.questionId === questionId);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = submission;
          return next;
        }
        return [...prev, submission];
      });
      return submission;
    },
    [examId]
  );

  const submitAll = useCallback(async (): Promise<void> => {
    if (!examId) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/backend/student/exams/${examId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({}),
      });
      const data = await res.json();

      const alreadySubmitted =
        !res.ok && (data.error?.toLowerCase().includes('already submitted') || res.status === 409);

      if (!res.ok && !alreadySubmitted) {
        throw new Error(data.error ?? 'Failed to submit exam');
      }

      setSession((prev) =>
        prev ? { ...prev, isSubmitted: true, submittedAt: new Date().toISOString() } : prev
      );
      setPhase('submitted');
    } catch (err) {
      throw err;
    } finally {
      setSubmitting(false);
    }
  }, [examId]);

  const recordTabSwitch = useCallback(async (): Promise<void> => {
    if (!examId) return;
    await fetch(`/api/backend/student/exams/${examId}/tab-switch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({}),
    });
    setTabSwitchCounter((n) => n + 1);
    setSession((prev) => (prev ? { ...prev, tabSwitchCounter: prev.tabSwitchCounter + 1 } : prev));
  }, [examId]);

  useEffect(() => {
    if (!examId) return;
    let cancelled = false;

    async function init() {
      try {
        setPhase('loading');
        setError(null);

        const examRes = await fetch(`/api/backend/student/exams/${examId}`, {
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        });
        const examJson = await examRes.json();
        if (!examRes.ok) throw new Error(examJson.error ?? 'Failed to load exam');
        if (cancelled) return;
        setExam(examJson.data as ExamData);

        const sessRes = await fetch(`/api/backend/student/exams/${examId}/session`, {
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        });
        let sess: ExamSessionData | null = null;
        if (sessRes.ok) {
          const sessJson = await sessRes.json();
          const raw = sessJson.data;
          sess = { ...raw, tabSwitchCounter: raw.tabSwitchCounter ?? raw.tabSwitchCount ?? 0 };
        }
        if (cancelled) return;

        if (!sess) {
          const startRes = await fetch(`/api/backend/student/exams/${examId}/start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
            body: JSON.stringify({}),
          });
          const startJson = await startRes.json();
          if (!startRes.ok) throw new Error(startJson.error ?? 'Failed to start exam');
          sess = startJson.data as ExamSessionData;
        } else {
          setTabSwitchCounter(sess.tabSwitchCounter);
        }
        if (cancelled) return;
        setSession(sess);

        const answersRes = await fetch(`/api/backend/student/exams/${examId}/answers`, {
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        });
        if (answersRes.ok) {
          const answersJson = await answersRes.json();
          setSubmissions(answersJson.data ?? []);
        }
        if (cancelled) return;

        setPhase(sess.isSubmitted ? 'submitted' : 'active');
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load exam');
          setPhase('error');
        }
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, [examId]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    phase,
    exam,
    questions: exam?.questions ?? [],
    submissions,
    tabSwitchCounter,
    error,
    submitQuestion,
    submitAll,
    session,
    loading: phase === 'loading' || phase === 'idle',
    submitting,
    recordTabSwitch,
    refreshSubmissions: async () => {
      const res = await fetch(`/api/backend/student/exams/${examId}/answers`, {
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) {
        const json = await res.json();
        setSubmissions(json.data ?? []);
      }
    },
  };
}
