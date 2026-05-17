import { useState, useEffect, useCallback } from 'react';
import { StudentAssignment } from './useStudentAssignments';

const getToken = () => localStorage.getItem('authToken');

export interface SubmissionResult {
  id: string;
  assignmentId: string;
  studentId: string;
  code: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  score: number | null;
  submittedAt: string;
  feedback: string | null;
  feedbackUpdatedAt: string | null;
  testResults?: {
    id: string;
    testCaseId: string;
    passed: boolean;
    output: string;
    testCase?: { name: string; expectedOutput: string };
  }[];
}

export function useStudentAssignment(assignmentId: string) {
  const [assignment, setAssignment] = useState<StudentAssignment | null>(null);
  const [submission, setSubmission] = useState<SubmissionResult | null>(null);
  const [gradeReleased, setGradeReleased] = useState(false);
  const [feedback, setFeedback] = useState<{
    feedback: string | null;
    feedbackUpdatedAt: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const headers = { Authorization: `Bearer ${getToken()}` };

      const [assignRes, subRes] = await Promise.all([
        fetch(`/api/backend/student/assignments/${assignmentId}`, { headers }),
        fetch(`/api/backend/student/submit/assignments/${assignmentId}`, { headers }),
      ]);

      const assignData = await assignRes.json();
      if (assignRes.ok) setAssignment(assignData.data);
      else setError(assignData.error || 'Failed to load assignment');

      if (subRes.ok) {
        const subData = await subRes.json();
        const sub = subData.data ?? null;
        setSubmission(subData.data ?? null);
        if (sub?.id) {
          const feedbackRes = await fetch(`/api/backend/student/submit/${sub.id}/feedback`, {
            headers,
          });
          if (feedbackRes.ok) {
            const feedbackData = await feedbackRes.json();
            const releasedData = feedbackData.data;
            const released =
              releasedData?.feedback !== null && releasedData?.feedback !== undefined;

            setGradeReleased(released);
            setFeedback({
              feedback: releasedData?.feedback ?? null,
              feedbackUpdatedAt: releasedData?.feedbackUpdatedAt ?? null,
            });
          } else {
            setFeedback(null);
            setGradeReleased(false);
          }
        }
      } else {
        setSubmission(null);
        setFeedback(null);
      }
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }, [assignmentId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const submitAssignment = async (code: string): Promise<SubmissionResult> => {
    const res = await fetch(`/api/backend/student/submit/assignments/${assignmentId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getToken()}`,
      },
      body: JSON.stringify({ code }),
    });
    const data = await res.json();
    if (res.ok) {
      await fetchData();
      return data.data;
    }
    throw new Error(data.error || 'Failed to submit assignment');
  };

  return {
    assignment,
    submission,
    feedback,
    gradeReleased,
    loading,
    error,
    refetch: fetchData,
    submitAssignment,
  };
}
