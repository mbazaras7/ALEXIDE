import { useEffect, useRef, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { notifications } from '@mantine/notifications';
import { IconClock, IconAlertTriangle } from '@tabler/icons-react';
import React from 'react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3000';

export interface ExamJoinedPayload {
  examId: string;
  endTime: string;
  durationMinutes: number;
}

export interface UseExamSocketOptions {
  examId: string;
  enabled: boolean;
  onEnded: () => void;
  onTimeWarning?: (minutesLeft: number) => void;
}

export function useExamSocket({ examId, enabled, onEnded, onTimeWarning }: UseExamSocketOptions) {
  const socketRef = useRef<Socket | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [joinedPayload, setJoinedPayload] = useState<ExamJoinedPayload | null>(null);

  const onEndedRef = useRef(onEnded);
  const onTimeWarningRef = useRef(onTimeWarning);
  useEffect(() => {
    onEndedRef.current = onEnded;
  }, [onEnded]);
  useEffect(() => {
    onTimeWarningRef.current = onTimeWarning;
  }, [onTimeWarning]);

  const emitTabSwitch = useCallback(() => {
    socketRef.current?.emit('exam:tab_switch', { examId });
  }, [examId]);

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

    socket.on('exam:joined', (payload: ExamJoinedPayload) => {
      setJoinedPayload(payload);
    });

    socket.on('exam:time_warning', ({ minutesLeft }: { minutesLeft: number }) => {
      onTimeWarningRef.current?.(minutesLeft);
      const isCritical = minutesLeft <= 1;
      notifications.show({
        id: `time-warning-${minutesLeft}`,
        title: isCritical
          ? 'Last minute!'
          : `${minutesLeft} minute${minutesLeft !== 1 ? 's' : ''} remaining`,
        message: isCritical
          ? 'Your exam will auto-submit in 60 seconds! Make sure to save your answers.'
          : 'Make sure to save your answers.',
        color: isCritical ? 'red' : minutesLeft <= 5 ? 'orange' : 'yellow',
        icon: React.createElement(isCritical ? IconAlertTriangle : IconClock, { size: 18 }),
        autoClose: 8000,
      });
    });

    socket.on('exam:ended', () => {
      notifications.show({
        title: 'Exam ended',
        message: 'Exam has ended. Your answers are being submitted.',
        color: 'red',
        autoClose: false,
      });
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      socket.disconnect();
      socketRef.current = null;
      setIsConnected(false);
      onEndedRef.current();
    });

    socket.on('exam:error', (msg: string) => {
      if (process.env.NODE_ENV === 'development') {
        // eslint-disable-next-line no-console
        console.warn('[exam socket error]', msg);
      }
    });

    heartbeatRef.current = setInterval(() => {
      if (socket.connected) socket.emit('exam:heartbeat', { examId });
    }, 30_000);

    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      socket.emit('exam:leave', { examId });
      socket.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    };
  }, [enabled, examId]);

  return { isConnected, joinedPayload, emitTabSwitch };
}
