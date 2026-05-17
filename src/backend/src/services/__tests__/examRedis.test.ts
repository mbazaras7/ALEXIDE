import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Mock redis config before anything imports it
jest.mock('../../config/redis', () => ({
  storeClient: {
    set: jest.fn(),
    get: jest.fn(),
    del: jest.fn(),
    exists: jest.fn(),
    ttl: jest.fn(),
    sAdd: jest.fn(),
    sRem: jest.fn(),
    sMembers: jest.fn(),
    multi: jest.fn(),
  },
}));

import { storeClient } from '../../config/redis';
import {
  setActiveExam,
  getActiveExam,
  removeActiveExam,
  isExamActive,
  setStudentSession,
  getStudentSession,
  getAllStudentSessions,
  incrementTabSwitch,
  updateHeartbeat,
  markStudentSubmitted,
  removeStudentSession,
  getTimeRemaining,
} from '../examRedis';
import { RedisExamState, RedisStudentSession } from '../../types/examRedis';

const mockStore = storeClient as jest.Mocked<typeof storeClient>;

const examId = 'exam-001';
const studentId = 'student-456';

const makeExamState = (overrides: Partial<RedisExamState> = {}): RedisExamState => ({
  examId,
  classId: 'class-789',
  teacherId: 'teacher-123',
  status: 'ACTIVE',
  startTime: new Date().toISOString(),
  endTime: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  durationMinutes: 60,
  ...overrides,
});

const makeStudentSession = (overrides: Partial<RedisStudentSession> = {}): RedisStudentSession => ({
  studentId,
  examId,
  sessionId: 'sess-001',
  joinedAt: new Date().toISOString(),
  tabSwitches: 0,
  status: 'ACTIVE',
  lastHeartbeat: new Date().toISOString(),
  ...overrides,
});

