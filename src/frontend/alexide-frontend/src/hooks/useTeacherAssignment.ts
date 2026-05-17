import { useState, useEffect, useCallback } from 'react';
import { Assignment, TestCase, CreateTestCaseData } from './useTeacherAssignments';

const getToken = () => localStorage.getItem('authToken');

export interface Submission {
  id: string;
  assignmentId: string;
  studentId: string;
  code: string;
  status: 'PENDING' | 'GRADED' | 'FAILED';
  score: number | null;
  maxScore: number;
  submittedAt: string;
  student?: { id: string; name: string; email: string };
  testResults?: {
    id: string;
    testCaseId: string;
    passed: boolean;
    output: string;
    testCase?: { name: string; expectedOutput: string };
  }[];
  aiFeedback: string | null;
  aiFeedbackGeneratedAt: string | null;
  feedback: string | null;
  feedbackUpdatedAt: string | null;
}

export function useTeacherAssignment(assignmentId: string) {
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAssignment = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [assignRes, subRes] = await Promise.all([
        fetch(`/api/backend/teacher/assignments/${assignmentId}`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        }),
        fetch(`/api/backend/teacher/submit/assignments/${assignmentId}`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        }),
      ]);
      const assignData = await assignRes.json();
      const subData = await subRes.json();
      if (assignRes.ok) setAssignment(assignData.data);
      else setError(assignData.error || 'Failed to load assignment');
      if (subRes.ok) setSubmissions(subData.data || []);
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }, [assignmentId]);

  useEffect(() => {
    fetchAssignment();
  }, [fetchAssignment]);

  const addTestCase = async (payload: CreateTestCaseData): Promise<TestCase> => {
    const res = await fetch(`/api/backend/teacher/assignments/${assignmentId}/test-cases`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (res.ok) {
      await fetchAssignment();
      return data.data;
    }
    throw new Error(data.error || 'Failed to add test case');
  };

  const deleteTestCase = async (testCaseId: string): Promise<void> => {
    const res = await fetch(`/api/backend/teacher/assignments/test-cases/${testCaseId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (res.ok) {
      await fetchAssignment();
      return;
    }
    const data = await res.json();
    throw new Error(data.error || 'Failed to delete test case');
  };

  const reGradeSubmission = async (submissionId: string): Promise<void> => {
    const res = await fetch(`/api/backend/teacher/submit/${submissionId}/regrade`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Failed to regrade');
    }

    await new Promise((resolve) => setTimeout(resolve, 1500));
    await fetchAssignment();
  };

  const publishAssignment = async (): Promise<void> => {
    const res = await fetch(`/api/backend/teacher/assignments/${assignmentId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getToken()}`,
      },
      body: JSON.stringify({ status: 'PUBLISHED' }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Failed to publish assignment');
    }
    await fetchAssignment();
  };

  return {
    assignment,
    submissions,
    loading,
    error,
    refetch: fetchAssignment,
    addTestCase,
    deleteTestCase,
    reGradeSubmission,
    publishAssignment,
  };
}
