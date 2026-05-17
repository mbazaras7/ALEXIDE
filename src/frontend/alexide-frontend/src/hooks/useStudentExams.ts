import { useState, useEffect } from 'react';
import { StudentExamSummary } from '../components/StudentExamTab';

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('authToken');
  return { Authorization: `Bearer ${token ?? ''}` };
}

export function useStudentExams(classId: string) {
  const [exams, setExams] = useState<StudentExamSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetch() {
      try {
        setLoading(true);
        setError(null);
        const res = await window.fetch(`/api/backend/student/exams/class/${classId}`, {
          headers: authHeaders(),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'Failed to load exams');
        if (!cancelled) setExams(data.data ?? []);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load exams');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetch();
    return () => {
      cancelled = true;
    };
  }, [classId]);

  return { exams, loading, error };
}
