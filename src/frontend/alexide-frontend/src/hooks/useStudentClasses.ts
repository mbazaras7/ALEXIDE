import { useState, useEffect, useCallback } from 'react';

const getToken = () => localStorage.getItem('authToken');

export interface EnrolledClass {
  id: string;
  name: string;
  description: string;
  teacherName: string;
  joinedAt: string;
  class: {
    id: string;
    name: string;
    description: string;
    teacherId: string;
    joinCode: string;
    createdAt: string;
    updatedAt: string;
  };
}

export function useStudentClasses() {
  const [classes, setClasses] = useState<EnrolledClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchClasses = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/backend/student/classes', {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (res.ok) setClasses(data.data || []);
      else setError(data.error || 'Failed to load classes');
    } catch {
      setError('Network Error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClasses();
  }, [fetchClasses]);

  const joinClass = async (joinCode: string) => {
    const res = await fetch('/api/backend/student/classes/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ joinCode }),
    });
    const data = await res.json();
    if (res.ok) {
      await fetchClasses();
      return data.data;
    }
    throw new Error(data.error || 'Failed to join class');
  };

  const leaveClass = async (classId: string) => {
    const res = await fetch(`/api/backend/student/classes/${classId}/leave`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (res.ok) {
      await fetchClasses();
      return;
    }
    const data = await res.json();
    throw new Error(data.error || 'Failed to leave class');
  };

  const getEnrolledClass = useCallback(async (classId: string) => {
    const res = await fetch(`/api/backend/student/classes/${classId}`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    const data = await res.json();
    if (res.ok) return data.data;
    throw new Error(data.error || 'Failed to load class');
  }, []);

  return { classes, loading, error, fetchClasses, joinClass, leaveClass, getEnrolledClass };
}
