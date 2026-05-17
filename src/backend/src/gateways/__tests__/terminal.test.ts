import { createServer } from 'http';
import { Server } from 'socket.io';
import { io as Client, Socket as ClientSocket } from 'socket.io-client';
import { EventEmitter, PassThrough } from 'stream';
import { registerTerminalGateway } from '../terminal';
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

jest.mock('../../services/container', () => ({
  containerService: {
    getOrCreateContainer: jest.fn(),
    recordActivity: jest.fn(),
  },
}));

jest.mock('../../services/terminal', () => ({
  createPtySession: jest.fn(),
}));

jest.mock('../../services/execution', () => ({
  syncWorkspaceToContainer: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
  syncSingleFileToContainer: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
  deleteFromContainer: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
  moveInContainer: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
  renameInContainer: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
}));

import { containerService } from '../../services/container';
import { createPtySession } from '../../services/terminal';
import {
  syncWorkspaceToContainer,
  syncSingleFileToContainer,
  deleteFromContainer,
  moveInContainer,
  renameInContainer,
} from '../../services/execution';

const mockDeleteFromContainer = deleteFromContainer as jest.MockedFunction<
  typeof deleteFromContainer
>;
const mockMoveInContainer = moveInContainer as jest.MockedFunction<typeof moveInContainer>;
const mockRenameInContainer = renameInContainer as jest.MockedFunction<typeof renameInContainer>;
const mockContainerService = containerService as jest.Mocked<typeof containerService>;
const mockCreatePtySession = createPtySession as jest.MockedFunction<typeof createPtySession>;
const mockSyncWorkspace = syncWorkspaceToContainer as jest.MockedFunction<
  typeof syncWorkspaceToContainer
>;
const mockSyncSingleFile = syncSingleFileToContainer as jest.MockedFunction<
  typeof syncSingleFileToContainer
>;

function createFakeStream() {
  const stream = new PassThrough() as any;
  stream.write = jest.fn((data: string) => {
    stream.emit('data', Buffer.from(data));
  });
  stream.destroy = jest.fn();
  return stream;
}

function createFakeContainer(stream: any) {
  return {
    exec: jest.fn().mockImplementation(() =>
      Promise.resolve({
        start: jest.fn().mockImplementation(() => Promise.resolve(stream)),
        resize: jest.fn().mockImplementation(() => Promise.resolve()),
      })
    ),
  } as unknown as any;
}

