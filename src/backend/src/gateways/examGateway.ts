/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Namespace, Socket } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents, SocketData } from '../types/examGateway';
import * as examRedis from '../services/examRedis';
import { examService } from '../services/exam';
import { classRepository } from '../repositories/class';

type ExamSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;

type ExamNamespace = Namespace<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;

const examRoom = (examId: string) => `exam:${examId}`;
const teacherRoom = (examId: string) => `exam:${examId}:teacher`;

const heartbeatMap = new Map<string, number>();
const HEARTBEAT_TIMEOUT_MS = 60_000 * 5;
const HEARTBEAT_SWEEP_MS = 20_000;

function heartbeatKey(examId: string, studentId: string) {
  return `${examId}:${studentId}`;
}

let sweepInterval: ReturnType<typeof setInterval> | null = null;

function startHeartbeatSweep(io: ExamNamespace): ReturnType<typeof setInterval> {
  if (sweepInterval) clearInterval(sweepInterval); // prevent duplicates
  sweepInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, lastSeen] of heartbeatMap.entries()) {
      if (now - lastSeen > HEARTBEAT_TIMEOUT_MS) {
        const [examId, studentId] = key.split(':');
        heartbeatMap.delete(key);
        console.log(`Heartbeat timeout: studentId:${studentId} examId:${examId}`);
        io.to(teacherRoom(examId)).emit('exam:student_disconnected', { studentId });
      }
    }
  }, HEARTBEAT_SWEEP_MS);
  return sweepInterval;
}

export function stopHeartbeatSweep(): void {
  if (sweepInterval) {
    clearInterval(sweepInterval);
    sweepInterval = null;
  }
}

const warningSentMap = new Map<string, Set<number>>();

function scheduleTimeWarnings(
  io: ExamNamespace,
  examId: string,
  endTime: string,
  durationMinutes: number
): void {
  if (!warningSentMap.has(examId)) {
    warningSentMap.set(examId, new Set());
  }

  const warningMinutes = [15, 10, 5, 1].filter((m) => m < durationMinutes);
  const endMs = new Date(endTime).getTime();

  for (const minutesLeft of warningMinutes) {
    const fireAt = endMs - minutesLeft * 60 * 1000;
    const delay = fireAt - Date.now();
    if (delay <= 0) continue;

    setTimeout(() => {
      const sent = warningSentMap.get(examId);
      if (sent?.has(minutesLeft)) return;
      sent?.add(minutesLeft);

      console.log(`Time warning: ${minutesLeft}min left for examId:${examId}`);
      io.to(examRoom(examId)).emit('exam:time_warning', { minutesLeft });
    }, delay);
  }

  const endDelay = endMs - Date.now();
  if (endDelay > 0) {
    setTimeout(async () => {
      console.log(`Exam ended: examId:${examId}`);
      io.to(examRoom(examId)).emit('exam:ended');
      warningSentMap.delete(examId);
      try {
        await examService.autoSubmitExam(examId);
      } catch (err: any) {
        console.error(`[ExamGateway] autoSubmitExam failed for examId:${examId}: ${err.message}`);
      }
    }, endDelay);
  }
}