describe('examRedisService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── setActiveExam ────────────────────────────────────────────────────────

  describe('setActiveExam', () => {
    it('should write exam state to Redis with correct TTL', async () => {
      mockStore.set.mockResolvedValue('OK');

      const state = makeExamState();
      await setActiveExam(state, 60);

      expect(mockStore.set).toHaveBeenCalledWith(
        `exam:${examId}:state`,
        JSON.stringify(state),
        { EX: 3900 } // 60 * 60 + 300
      );
    });

    it('should calculate TTL as durationMinutes * 60 + 300 grace', async () => {
      mockStore.set.mockResolvedValue('OK');

      await setActiveExam(makeExamState(), 90);

      const call = mockStore.set.mock.calls[0];
      expect((call[2] as any).EX).toBe(90 * 60 + 300);
    });

    it('should not throw if Redis fails', async () => {
      mockStore.set.mockRejectedValue(new Error('Redis down'));

      await expect(setActiveExam(makeExamState(), 60)).resolves.not.toThrow();
    });
  });

  // ─── getActiveExam ────────────────────────────────────────────────────────

  describe('getActiveExam', () => {
    it('should return parsed exam state when found', async () => {
      const state = makeExamState();
      mockStore.get.mockResolvedValue(JSON.stringify(state));

      const result = await getActiveExam(examId);

      expect(mockStore.get).toHaveBeenCalledWith(`exam:${examId}:state`);
      expect(result).toEqual(state);
    });

    it('should return null when key does not exist', async () => {
      mockStore.get.mockResolvedValue(null);

      const result = await getActiveExam(examId);
      expect(result).toBeNull();
    });

    it('should return null if Redis fails', async () => {
      mockStore.get.mockRejectedValue(new Error('Redis down'));

      const result = await getActiveExam(examId);
      expect(result).toBeNull();
    });
  });

  // ─── removeActiveExam ─────────────────────────────────────────────────────

  describe('removeActiveExam', () => {
    it('should delete the exam state key', async () => {
      mockStore.del.mockResolvedValue(1);

      await removeActiveExam(examId);

      expect(mockStore.del).toHaveBeenCalledWith(`exam:${examId}:state`);
    });

    it('should not throw if Redis fails', async () => {
      mockStore.del.mockRejectedValue(new Error('Redis down'));

      await expect(removeActiveExam(examId)).resolves.not.toThrow();
    });
  });

  // ─── isExamActive ─────────────────────────────────────────────────────────

  describe('isExamActive', () => {
    it('should return true when exam key exists', async () => {
      mockStore.exists.mockResolvedValue(1);

      const result = await isExamActive(examId);
      expect(result).toBe(true);
      expect(mockStore.exists).toHaveBeenCalledWith(`exam:${examId}:state`);
    });

    it('should return false when exam key does not exist', async () => {
      mockStore.exists.mockResolvedValue(0);

      const result = await isExamActive(examId);
      expect(result).toBe(false);
    });

    it('should return false if Redis fails', async () => {
      mockStore.exists.mockRejectedValue(new Error('Redis down'));

      const result = await isExamActive(examId);
      expect(result).toBe(false);
    });
  });

  // ─── setStudentSession ────────────────────────────────────────────────────

  describe('setStudentSession', () => {
    it('should write student session and add to students set', async () => {
      mockStore.set.mockResolvedValue('OK');
      mockStore.sAdd.mockResolvedValue(1);

      const session = makeStudentSession();
      await setStudentSession(session, 60);

      expect(mockStore.set).toHaveBeenCalledWith(
        `exam:${examId}:student:${studentId}`,
        JSON.stringify(session),
        { EX: 3900 }
      );
      expect(mockStore.sAdd).toHaveBeenCalledWith(`exam:${examId}:students`, studentId);
    });

    it('should not throw if Redis fails', async () => {
      mockStore.set.mockRejectedValue(new Error('Redis down'));

      await expect(setStudentSession(makeStudentSession(), 60)).resolves.not.toThrow();
    });
  });

  // ─── getStudentSession ────────────────────────────────────────────────────

  describe('getStudentSession', () => {
    it('should return parsed student session when found', async () => {
      const session = makeStudentSession();
      mockStore.get.mockResolvedValue(JSON.stringify(session));

      const result = await getStudentSession(examId, studentId);

      expect(mockStore.get).toHaveBeenCalledWith(`exam:${examId}:student:${studentId}`);
      expect(result).toEqual(session);
    });

    it('should return null when session does not exist', async () => {
      mockStore.get.mockResolvedValue(null);

      const result = await getStudentSession(examId, studentId);
      expect(result).toBeNull();
    });

    it('should return null if Redis fails', async () => {
      mockStore.get.mockRejectedValue(new Error('Redis down'));

      const result = await getStudentSession(examId, studentId);
      expect(result).toBeNull();
    });
  });

  // ─── getAllStudentSessions ────────────────────────────────────────────────

  describe('getAllStudentSessions', () => {
    it('should return all student sessions for an exam', async () => {
      const session1 = makeStudentSession({ studentId: 'student-1' });
      const session2 = makeStudentSession({ studentId: 'student-2' });

      mockStore.sMembers.mockResolvedValue(['student-1', 'student-2']);
      const mockPipeline = {
        get: jest.fn().mockReturnThis(),
        exec: jest
          .fn<() => Promise<any[]>>()
          .mockResolvedValue([JSON.stringify(session1), JSON.stringify(session2)]),
      };
      mockStore.multi.mockReturnValue(mockPipeline as any);

      const result = await getAllStudentSessions(examId);

      expect(mockStore.sMembers).toHaveBeenCalledWith(`exam:${examId}:students`);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(session1);
      expect(result[1]).toEqual(session2);
    });

    it('should return empty array when no students in set', async () => {
      mockStore.sMembers.mockResolvedValue([]);

      const result = await getAllStudentSessions(examId);
      expect(result).toHaveLength(0);
      expect(mockStore.multi).not.toHaveBeenCalled();
    });

    it('should filter out null pipeline results', async () => {
      const session = makeStudentSession();
      mockStore.sMembers.mockResolvedValue(['student-1', 'student-2']);
      const mockPipeline = {
        get: jest.fn().mockReturnThis(),
        exec: jest.fn<() => Promise<any[]>>().mockResolvedValue([JSON.stringify(session), null]),
      };
      mockStore.multi.mockReturnValue(mockPipeline as any);

      const result = await getAllStudentSessions(examId);
      expect(result).toHaveLength(1);
    });

    it('should return empty array if Redis fails', async () => {
      mockStore.sMembers.mockRejectedValue(new Error('Redis down'));

      const result = await getAllStudentSessions(examId);
      expect(result).toEqual([]);
    });
  });

  // ─── incrementTabSwitch ───────────────────────────────────────────────────

  describe('incrementTabSwitch', () => {
    it('should increment tab switch count and return new value', async () => {
      const session = makeStudentSession({ tabSwitches: 2 });
      mockStore.get.mockResolvedValue(JSON.stringify(session));
      mockStore.ttl.mockResolvedValue(3000);
      mockStore.set.mockResolvedValue('OK');

      const result = await incrementTabSwitch(examId, studentId);

      expect(result).toBe(3);
      const setCall = mockStore.set.mock.calls[0];
      const written = JSON.parse(setCall[1] as string) as RedisStudentSession;
      expect(written.tabSwitches).toBe(3);
    });

    it('should use 300s TTL if Redis TTL is negative', async () => {
      const session = makeStudentSession({ tabSwitches: 0 });
      mockStore.get.mockResolvedValue(JSON.stringify(session));
      mockStore.ttl.mockResolvedValue(-1);
      mockStore.set.mockResolvedValue('OK');

      await incrementTabSwitch(examId, studentId);

      const setCall = mockStore.set.mock.calls[0];
      expect((setCall[2] as any).EX).toBe(300);
    });

    it('should return 0 if session does not exist', async () => {
      mockStore.get.mockResolvedValue(null);

      const result = await incrementTabSwitch(examId, studentId);
      expect(result).toBe(0);
    });

    it('should return 0 if Redis fails', async () => {
      mockStore.get.mockRejectedValue(new Error('Redis down'));

      const result = await incrementTabSwitch(examId, studentId);
      expect(result).toBe(0);
    });
  });

  // ─── updateHeartbeat ──────────────────────────────────────────────────────

  describe('updateHeartbeat', () => {
    it('should update lastHeartbeat timestamp', async () => {
      const before = new Date().toISOString();
      const session = makeStudentSession({ lastHeartbeat: '2020-01-01T00:00:00.000Z' });
      mockStore.get.mockResolvedValue(JSON.stringify(session));
      mockStore.ttl.mockResolvedValue(3000);
      mockStore.set.mockResolvedValue('OK');

      await updateHeartbeat(examId, studentId);

      const setCall = mockStore.set.mock.calls[0];
      const written = JSON.parse(setCall[1] as string) as RedisStudentSession;
      expect(written.lastHeartbeat >= before).toBe(true);
    });

    it('should do nothing if session does not exist', async () => {
      mockStore.get.mockResolvedValue(null);

      await updateHeartbeat(examId, studentId);
      expect(mockStore.set).not.toHaveBeenCalled();
    });

    it('should not throw if Redis fails', async () => {
      mockStore.get.mockRejectedValue(new Error('Redis down'));

      await expect(updateHeartbeat(examId, studentId)).resolves.not.toThrow();
    });
  });

  // ─── markStudentSubmitted ─────────────────────────────────────────────────

  describe('markStudentSubmitted', () => {
    it('should set student session status to SUBMITTED', async () => {
      const session = makeStudentSession({ status: 'ACTIVE' });
      mockStore.get.mockResolvedValue(JSON.stringify(session));
      mockStore.ttl.mockResolvedValue(3000);
      mockStore.set.mockResolvedValue('OK');

      await markStudentSubmitted(examId, studentId);

      const setCall = mockStore.set.mock.calls[0];
      const written = JSON.parse(setCall[1] as string) as RedisStudentSession;
      expect(written.status).toBe('SUBMITTED');
    });

    it('should do nothing if session does not exist', async () => {
      mockStore.get.mockResolvedValue(null);

      await markStudentSubmitted(examId, studentId);
      expect(mockStore.set).not.toHaveBeenCalled();
    });

    it('should not throw if Redis fails', async () => {
      mockStore.get.mockRejectedValue(new Error('Redis down'));

      await expect(markStudentSubmitted(examId, studentId)).resolves.not.toThrow();
    });
  });

  // ─── removeStudentSession ─────────────────────────────────────────────────

  describe('removeStudentSession', () => {
    it('should delete student key and remove from students set', async () => {
      mockStore.del.mockResolvedValue(1);
      mockStore.sRem.mockResolvedValue(1);

      await removeStudentSession(examId, studentId);

      expect(mockStore.del).toHaveBeenCalledWith(`exam:${examId}:student:${studentId}`);
      expect(mockStore.sRem).toHaveBeenCalledWith(`exam:${examId}:students`, studentId);
    });

    it('should not throw if Redis fails', async () => {
      mockStore.del.mockRejectedValue(new Error('Redis down'));

      await expect(removeStudentSession(examId, studentId)).resolves.not.toThrow();
    });
  });

  // ─── getTimeRemaining ─────────────────────────────────────────────────────

  describe('getTimeRemaining', () => {
    it('should return milliseconds remaining until exam end', async () => {
      const endTime = new Date(Date.now() + 30 * 60 * 1000); // 30 min from now
      const state = makeExamState({ endTime: endTime.toISOString() });
      mockStore.get.mockResolvedValue(JSON.stringify(state));

      const result = await getTimeRemaining(examId);

      expect(result).toBeGreaterThan(29 * 60 * 1000);
      expect(result).toBeLessThanOrEqual(30 * 60 * 1000);
    });

    it('should return 0 if exam has already ended', async () => {
      const endTime = new Date(Date.now() - 1000); // 1 second ago
      const state = makeExamState({ endTime: endTime.toISOString() });
      mockStore.get.mockResolvedValue(JSON.stringify(state));

      const result = await getTimeRemaining(examId);
      expect(result).toBe(0);
    });

    it('should return null if exam not in Redis', async () => {
      mockStore.get.mockResolvedValue(null);

      const result = await getTimeRemaining(examId);
      expect(result).toBeNull();
    });

    it('should return null if Redis fails', async () => {
      mockStore.get.mockRejectedValue(new Error('Redis down'));

      const result = await getTimeRemaining(examId);
      expect(result).toBeNull();
    });
  });
});
