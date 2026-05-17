/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Server, Socket } from 'socket.io';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  SocketData,
  TerminalSession,
} from '../types/terminal';
import type { Duplex } from 'stream';
import { containerService } from '../services/container';
import { createPtySession } from '../services/terminal';
import {
  syncWorkspaceToContainer,
  syncSingleFileToContainer,
  deleteFromContainer,
  renameInContainer,
  moveInContainer,
} from '../services/execution';
import { getActiveClosedBookExam } from '../middleware/exam';

type TerminalSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;

const FLUSH_INTERVAL_MS = 16; // ~60fps

function createOutputBuffer(socket: TerminalSocket) {
  let buffer = '';
  let flushTimer: ReturnType<typeof setTimeout> | null = null;

  const flush = () => {
    if (buffer) {
      socket.emit('terminal:output', buffer);
      buffer = '';
    }
    flushTimer = null;
  };

  const write = (chunk: string) => {
    buffer += chunk;
    if (!flushTimer) {
      flushTimer = setTimeout(flush, FLUSH_INTERVAL_MS);
    }
  };

  const destroy = () => {
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    flush();
  };

  return { write, destroy };
}

export function registerTerminalGateway(
  io: Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>
): void {
  io.on('connection', (socket: TerminalSocket) => {
    const session: TerminalSession = {
      userId: socket.data.userId,
      socketId: socket.id,
      execStream: null,
      isActive: false,
    };

    console.log(`Terminal connected: userId=${session.userId} socketId=${session.socketId}`);

    socket.on('terminal:start', async (payload) => {
      if (session.isActive) {
        socket.emit('terminal:error', 'Terminal session already running');
        return;
      }

      try {
        const container = await containerService.getOrCreateContainer(session.userId);

        const outputBuffer = createOutputBuffer(socket);
        session.execStream = (await createPtySession(container, payload)) as Duplex;
        session.isActive = true;

        session.execStream.on('data', (chunk: Buffer) => {
          outputBuffer.write(chunk.toString('utf8'));
        });

        session.execStream.on('end', () => {
          outputBuffer.destroy();
          session.isActive = false;
          socket.emit('terminal:exit', 0);
        });

        session.execStream.on('error', (err: Error) => {
          outputBuffer.destroy();
          session.isActive = false;
          socket.emit('terminal:error', err.message);
        });

        socket.emit('terminal:ready');

        syncWorkspaceToContainer(container, session.userId).catch((err) => {
          console.warn(`Background sync failed for userId=${session.userId}:`, err.message);
        });
      } catch (err: any) {
        socket.emit('terminal:error', `Failed to start terminal: ${err.message}`);
      }
    });

    socket.on('terminal:input', (payload) => {
      if (!session.execStream || !session.isActive) return;

      let input: string | undefined;
      if (typeof payload === 'string') {
        try {
          const parsed = JSON.parse(payload);
          input = parsed.data;
        } catch {
          input = payload;
        }
      } else {
        input = payload?.data;
      }

      if (!input) return;

      session.execStream.write(input);
      containerService.recordActivity(session.userId);
    });

    socket.on('execution:sync', async (payload) => {
      try {
        if (socket.data.role === 'STUDENT') {
          const blockedExamId = await getActiveClosedBookExam(session.userId);
          if (blockedExamId) {
            console.warn(
              `Blocked execution:sync for userId:${session.userId} — closed-book exam:${blockedExamId}`
            );
            socket.emit('terminal:error', 'File sync is not allowed during a closed-book exam');
            return;
          }
        }

        const container = await containerService.getOrCreateContainer(session.userId);
        await syncSingleFileToContainer(container, payload.fileId, session.userId);
      } catch (err: any) {
        console.warn(`File sync failed for userId=${session.userId}:`, err.message);
      }
    });

    socket.on('execution:delete', async (payload: { path: string }) => {
      try {
        if (socket.data.role === 'STUDENT') {
          const blockedExamId = await getActiveClosedBookExam(session.userId);
          if (blockedExamId) {
            socket.emit('terminal:error', 'File operations not allowed during a closed-book exam');
            return;
          }
        }

        const container = await containerService.getOrCreateContainer(session.userId);
        await deleteFromContainer(container, payload.path);
        console.log(`Deleted from container: ${payload.path} userId=${session.userId}`);
      } catch (err: any) {
        console.warn(`delete failed for userId=${session.userId}:`, err.message);
      }
    });

    socket.on('execution:move', async (payload: { oldPath: string; newPath: string }) => {
      try {
        if (socket.data.role === 'STUDENT') {
          const blockedExamId = await getActiveClosedBookExam(session.userId);
          if (blockedExamId) {
            socket.emit('terminal:error', 'File operations not allowed during a closed-book exam');
            return;
          }
        }

        const container = await containerService.getOrCreateContainer(session.userId);
        await moveInContainer(container, payload.oldPath, payload.newPath);
        console.log(
          `Moved in container: ${payload.oldPath} → ${payload.newPath} userId=${session.userId}`
        );
      } catch (err: any) {
        console.warn(`move failed for userId=${session.userId}:`, err.message);
      }
    });

    socket.on('execution:rename', async (payload: { oldPath: string; newPath: string }) => {
      try {
        if (socket.data.role === 'STUDENT') {
          const blockedExamId = await getActiveClosedBookExam(session.userId);
          if (blockedExamId) {
            socket.emit('terminal:error', 'File operations not allowed during a closed-book exam');
            return;
          }
        }

        const container = await containerService.getOrCreateContainer(session.userId);
        await renameInContainer(container, payload.oldPath, payload.newPath);
        console.log(
          `Renamed in container: ${payload.oldPath} → ${payload.newPath} userId=${session.userId}`
        );
      } catch (err: any) {
        console.warn(`rename failed for userId=${session.userId}:`, err.message);
      }
    });

    socket.on('execution:stop', () => {
      if (!session.execStream || !session.isActive) return;
      session.execStream.write('\x03');
      containerService.recordActivity(session.userId);
    });

    socket.on('terminal:resize', async (payload) => {
      if (!session.isActive) return;
      try {
        const container = await containerService.getOrCreateContainer(session.userId);
        const exec = await container.exec({
          Cmd: [],
          AttachStdin: false,
          AttachStdout: false,
          Tty: true,
        });
        await (exec as any).resize({ w: payload.cols, h: payload.rows });
      } catch {
        // Not fatal
      }
    });

    socket.on('disconnect', () => {
      console.log(`Terminal disconnected: userId=${session.userId} socketId=${session.socketId}`);
      if (session.execStream) {
        session.execStream.destroy();
        session.execStream = null;
      }
      session.isActive = false;
    });
  });
}
