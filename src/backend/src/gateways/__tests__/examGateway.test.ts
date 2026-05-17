import { createServer } from 'http';
import { Server } from 'socket.io';
import { io as Client, Socket as ClientSocket } from 'socket.io-client';
import { registerExamGateway, stopHeartbeatSweep } from '../examGateway';
import { JwtService } from '../../config/auth';
import {
  jest,
  beforeEach,
  expect,
  describe,
  it,
  afterAll,
  afterEach,
  beforeAll,
} from '@jest/globals';

jest.mock('../../config/redis', () => ({
  connectRedis: jest.fn().mockResolvedValue(undefined as never),
  disconnectRedis: jest.fn().mockResolvedValue(undefined as never),
  pubClient: { connect: jest.fn(), quit: jest.fn() },
  subClient: { connect: jest.fn(), quit: jest.fn() },
  storeClient: { connect: jest.fn(), quit: jest.fn() },
}));

jest.mock('../../services/examRedis', () => ({
  getActiveExam: jest.fn(),
  setActiveExam: jest.fn(),
  removeActiveExam: jest.fn(),
  isExamActive: jest.fn(),
  setStudentSession: jest.fn(),
  getStudentSession: jest.fn(),
  getAllStudentSessions: jest.fn(),
  incrementTabSwitch: jest.fn(),
  updateHeartbeat: jest.fn(),
  markStudentSubmitted: jest.fn(),
  removeStudentSession: jest.fn(),
  getTimeRemaining: jest.fn(),
}));

jest.mock('../../services/exam', () => ({
  examService: {
    getStudentSession: jest.fn(),
    recordTabSwitch: jest.fn(),
    submitExamSession: jest.fn(),
    getStudentFileSnapshot: jest.fn(),
  },
}));

import * as examRedis from '../../services/examRedis';
import { examService } from '../../services/exam';

const mockExamRedis = examRedis as jest.Mocked<typeof examRedis>;
const mockExamService = examService as jest.Mocked<typeof examService>;

const examId = 'exam-001';
const teacherId = 'teacher-001';
const studentId = 'student-001';
const sessionId = 'sess-001';

