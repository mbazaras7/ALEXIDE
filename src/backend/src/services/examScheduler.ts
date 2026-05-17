import db from '../db';
import { exams } from '../db/schema';
import { eq, and, lte, isNotNull } from 'drizzle-orm';
import * as examRedis from './examRedis';
import { examRepository } from '../repositories/exam';
import { examService } from './exam';
import type { Namespace } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '../types/examGateway';
import { SocketData } from '../types/terminal';

type ExamNamespace = Namespace<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;

const activeEndTimers = new Map<string, ReturnType<typeof setTimeout>>();

export function startExamScheduler(io: ExamNamespace): ReturnType<typeof setInterval> {
  checkAndActivateExams(io).catch(console.error);
  return setInterval(() => checkAndActivateExams(io).catch(console.error), 30_000);
}

async function checkAndActivateExams(io: ExamNamespace): Promise<void> {
  const due = await db
    .select()
    .from(exams)
    .where(
      and(
        eq(exams.status, 'SCHEDULED'),
        isNotNull(exams.scheduledStart),
        lte(exams.scheduledStart, new Date())
      )
    );

  for (const exam of due) {
    try {
      await activateExam(io, exam);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`Scheduler: failed to activate exam ${exam.id}: ${message}`);
    }
  }
}

async function activateExam(io: ExamNamespace, exam: typeof exams.$inferSelect): Promise<void> {
  if (await examRedis.isExamActive(exam.id)) return;

  await examRepository.update(exam.id, exam.teacherId, { status: 'ACTIVE' });

  const startAnchor = exam.scheduledStart ? new Date(exam.scheduledStart).getTime() : Date.now();
  const endTime = new Date(startAnchor + exam.durationMinutes * 60 * 1000).toISOString();

  await examRedis.setActiveExam(
    {
      examId: exam.id,
      classId: exam.classId,
      teacherId: exam.teacherId,
      status: 'ACTIVE',
      startTime: new Date().toISOString(),
      endTime,
      durationMinutes: exam.durationMinutes,
    },
    exam.durationMinutes
  );

  console.log(`Scheduler: exam ${exam.id} is now ACTIVE, ends at ${endTime}`);

  scheduleEndTimer(io, exam.id, exam.teacherId, exam.durationMinutes * 60 * 1000);
}

function scheduleEndTimer(
  io: ExamNamespace,
  examId: string,
  teacherId: string,
  delayMs: number
): void {
  if (activeEndTimers.has(examId)) clearTimeout(activeEndTimers.get(examId)!);

  const timer = setTimeout(async () => {
    activeEndTimers.delete(examId);
    try {
      await examRepository.update(examId, teacherId, { status: 'COMPLETED' });
      await examService.autoSubmitExam(examId);
      await examRedis.removeActiveExam(examId);
      io.to(`exam:${examId}:teacher`).emit('exam:ended');
      io.to(`exam:${examId}`).emit('exam:ended');
      console.log(`Scheduler: exam ${examId} ended`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`Scheduler failed to end exam ${examId}:`, message);
    }
  }, delayMs);

  activeEndTimers.set(examId, timer);
}

export async function rehydrateActiveExams(io: ExamNamespace): Promise<void> {
  const activeExams = await db.select().from(exams).where(eq(exams.status, 'ACTIVE'));

  for (const exam of activeExams) {
    const state = await examRedis.getActiveExam(exam.id);
    if (!state?.endTime) continue;

    const remainingMs = new Date(state.endTime).getTime() - Date.now();
    if (remainingMs <= 0) {
      await examService.autoSubmitExam(exam.id);
      await examRedis.removeActiveExam(exam.id);
      io.to(`exam:${exam.id}:teacher`).emit('exam:ended');
      io.to(`exam:${exam.id}`).emit('exam:ended');
    } else {
      scheduleEndTimer(io, exam.id, exam.teacherId, remainingMs);
      console.log(
        `Scheduler: rehydrated exam ${exam.id} (${Math.round(remainingMs / 60000)}m left)`
      );
    }
  }
}
