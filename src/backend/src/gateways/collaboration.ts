/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Namespace, Socket } from 'socket.io';
import * as Y from 'yjs';
import { fileRepository } from '../repositories/file';
import { fileService } from '../services/file';
import { saveDocState, loadDocState } from '../config/redis';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  SocketData,
  CollaborationSession,
  ManagedDoc,
  CollaboratorInfo,
} from '../types/collaboration';

type CollaborationSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;

const docStore = new Map<string, ManagedDoc>();
const docOwnership = new Map<string, { userId: string }>();

function getUserColour(userId: string): string {
  const colours = [
    '#F87171',
    '#FB923C',
    '#FBBF24',
    '#34D399',
    '#38BDF8',
    '#818CF8',
    '#E879F9',
    '#F472B6',
  ];
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colours[Math.abs(hash) % colours.length];
}

async function getOrCreateDoc(fileId: string): Promise<ManagedDoc> {
  if (!docStore.has(fileId)) {
    const doc = new Y.Doc();

    //Try to load previously saved state from Redis
    const savedState = await loadDocState(fileId);
    if (savedState) {
      Y.applyUpdate(doc, savedState);
      console.log(`Restored doc from Redis for fileId:${fileId}`);
    }

    docStore.set(fileId, {
      doc,
      connectedUsers: new Map(),
      persistTimer: null,
    });
  }
  return docStore.get(fileId)!;
}

async function persistDocToStorage(fileId: string, doc: Y.Doc): Promise<void> {
  try {
    const ownership = docOwnership.get(fileId);
    if (!ownership) {
      console.warn(`No ownership info for fileId:${fileId}, skipping MinIO persist`);
      return;
    }

    //Get text content from the shared Yjs text type
    const yText = doc.getText('content');
    const content = yText.toString();

    if (!content && content.length === 0) {
      console.log(`Empty doc for fileId:${fileId}, skipping MinIO persist`);
      return;
    }

    await fileService.updateFile(fileId, ownership.userId, { content });
    console.log(
      `[Collaboration] Persisted to MinIO for fileId:${fileId} (${content.length} chars)`
    );
  } catch (err: any) {
    //Non-fatal — Redis still has the state as backup
    console.error(`Failed to persist to MinIO for fileId:${fileId}:`, err.message);
  }
}

async function cleanupDoc(fileId: string): Promise<void> {
  const managed = docStore.get(fileId);
  if (!managed) return;
  if (managed.connectedUsers.size === 0) {
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const rechecked = docStore.get(fileId);
    if (!rechecked || rechecked.connectedUsers.size > 0) {
      console.log(`Cleanup aborted for fileId:${fileId} — user rejoined`);
      return;
    }

    if (rechecked.persistTimer) clearTimeout(rechecked.persistTimer);

    await persistDocToStorage(fileId, rechecked.doc);
    const finalState = Y.encodeStateAsUpdate(rechecked.doc);
    await saveDocState(fileId, finalState);
    console.log(`Saved doc to Redis for fileId:${fileId}`);

    rechecked.doc.destroy();
    docStore.delete(fileId);
    docOwnership.delete(fileId);
    console.log(`Doc destroyed for fileId:${fileId}`);
  }
}

function broadcastUserList(
  io: Namespace<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>,
  roomName: string,
  fileId: string
): void {
  const managed = docStore.get(fileId);
  if (!managed) return;

  const users: CollaboratorInfo[] = Array.from(managed.connectedUsers.entries()).map(
    ([uid, name]) => ({
      userId: uid,
      name: name,
      colour: getUserColour(uid),
    })
  );

  io.to(roomName).emit('collaboration:users', users);
}

async function leaveCurrentRoom(
  socket: CollaborationSocket,
  session: CollaborationSession,
  io: Namespace<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>
): Promise<void> {
  if (!session.fileId) return;

  const fileId = session.fileId;
  const roomName = `collab:${fileId}`;
  const managed = docStore.get(fileId);

  if (managed) {
    managed.connectedUsers.delete(session.userId);
  }

  await socket.leave(roomName);
  session.fileId = null;

  broadcastUserList(io, roomName, fileId);
  await cleanupDoc(fileId);

  console.log(`userId:${session.userId} left fileId:${fileId}`);
}

