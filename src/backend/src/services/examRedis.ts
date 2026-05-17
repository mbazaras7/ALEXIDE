/* eslint-disable @typescript-eslint/no-explicit-any */
import { storeClient } from '../config/redis';
import { RedisExamState, RedisStudentSession } from '../types/examRedis';

const examStateKey = (examId: string) => `exam:${examId}:state`;
const studentSessionKey = (examId: string, studentId: string) =>
  `exam:${examId}:student:${studentId}`;
const examStudentsSetKey = (examId: string) => `exam:${examId}:students`;

export async function setActiveExam(data: RedisExamState, durationMinutes: number): Promise<void> {
  try {
    const ttl = durationMinutes * 60 + 300;
    await storeClient.set(examStateKey(data.examId), JSON.stringify(data), { EX: ttl });
    console.log(`Exam ${data.examId} written to Redis, TTL: ${ttl}s`);
  } catch (err: any) {
    console.warn(`setActiveExam failed (Redis unavailable?): ${err.message}`);
  }
}

export async function getActiveExam(examId: string): Promise<RedisExamState | null> {
  try {
    const raw = await storeClient.get(examStateKey(examId));
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as RedisExamState;
  } catch (err: any) {
    console.warn(`getActiveExam failed: ${err.message}`);
    return null;
  }
}

export async function removeActiveExam(examId: string): Promise<void> {
  try {
    await storeClient.del(examStateKey(examId));
    console.log(`Exam ${examId} removed from Redis`);
  } catch (err: any) {
    console.warn(`removeActiveExam failed: ${err.message}`);
  }
}

export async function isExamActive(examId: string): Promise<boolean> {
  try {
    const exists = await storeClient.exists(examStateKey(examId));
    return exists === 1;
  } catch (err: any) {
    console.warn(`isExamActive failed: ${err.message}`);
    return false;
  }
}

export async function setStudentSession(
  data: RedisStudentSession,
  durationMinutes: number
): Promise<void> {
  try {
    const ttl = durationMinutes * 60 + 300;
    const key = studentSessionKey(data.examId, data.studentId);
    await storeClient.set(key, JSON.stringify(data), { EX: ttl });
    await storeClient.sAdd(examStudentsSetKey(data.examId), data.studentId);
    console.log(`Student ${data.studentId} session written for exam ${data.examId}`);
  } catch (err: any) {
    console.warn(`setStudentSession failed: ${err.message}`);
  }
}

export async function getStudentSession(
  examId: string,
  studentId: string
): Promise<RedisStudentSession | null> {
  try {
    const raw = await storeClient.get(studentSessionKey(examId, studentId));
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as RedisStudentSession;
  } catch (err: any) {
    console.warn(`getStudentSession failed: ${err.message}`);
    return null;
  }
}

export async function getAllStudentSessions(examId: string): Promise<RedisStudentSession[]> {
  try {
    const studentIds = await storeClient.sMembers(examStudentsSetKey(examId));
    if (!studentIds.length) {
      return [];
    }

    const pipeline = storeClient.multi();
    for (const sid of studentIds) {
      pipeline.get(studentSessionKey(examId, sid));
    }
    const results = await pipeline.exec();

    return (results as unknown as (string | null)[])
      .filter((r): r is string => r !== null)
      .map((r) => JSON.parse(r) as RedisStudentSession);
  } catch (err: any) {
    console.warn(`getAllStudentSessions failed: ${err.message}`);
    return [];
  }
}

export async function incrementTabSwitch(examId: string, studentId: string): Promise<number> {
  try {
    const session = await getStudentSession(examId, studentId);
    if (!session) {
      return 0;
    }

    session.tabSwitches += 1;
    const ttl = await storeClient.ttl(studentSessionKey(examId, studentId));
    await storeClient.set(studentSessionKey(examId, studentId), JSON.stringify(session), {
      EX: ttl > 0 ? ttl : 300,
    });
    return session.tabSwitches;
  } catch (err: any) {
    console.warn(`incrementTabSwitch failed: ${err.message}`);
    return 0;
  }
}

export async function updateHeartbeat(examId: string, studentId: string): Promise<void> {
  try {
    const session = await getStudentSession(examId, studentId);
    if (!session) {
      return;
    }

    session.lastHeartbeat = new Date().toISOString();
    const ttl = await storeClient.ttl(studentSessionKey(examId, studentId));
    await storeClient.set(studentSessionKey(examId, studentId), JSON.stringify(session), {
      EX: ttl > 0 ? ttl : 300,
    });
  } catch (err: any) {
    console.warn(`updateHeartbeat failed: ${err.message}`);
  }
}

export async function markStudentSubmitted(examId: string, studentId: string): Promise<void> {
  try {
    const session = await getStudentSession(examId, studentId);
    if (!session) {
      return;
    }

    session.status = 'SUBMITTED';
    const ttl = await storeClient.ttl(studentSessionKey(examId, studentId));
    await storeClient.set(studentSessionKey(examId, studentId), JSON.stringify(session), {
      EX: ttl > 0 ? ttl : 300,
    });
    console.log(`Student ${studentId} marked submitted in Redis`);
  } catch (err: any) {
    console.warn(`markStudentSubmitted failed: ${err.message}`);
  }
}

export async function removeStudentSession(examId: string, studentId: string): Promise<void> {
  try {
    await storeClient.del(studentSessionKey(examId, studentId));
    await storeClient.sRem(examStudentsSetKey(examId), studentId);
  } catch (err: any) {
    console.warn(`removeStudentSession failed: ${err.message}`);
  }
}

export async function getTimeRemaining(examId: string): Promise<number | null> {
  try {
    const state = await getActiveExam(examId);
    if (!state) {
      return null;
    }
    const remaining = new Date(state.endTime).getTime() - Date.now();
    return Math.max(remaining, 0);
  } catch (err: any) {
    console.warn(`getTimeRemaining failed: ${err.message}`);
    return null;
  }
}
