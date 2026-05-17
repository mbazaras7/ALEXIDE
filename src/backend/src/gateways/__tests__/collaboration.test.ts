/* eslint-disable @typescript-eslint/no-require-imports */
import { createServer } from 'http';
import { Server } from 'socket.io';
import { io as Client, Socket as ClientSocket } from 'socket.io-client';
import { registerCollaborationGateway } from '../collaboration';
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
  saveDocState: jest.fn().mockResolvedValue(undefined as never),
  loadDocState: jest.fn().mockResolvedValue(null as never),
  deleteDocState: jest.fn().mockResolvedValue(undefined as never),
  docStateExists: jest.fn().mockResolvedValue(false as never),
  connectRedis: jest.fn().mockResolvedValue(undefined as never),
  disconnectRedis: jest.fn().mockResolvedValue(undefined as never),
  pubClient: { connect: jest.fn(), quit: jest.fn() },
  subClient: { connect: jest.fn(), quit: jest.fn() },
  storeClient: { connect: jest.fn(), quit: jest.fn() },
}));

jest.mock('../../repositories/file', () => ({
  fileRepository: {
    canUserAccessFile: jest.fn(),
    findById: jest.fn(),
  },
}));

jest.mock('../../services/file', () => ({
  fileService: {
    getFileContent: jest.fn(),
    updateFile: jest.fn(),
  },
}));

import { fileRepository } from '../../repositories/file';
import { fileService } from '../../services/file';
import { saveDocState, loadDocState } from '../../config/redis';

const mockFileRepository = fileRepository as jest.Mocked<typeof fileRepository>;
const mockFileService = fileService as jest.Mocked<typeof fileService>;
const mockSaveDocState = saveDocState as jest.MockedFunction<typeof saveDocState>;
const mockLoadDocState = loadDocState as jest.MockedFunction<typeof loadDocState>;

function createClient(port: number, token: string): ClientSocket {
  return Client(`http://localhost:${port}/collaboration`, {
    auth: { token },
    autoConnect: false,
  });
}

