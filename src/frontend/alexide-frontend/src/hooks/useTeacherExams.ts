import { useState, useCallback, useEffect } from 'react';

export interface TeacherExamSummary {
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

export interface CreateExamData {
  title: string;
  instructions?: string | null;
  language?: string;
  durationMinutes: number;
  maxScore: number;
  isOpenBook?: boolean;
  scheduledStart?: string | null;
}

const getToken = () => localStorage.getItem('authToken');

export function useTeacherExams(classId: string) {
  const [exams, setExams] = useState<TeacherExamSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchExams = useCallback(async () => {
    if (!classId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/backend/teacher/exams/class/${classId}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? 'Failed to load exams');
      }
      const data = await res.json();
      setExams(data.data ?? data.exams ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  }, [classId]);

  useEffect(() => {
    fetchExams();
  }, [fetchExams]);

  const createExam = useCallback(
    async (data: CreateExamData): Promise<TeacherExamSummary> => {
      const res = await fetch(`/api/backend/teacher/exams/${classId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? 'Failed to create exam');
      }
      const result = await res.json();
      await fetchExams();
      return result.data ?? result.exam ?? result;
    },
    [classId, fetchExams]
  );

  const deleteExam = useCallback(
    async (examId: string): Promise<void> => {
      const res = await fetch(`/api/backend/teacher/exams/${examId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? 'Failed to delete exam');
      }
      await fetchExams();
    },
    [fetchExams]
  );

  return { exams, loading, error, fetchExams, createExam, deleteExam };
}
