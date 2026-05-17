import { useState, useEffect, useCallback } from 'react';

const getToken = () => localStorage.getItem('authToken');

export type SourceType = 'ASSIGNMENT' | 'EXAM';

export interface Grade {
  id: string;
  studentId: string;
  classId: string;
  sourceType: SourceType;
  sourceId: string;
  score: number;
  maxScore: number;
  percentage: number;
  releasedAt: string | null;
  createdAt: string;
  updatedAt: string;
  student?: {
    id: string;
    name: string;
    email: string;
  };
}

export interface RecordGradeData {
  studentId: string;
  sourceType: SourceType;
  sourceId: string;
  score: number;
  maxScore: number;
}

export function useTeacherGrades(classId: string) {
  const [grades, setGrades] = useState<Grade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGrades = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/backend/teacher/grades/class/${classId}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (res.ok) setGrades(data.data || []);
      else setError(data.error || 'Failed to load grades');
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }, [classId]);

  useEffect(() => {
    fetchGrades();
  }, [fetchGrades]);

  const recordGrade = async (gradeData: RecordGradeData): Promise<Grade> => {
    const res = await fetch(`/api/backend/teacher/grades/class/${classId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify(gradeData),
    });
    const data = await res.json();
    if (res.ok) {
      await fetchGrades();
      return data.data;
    }
    throw new Error(data.error || 'Failed to record grade');
  };

  const updateGrade = async (gradeId: string, score: number, maxScore: number): Promise<Grade> => {
    const res = await fetch(`/api/backend/teacher/grades/${gradeId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ score, maxScore }),
    });
    const data = await res.json();
    if (res.ok) {
      await fetchGrades();
      return data.data;
    }
    throw new Error(data.error || 'Failed to update grade');
  };

  const deleteGrade = async (gradeId: string): Promise<void> => {
    const res = await fetch(`/api/backend/teacher/grades/${gradeId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (res.ok) {
      await fetchGrades();
      return;
    }
    const data = await res.json();
    throw new Error(data.error || 'Failed to delete grade');
  };

  const releaseGrades = async (sourceType: SourceType, sourceId: string): Promise<void> => {
    const res = await fetch(`/api/backend/teacher/grades/class/${classId}/release`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ sourceType, sourceId }),
    });
    if (res.ok) {
      await fetchGrades();
      return;
    }
    const data = await res.json();
    throw new Error(data.error || 'Failed to release grades');
  };

  return {
    grades,
    loading,
    error,
    fetchGrades,
    recordGrade,
    updateGrade,
    deleteGrade,
    releaseGrades,
  };
}