describe('CollaborationGateway', () => {
  let httpServer: ReturnType<typeof createServer>;
  let ioServer: Server;
  let port: number;
  let token: string;
  let token2: string;
  let client: ClientSocket;
  let client2: ClientSocket;

  const TEST_FILE_ID = 'file-abc-123';

  beforeAll((done) => {
    httpServer = createServer();
    ioServer = new Server(httpServer);

    const collabNs = ioServer.of('/collaboration');
    collabNs.use((socket, next) => {
      const raw = (socket.handshake.auth?.token || socket.handshake.query?.token) as string;
      if (!raw) return next(new Error('No token provided'));
      const payload = JwtService.verifyToken(raw);
      if (!payload) return next(new Error('Invalid token'));
      socket.data.userId = payload.userId;
      socket.data.userName = payload.email;
      next();
    });

    registerCollaborationGateway(collabNs as any);

    httpServer.listen(() => {
      port = (httpServer.address() as any).port;

      token = JwtService.generateToken({
        userId: 'user-001',
        email: 'alice@test.com',
        role: 'STUDENT',
      });

      token2 = JwtService.generateToken({
        userId: 'user-002',
        email: 'bob@test.com',
        role: 'STUDENT',
      });

      done();
    });
  });

  afterAll((done) => {
    ioServer.close();
    httpServer.close(done);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockFileRepository.canUserAccessFile.mockResolvedValue(true);
    mockLoadDocState.mockResolvedValue(null);
    mockFileRepository.findById.mockResolvedValue({
      id: TEST_FILE_ID,
      userId: 'user-001',
      name: 'main.py',
      path: '/main.py',
      parentId: null,
      isDirectory: false,
      mimeType: 'text/x-python',
      size: 0,
      storageKey: null,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockFileService.getFileContent.mockResolvedValue(Buffer.from(''));
    mockFileService.updateFile.mockResolvedValue({} as any);
    mockSaveDocState.mockResolvedValue(undefined);
  });

  afterEach(async () => {
    if (client) {
      client.removeAllListeners();
      client.disconnect();
    }
    if (client2) {
      client2.removeAllListeners();
      client2.disconnect();
    }
    await new Promise((r) => setTimeout(r, 150));
  });

  describe('connection', () => {
    it('connects successfully with a valid token', (done) => {
      client = createClient(port, token);
      client.on('connect', () => {
        expect(client.connected).toBe(true);
        done();
      });
      client.on('connect_error', done);
      client.connect();
    }, 10000);

    it('rejects connection with an invalid token', (done) => {
      client = Client(`http://localhost:${port}/collaboration`, {
        auth: { token: 'invalid.token.here' },
        autoConnect: false,
      });
      client.on('connect_error', (err: any) => {
        expect(err.message).toBe('Invalid token');
        done();
      });
      client.connect();
    }, 10000);

    it('rejects connection with no token', (done) => {
      client = Client(`http://localhost:${port}/collaboration`, { autoConnect: false });
      client.on('connect_error', (err: any) => {
        expect(err.message).toBe('No token provided');
        done();
      });
      client.connect();
    }, 10000);
  });

  describe('collaboration:join', () => {
    it('emits collaboration:synced after joining a valid file', (done) => {
      client = createClient(port, token);
      client.on('connect', () => {
        client.emit('collaboration:join', { fileId: TEST_FILE_ID });
      });
      client.on('collaboration:synced', (payload: any) => {
        expect(payload).toHaveProperty('update');
        expect(Array.isArray(payload.update)).toBe(true);
        done();
      });
      client.on('collaboration:error', (msg: string) => done(new Error(msg)));
      client.connect();
    }, 10000);

    it('emits collaboration:users after joining', (done) => {
      client = createClient(port, token);
      client.on('connect', () => {
        client.emit('collaboration:join', { fileId: TEST_FILE_ID });
      });
      client.on('collaboration:users', (users: any[]) => {
        expect(Array.isArray(users)).toBe(true);
        expect(users.length).toBeGreaterThan(0);
        expect(users[0]).toHaveProperty('userId');
        expect(users[0]).toHaveProperty('colour');
        done();
      });
      client.on('collaboration:error', (msg: string) => done(new Error(msg)));
      client.connect();
    }, 10000);

    it('emits collaboration:error when access is denied', (done) => {
      mockFileRepository.canUserAccessFile.mockResolvedValue(false);
      client = createClient(port, token);
      client.on('connect', () => {
        client.emit('collaboration:join', { fileId: TEST_FILE_ID });
      });
      client.on('collaboration:error', (msg: string) => {
        expect(msg).toContain('Access denied');
        done();
      });
      client.connect();
    }, 10000);

    it('emits collaboration:error when fileId is missing', (done) => {
      client = createClient(port, token);
      client.on('connect', () => {
        client.emit('collaboration:join', {});
      });
      client.on('collaboration:error', (msg: string) => {
        expect(msg).toContain('fileId is required');
        done();
      });
      client.connect();
    }, 10000);

    it('notifies existing users when a second user joins', (done) => {
      client = createClient(port, token);
      client2 = createClient(port, token2);

      client.on('connect', () => {
        client.emit('collaboration:join', { fileId: TEST_FILE_ID });
      });

      let synced = false;
      client.on('collaboration:synced', () => {
        synced = true;
        client2.on('connect', () => {
          client2.emit('collaboration:join', { fileId: TEST_FILE_ID });
        });
        client2.connect();
      });

      client.on('collaboration:users', (users: any[]) => {
        if (synced && users.length === 2) {
          expect(users.map((u: any) => u.userId)).toContain('user-001');
          expect(users.map((u: any) => u.userId)).toContain('user-002');
          done();
        }
      });

      client.on('collaboration:error', (msg: string) => done(new Error(msg)));
      client.connect();
    }, 15000);
  });

  describe('collaboration:join — exam mode', () => {
    let examToken: string;
    let openBookToken: string;

    beforeAll(() => {
      examToken = JwtService.generateToken({
        userId: 'user-exam-001',
        email: 'examstudent@test.com',
        role: 'STUDENT',
      });

      openBookToken = JwtService.generateToken({
        userId: 'user-open-001',
        email: 'openstudent@test.com',
        role: 'STUDENT',
      });
    });

    let examHttpServer: ReturnType<typeof createServer>;
    let examIoServer: Server;
    let examPort: number;
    let examClient: ClientSocket;

    beforeAll((done) => {
      examHttpServer = createServer();
      examIoServer = new Server(examHttpServer);

      const examCollabNs = examIoServer.of('/collaboration');

      examCollabNs.use((socket, next) => {
        const raw = (socket.handshake.auth?.token || socket.handshake.query?.token) as string;
        if (!raw) return next(new Error('No token provided'));
        const payload = JwtService.verifyToken(raw);
        if (!payload) return next(new Error('Invalid token'));
        socket.data.userId = payload.userId;
        socket.data.userName = payload.email;
        socket.data.role = payload.role;
        next();
      });

      examCollabNs.use((socket: any, next) => {
        if (socket.data.userId === 'user-exam-001') {
          socket.data.activeClosedBookExamId = 'exam-closed-001';
        } else {
          socket.data.activeClosedBookExamId = null;
        }
        next();
      });

      registerCollaborationGateway(examCollabNs as any);

      examHttpServer.listen(() => {
        examPort = (examHttpServer.address() as any).port;
        done();
      });
    });

    afterAll((done) => {
      examIoServer.close();
      examHttpServer.close(done);
    });

    afterEach(async () => {
      if (examClient) {
        examClient.removeAllListeners();
        examClient.disconnect();
      }
      await new Promise((r) => setTimeout(r, 150));
    });

    it('blocks collaboration:join for student in a closed-book exam', (done) => {
      examClient = Client(`http://localhost:${examPort}/collaboration`, {
        auth: { token: examToken },
        autoConnect: false,
      });

      examClient.on('connect', () => {
        examClient.emit('collaboration:join', { fileId: TEST_FILE_ID });
      });

      examClient.on('collaboration:error', (msg: string) => {
        expect(msg).toBe('File access is restricted during a closed-book exam');
        done();
      });

      examClient.on('collaboration:synced', () => {
        done(new Error('Should not have synced — student is in closed-book exam'));
      });

      examClient.connect();
    }, 10000);

    it('does not call canUserAccessFile when blocked by exam mode', (done) => {
      examClient = Client(`http://localhost:${examPort}/collaboration`, {
        auth: { token: examToken },
        autoConnect: false,
      });

      examClient.on('connect', () => {
        examClient.emit('collaboration:join', { fileId: TEST_FILE_ID });
      });

      examClient.on('collaboration:error', () => {
        expect(mockFileRepository.canUserAccessFile).not.toHaveBeenCalled();
        done();
      });

      examClient.connect();
    }, 10000);

    it('allows collaboration:join for student NOT in a closed-book exam', (done) => {
      examClient = Client(`http://localhost:${examPort}/collaboration`, {
        auth: { token: openBookToken },
        autoConnect: false,
      });

      examClient.on('connect', () => {
        examClient.emit('collaboration:join', { fileId: TEST_FILE_ID });
      });

      examClient.on('collaboration:synced', (payload: any) => {
        expect(payload).toHaveProperty('update');
        done();
      });

      examClient.on('collaboration:error', (msg: string) => {
        done(new Error(`Should not be blocked: ${msg}`));
      });

      examClient.connect();
    }, 10000);

    it('allows collaboration:join for student with null activeClosedBookExamId', (done) => {
      examClient = Client(`http://localhost:${examPort}/collaboration`, {
        auth: { token: openBookToken },
        autoConnect: false,
      });

      examClient.on('connect', () => {
        examClient.emit('collaboration:join', { fileId: TEST_FILE_ID });
      });

      examClient.on('collaboration:synced', () => {
        done();
      });

      examClient.on('collaboration:error', (msg: string) => {
        done(new Error(`Unexpected error: ${msg}`));
      });

      examClient.connect();
    }, 10000);
  });

  describe('collaboration:update', () => {
    it('broadcasts update to other users in the same room', (done) => {
      client = createClient(port, token);
      client2 = createClient(port, token2);

      const Y = require('yjs');
      const doc = new Y.Doc();
      const fakeUpdate = Array.from(Y.encodeStateAsUpdate(doc));

      client.on('connect', () => {
        client.emit('collaboration:join', { fileId: TEST_FILE_ID });
      });

      client.on('collaboration:synced', () => {
        client2.on('connect', () => {
          client2.emit('collaboration:join', { fileId: TEST_FILE_ID });
        });
        client2.connect();
      });

      client2.on('collaboration:synced', () => {
        client2.on('collaboration:update', (payload: any) => {
          expect(payload).toHaveProperty('update');
          done();
        });
        client.emit('collaboration:update', { update: fakeUpdate });
      });

      client.on('collaboration:error', (msg: string) => done(new Error(msg)));
      client2.on('collaboration:error', (msg: string) => done(new Error(msg)));
      client.connect();
    }, 15000);

    it('does not echo update back to the sender', (done) => {
      client = createClient(port, token);

      const Y = require('yjs');
      const doc = new Y.Doc();
      const fakeUpdate = Array.from(Y.encodeStateAsUpdate(doc));

      let receivedOwnUpdate = false;

      client.on('connect', () => {
        client.emit('collaboration:join', { fileId: TEST_FILE_ID });
      });

      client.on('collaboration:synced', () => {
        client.on('collaboration:update', () => {
          receivedOwnUpdate = true;
        });
        client.emit('collaboration:update', { update: fakeUpdate });

        setTimeout(() => {
          expect(receivedOwnUpdate).toBe(false);
          done();
        }, 400);
      });

      client.connect();
    }, 10000);

    it('emits collaboration:error for invalid update payload', (done) => {
      client = createClient(port, token);
      client.on('connect', () => {
        client.emit('collaboration:join', { fileId: TEST_FILE_ID });
      });
      client.on('collaboration:synced', () => {
        client.emit('collaboration:update', { update: [] });
      });
      client.on('collaboration:error', (msg: string) => {
        expect(msg).toContain('Invalid update');
        done();
      });
      client.connect();
    }, 10000);

    it('ignores update when not in a room', (done) => {
      client = createClient(port, token);
      client.on('connect', () => {
        client.emit('collaboration:update', { update: [1, 2, 3] });
        setTimeout(() => {
          expect(client.connected).toBe(true);
          done();
        }, 300);
      });
      client.connect();
    }, 10000);
  });

  describe('collaboration:awareness', () => {
    it('relays awareness update to other users in the room', (done) => {
      client = createClient(port, token);
      client2 = createClient(port, token2);

      const fakeAwareness = [10, 20, 30];

      client.on('connect', () => {
        client.emit('collaboration:join', { fileId: TEST_FILE_ID });
      });

      client.on('collaboration:synced', () => {
        client2.on('connect', () => {
          client2.emit('collaboration:join', { fileId: TEST_FILE_ID });
        });
        client2.connect();
      });

      client2.on('collaboration:synced', () => {
        client2.on('collaboration:awareness', (payload: any) => {
          expect(payload.update).toEqual(fakeAwareness);
          done();
        });
        client.emit('collaboration:awareness', { update: fakeAwareness });
      });

      client.on('collaboration:error', (msg: string) => done(new Error(msg)));
      client.connect();
    }, 15000);
  });

  describe('collaboration:leave', () => {
    it('removes user from room and notifies remaining users', (done) => {
      client = createClient(port, token);
      client2 = createClient(port, token2);

      client.on('connect', () => {
        client.emit('collaboration:join', { fileId: TEST_FILE_ID });
      });

      client.on('collaboration:synced', () => {
        client2.on('connect', () => {
          client2.emit('collaboration:join', { fileId: TEST_FILE_ID });
        });
        client2.connect();
      });

      client2.on('collaboration:synced', () => {
        client.on('collaboration:users', (users: any[]) => {
          if (users.length === 1) {
            expect(users[0].userId).toBe('user-001');
            done();
          }
        });
        client2.emit('collaboration:leave');
      });

      client.on('collaboration:error', (msg: string) => done(new Error(msg)));
      client.connect();
    }, 15000);

    it('saves doc state to Redis when last user leaves', (done) => {
      client = createClient(port, token);
      client.on('connect', () => {
        client.emit('collaboration:join', { fileId: TEST_FILE_ID });
      });
      client.on('collaboration:synced', () => {
        client.emit('collaboration:leave');
        setTimeout(() => {
          expect(mockSaveDocState).toHaveBeenCalledWith(TEST_FILE_ID, expect.any(Uint8Array));
          done();
        }, 3000);
      });
      client.on('collaboration:error', (msg: string) => done(new Error(msg)));
      client.connect();
    }, 15000);
  });

  describe('disconnect', () => {
    it('cleans up room on unexpected disconnect', (done) => {
      client = createClient(port, token);
      client.on('connect', () => {
        client.emit('collaboration:join', { fileId: TEST_FILE_ID });
      });
      client.on('collaboration:synced', () => {
        client.disconnect();
        setTimeout(() => {
          expect(mockSaveDocState).toHaveBeenCalled();
          done();
        }, 3000);
      });
      client.on('collaboration:error', (msg: string) => done(new Error(msg)));
      client.connect();
    }, 15000);
  });
});
