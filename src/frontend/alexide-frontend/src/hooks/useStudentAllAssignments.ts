import { useState, useEffect, useCallback } from 'react';

const getToken = () => localStorage.getItem('authToken');

export interface StudentAssignment {
  id: string;
  classId: string;
  className: string;
  title: string;
  description: string | null;
  language: string;
  maxScore: number;
  dueDate: string | null;
  status: string;
  submissionStatus: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
}

export function useStudentAllAssignments() {
  const [assignments, setAssignments] = useState<StudentAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAssignments = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/backend/student/assignments', {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (res.ok) setAssignments(data.data || []);
      else setError(data.error || 'Failed to load assignments');
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);

  return { assignments, loading, error };
}
