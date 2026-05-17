import { useState, useEffect, useCallback } from 'react';

const getToken = () => localStorage.getItem('authToken');

export interface ClassStudent {
  id: string;
  studentId: string;
  name: string;
  email: string;
  joinedAt: string;
  student: {
    id: string;
    name: string;
    email: string;
  };
}

export interface Class {
  id: string;
  name: string;
  description: string;
  joinCode: string;
  teacherId: string;
  createdAt: string;
  updatedAt: string;
  memberCount?: number;
  members?: ClassStudent[];
}

export function useTeacherClasses() {
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchClasses = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/backend/teacher/classes', {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (res.ok) setClasses(data.data || []);
      else setError(data.error || 'Failed to load classes');
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClasses();
  }, [fetchClasses]);

  const createClass = async (name: string, description: string) => {
    const res = await fetch('/api/backend/teacher/classes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ name, description }),
    });
    const data = await res.json();
    if (res.ok) {
      await fetchClasses();
      return data.data;
    }
    throw new Error(data.error || 'Failed to create class');
  };

  const updateClass = async (classId: string, name: string, description: string) => {
    const res = await fetch(`/api/backend/teacher/classes/${classId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ name, description }),
    });
    const data = await res.json();
    if (res.ok) {
      await fetchClasses();
      return data.data;
    }
    throw new Error(data.error || 'Failed to update class');
  };

  const deleteClass = async (classId: string) => {
    const res = await fetch(`/api/backend/teacher/classes/${classId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (res.ok) {
      await fetchClasses();
      return;
    }
    const data = await res.json();
    throw new Error(data.error || 'Failed to delete class');
  };

  const regenerateCode = async (classId: string) => {
    const res = await fetch(`/api/backend/teacher/classes/${classId}/regenerate-code`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    const data = await res.json();
    if (res.ok) {
      await fetchClasses();
      return data.data.joinCode;
    }
    throw new Error(data.error || 'Failed to regenerate code');
  };

  const removeStudent = async (classId: string, studentId: string) => {
    const res = await fetch(`/api/backend/teacher/classes/${classId}/students/${studentId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (res.ok) {
      await fetchClasses();
      return;
    }
    const data = await res.json();
    throw new Error(data.error || 'Failed to remove student');
  };

  const getClassDetails = useCallback(async (classId: string): Promise<Class> => {
    const res = await fetch(`/api/backend/teacher/classes/${classId}`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    const data = await res.json();
    if (res.ok) return data.data;
    throw new Error(data.error || 'Failed to load class');
  }, []);

  return {
    classes,
    loading,
    error,
    fetchClasses,
    createClass,
    updateClass,
    deleteClass,
    regenerateCode,
    removeStudent,
    getClassDetails,
  };
}
