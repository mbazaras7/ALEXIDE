import { useState, useEffect, useCallback } from 'react';

export interface ExamTestCase {
  id: string;
  name: string;
  inputData: string | null;
  expectedOutput: string;
  orderIndex: number;
  sysArgs: string | null;
  weight: number;
}

export interface ExamQuestion {
  id: string;
  examId: string;
  title: string;
  description: string | null;
  maxScore: number;
  language: string;
  orderIndex: number;
  testCases: ExamTestCase[];
}

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
}

export interface ExamSessionMonitor {
  id: string;
  studentId: string;
  studentName?: string;
  name?: string;
  startedAt: string;
  joinedAt?: string;
  submittedAt: string | null;
  expiresAt: string;
  isSubmitted: boolean;
  isOnline: boolean;
  tabSwitches?: number;
  tabSwitchCount?: number;
}

const getToken = () => localStorage.getItem('authToken');

async function throwIfNotOk(res: Response) {
  if (!res.ok) {
    let msg = `Request failed: ${res.status}`;
    try {
      const json = await res.json();
      msg = json.error ?? json.message ?? msg;
    } catch {}
    throw new Error(msg);
  }
}

export function useTeacherExamDetails(examId: string) {
  const [exam, setExam] = useState<ExamData | null>(null);
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [sessions, setSessions] = useState<ExamSessionMonitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchExam = useCallback(async () => {
    const res = await fetch(`/api/backend/teacher/exams/${examId}`, {
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
    });
    await throwIfNotOk(res);
    const json = await res.json();
    const data: ExamData & { questions?: ExamQuestion[] } = json.data ?? json;
    setExam({
      id: data.id,
      classId: data.classId,
      title: data.title,
      instructions: data.instructions,
      language: data.language,
      durationMinutes: data.durationMinutes,
      scheduledStart: data.scheduledStart,
      scheduledEnd: data.scheduledEnd,
      status: data.status,
      maxScore: data.maxScore,
      isOpenBook: data.isOpenBook,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    });
    setQuestions(data.questions ?? []);
  }, [examId]);

  const fetchSessions = useCallback(async () => {
    const res = await fetch(`/api/backend/teacher/exams/${examId}/monitor`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (!res.ok) return;
    const json = await res.json();
    const raw = json.data ?? json;
    const arr: ExamSessionMonitor[] = Array.isArray(raw)
      ? raw
      : Array.isArray(raw?.sessions)
        ? raw.sessions
        : Array.isArray(raw?.students)
          ? raw.students
          : [];

    setSessions(
      arr.map(
        (s): ExamSessionMonitor => ({
          id: s.id ?? s.studentId,
          studentId: s.studentId,
          studentName: s.studentName,
          name: s.name,
          startedAt: s.startedAt ?? s.joinedAt ?? new Date().toISOString(),
          joinedAt: s.joinedAt ?? s.startedAt,
          submittedAt: s.submittedAt ?? null,
          expiresAt: s.expiresAt ?? '',
          isSubmitted: s.isSubmitted ?? s.submittedAt != null,
          isOnline: s.isOnline ?? false,
          tabSwitches: s.tabSwitches ?? s.tabSwitchCount ?? 0,
          tabSwitchCount: s.tabSwitchCount ?? s.tabSwitches ?? 0,
        })
      )
    );
  }, [examId]);

  const fetchAll = useCallback(async () => {
    await Promise.all([fetchExam(), fetchSessions()]);
  }, [fetchExam, fetchSessions]);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        setLoading(true);
        setError(null);
        await fetchExam();
        if (cancelled) return;
        await fetchSessions();
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load exam');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    init();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examId]);

  const addQuestion = useCallback(
    async (data: { title: string; description?: string; maxScore: number }) => {
      const res = await fetch(`/api/backend/teacher/exams/${examId}/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify(data),
      });
      await throwIfNotOk(res);
      await fetchExam();
    },
    [examId, fetchExam]
  );

  const deleteQuestion = useCallback(
    async (questionId: string) => {
      const res = await fetch(`/api/backend/teacher/exams/${examId}/questions/${questionId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      });
      await throwIfNotOk(res);
      await fetchExam();
    },
    [examId, fetchExam]
  );

  const addTestCase = useCallback(
    async (
      questionId: string,
      data: { name: string; inputData?: string; expectedOutput: string }
    ) => {
      const res = await fetch(
        `/api/backend/teacher/exams/${examId}/questions/${questionId}/test-cases`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
          body: JSON.stringify(data),
        }
      );
      await throwIfNotOk(res);
      await fetchExam();
    },
    [examId, fetchExam]
  );

  const deleteTestCase = useCallback(
    async (questionId: string, testCaseId: string) => {
      const res = await fetch(
        `/api/backend/teacher/exams/${examId}/questions/${questionId}/test-cases/${testCaseId}`,
        {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        }
      );
      await throwIfNotOk(res);
      await fetchExam();
    },
    [examId, fetchExam]
  );

  const updateStatus = useCallback(
    async (status: 'SCHEDULED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED') => {
      const res = await fetch(`/api/backend/teacher/exams/${examId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ status }),
      });
      await throwIfNotOk(res);
      await fetchExam();
    },
    [examId, fetchExam]
  );

  return {
    exam,
    questions,
    sessions,
    loading,
    error,
    addQuestion,
    deleteQuestion,
    addTestCase,
    deleteTestCase,
    updateStatus,
    fetchAll,
  };
}