export function registerCollaborationGateway(
  io: Namespace<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>
): void {
  io.on('connection', (socket: CollaborationSocket) => {
    const session: CollaborationSession = {
      userId: socket.data.userId,
      userName: socket.data.userName ?? 'Unknown',
      colour: getUserColour(socket.data.userId),
      socketId: socket.id,
      fileId: null,
    };

    console.log(`Connected userId:${session.userId} socketId:${session.socketId}`);

    socket.on('collaboration:join', async ({ fileId }) => {
      if (!fileId || typeof fileId !== 'string') {
        socket.emit('collaboration:error', 'fileId is required');
        return;
      }

      if (socket.data.activeClosedBookExamId) {
        socket.emit('collaboration:error', 'File access is restricted during a closed-book exam');
        return;
      }

      const hasAccess = await fileRepository.canUserAccessFile(fileId, session.userId);
      if (!hasAccess) {
        socket.emit(
          'collaboration:error',
          'Access denied: you do not have permission to access this file'
        );
        return;
      }

      if (session.fileId) {
        await leaveCurrentRoom(socket, session, io);
      }

      session.fileId = fileId;
      const roomName = `collab:${fileId}`;

      const managed = await getOrCreateDoc(fileId);
      managed.connectedUsers.set(session.userId, session.userName);

      if (!docOwnership.has(fileId)) {
        docOwnership.set(fileId, { userId: session.userId });
      }

      const yText = managed.doc.getText('content');
      if (yText.toString().trim() === '') {
        try {
          const file = await fileRepository.findByIdWithoutOwnership(fileId);
          if (file && !file.isDirectory && file.storageKey) {
            const contentBuffer = await fileService.getFileContent(fileId, session.userId);
            const content = contentBuffer.toString('utf-8');
            if (content.trim()) {
              managed.doc.transact(() => {
                yText.delete(0, yText.length);
                yText.insert(0, content);
              });
              console.log(`Loaded file content from MinIO for fileId:${fileId}`);

              const updatedState = Y.encodeStateAsUpdate(managed.doc);
              io.to(roomName).emit('collaboration:update', { update: Array.from(updatedState) });
            }
          }
        } catch (err: any) {
          console.warn(`Could not load initial content for fileId:${fileId}:`, err.message);
        }
      }

      await socket.join(roomName);

      const currentState = Y.encodeStateAsUpdate(managed.doc);
      socket.emit('collaboration:synced', {
        update: Array.from(currentState),
      });

      broadcastUserList(io, roomName, fileId);
      console.log(`userId:${session.userId} joined fileId:${fileId}`);
    });

    socket.on('collaboration:update', ({ update }) => {
      if (!session.fileId) return;

      const managed = docStore.get(session.fileId);
      if (!managed) return;

      if (!update || !Array.isArray(update) || update.length === 0) {
        socket.emit('collaboration:error', 'Invalid update payload');
        return;
      }

      try {
        const uint8 = new Uint8Array(update);
        Y.applyUpdate(managed.doc, uint8);

        const roomName = `collab:${session.fileId}`;
        socket.to(roomName).emit('collaboration:update', { update });

        if (managed.persistTimer) clearTimeout(managed.persistTimer);
        managed.persistTimer = setTimeout(async () => {
          const state = Y.encodeStateAsUpdate(managed.doc);
          await saveDocState(session.fileId!, state);
          console.log(`Persisted to Redis for fileId:${session.fileId}`);
        }, 5000);
      } catch (err: any) {
        console.warn(`Invalid Yjs update from userId:${session.userId} — ${err.message}`);
        socket.emit('collaboration:error', 'Invalid update: malformed Yjs data');
      }
    });

    socket.on('collaboration:awareness', ({ update }) => {
      if (!session.fileId) return;
      const roomName = `collab:${session.fileId}`;
      socket.to(roomName).emit('collaboration:awareness', { update });
    });

    socket.on('collaboration:leave', async () => {
      await leaveCurrentRoom(socket, session, io);
    });

    socket.on('collaboration:kick', async (fileId: string) => {
      const ownership = docOwnership.get(fileId);
      if (!ownership || ownership.userId !== session.userId) {
        socket.emit('collaboration:error', 'Only the file owner can end the session');
        return;
      }

      const roomName = `collab:${fileId}`;
      const managed = docStore.get(fileId);

      if (managed) {
        await persistDocToStorage(fileId, managed.doc);
      }

      socket.to(roomName).emit('collaboration:kicked', 'The owner has ended the session');

      const sockets = await io.in(roomName).fetchSockets();
      for (const s of sockets) {
        if (s.id !== socket.id) {
          s.leave(roomName);
        }
      }

      broadcastUserList(io, roomName, fileId);
    });

    socket.on('disconnect', async () => {
      console.log(`Disconnected userId:${session.userId} socketId:${session.socketId}`);
      await leaveCurrentRoom(socket, session, io);
    });
  });
}
