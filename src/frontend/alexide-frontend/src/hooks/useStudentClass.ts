import { useState, useEffect, useCallback } from 'react';

const getToken = () => localStorage.getItem('authToken');

export interface StudentClassDetails {
  id: string;
  name: string;
  description: string | null;
  joinCode: string;
  teacherId: string;
  teacher?: {
    id: string;
    name: string;
    email: string;
  };
  members?: {
    studentId: string;
    joinedAt: string;
    student: { id: string; name: string; email: string };
  }[];
  createdAt: string;
  updatedAt: string;
}

export function useStudentClass(classId: string) {
  const [classData, setClassData] = useState<StudentClassDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchClass = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const headers = { Authorization: `Bearer ${getToken()}` };

      const [classRes, studentsRes] = await Promise.all([
        fetch(`/api/backend/student/classes/${classId}`, { headers }),
        fetch(`/api/backend/student/classes/${classId}/students`, { headers }),
      ]);

      const classJson = await classRes.json();
      const studentsJson = await studentsRes.json();

      if (!classRes.ok) {
        setError(classJson.error || 'Failed to load class');
        return;
      }

      const rawStudents = studentsRes.ok ? (studentsJson.data?.students ?? []) : [];

      const members = rawStudents.map(
        (s: { id: string; name: string | null; email: string; joinedAt: string }) => ({
          studentId: s.id,
          joinedAt: s.joinedAt,
          student: {
            id: s.id,
            name: s.name ?? 'Unknown',
            email: s.email,
          },
        })
      );

      const merged: StudentClassDetails = {
        ...classJson.data,
        members,
      };

      setClassData(merged);
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }, [classId]);

  useEffect(() => {
    fetchClass();
  }, [fetchClass]);

  return { classData, loading, error, refetch: fetchClass };
}