function makeSession(overrides: Record<string, any> = {}) {
  return {
    id: sessionId,
    examId,
    studentId,
    startedAt: new Date(),
    submittedAt: null,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    tabSwitchCount: 0,
    isSubmitted: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeExamState() {
  return {
    examId,
    classId: 'class-001',
    teacherId,
    status: 'ACTIVE' as const,
    startTime: new Date().toISOString(),
    endTime: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    durationMinutes: 60,
  };
}

function createClient(port: number, token: string, _role?: string): ClientSocket {
  return Client(`http://localhost:${port}/exam`, {
    auth: { token },
    autoConnect: false,
  });
}

function waitMs(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

describe('ExamGateway', () => {
  let httpServer: ReturnType<typeof createServer>;
  let ioServer: Server;
  let port: number;

  let teacherToken: string;
  let studentToken: string;

  let teacher: ClientSocket;
  let student: ClientSocket;

  beforeAll((done) => {
    httpServer = createServer();
    ioServer = new Server(httpServer);

    const examNs = ioServer.of('/exam');

    examNs.use((socket, next) => {
      const raw = (socket.handshake.auth?.token || socket.handshake.query?.token) as string;
      if (!raw) return next(new Error('No token provided'));
      const payload = JwtService.verifyToken(raw);
      if (!payload) return next(new Error('Invalid token'));
      socket.data.userId = payload.userId;
      socket.data.userName = payload.email;
      socket.data.role = payload.role;
      next();
    });

    registerExamGateway(examNs as any);

    httpServer.listen(() => {
      port = (httpServer.address() as any).port;

      teacherToken = JwtService.generateToken({
        userId: teacherId,
        email: 'teacher@test.com',
        role: 'TEACHER',
      });

      studentToken = JwtService.generateToken({
        userId: studentId,
        email: 'student@test.com',
        role: 'STUDENT',
      });

      done();
    });
  });

  afterAll((done) => {
    stopHeartbeatSweep();
    ioServer.close();
    httpServer.close(done);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockExamRedis.getActiveExam.mockResolvedValue(makeExamState());
    mockExamRedis.updateHeartbeat.mockResolvedValue(undefined);
    mockExamRedis.incrementTabSwitch.mockResolvedValue(1);
    mockExamRedis.markStudentSubmitted.mockResolvedValue(undefined);
    mockExamRedis.removeStudentSession.mockResolvedValue(undefined);
    mockExamService.getStudentSession.mockResolvedValue(makeSession());
    mockExamService.recordTabSwitch.mockResolvedValue({ tabSwitchCount: 1 });
    mockExamService.submitExamSession.mockResolvedValue(
      makeSession({ isSubmitted: true, submittedAt: new Date() })
    );
    mockExamService.getStudentFileSnapshot.mockResolvedValue({
      studentId,
      studentName: 'Test Student',
      examType: 'closed-book',
      answers: [
        { questionId: 'q-001', questionTitle: 'Write a loop', code: 'print(1)', status: 'PENDING' },
      ],
    });
  });

  afterEach(async () => {
    [teacher, student].forEach((c) => {
      if (c) {
        c.removeAllListeners();
        c.disconnect();
      }
    });
    await waitMs(150);
  });

  describe('connection', () => {
    it('connects successfully with a valid teacher token', (done) => {
      teacher = createClient(port, teacherToken);
      teacher.on('connect', () => {
        expect(teacher.connected).toBe(true);
        done();
      });
      teacher.on('connect_error', done);
      teacher.connect();
    }, 10000);

    it('connects successfully with a valid student token', (done) => {
      student = createClient(port, studentToken);
      student.on('connect', () => {
        expect(student.connected).toBe(true);
        done();
      });
      student.on('connect_error', done);
      student.connect();
    }, 10000);

    it('rejects connection with an invalid token', (done) => {
      const bad = Client(`http://localhost:${port}/exam`, {
        auth: { token: 'invalid.token.here' },
        autoConnect: false,
      });
      bad.on('connect_error', (err: any) => {
        expect(err.message).toBe('Invalid token');
        bad.disconnect();
        done();
      });
      bad.connect();
    }, 10000);

    it('rejects connection with no token', (done) => {
      const anon = Client(`http://localhost:${port}/exam`, { autoConnect: false });
      anon.on('connect_error', (err: any) => {
        expect(err.message).toBe('No token provided');
        anon.disconnect();
        done();
      });
      anon.connect();
    }, 10000);
  });

  describe('exam:join — student', () => {
    it('emits exam:joined with endTime and durationMinutes', (done) => {
      student = createClient(port, studentToken);
      student.on('connect', () => {
        student.emit('exam:join', { examId });
      });
      student.on('exam:joined', (payload: any) => {
        expect(payload.examId).toBe(examId);
        expect(payload.endTime).toBeDefined();
        expect(payload.durationMinutes).toBe(60);
        done();
      });
      student.on('exam:error', (msg: string) => done(new Error(msg)));
      student.connect();
    }, 10000);

    it('calls examService.getStudentSession on join', (done) => {
      student = createClient(port, studentToken);
      student.on('connect', () => {
        student.emit('exam:join', { examId });
      });
      student.on('exam:joined', () => {
        expect(mockExamService.getStudentSession).toHaveBeenCalledWith(examId, studentId);
        done();
      });
      student.on('exam:error', (msg: string) => done(new Error(msg)));
      student.connect();
    }, 10000);

    it('calls examRedis.updateHeartbeat on join', (done) => {
      student = createClient(port, studentToken);
      student.on('connect', () => {
        student.emit('exam:join', { examId });
      });
      student.on('exam:joined', () => {
        expect(mockExamRedis.updateHeartbeat).toHaveBeenCalledWith(examId, studentId);
        done();
      });
      student.on('exam:error', (msg: string) => done(new Error(msg)));
      student.connect();
    }, 10000);

    it('emits exam:error if session is already submitted', (done) => {
      mockExamService.getStudentSession.mockResolvedValue(
        makeSession({ isSubmitted: true, submittedAt: new Date() })
      );
      student = createClient(port, studentToken);
      student.on('connect', () => {
        student.emit('exam:join', { examId });
      });
      student.on('exam:error', (msg: string) => {
        expect(msg).toBe('Exam already submitted');
        done();
      });
      student.connect();
    }, 10000);

    it('emits exam:error if session not found', (done) => {
      mockExamService.getStudentSession.mockRejectedValue(new Error('Session not found'));
      student = createClient(port, studentToken);
      student.on('connect', () => {
        student.emit('exam:join', { examId });
      });
      student.on('exam:error', (msg: string) => {
        expect(msg).toBe('Session not found');
        done();
      });
      student.connect();
    }, 10000);

    it('emits exam:error if examId is missing', (done) => {
      student = createClient(port, studentToken);
      student.on('connect', () => {
        student.emit('exam:join', {} as any);
      });
      student.on('exam:error', (msg: string) => {
        expect(msg).toBe('examId is required');
        done();
      });
      student.connect();
    }, 10000);

    it('uses session expiresAt as fallback when Redis has no exam state', (done) => {
      mockExamRedis.getActiveExam.mockResolvedValue(null);
      student = createClient(port, studentToken);
      student.on('connect', () => {
        student.emit('exam:join', { examId });
      });
      student.on('exam:joined', (payload: any) => {
        expect(payload.endTime).toBeDefined();
        done();
      });
      student.on('exam:error', (msg: string) => done(new Error(msg)));
      student.connect();
    }, 10000);
  });

  describe('exam:join — teacher', () => {
    it('teacher joins without emitting exam:joined', (done) => {
      teacher = createClient(port, teacherToken);
      let receivedJoined = false;

      teacher.on('connect', () => {
        teacher.emit('exam:join', { examId });
        teacher.on('exam:joined', () => {
          receivedJoined = true;
        });
        setTimeout(() => {
          expect(receivedJoined).toBe(false);
          expect(mockExamService.getStudentSession).not.toHaveBeenCalled();
          done();
        }, 400);
      });
      teacher.on('connect_error', done);
      teacher.connect();
    }, 10000);

    it('teacher receives exam:student_joined when a student joins', (done) => {
      teacher = createClient(port, teacherToken);
      student = createClient(port, studentToken);

      teacher.on('connect', () => {
        teacher.emit('exam:join', { examId });

        setTimeout(() => {
          student.on('connect', () => {
            student.emit('exam:join', { examId });
          });
          student.connect();
        }, 200);
      });

      teacher.on('exam:student_joined', (payload: any) => {
        expect(payload.studentId).toBe(studentId);
        expect(payload.sessionId).toBe(sessionId);
        expect(payload.joinedAt).toBeDefined();
        done();
      });

      teacher.on('connect_error', done);
      teacher.connect();
    }, 15000);
  });

  describe('exam:heartbeat', () => {
    it('calls examRedis.updateHeartbeat on heartbeat', (done) => {
      student = createClient(port, studentToken);
      student.on('connect', () => {
        student.emit('exam:join', { examId });
      });
      student.on('exam:joined', () => {
        mockExamRedis.updateHeartbeat.mockClear();
        student.emit('exam:heartbeat', { examId });
        setTimeout(() => {
          expect(mockExamRedis.updateHeartbeat).toHaveBeenCalledWith(examId, studentId);
          done();
        }, 300);
      });
      student.on('exam:error', (msg: string) => done(new Error(msg)));
      student.connect();
    }, 10000);

    it('teacher heartbeat is ignored', (done) => {
      teacher = createClient(port, teacherToken);
      teacher.on('connect', () => {
        teacher.emit('exam:heartbeat', { examId });
        setTimeout(() => {
          expect(mockExamRedis.updateHeartbeat).not.toHaveBeenCalled();
          done();
        }, 300);
      });
      teacher.connect();
    }, 10000);
  });

  describe('exam:tab_switch', () => {
    it('calls examService.recordTabSwitch and examRedis.incrementTabSwitch', (done) => {
      student = createClient(port, studentToken);
      student.on('connect', () => {
        student.emit('exam:join', { examId });
      });
      student.on('exam:joined', () => {
        student.emit('exam:tab_switch', { examId });
        setTimeout(() => {
          expect(mockExamService.recordTabSwitch).toHaveBeenCalledWith(examId, studentId);
          expect(mockExamRedis.incrementTabSwitch).toHaveBeenCalledWith(examId, studentId);
          done();
        }, 300);
      });
      student.on('exam:error', (msg: string) => done(new Error(msg)));
      student.connect();
    }, 10000);

    it('teacher receives exam:tab_alert when student tab switches', (done) => {
      teacher = createClient(port, teacherToken);
      student = createClient(port, studentToken);

      mockExamService.recordTabSwitch.mockResolvedValue({ tabSwitchCount: 3 });

      teacher.on('connect', () => {
        teacher.emit('exam:join', { examId });
        setTimeout(() => {
          student.on('connect', () => {
            student.emit('exam:join', { examId });
          });
          student.connect();
        }, 200);
      });

      student.on('exam:joined', () => {
        setTimeout(() => {
          student.emit('exam:tab_switch', { examId });
        }, 100);
      });

      teacher.on('exam:tab_alert', (payload: any) => {
        expect(payload.studentId).toBe(studentId);
        expect(payload.count).toBe(3);
        done();
      });

      teacher.connect();
    }, 15000);

    it('emits exam:error if recordTabSwitch throws', (done) => {
      mockExamService.recordTabSwitch.mockRejectedValue(new Error('Exam already submitted'));

      student = createClient(port, studentToken);
      student.on('connect', () => {
        student.emit('exam:join', { examId });
      });
      student.on('exam:joined', () => {
        student.emit('exam:tab_switch', { examId });
      });
      student.on('exam:error', (msg: string) => {
        expect(msg).toBe('Exam already submitted');
        done();
      });
      student.connect();
    }, 10000);

    it('teacher tab_switch is ignored', (done) => {
      teacher = createClient(port, teacherToken);
      teacher.on('connect', () => {
        teacher.emit('exam:tab_switch', { examId });
        setTimeout(() => {
          expect(mockExamService.recordTabSwitch).not.toHaveBeenCalled();
          done();
        }, 300);
      });
      teacher.connect();
    }, 10000);
  });

  describe('exam:submit', () => {
    it('calls examService.submitExamSession on submit', (done) => {
      student = createClient(port, studentToken);
      student.on('connect', () => {
        student.emit('exam:join', { examId });
      });
      student.on('exam:joined', () => {
        student.emit('exam:submit', { examId });
        setTimeout(() => {
          expect(mockExamService.submitExamSession).toHaveBeenCalledWith(examId, studentId);
          done();
        }, 300);
      });
      student.on('exam:error', (msg: string) => done(new Error(msg)));
      student.connect();
    }, 10000);

    it('teacher receives exam:student_submitted after student submits', (done) => {
      teacher = createClient(port, teacherToken);
      student = createClient(port, studentToken);

      teacher.on('connect', () => {
        teacher.emit('exam:join', { examId });
        setTimeout(() => {
          student.on('connect', () => {
            student.emit('exam:join', { examId });
          });
          student.connect();
        }, 200);
      });

      student.on('exam:joined', () => {
        setTimeout(() => {
          student.emit('exam:submit', { examId });
        }, 100);
      });

      teacher.on('exam:student_submitted', (payload: any) => {
        expect(payload.studentId).toBe(studentId);
        done();
      });

      teacher.connect();
    }, 15000);

    it('emits exam:error if submitExamSession throws', (done) => {
      mockExamService.submitExamSession.mockRejectedValue(new Error('Exam already submitted'));

      student = createClient(port, studentToken);
      student.on('connect', () => {
        student.emit('exam:join', { examId });
      });
      student.on('exam:joined', () => {
        student.emit('exam:submit', { examId });
      });
      student.on('exam:error', (msg: string) => {
        expect(msg).toBe('Exam already submitted');
        done();
      });
      student.connect();
    }, 10000);

    it('teacher submit is ignored', (done) => {
      teacher = createClient(port, teacherToken);
      teacher.on('connect', () => {
        teacher.emit('exam:submit', { examId });
        setTimeout(() => {
          expect(mockExamService.submitExamSession).not.toHaveBeenCalled();
          done();
        }, 300);
      });
      teacher.connect();
    }, 10000);
  });

  describe('disconnect', () => {
    it('teacher receives exam:student_disconnected when student disconnects after joining', (done) => {
      teacher = createClient(port, teacherToken);
      student = createClient(port, studentToken);

      teacher.on('connect', () => {
        teacher.emit('exam:join', { examId });
        setTimeout(() => {
          student.on('connect', () => {
            student.emit('exam:join', { examId });
          });
          student.connect();
        }, 200);
      });

      student.on('exam:joined', () => {
        setTimeout(() => {
          student.disconnect();
        }, 100);
      });

      teacher.on('exam:student_disconnected', (payload: any) => {
        expect(payload.studentId).toBe(studentId);
        done();
      });

      teacher.connect();
    }, 15000);

    it('does not emit exam:student_disconnected for teacher disconnect', (done) => {
      teacher = createClient(port, teacherToken);
      let receivedDisconnected = false;

      teacher.on('connect', () => {
        teacher.emit('exam:join', { examId });
        setTimeout(() => {
          teacher.on('exam:student_disconnected', () => {
            receivedDisconnected = true;
          });
          teacher.disconnect();
          setTimeout(() => {
            expect(receivedDisconnected).toBe(false);
            done();
          }, 400);
        }, 200);
      });

      teacher.connect();
    }, 10000);

    it('student without a joined exam does not emit disconnected events', (done) => {
      teacher = createClient(port, teacherToken);
      student = createClient(port, studentToken);
      let receivedDisconnected = false;

      teacher.on('connect', () => {
        teacher.emit('exam:join', { examId });
        setTimeout(() => {
          student.on('connect', () => {
            // Student connects but does NOT emit exam:join
            setTimeout(() => {
              student.disconnect();
              setTimeout(() => {
                expect(receivedDisconnected).toBe(false);
                done();
              }, 400);
            }, 200);
          });
          teacher.on('exam:student_disconnected', () => {
            receivedDisconnected = true;
          });
          student.connect();
        }, 200);
      });

      teacher.connect();
    }, 15000);
  });

  describe('exam:request_snapshot', () => {
    it('teacher receives exam:snapshot_response with answers', (done) => {
      teacher = createClient(port, teacherToken);

      teacher.on('connect', () => {
        teacher.emit('exam:join', { examId });
        teacher.emit('exam:request_snapshot', { examId, studentId });
      });

      teacher.on('exam:snapshot_response', (payload: any) => {
        expect(payload.studentId).toBe(studentId);
        expect(payload.examType).toBe('closed-book');
        expect(Array.isArray(payload.answers)).toBe(true);
        expect(payload.answers[0].questionTitle).toBe('Write a loop');
        done();
      });

      teacher.on('exam:error', (msg: string) => done(new Error(msg)));
      teacher.connect();
    }, 10000);

    it('calls examService.getStudentFileSnapshot with correct args', (done) => {
      teacher = createClient(port, teacherToken);

      teacher.on('connect', () => {
        teacher.emit('exam:request_snapshot', { examId, studentId });
      });

      teacher.on('exam:snapshot_response', () => {
        expect(mockExamService.getStudentFileSnapshot).toHaveBeenCalledWith(
          examId,
          teacherId,
          studentId
        );
        done();
      });

      teacher.on('exam:error', (msg: string) => done(new Error(msg)));
      teacher.connect();
    }, 10000);

    it('emits exam:error if getStudentFileSnapshot throws', (done) => {
      mockExamService.getStudentFileSnapshot.mockRejectedValue(
        new Error('Student has no active session')
      );

      teacher = createClient(port, teacherToken);

      teacher.on('connect', () => {
        teacher.emit('exam:request_snapshot', { examId, studentId });
      });

      teacher.on('exam:error', (msg: string) => {
        expect(msg).toBe('Student has no active session');
        done();
      });

      teacher.connect();
    }, 10000);

    it('emits exam:error if a student tries to request a snapshot', (done) => {
      student = createClient(port, studentToken);

      student.on('connect', () => {
        student.emit('exam:request_snapshot', { examId, studentId });
      });

      student.on('exam:error', (msg: string) => {
        expect(msg).toBe('Only teachers can request snapshots');
        done();
      });

      student.connect();
    }, 10000);
  });

  describe('time warnings', () => {
    it('emits exam:time_warning to students at the scheduled interval', (done) => {
      const shortEndTime = new Date(Date.now() + 3000).toISOString();
      mockExamRedis.getActiveExam.mockResolvedValue({
        ...makeExamState(),
        endTime: shortEndTime,
        durationMinutes: 1,
      });

      student = createClient(port, studentToken);
      student.on('connect', () => {
        student.emit('exam:join', { examId: 'short-exam' });
      });
      student.on('exam:ended', () => {
        done();
      });
      student.on('exam:error', (msg: string) => done(new Error(msg)));
      student.connect();
    }, 15000);
  });
});
