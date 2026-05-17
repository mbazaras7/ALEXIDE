import { useState, useEffect, useCallback } from 'react';

const getToken = () => localStorage.getItem('authToken');

export type AssignmentStatus = 'DRAFT' | 'PUBLISHED';

export interface TestCase {
  id: string;
  name: string;
  inputData: string;
  expectedOutput: string;
  orderIndex: number;
}

export interface Assignment {
  id: string;
  classId: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  maxScore: number;
  language: string;
  status: AssignmentStatus;
  createdAt: string;
  updatedAt: string;
  testCases?: TestCase[];
}

export interface CreateAssignmentData {
  title: string;
  description?: string;
  dueDate?: string;
  maxScore: number;
  language: string;
  status: AssignmentStatus;
}

export interface CreateTestCaseData {
  name: string;
  inputData: string;
  expectedOutput: string;
  orderIndex: number;
}

export function useTeacherAssignments(classId: string) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAssignments = useCallback(async () => {
    const headers = { Authorization: `Bearer ${getToken()}` };
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/backend/teacher/assignments/class/${classId}`, { headers });
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

  const createAssignment = async (payload: CreateAssignmentData): Promise<Assignment> => {
    const res = await fetch(`/api/backend/teacher/assignments/class/${classId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (res.ok) {
      await fetchAssignments();
      return data.data;
    }
    throw new Error(data.error || 'Failed to create assignment');
  };

  const updateAssignment = async (
    assignmentId: string,
    payload: Partial<CreateAssignmentData>
  ): Promise<Assignment> => {
    const res = await fetch(`/api/backend/teacher/assignments/${assignmentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (res.ok) {
      await fetchAssignments();
      return data.data;
    }
    throw new Error(data.error || 'Failed to update assignment');
  };

  const deleteAssignment = async (assignmentId: string): Promise<void> => {
    const res = await fetch(`/api/backend/teacher/assignments/${assignmentId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (res.ok) {
      await fetchAssignments();
      return;
    }
    const data = await res.json();
    throw new Error(data.error || 'Failed to delete assignment');
  };

  return {
    assignments,
    loading,
    error,
    fetchAssignments,
    createAssignment,
    updateAssignment,
    deleteAssignment,
  };
}