export function registerExamGateway(io: ExamNamespace): void {
  startHeartbeatSweep(io);

  io.on('connection', (socket: ExamSocket) => {
    const { userId, role } = socket.data;
    console.log(`Connected userId:${userId} role:${role} socketId:${socket.id}`);

    socket.on('exam:join', async ({ examId }) => {
      if (!examId) {
        socket.emit('exam:error', 'examId is required');
        return;
      }

      try {
        if (role === 'TEACHER') {
          await socket.join(teacherRoom(examId));
          await socket.join(examRoom(examId));
          console.log(`Teacher ${userId} joined examId:${examId}`);
          return;
        }

        const session = await examService.getStudentSession(examId, userId);

        if (session.isSubmitted) {
          socket.emit('exam:error', 'Exam already submitted');
          return;
        }

        await socket.join(examRoom(examId));

        heartbeatMap.set(heartbeatKey(examId, userId), Date.now());

        await examRedis.updateHeartbeat(examId, userId);

        const examState = await examRedis.getActiveExam(examId);
        const endTime = examState?.endTime ?? session.expiresAt.toISOString();
        const durationMinutes = examState?.durationMinutes ?? 60;

        socket.emit('exam:joined', { examId, endTime, durationMinutes });

        const classStudents = examState
          ? await classRepository.findStudentsByClass(examState.classId)
          : null;
        const studentRecord = classStudents?.students?.find((s) => s.id === userId);
        const displayName =
          studentRecord?.name ?? studentRecord?.email ?? socket.data.userName ?? userId;

        socket.to(teacherRoom(examId)).emit('exam:student_joined', {
          studentId: userId,
          sessionId: session.id,
          joinedAt: new Date().toISOString(),
          name: displayName,
        });

        if (!warningSentMap.has(examId)) {
          scheduleTimeWarnings(io, examId, endTime, durationMinutes);
        }

        console.log(`Student ${userId} joined examId:${examId}`);
      } catch (err: any) {
        console.error(`exam:join error: ${err.message}`);
        socket.emit('exam:error', err.message);
      }
    });

    socket.on('exam:heartbeat', async ({ examId }) => {
      if (role !== 'STUDENT') return;

      heartbeatMap.set(heartbeatKey(examId, userId), Date.now());

      await examRedis.updateHeartbeat(examId, userId);
    });

    socket.on('exam:tab_switch', async ({ examId }) => {
      if (role !== 'STUDENT') return;

      try {
        const { tabSwitchCount } = await examService.recordTabSwitch(examId, userId);

        await examRedis.incrementTabSwitch(examId, userId);

        socket.to(teacherRoom(examId)).emit('exam:tab_alert', {
          studentId: userId,
          count: tabSwitchCount,
        });

        console.log(`Tab switch: studentId:${userId} examId:${examId} count:${tabSwitchCount}`);
      } catch (err: any) {
        console.error(`exam:tab_switch error: ${err.message}`);
        socket.emit('exam:error', err.message);
      }
    });

    socket.on('exam:submit', async ({ examId }) => {
      if (role !== 'STUDENT') return;

      try {
        await examService.submitExamSession(examId, userId);

        heartbeatMap.delete(heartbeatKey(examId, userId));

        socket.to(teacherRoom(examId)).emit('exam:student_submitted', {
          studentId: userId,
        });

        console.log(`Student ${userId} submitted examId:${examId}`);
      } catch (err: any) {
        console.error(`exam:submit error: ${err.message}`);
        socket.emit('exam:error', err.message);
      }
    });

    socket.on('disconnect', () => {
      console.log(`Disconnected userId:${userId} socketId:${socket.id}`);

      if (role !== 'STUDENT') return;

      for (const key of heartbeatMap.keys()) {
        if (key.endsWith(`:${userId}`)) {
          const examId = key.split(':')[0];
          heartbeatMap.delete(key);
          io.to(teacherRoom(examId)).emit('exam:student_disconnected', { studentId: userId });
          console.log(`Student ${userId} disconnected from examId:${examId}`);
        }
      }
    });

    socket.on('exam:request_snapshot', async ({ examId, studentId }) => {
      if (role !== 'TEACHER') {
        socket.emit('exam:error', 'Only teachers can request snapshots');
        return;
      }

      try {
        const snapshot = await examService.getStudentFileSnapshot(
          examId,
          socket.data.userId,
          studentId
        );

        socket.emit('exam:snapshot_response', {
          studentId,
          studentName: snapshot.studentName,
          examType: snapshot.examType,
          answers: snapshot.answers,
        });

        console.log(
          `Snapshot requested by teacher ${socket.data.userId} for student ${studentId} in exam ${examId}`
        );
      } catch (err: any) {
        console.error(`exam:request_snapshot error: ${err.message}`);
        socket.emit('exam:error', err.message);
      }
    });
  });
}