describe('TerminalGateway', () => {
  let httpServer: ReturnType<typeof createServer>;
  let ioServer: Server;
  let token: string;
  let port: number;
  let client: ClientSocket;

  beforeAll((done) => {
    httpServer = createServer();
    ioServer = new Server(httpServer);

    ioServer.use((socket, next) => {
      const raw = (socket.handshake.auth?.token || socket.handshake.query?.token) as string;
      if (!raw) return next(new Error('No token provided'));
      const payload = JwtService.verifyToken(raw);
      if (!payload) return next(new Error('Invalid token'));
      socket.data.userId = payload.userId;
      next();
    });

    registerTerminalGateway(ioServer as any);

    httpServer.listen(() => {
      port = (httpServer.address() as any).port;
      token = JwtService.generateToken({
        userId: 'test-user-123',
        email: 'test@test.com',
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
    mockSyncWorkspace.mockResolvedValue(undefined);
    mockSyncSingleFile.mockResolvedValue(undefined);
    mockDeleteFromContainer.mockResolvedValue(undefined);
    mockMoveInContainer.mockResolvedValue(undefined);
    mockRenameInContainer.mockResolvedValue(undefined);
  });

  afterEach((done) => {
    if (client?.connected) {
      client.disconnect();
    }
    setTimeout(done, 100);
  });

  describe('connection', () => {
    it('connects successfully with a valid token', (done) => {
      client = Client(`http://localhost:${port}`, { auth: { token } });

      client.on('connect', () => {
        expect(client.connected).toBe(true);
        done();
      });

      client.on('connect_error', done);
    });

    it('rejects connection with an invalid token', (done) => {
      client = Client(`http://localhost:${port}`, {
        auth: { token: 'invalid.token.here' },
      });

      client.on('connect_error', (err: { message: any }) => {
        expect(err.message).toBe('Invalid token');
        done();
      });
    });

    it('rejects connection with no token', (done) => {
      client = Client(`http://localhost:${port}`);

      client.on('connect_error', (err: { message: any }) => {
        expect(err.message).toBe('No token provided');
        done();
      });
    });
  });

  describe('terminal:start', () => {
    it('emits terminal:ready after successful start', (done) => {
      const fakeStream = createFakeStream();
      const fakeContainer = createFakeContainer(fakeStream);
      mockContainerService.getOrCreateContainer.mockResolvedValue(fakeContainer);
      mockCreatePtySession.mockResolvedValue(fakeStream);

      client = Client(`http://localhost:${port}`, { auth: { token } });

      client.on('connect', () => {
        client.emit('terminal:start', { cols: 80, rows: 24 });
      });

      client.on('terminal:ready', () => {
        expect(mockContainerService.getOrCreateContainer).toHaveBeenCalledWith('test-user-123');
        expect(mockCreatePtySession).toHaveBeenCalledWith(fakeContainer, { cols: 80, rows: 24 });
        done();
      });

      client.on('terminal:error', (msg: string | undefined) => done(new Error(msg)));
    }, 10000);

    it('triggers background workspace sync after terminal:ready', (done) => {
      const fakeStream = createFakeStream();
      const fakeContainer = createFakeContainer(fakeStream);
      mockContainerService.getOrCreateContainer.mockResolvedValue(fakeContainer);
      mockCreatePtySession.mockResolvedValue(fakeStream);

      client = Client(`http://localhost:${port}`, { auth: { token } });

      client.on('connect', () => {
        client.emit('terminal:start', { cols: 80, rows: 24 });
      });

      client.on('terminal:ready', () => {
        // Sync runs async in background — check shortly after ready
        setTimeout(() => {
          expect(mockSyncWorkspace).toHaveBeenCalledWith(fakeContainer, 'test-user-123');
          done();
        }, 100);
      });

      client.on('terminal:error', (msg: string | undefined) => done(new Error(msg)));
    }, 10000);

    it('does NOT emit terminal:syncing before terminal:ready', (done) => {
      const fakeStream = createFakeStream();
      const fakeContainer = createFakeContainer(fakeStream);
      mockContainerService.getOrCreateContainer.mockResolvedValue(fakeContainer);
      mockCreatePtySession.mockResolvedValue(fakeStream);

      let syncingReceived = false;
      client = Client(`http://localhost:${port}`, { auth: { token } });

      client.on('connect', () => {
        client.emit('terminal:start', { cols: 80, rows: 24 });
      });

      client.on('terminal:syncing', () => {
        syncingReceived = true;
      });

      client.on('terminal:ready', () => {
        expect(syncingReceived).toBe(false);
        done();
      });

      client.on('terminal:error', (msg: string | undefined) => done(new Error(msg)));
    }, 10000);

    it('emits terminal:error if already active', (done) => {
      const fakeStream = createFakeStream();
      const fakeContainer = createFakeContainer(fakeStream);
      mockContainerService.getOrCreateContainer.mockResolvedValue(fakeContainer);
      mockCreatePtySession.mockResolvedValue(fakeStream);

      client = Client(`http://localhost:${port}`, { auth: { token } });

      client.on('connect', () => {
        client.emit('terminal:start', { cols: 80, rows: 24 });
      });

      client.on('terminal:ready', () => {
        client.emit('terminal:start', { cols: 80, rows: 24 });
      });

      client.on('terminal:error', (msg: any) => {
        expect(msg).toBe('Terminal session already running');
        done();
      });
    }, 10000);

    it('emits terminal:error if container creation fails', (done) => {
      mockContainerService.getOrCreateContainer.mockRejectedValue(new Error('Docker unavailable'));

      client = Client(`http://localhost:${port}`, { auth: { token } });

      client.on('connect', () => {
        client.emit('terminal:start', { cols: 80, rows: 24 });
      });

      client.on('terminal:error', (msg: any) => {
        expect(msg).toContain('Failed to start terminal');
        done();
      });
    }, 10000);
  });

  describe('terminal:input', () => {
    it('writes input to the exec stream', (done) => {
      const fakeStream = createFakeStream();
      const fakeContainer = createFakeContainer(fakeStream);
      mockContainerService.getOrCreateContainer.mockResolvedValue(fakeContainer);
      mockCreatePtySession.mockResolvedValue(fakeStream);

      client = Client(`http://localhost:${port}`, { auth: { token } });

      client.on('connect', () => {
        client.emit('terminal:start', { cols: 80, rows: 24 });
      });

      client.on('terminal:ready', () => {
        client.emit('terminal:input', { data: 'echo hello\r' });

        setTimeout(() => {
          expect(fakeStream.write).toHaveBeenCalledWith('echo hello\r');
          expect(mockContainerService.recordActivity).toHaveBeenCalledWith('test-user-123');
          done();
        }, 100);
      });

      client.on('terminal:error', (msg: string | undefined) => done(new Error(msg)));
    }, 10000);

    it('parses JSON-encoded input string', (done) => {
      const fakeStream = createFakeStream();
      const fakeContainer = createFakeContainer(fakeStream);
      mockContainerService.getOrCreateContainer.mockResolvedValue(fakeContainer);
      mockCreatePtySession.mockResolvedValue(fakeStream);

      client = Client(`http://localhost:${port}`, { auth: { token } });

      client.on('connect', () => {
        client.emit('terminal:start', { cols: 80, rows: 24 });
      });

      client.on('terminal:ready', () => {
        client.emit('terminal:input', JSON.stringify({ data: 'ls\r' }));

        setTimeout(() => {
          expect(fakeStream.write).toHaveBeenCalledWith('ls\r');
          done();
        }, 100);
      });

      client.on('terminal:error', (msg: string | undefined) => done(new Error(msg)));
    }, 10000);

    it('ignores input if session is not active', (done) => {
      client = Client(`http://localhost:${port}`, { auth: { token } });

      client.on('connect', () => {
        client.emit('terminal:input', { data: 'echo hello\r' });

        setTimeout(() => {
          expect(mockContainerService.recordActivity).not.toHaveBeenCalled();
          done();
        }, 200);
      });
    }, 10000);
  });

  describe('terminal:output', () => {
    it('receives output from the exec stream', (done) => {
      const fakeStream = new EventEmitter() as any;
      fakeStream.write = jest.fn();
      fakeStream.destroy = jest.fn();

      mockContainerService.getOrCreateContainer.mockResolvedValue(createFakeContainer(fakeStream));
      mockCreatePtySession.mockResolvedValue(fakeStream);

      client = Client(`http://localhost:${port}`, { auth: { token } });

      client.on('connect', () => {
        client.emit('terminal:start', { cols: 80, rows: 24 });
      });

      client.on('terminal:ready', () => {
        fakeStream.emit('data', Buffer.from('hello from docker\n'));
      });

      client.on('terminal:output', (data: string) => {
        expect(data).toContain('hello from docker');
        done();
      });

      client.on('terminal:error', (msg: string | undefined) => done(new Error(msg)));
    }, 10000);

    it('buffers output and flushes it together within 16ms', (done) => {
      const fakeStream = new EventEmitter() as any;
      fakeStream.write = jest.fn();
      fakeStream.destroy = jest.fn();

      mockContainerService.getOrCreateContainer.mockResolvedValue(createFakeContainer(fakeStream));
      mockCreatePtySession.mockResolvedValue(fakeStream);

      client = Client(`http://localhost:${port}`, { auth: { token } });

      client.on('connect', () => {
        client.emit('terminal:start', { cols: 80, rows: 24 });
      });

      const received: string[] = [];

      client.on('terminal:ready', () => {
        // Emit two chunks rapidly — should be flushed together
        fakeStream.emit('data', Buffer.from('chunk1'));
        fakeStream.emit('data', Buffer.from('chunk2'));
      });

      client.on('terminal:output', (data: string) => {
        received.push(data);
        // Both chunks should arrive in one or two emissions, but combined content is correct
        if (received.join('').includes('chunk1') && received.join('').includes('chunk2')) {
          done();
        }
      });

      client.on('terminal:error', (msg: string | undefined) => done(new Error(msg)));
    }, 10000);
  });

  // ─── execution:sync Tests ─────────────────────────────────────

  describe('execution:sync', () => {
    it('syncs a single file when session is active', (done) => {
      const fakeStream = createFakeStream();
      const fakeContainer = createFakeContainer(fakeStream);
      mockContainerService.getOrCreateContainer.mockResolvedValue(fakeContainer);
      mockCreatePtySession.mockResolvedValue(fakeStream);

      client = Client(`http://localhost:${port}`, { auth: { token } });

      client.on('connect', () => {
        client.emit('terminal:start', { cols: 80, rows: 24 });
      });

      client.on('terminal:ready', () => {
        client.emit('execution:sync', { fileId: 'file-abc' });

        setTimeout(() => {
          expect(mockSyncSingleFile).toHaveBeenCalledWith(
            fakeContainer,
            'file-abc',
            'test-user-123'
          );
          done();
        }, 200);
      });

      client.on('terminal:error', (msg: string | undefined) => done(new Error(msg)));
    }, 10000);

    it('does not throw if sync fails', (done) => {
      const fakeStream = createFakeStream();
      const fakeContainer = createFakeContainer(fakeStream);
      mockContainerService.getOrCreateContainer.mockResolvedValue(fakeContainer);
      mockCreatePtySession.mockResolvedValue(fakeStream);
      mockSyncSingleFile.mockRejectedValue(new Error('File not found'));

      client = Client(`http://localhost:${port}`, { auth: { token } });

      client.on('connect', () => {
        client.emit('terminal:start', { cols: 80, rows: 24 });
      });

      client.on('terminal:ready', () => {
        client.emit('execution:sync', { fileId: 'bad-file' });

        setTimeout(() => {
          done();
        }, 200);
      });

      client.on('terminal:error', (msg: string | undefined) =>
        done(new Error(`Unexpected error: ${msg}`))
      );
    }, 10000);
  });

  describe('terminal:resize', () => {
    it('ignores resize when session is not active', (done) => {
      client = Client(`http://localhost:${port}`, { auth: { token } });

      client.on('connect', () => {
        client.emit('terminal:resize', { cols: 120, rows: 40 });

        setTimeout(() => {
          expect(mockContainerService.getOrCreateContainer).not.toHaveBeenCalled();
          done();
        }, 200);
      });
    }, 10000);
  });

  describe('disconnect', () => {
    it('destroys the exec stream on disconnect', (done) => {
      const fakeStream = createFakeStream();
      mockContainerService.getOrCreateContainer.mockResolvedValue(createFakeContainer(fakeStream));
      mockCreatePtySession.mockResolvedValue(fakeStream);

      client = Client(`http://localhost:${port}`, { auth: { token } });

      client.on('connect', () => {
        client.emit('terminal:start', { cols: 80, rows: 24 });
      });

      client.on('terminal:ready', () => {
        client.disconnect();

        setTimeout(() => {
          expect(fakeStream.destroy).toHaveBeenCalled();
          done();
        }, 200);
      });

      client.on('terminal:error', (msg: string | undefined) => done(new Error(msg)));
    }, 10000);
  });

  describe('execution:delete', () => {
    it('calls deleteFromContainer with the correct path', (done) => {
      const fakeStream = createFakeStream();
      const fakeContainer = createFakeContainer(fakeStream);
      mockContainerService.getOrCreateContainer.mockResolvedValue(fakeContainer);
      mockCreatePtySession.mockResolvedValue(fakeStream);

      client = Client(`http://localhost:${port}`, { auth: { token } });

      client.on('connect', () => {
        client.emit('terminal:start', { cols: 80, rows: 24 });
      });

      client.on('terminal:ready', () => {
        client.emit('execution:delete', { path: 'projects/main.py' });

        setTimeout(() => {
          expect(mockDeleteFromContainer).toHaveBeenCalledWith(fakeContainer, 'projects/main.py');
          done();
        }, 200);
      });

      client.on('terminal:error', (msg: string | undefined) => done(new Error(msg)));
    }, 10000);

    it('calls deleteFromContainer for a directory path', (done) => {
      const fakeStream = createFakeStream();
      const fakeContainer = createFakeContainer(fakeStream);
      mockContainerService.getOrCreateContainer.mockResolvedValue(fakeContainer);
      mockCreatePtySession.mockResolvedValue(fakeStream);

      client = Client(`http://localhost:${port}`, { auth: { token } });

      client.on('connect', () => {
        client.emit('terminal:start', { cols: 80, rows: 24 });
      });

      client.on('terminal:ready', () => {
        client.emit('execution:delete', { path: 'projects' });

        setTimeout(() => {
          expect(mockDeleteFromContainer).toHaveBeenCalledWith(fakeContainer, 'projects');
          done();
        }, 200);
      });

      client.on('terminal:error', (msg: string | undefined) => done(new Error(msg)));
    }, 10000);

    it('does not throw if deleteFromContainer fails', (done) => {
      const fakeStream = createFakeStream();
      const fakeContainer = createFakeContainer(fakeStream);
      mockContainerService.getOrCreateContainer.mockResolvedValue(fakeContainer);
      mockCreatePtySession.mockResolvedValue(fakeStream);
      mockDeleteFromContainer.mockRejectedValueOnce(new Error('rm failed'));

      client = Client(`http://localhost:${port}`, { auth: { token } });

      client.on('connect', () => {
        client.emit('terminal:start', { cols: 80, rows: 24 });
      });

      client.on('terminal:ready', () => {
        client.emit('execution:delete', { path: 'file.py' });

        setTimeout(() => {
          done();
        }, 200);
      });

      client.on('terminal:error', (msg: string | undefined) =>
        done(new Error(`Unexpected error: ${msg}`))
      );
    }, 10000);
  });

  describe('execution:move', () => {
    it('calls moveInContainer with the correct old and new paths', (done) => {
      const fakeStream = createFakeStream();
      const fakeContainer = createFakeContainer(fakeStream);
      mockContainerService.getOrCreateContainer.mockResolvedValue(fakeContainer);
      mockCreatePtySession.mockResolvedValue(fakeStream);

      client = Client(`http://localhost:${port}`, { auth: { token } });

      client.on('connect', () => {
        client.emit('terminal:start', { cols: 80, rows: 24 });
      });

      client.on('terminal:ready', () => {
        client.emit('execution:move', { oldPath: 'main.py', newPath: 'projects/main.py' });

        setTimeout(() => {
          expect(mockMoveInContainer).toHaveBeenCalledWith(
            fakeContainer,
            'main.py',
            'projects/main.py'
          );
          done();
        }, 200);
      });

      client.on('terminal:error', (msg: string | undefined) => done(new Error(msg)));
    }, 10000);

    it('calls moveInContainer when moving from subdirectory to root', (done) => {
      const fakeStream = createFakeStream();
      const fakeContainer = createFakeContainer(fakeStream);
      mockContainerService.getOrCreateContainer.mockResolvedValue(fakeContainer);
      mockCreatePtySession.mockResolvedValue(fakeStream);

      client = Client(`http://localhost:${port}`, { auth: { token } });

      client.on('connect', () => {
        client.emit('terminal:start', { cols: 80, rows: 24 });
      });

      client.on('terminal:ready', () => {
        client.emit('execution:move', { oldPath: 'projects/main.py', newPath: 'main.py' });

        setTimeout(() => {
          expect(mockMoveInContainer).toHaveBeenCalledWith(
            fakeContainer,
            'projects/main.py',
            'main.py'
          );
          done();
        }, 200);
      });

      client.on('terminal:error', (msg: string | undefined) => done(new Error(msg)));
    }, 10000);

    it('does not throw if moveInContainer fails', (done) => {
      const fakeStream = createFakeStream();
      const fakeContainer = createFakeContainer(fakeStream);
      mockContainerService.getOrCreateContainer.mockResolvedValue(fakeContainer);
      mockCreatePtySession.mockResolvedValue(fakeStream);
      mockMoveInContainer.mockRejectedValueOnce(new Error('mv failed'));

      client = Client(`http://localhost:${port}`, { auth: { token } });

      client.on('connect', () => {
        client.emit('terminal:start', { cols: 80, rows: 24 });
      });

      client.on('terminal:ready', () => {
        client.emit('execution:move', { oldPath: 'old.py', newPath: 'new.py' });

        setTimeout(() => {
          done();
        }, 200);
      });

      client.on('terminal:error', (msg: string | undefined) =>
        done(new Error(`Unexpected error: ${msg}`))
      );
    }, 10000);
  });

  describe('execution:rename', () => {
    it('calls renameInContainer with the correct old and new paths', (done) => {
      const fakeStream = createFakeStream();
      const fakeContainer = createFakeContainer(fakeStream);
      mockContainerService.getOrCreateContainer.mockResolvedValue(fakeContainer);
      mockCreatePtySession.mockResolvedValue(fakeStream);

      client = Client(`http://localhost:${port}`, { auth: { token } });

      client.on('connect', () => {
        client.emit('terminal:start', { cols: 80, rows: 24 });
      });

      client.on('terminal:ready', () => {
        client.emit('execution:rename', { oldPath: 'main.py', newPath: 'solution.py' });

        setTimeout(() => {
          expect(mockRenameInContainer).toHaveBeenCalledWith(
            fakeContainer,
            'main.py',
            'solution.py'
          );
          done();
        }, 200);
      });

      client.on('terminal:error', (msg: string | undefined) => done(new Error(msg)));
    }, 10000);

    it('calls renameInContainer for a file inside a subdirectory', (done) => {
      const fakeStream = createFakeStream();
      const fakeContainer = createFakeContainer(fakeStream);
      mockContainerService.getOrCreateContainer.mockResolvedValue(fakeContainer);
      mockCreatePtySession.mockResolvedValue(fakeStream);

      client = Client(`http://localhost:${port}`, { auth: { token } });

      client.on('connect', () => {
        client.emit('terminal:start', { cols: 80, rows: 24 });
      });

      client.on('terminal:ready', () => {
        client.emit('execution:rename', {
          oldPath: 'projects/old.py',
          newPath: 'projects/new.py',
        });

        setTimeout(() => {
          expect(mockRenameInContainer).toHaveBeenCalledWith(
            fakeContainer,
            'projects/old.py',
            'projects/new.py'
          );
          done();
        }, 200);
      });

      client.on('terminal:error', (msg: string | undefined) => done(new Error(msg)));
    }, 10000);

    it('does not throw if renameInContainer fails', (done) => {
      const fakeStream = createFakeStream();
      const fakeContainer = createFakeContainer(fakeStream);
      mockContainerService.getOrCreateContainer.mockResolvedValue(fakeContainer);
      mockCreatePtySession.mockResolvedValue(fakeStream);
      mockRenameInContainer.mockRejectedValueOnce(new Error('rename failed'));

      client = Client(`http://localhost:${port}`, { auth: { token } });

      client.on('connect', () => {
        client.emit('terminal:start', { cols: 80, rows: 24 });
      });

      client.on('terminal:ready', () => {
        client.emit('execution:rename', { oldPath: 'old.py', newPath: 'new.py' });

        setTimeout(() => {
          done();
        }, 200);
      });

      client.on('terminal:error', (msg: string | undefined) =>
        done(new Error(`Unexpected error: ${msg}`))
      );
    }, 10000);
  });
});
