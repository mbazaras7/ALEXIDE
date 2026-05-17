import { useState, useEffect, useCallback } from 'react';

const getToken = () => localStorage.getItem('authToken');

export type SourceType = 'ASSIGNMENT' | 'EXAM';

export interface StudentGrade {
  id: string;
  studentId: string;
  classId: string;
  sourceType: SourceType;
  sourceId: string;
  sourceName: string;
  score: number;
  maxScore: number;
  percentage: number;
  releasedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ClassGradeStats {
  totalGrades: number;
  averagePercentage: number;
  highestPercentage: number;
  lowestPercentage: number;
}

export function useStudentGrades(classId: string) {
  const [grades, setGrades] = useState<StudentGrade[]>([]);
  const [stats, setStats] = useState<ClassGradeStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGrades = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [gradesRes, statsRes, assignmentsRes] = await Promise.all([
        fetch(`/api/backend/student/grades/class/${classId}`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        }),
        fetch(`/api/backend/student/grades/class/${classId}/stats`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        }),
        fetch(`/api/backend/student/assignments/class/${classId}`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        }),
      ]);

      const gradesData = await gradesRes.json();
      const statsData = await statsRes.json();

      const assignmentsData = assignmentsRes.ok ? await assignmentsRes.json() : { data: [] };

      const assignmentMap: Record<string, string> = {};
      for (const a of assignmentsData.data || []) {
        assignmentMap[a.id] = a.title;
      }

      if (gradesData.ok || gradesRes.ok) {
        const resolved = (gradesData.data || []).map((g: Omit<StudentGrade, 'sourceName'>) => ({
          ...g,
          sourceName: assignmentMap[g.sourceId] ?? g.sourceId,
        }));
        setGrades(resolved);
      } else {
        setError(gradesData.error || 'Failed to load grades');
      }

      if (statsRes.ok) setStats(statsData.data || null);
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }, [classId]);

  useEffect(() => {
    fetchGrades();
  }, [fetchGrades]);

  return { grades, stats, loading, error, refetch: fetchGrades };
}
