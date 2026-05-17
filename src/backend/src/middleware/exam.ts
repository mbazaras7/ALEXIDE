/* eslint-disable @typescript-eslint/no-explicit-any */
import { getStudentSession } from '../services/examRedis';
import { examRepository } from '../repositories/exam';

//Checks all active Redis student sessions for this student across any exam.  Returns the examId if the student is in a closed-book active exam, null otherwise.
export async function getActiveClosedBookExam(studentId: string): Promise<string | null> {
  const activeSessions = await examRepository.findActiveSessionsByStudent(studentId);

  for (const session of activeSessions) {
    const exam = await examRepository.findById(session.examId);
    if (!exam) continue;
    if (exam.status !== 'ACTIVE') continue;
    if (exam.isOpenBook) continue;

    const redisSession = await getStudentSession(session.examId, studentId);
    if (redisSession && redisSession.status === 'ACTIVE') {
      return session.examId;
    }
  }

  return null;
}

//Allows connection but attaches examMode context to socket.data. Blocking happens at the event level inside the gateway.
export function createExamModeMiddleware() {
  return async (socket: any, next: (err?: Error) => void) => {
    if (socket.data.role === 'TEACHER') return next();

    try {
      const blockedExamId = await getActiveClosedBookExam(socket.data.userId);
      socket.data.activeClosedBookExamId = blockedExamId ?? null;
    } catch (err: any) {
      console.warn(`Check failed for userId:${socket.data.userId}: ${err.message}`);
      socket.data.activeClosedBookExamId = null;
    }

    next();
  };
}
