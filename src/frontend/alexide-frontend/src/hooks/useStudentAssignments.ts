import { useState, useEffect, useCallback } from 'react';

const getToken = () => localStorage.getItem('authToken');

export interface StudentAssignment {
  id: string;
  classId: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  maxScore: number;
  language: string;
  status: 'PUBLISHED';
  createdAt: string;
  updatedAt: string;
}

export interface Submission {
  id: string;
  assignmentId: string;
  studentId: string;
  code: string;
  status: 'PENDING' | 'GRADED' | 'FAILED';
  score: number | null;
  submittedAt: string;
}

const headers = () => ({ Authorization: `Bearer ${getToken()}` });
const jsonHeaders = () => ({ ...headers(), 'Content-Type': 'application/json' });

export function useStudentAssignments(classId: string) {
  const [assignments, setAssignments] = useState<StudentAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAssignments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/backend/student/assignments/class/${classId}`, {
        headers: headers(),
      });
      const data = await res.json();
      if (res.ok) setAssignments(data.data || []);
      else setError(data.error || 'Failed to load assignments');
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }, [classId]);

  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);

  const submitAssignment = async (assignmentId: string, code: string): Promise<Submission> => {
    const res = await fetch(`/api/backend/student/submit/assignments/${assignmentId}`, {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ code }),
    });
    const data = await res.json();
    if (res.ok) return data.data;
    throw new Error(data.error || 'Failed to submit assignment');
  };

  const getMySubmission = async (assignmentId: string): Promise<Submission | null> => {
    const res = await fetch(`/api/backend/student/submit/assignments/${assignmentId}`, {
      headers: headers(),
    });
    if (res.status === 404) return null;
    const data = await res.json();
    if (res.ok) return data.data;
    throw new Error(data.error || 'Failed to load submission');
  };

  return { assignments, loading, error, fetchAssignments, submitAssignment, getMySubmission };
}
