import { useState, useEffect } from 'react';
import { useStudentClasses } from './useStudentClasses';

const getToken = () => localStorage.getItem('authToken');

export interface DashboardGrade {
  id: string;
  score: number;
  maxScore: number;
  percentage: number;
  sourceType: 'ASSIGNMENT' | 'EXAM';
  releasedAt: string | null;
  createdAt: string;
  classId: string;
  className?: string;
}

interface RawClassSummary {
  classId?: string;
  id?: string;
  className?: string;
  name?: string;
  averagePercentage: number;
  totalGrades: number;
}

export interface ClassSummary {
  classId: string;
  className: string;
  averagePercentage: number;
  totalGrades: number;
}

export function useStudentDashboard() {
  const { classes, loading: classesLoading } = useStudentClasses();
  const [recentGrades, setRecentGrades] = useState<DashboardGrade[]>([]);
  const [classSummaries, setClassSummaries] = useState<ClassSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (classesLoading || classes.length === 0) {
      if (!classesLoading) setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        setLoading(true);
        const summaryRes = await fetch('/api/backend/student/grades/summary', {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        const summaryData = await summaryRes.json();
        setClassSummaries(
          (summaryData.data || []).map((s: RawClassSummary) => ({
            ...s,
            classId: s.classId ?? s.id,
            className:
              s.className ??
              s.name ??
              classes.find((c) => c.class.id === (s.classId ?? s.id))?.class.name ??
              'Unknown',
          }))
        );

        const allGradesRes = await fetch('/api/backend/student/grades', {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        const allGradesData = await allGradesRes.json();
        if (allGradesRes.ok) {
          const sorted = (allGradesData.data || [])
            .sort(
              (a: DashboardGrade, b: DashboardGrade) =>
                new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            )
            .slice(0, 5)
            .map((g: DashboardGrade) => ({
              ...g,
              className: classes.find((c) => c.class?.id === g.classId)?.class?.name ?? 'Unknown',
            }));
          setRecentGrades(sorted);
        }
      } catch {
        setError('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [classes, classesLoading]);

  return { classes, recentGrades, classSummaries, loading, error };
}
