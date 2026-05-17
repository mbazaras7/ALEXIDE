import { useState, useEffect } from 'react';
import { useTeacherClasses } from './useTeacherClasses';

const getToken = () => localStorage.getItem('authToken');

export interface TeacherClassOverview {
  classId: string;
  className: string;
  memberCount: number;
  averagePercentage: number | null;
  totalGrades: number;
}

export function useTeacherDashboard() {
  const { classes, loading: classesLoading } = useTeacherClasses();
  const [overviews, setOverviews] = useState<TeacherClassOverview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (classesLoading || classes.length === 0) {
      if (!classesLoading) setLoading(false);
      return;
    }

    const fetchOverviews = async () => {
      try {
        setLoading(true);
        const results = await Promise.allSettled(
          classes.map((c) =>
            fetch(`/api/backend/teacher/grades/class/${c.id}/overview`, {
              headers: { Authorization: `Bearer ${getToken()}` },
            }).then((r) => r.json())
          )
        );
        const mapped: TeacherClassOverview[] = classes.map((c, i) => {
          const res = results[i];
          const data = res.status === 'fulfilled' ? res.value?.data : null;

          const students: { percentage: number; gradedCount: number }[] = Array.isArray(data)
            ? data
            : [];

          const totalGrades = students.reduce((sum, s) => sum + (s.gradedCount ?? 0), 0);
          const averagePercentage =
            students.length > 0
              ? students.reduce((sum, s) => sum + s.percentage, 0) / students.length
              : null;

          return {
            classId: c.id,
            className: c.name,
            memberCount: c.memberCount ?? c.members?.length ?? 0,
            averagePercentage,
            totalGrades,
          };
        });
        setOverviews(mapped);
      } catch {
        setError('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };

    fetchOverviews();
  }, [classes, classesLoading]);

  return { classes, overviews, loading, error };
}
