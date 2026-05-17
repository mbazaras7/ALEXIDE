import { useEffect, useRef, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { notifications } from '@mantine/notifications';
import { IconAlertTriangle } from '@tabler/icons-react';
import React from 'react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3000';

export interface MonitoredStudent {
  studentId: string;
  name: string;
  sessionId?: string;
  status: 'active' | 'disconnected' | 'submitted' | 'expired';
  tabSwitchCounter: number;
  joinedAt: string;
  submittedAt: string | null;
  isOnline: boolean;
}

export interface SnapshotAnswer {
  questionId: string;
  questionTitle: string;
  code: string;
  status: string;
}

export interface ExamSnapshot {
  studentId: string;
  studentName: string;
  examType: 'open-book' | 'closed-book';
  answers: SnapshotAnswer[];
}

export interface UseTeacherExamSocketOptions {
  examId: string;
  enabled: boolean;
  onExamEnded?: () => void;
  onStudentSubmitted?: () => void;
}

export function useTeacherExamSocket({
  examId,
  enabled,
  onExamEnded,
  onStudentSubmitted,
}: UseTeacherExamSocketOptions) {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [students, setStudents] = useState<MonitoredStudent[]>([]);
  const [alertStudentId, setAlertStudentId] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<ExamSnapshot | null>(null);
  const [snapshotLoading, setSnapshotLoading] = useState(false);

  const onExamEndedRef = useRef(onExamEnded);
  const onStudentSubmittedRef = useRef(onStudentSubmitted);
  useEffect(() => {
    onExamEndedRef.current = onExamEnded;
  }, [onExamEnded]);
  useEffect(() => {
    onStudentSubmittedRef.current = onStudentSubmitted;
  }, [onStudentSubmitted]);

  const requestSnapshot = useCallback(
    (studentId: string) => {
      if (!socketRef.current?.connected) return;
      setSnapshotLoading(true);
      socketRef.current.emit('exam:request_snapshot', { examId, studentId });
    },
    [examId]
  );

  const dismissSnapshot = useCallback(() => setSnapshot(null), []);

  useEffect(() => {
    if (!enabled || !examId) return;
    const token = localStorage.getItem('authToken');
    if (!token) return;

    const socket = io(`${BACKEND_URL}/exam`, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      socket.emit('exam:join', { examId });
    });

    socket.on('disconnect', () => setIsConnected(false));

    socket.on(
      'exam:student_joined',
      (payload: { studentId: string; sessionId: string; joinedAt: string; name: string }) => {
        setStudents((prev) => {
          const exists = prev.some((s) => s.studentId === payload.studentId);
          if (exists) {
            return prev.map((s) =>
              s.studentId === payload.studentId
                ? { ...s, isOnline: true, status: 'active' as const, joinedAt: payload.joinedAt }
                : s
            );
          }
          return [
            ...prev,
            {
              studentId: payload.studentId,
              name: payload.name ?? payload.studentId,
              sessionId: payload.sessionId,
              status: 'active' as const,
              tabSwitchCounter: 0,
              joinedAt: payload.joinedAt,
              submittedAt: null,
              isOnline: true,
            },
          ];
        });
      }
    );

    socket.on('exam:student_disconnected', ({ studentId }: { studentId: string }) => {
      setStudents((prev) =>
        prev.map((s) =>
          s.studentId === studentId ? { ...s, isOnline: false, status: 'disconnected' as const } : s
        )
      );
    });

    socket.on('exam:student_submitted', ({ studentId }: { studentId: string }) => {
      setStudents((prev) =>
        prev.map((s) =>
          s.studentId === studentId
            ? {
                ...s,
                status: 'submitted' as const,
                isOnline: false,
                submittedAt: new Date().toISOString(),
              }
            : s
        )
      );
      onStudentSubmittedRef.current?.();
    });

    socket.on('exam:tab_alert', ({ studentId, count }: { studentId: string; count: number }) => {
      setStudents((prev) =>
        prev.map((s) => (s.studentId === studentId ? { ...s, tabSwitchCounter: count } : s))
      );
      setAlertStudentId(studentId);
      notifications.show({
        id: `tab-alert-${studentId}-${count}`,
        title: 'Tab switch detected',
        message: `Student switched tabs (total: ${count})`,
        color: count > 3 ? 'red' : 'orange',
        icon: React.createElement(IconAlertTriangle, { size: 18 }),
        autoClose: 5000,
      });
      setTimeout(() => setAlertStudentId(null), 4000);
    });

    socket.on('exam:snapshot_response', (payload: ExamSnapshot) => {
      setSnapshot(payload);
      setSnapshotLoading(false);
    });

    socket.on('exam:ended', () => onExamEndedRef.current?.());
    socket.on('exam:error', () => setSnapshotLoading(false));

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setIsConnected(false);
      setSnapshotLoading(false);
    };
  }, [enabled, examId]);

  return {
    isConnected,
    students,
    alertStudentId,
    snapshot,
    snapshotLoading,
    requestSnapshot,
    dismissSnapshot,
  };
}
